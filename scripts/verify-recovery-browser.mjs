import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { resolveServiceKey } from "./service-key.mjs";

loadEnv(".env.local");
loadEnv(".env");

const appUrl = process.env.STRATA_BROWSER_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = resolveServiceKey();
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const marker = `recovery-browser-${Date.now()}`;
const recoveryEmail = `${marker}@example.com`;
const originalPassword = "RecoveryBrowserOriginal123!";
const updatedPassword = "RecoveryBrowserUpdated123!";

if (!appUrl) {
  throw new Error("Set STRATA_BROWSER_URL to the fresh Preview URL for recovery verification.");
}

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and a valid server-side Supabase key for recovery verification.");
}

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function loadEnv(file) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function withBypass(target) {
  if (!bypassSecret) return target;

  const url = new URL(target);
  url.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return url.toString();
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanup(userId) {
  const errors = [];
  const attempts = [
    ["audit cleanup", () => must("audit cleanup", service.from("audit_log").delete().eq("target", recoveryEmail))],
    ["member cleanup", () => must("member cleanup", service.from("members").delete().eq("email", recoveryEmail))],
  ];

  if (userId) {
    attempts.push([
      "Auth user cleanup",
      () => must("Auth user cleanup", service.auth.admin.deleteUser(userId)),
    ]);
  }

  for (const [label, attempt] of attempts) {
    try {
      await attempt();
    } catch (error) {
      errors.push(new Error(`${label}: ${error instanceof Error ? error.message : "unknown cleanup failure"}`));
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, "Recovery browser cleanup failed.");
  }
}

async function setupRecoveryMember() {
  const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
  const adminMember = await must(
    "admin committee lookup",
    service
      .from("members")
      .select("committee_id")
      .eq("email", adminEmail.toLowerCase())
      .eq("status", "active")
      .single(),
  );
  const auth = await must(
    "recovery Auth user creation",
    service.auth.admin.createUser({
      email: recoveryEmail,
      password: originalPassword,
      email_confirm: true,
      user_metadata: { verification_marker: marker },
    }),
  );
  userId = auth.user.id;

  await must(
    "recovery member creation",
    service.from("members").insert({
      committee_id: adminMember.committee_id,
      user_id: auth.user.id,
      email: recoveryEmail,
      full_name: "Recovery Browser Member",
      role: "member",
      status: "active",
      access_level: "member",
      accepted_at: new Date().toISOString(),
    }),
  );

}

async function getRecoveryActionLink() {
  const recoveryUrl = new URL("/recover", appUrl).toString();
  const generated = await must(
    "recovery link generation",
    service.auth.admin.generateLink({
      type: "recovery",
      email: recoveryEmail,
      options: { redirectTo: recoveryUrl },
    }),
  );

  if (generated.properties.redirect_to !== recoveryUrl) {
    throw new Error("Supabase did not preserve the fixed Preview recovery redirect.");
  }

  return generated.properties.action_link;
}

let browser;
let userId;
let actionLink;
let primaryError;
const observations = {
  callbackReached: false,
  updateFormShown: false,
  passwordUpdated: false,
  localSessionCleared: false,
  newPasswordSignsIn: false,
  cleanupComplete: false,
};

try {
  await setupRecoveryMember();
  actionLink = await getRecoveryActionLink();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(withBypass(appUrl), { waitUntil: "networkidle" });
  await page.goto(actionLink, { waitUntil: "networkidle" });
  observations.callbackReached = new URL(page.url()).pathname === "/recover";

  await page.getByRole("heading", { name: "Reset your password" }).waitFor({ timeout: 30000 });
  const newPasswordInput = page.getByLabel("New password", { exact: true });
  await newPasswordInput.waitFor({ timeout: 30000 });
  observations.updateFormShown = true;

  await newPasswordInput.fill(updatedPassword);
  await page.getByLabel("Confirm new password").fill(updatedPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByText("Password updated. Sign in again with your new password.").waitFor({ timeout: 30000 });
  observations.passwordUpdated = true;
  observations.localSessionCleared = true;

  await page.getByRole("link", { name: "Return to sign in" }).click();
  await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor({ timeout: 30000 });
  await page.getByLabel("Email").fill(recoveryEmail);
  await page.getByLabel("Password").fill(updatedPassword);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.getByRole("banner").getByText(recoveryEmail).waitFor({ timeout: 30000 });
  observations.newPasswordSignsIn = true;
} catch (error) {
  const sensitiveValues = [actionLink, serviceKey, bypassSecret].filter(Boolean);
  let message = error instanceof Error ? error.message : "Recovery browser verification failed.";
  for (const sensitive of sensitiveValues) message = message.replaceAll(sensitive, "[REDACTED]");
  primaryError = new Error(message);
} finally {
  if (browser) await browser.close();

  try {
    await cleanup(userId);
    observations.cleanupComplete = true;
  } catch (cleanupError) {
    primaryError = primaryError
      ? new AggregateError([primaryError, cleanupError], "Recovery verification and cleanup failed.")
      : cleanupError;
  }
}

if (primaryError) throw primaryError;

const ok = Object.values(observations).every(Boolean);
console.log(JSON.stringify({ ok, observations }, null, 2));
if (!ok) process.exitCode = 1;

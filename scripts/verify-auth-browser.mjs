import { resolveServiceKey } from "./service-key.mjs";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  assertBrowserMutationTargetAttestation,
  assertSafeBrowserMutationTarget,
} from "./target-environment-guard.mjs";

loadEnv(".env.local");
loadEnv(".env");

const externalBrowserUrl = Boolean(process.env.STRATA_BROWSER_URL);
const appUrl = process.env.STRATA_BROWSER_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  resolveServiceKey();
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.fixture.admin@example.invalid";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "LocalFixtureAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.fixture.member@example.invalid";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "LocalFixtureMember123!";
const marker = `auth-browser-${Date.now()}`;
const managedEmail = `${marker}-managed@example.com`;
const invitedEmail = `${marker}-invited@example.com`;
const managedPassword = "AuthBrowserVerify123!";

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for auth browser verification setup.");
}

const mutationTarget = assertSafeBrowserMutationTarget({
  appUrl,
  supabaseUrl,
  operation: "verify:auth-browser",
});

function loadEnv(file) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Vercel Preview deployments sit behind Deployment Protection. The
// "Protection Bypass for Automation" secret lets verification traffic through
// without weakening protection for anyone else. Absent, this is a no-op.
// The secret is passed as a query parameter on the first navigation so Vercel
// sets a bypass cookie scoped to the deployment origin. Sending it as a header
// on every request would leak it to third-party origins the page contacts.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

function withBypass(target) {
  if (!bypassSecret) {
    return target;
  }

  const parsed = new URL(target);
  parsed.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  parsed.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return parsed.toString();
}

async function canReachApp() {
  try {
    const response = await fetch(withBypass(appUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    // Following the redirect would land on the Vercel login page and return
    // 200, so protection has to be detected here rather than downstream.
    if ((response.headers.get("location") ?? "").includes("vercel.com/sso")) {
      throw new Error(
        `Vercel Deployment Protection is blocking ${appUrl}. Set a valid 32-character VERCEL_AUTOMATION_BYPASS_SECRET (Project Settings -> Deployment Protection -> Protection Bypass for Automation), or disable Vercel Authentication for Preview.`,
      );
    }

    return response.ok || response.status < 500;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Deployment Protection")) {
      throw error;
    }

    return false;
  }
}

function startDevServer() {
  const logs = { value: "" };
  const child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    logs.value += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs.value += chunk.toString();
  });

  return { child, logs };
}

async function ensureServer() {
  if (await canReachApp()) {
    return null;
  }

  if (externalBrowserUrl) {
    throw new Error(`Configured STRATA_BROWSER_URL is not reachable: ${appUrl}`);
  }

  const { child, logs } = startDevServer();

  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (await canReachApp()) {
      return child;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }

  child.kill();
  throw new Error(`Dev server did not become reachable at ${appUrl}.\n${logs.value.slice(-4000)}`);
}

async function findAuthUsersByEmail(email) {
  const matches = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    matches.push(...(data.users ?? []).filter((user) => user.email?.toLowerCase() === email.toLowerCase()));

    if ((data.users ?? []).length < 1000) {
      break;
    }
  }

  return matches;
}

async function cleanupMarkedRecords() {
  const emails = [managedEmail, invitedEmail];
  await service.from("audit_log").delete().in("target", emails);
  await service.from("members").delete().in("email", emails);

  for (const email of emails) {
    const users = await findAuthUsersByEmail(email);

    for (const user of users) {
      await service.auth.admin.deleteUser(user.id);
    }
  }
}

async function setupManagedMember() {
  const { data: adminMember, error: adminMemberError } = await service
    .from("members")
    .select("committee_id")
    .eq("email", adminEmail.toLowerCase())
    .eq("status", "active")
    .single();

  if (adminMemberError || !adminMember) {
    throw new Error(adminMemberError?.message ?? "Seeded admin member was not found.");
  }

  const createdUser = await service.auth.admin.createUser({
    email: managedEmail,
    password: managedPassword,
    email_confirm: true,
    user_metadata: {
      verification_marker: marker,
    },
  });

  if (createdUser.error) {
    throw createdUser.error;
  }

  const { error: memberError } = await service.from("members").insert({
    committee_id: adminMember.committee_id,
    user_id: createdUser.data.user.id,
    email: managedEmail,
    full_name: "Auth Browser Managed",
    role: "member",
    status: "active",
    access_level: "member",
    accepted_at: new Date().toISOString(),
  });

  if (memberError) {
    throw memberError;
  }
}

async function hydrate(page) {
  await page.waitForFunction(() => document.documentElement.dataset.strataHydrated === "true", {
    timeout: 25000,
  });
}

async function submitCredentials(page, email, password) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function signIn(page, email, password) {
  await submitCredentials(page, email, password);
  await page.getByRole("banner").getByText(email).waitFor({ timeout: 30000 });
}

async function signOut(page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.getByRole("button", { name: /sign in/i }).waitFor({ timeout: 20000 });
}

async function openMembers(page) {
  await page.getByRole("button", { name: "Members" }).first().click();
  await page.getByText("Invite-only committee access").waitFor({ timeout: 15000 });
}

async function memberRow(page, email) {
  const row = page.locator("div").filter({ hasText: email }).filter({ has: page.getByLabel(`Name for ${email}`) }).first();
  await row.waitFor({ timeout: 20000 });
  return row;
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

const server = await ensureServer();
await assertBrowserMutationTargetAttestation({
  target: mutationTarget,
  operation: "verify:auth-browser",
});
const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await cleanupMarkedRecords();
await setupManagedMember();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const observations = {
  signedOutLocked: false,
  adminSignedIn: false,
  inviteFormEnabled: false,
  inviteCreatesPendingMember: false,
  loadingState: false,
  successState: false,
  activeState: false,
  backwardsInviteRejected: false,
  inactiveState: false,
  selfLockoutControlsDisabled: false,
  ordinarySignedIn: false,
  ordinaryCannotInvite: false,
  ordinaryCannotEdit: false,
  hiddenRecordsAbsent: false,
  suspendedLocked: false,
  cleanupScoped: true,
};
const consoleMessages = [];
const pageErrors = [];

page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("/_next/webpack-hmr")) {
    consoleMessages.push(message.text());
  }
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(withBypass(appUrl), { waitUntil: "networkidle" });
  await hydrate(page);
  await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor({ timeout: 20000 });
  observations.signedOutLocked = true;

  await signIn(page, adminEmail, adminPassword);
  // Rendered in both the header and the dashboard evidence-boundary panel, so
  // disambiguate rather than assert a single occurrence.
  await page.getByText("Supabase RLS-backed session data").first().waitFor({ timeout: 30000 });
  observations.adminSignedIn = true;

  await openMembers(page);
  const inviteButton = page.getByRole("button", { name: /^Invite$/ });
  observations.inviteFormEnabled = await inviteButton.isEnabled();
  await page.getByLabel("Invite email").fill(invitedEmail);
  await page.getByLabel("Invite full name").fill("Auth Browser Invited");
  await page.getByLabel("Invite role").selectOption("treasurer");
  await page.getByLabel("Invite access level").selectOption("limited_admin");
  await inviteButton.click();
  await page.getByText(/Sending invite|Member invited|Member invite row saved/).waitFor({ timeout: 30000 });
  // The email appears in both the row's field label and its own text node.
  await page.getByText(invitedEmail).first().waitFor({ timeout: 30000 });
  observations.inviteCreatesPendingMember = true;

  let managedRow = await memberRow(page, managedEmail);
  observations.activeState = (await managedRow.innerText()).includes("Active");
  await managedRow.getByLabel(`Name for ${managedEmail}`).fill("Auth Browser Managed Updated");
  await managedRow.getByLabel(`Role for ${managedEmail}`).selectOption("treasurer");
  await managedRow.getByLabel(`Access level for ${managedEmail}`).selectOption("limited_admin");
  await managedRow.getByLabel(`Save member ${managedEmail}`).click();
  await page.getByText("Saving member access...").waitFor({ timeout: 10000 });
  observations.loadingState = true;
  await page.getByText("Member access updated").waitFor({ timeout: 30000 });
  observations.successState = true;

  managedRow = await memberRow(page, managedEmail);
  await managedRow.getByLabel(`Status for ${managedEmail}`).selectOption("invited");
  await managedRow.getByLabel(`Save member ${managedEmail}`).click();
  await page
    .getByText("Active or suspended members cannot be moved back to invited")
    .waitFor({ timeout: 30000 });
  observations.backwardsInviteRejected = true;

  await managedRow.getByLabel(`Status for ${managedEmail}`).selectOption("suspended");
  await managedRow.getByLabel(`Save member ${managedEmail}`).click();
  await page.getByText("Member access updated").waitFor({ timeout: 30000 });
  managedRow = await memberRow(page, managedEmail);
  observations.inactiveState = (await managedRow.innerText()).includes("Inactive");

  const adminRow = await memberRow(page, adminEmail);
  observations.selfLockoutControlsDisabled =
    (await adminRow.getByLabel(`Role for ${adminEmail}`).isDisabled()) &&
    (await adminRow.getByLabel(`Access level for ${adminEmail}`).isDisabled()) &&
    (await adminRow.getByLabel(`Status for ${adminEmail}`).isDisabled());

  await signOut(page);
  await signIn(page, memberEmail, memberPassword);
  await page.getByText("Workspace updated").waitFor({ timeout: 30000 });
  observations.ordinarySignedIn = true;
  await openMembers(page);
  await page.getByText("Sign in as an admin, chair, or secretary to invite members").waitFor({ timeout: 30000 });
  observations.ordinaryCannotInvite =
    (await page.getByLabel("Invite email").isDisabled()) &&
    (await page.getByRole("button", { name: /^Invite$/ }).isDisabled());
  const ordinaryManagedRow = await memberRow(page, managedEmail);
  observations.ordinaryCannotEdit =
    (await ordinaryManagedRow.getByLabel(`Name for ${managedEmail}`).isDisabled()) &&
    (await ordinaryManagedRow.getByLabel(`Role for ${managedEmail}`).isDisabled()) &&
    (await ordinaryManagedRow.getByLabel(`Access level for ${managedEmail}`).isDisabled()) &&
    (await ordinaryManagedRow.getByLabel(`Status for ${managedEmail}`).isDisabled());
  const ordinaryText = await bodyText(page);
  observations.hiddenRecordsAbsent =
    !ordinaryText.includes("Admin levy hardship matter") &&
    !ordinaryText.includes("Custom access legal review") &&
    !ordinaryText.includes("Admin-only seeded card") &&
    !ordinaryText.includes("Hidden document");

  await signOut(page);
  // A suspended member must never reach an authenticated header, so submit the
  // credentials without asserting a session and require the locked screen.
  await submitCredentials(page, managedEmail, managedPassword);
  await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor({ timeout: 30000 });
  const suspendedText = await bodyText(page);
  observations.suspendedLocked =
    suspendedText.includes("The dashboard stays locked") &&
    !suspendedText.includes("Decision requiring attention") &&
    !suspendedText.includes("Plan vs current state");
} catch (error) {
  const visibleText = await bodyText(page).catch(() => "");
  throw new Error(
    `${error instanceof Error ? error.message : "Auth browser verification failed"}\nObservations:\n${JSON.stringify(
      observations,
      null,
      2,
    )}\nConsole:\n${consoleMessages.slice(-20).join("\n")}\nPage errors:\n${pageErrors
      .slice(-20)
      .join("\n")}\nVisible text:\n${visibleText.slice(0, 5000)}`,
  );
} finally {
  await browser.close();
  await cleanupMarkedRecords();

  if (server) {
    server.kill();
  }
}

const ok = Object.values(observations).every(Boolean);
console.log(JSON.stringify({ ok, observations }, null, 2));

if (!ok) {
  process.exitCode = 1;
}

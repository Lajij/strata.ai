import { resolveServiceKey } from "./service-key.mjs";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env.local");
loadEnv(".env");

const externalBrowserUrl = Boolean(process.env.STRATA_BROWSER_URL);
const url = process.env.STRATA_BROWSER_URL ?? `http://127.0.0.1:${await getFreePort()}`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  resolveServiceKey();
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";
const marker = `verify-ai-browser-${new Date().toISOString()}`;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for AI browser verification cleanup.");
}

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
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

async function getFreePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolvePort(address.port);
          return;
        }

        reject(new Error("Could not allocate a free browser verification port."));
      });
    });
  });
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
    const response = await fetch(withBypass(url), {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    // Following the redirect would land on the Vercel login page and return
    // 200, so protection has to be detected here rather than downstream.
    if ((response.headers.get("location") ?? "").includes("vercel.com/sso")) {
      throw new Error(
        `Vercel Deployment Protection is blocking ${url}. Set a valid 32-character VERCEL_AUTOMATION_BYPASS_SECRET (Project Settings -> Deployment Protection -> Protection Bypass for Automation), or disable Vercel Authentication for Preview.`,
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

async function ensureServer() {
  if (externalBrowserUrl && (await canReachApp())) {
    return null;
  }

  if (externalBrowserUrl) {
    throw new Error(`Configured STRATA_BROWSER_URL is not reachable: ${url}`);
  }

  const port = new URL(url).port || "3210";
  let { child, logs } = startDevServer(port);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await canReachApp()) {
      return child;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }

  const stalePid = logs.value.match(/PID:\s+(\d+)/)?.[1];

  if (logs.value.includes("Another next dev server is already running") && stalePid) {
    process.kill(Number(stalePid), "SIGTERM");
    child.kill();
    await new Promise((resolveWait) => setTimeout(resolveWait, 2000));
    ({ child, logs } = startDevServer(port));

    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await canReachApp()) {
        return child;
      }

      await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
    }
  }

  child.kill();
  throw new Error(`Dev server did not become reachable at ${url}.\n${logs.value.slice(-4000)}`);
}

function startDevServer(port) {
  const logs = { value: "" };
  const hasProductionBuild = existsSync(resolve(process.cwd(), ".next/BUILD_ID"));
  const child = spawn(
    "npm",
    hasProductionBuild ? ["run", "start", "--", "--port", port] : ["run", "dev", "--", "--port", port, "--webpack"],
    {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    logs.value += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs.value += chunk.toString();
  });

  return { child, logs };
}

async function cleanupAiOutputs() {
  const { data, error } = await service.from("ai_outputs").select("id,output").limit(500);

  if (error) {
    throw error;
  }

  const ids = (data ?? [])
    .filter((row) => row.output && typeof row.output === "object" && row.output.verification_marker === marker)
    .map((row) => row.id);

  if (ids.length) {
    await service.from("ai_outputs").delete().in("id", ids);
  }
}

async function expectAiResult(page, label) {
  await page.getByText(/Fallback AI output ready|AI output ready/).last().waitFor({ timeout: 30000 });
  const text = await page.locator("body").innerText();

  for (const expected of ["mock ·", "Saved to ai_outputs", "General information only"]) {
    if (!text.includes(expected)) {
      throw new Error(`${label} did not show expected AI result text: ${expected}\nVisible page text:\n${text.slice(0, 5000)}`);
    }
  }
}

async function runCardAction(page, label) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).click();
  await page.getByText(new RegExp(`Running ${label.replace(/\s+/g, " ")}|Running`, "i")).waitFor({ timeout: 10000 });
  await expectAiResult(page, label);
}

const server = await ensureServer();
await cleanupAiOutputs();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const consoleMessages = [];
const pageErrors = [];
page.on("console", (message) => {
  if (
    (message.type() === "error" || message.type() === "warning") &&
    !message.text().includes("/_next/webpack-hmr")
  ) {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  pageErrors.push(error.message);
});
const observations = {
  signedIn: false,
  hiddenAbsent: false,
  cardBrief: false,
  threadSummary: false,
  quoteRisk: false,
  lawLookup: false,
  documentQa: false,
  budgetInsight: false,
  projectStatus: false,
  persistedRows: false,
};

try {
  await page.addInitScript((value) => {
    window.__STRATA_AI_VERIFICATION_MARKER__ = value;
  }, marker);

  await page.goto(withBypass(url), { waitUntil: "networkidle" });
  try {
    await page.waitForFunction(() => document.documentElement.dataset.strataHydrated === "true", {
      timeout: 20000,
    });
  } catch (error) {
    const resources = await page
      .evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => entry.name.includes("/_next/"))
          .map((entry) => ({ name: entry.name, duration: Math.round(entry.duration) }))
          .slice(-20),
      )
      .catch(() => []);
    throw new Error(
      `Strata app did not hydrate before sign-in. Console:\n${consoleMessages
        .slice(-20)
        .join("\n")}\nPage errors:\n${pageErrors.slice(-20).join("\n")}\nNext resources:\n${JSON.stringify(resources, null, 2)}`,
      { cause: error },
    );
  }
  await page.getByLabel("Email").click();
  await page.getByLabel("Email").pressSequentially(memberEmail);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").pressSequentially(memberPassword);
  await page.evaluate(
    ({ email, password }) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      const emailInput = document.querySelector('input[aria-label="Email"]');
      const passwordInput = document.querySelector('input[aria-label="Password"]');

      if (emailInput instanceof HTMLInputElement && setValue) {
        setValue.call(emailInput, email);
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (passwordInput instanceof HTMLInputElement && setValue) {
        setValue.call(passwordInput, password);
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    { email: memberEmail, password: memberPassword },
  );
  await page.waitForFunction(() => {
    const emailInput = document.querySelector('input[aria-label="Email"]');
    const button = Array.from(document.querySelectorAll("button")).find((item) =>
      /sign in/i.test(item.textContent ?? ""),
    );
    return Boolean(emailInput && button && !button.hasAttribute("disabled"));
  });
  await page.locator('input[aria-label="Email"] ~ input[aria-label="Password"] ~ button').click();
  try {
    await page.getByText(memberEmail).first().waitFor({ timeout: 20000 });
    await page.getByText("Workspace updated").waitFor({ timeout: 20000 });
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const formState = await page
      .evaluate(() => {
        const emailInput = document.querySelector('input[aria-label="Email"]');
        const passwordInput = document.querySelector('input[aria-label="Password"]');
        const signInButton = Array.from(document.querySelectorAll("button")).find((item) =>
          /sign in/i.test(item.textContent ?? ""),
        );

        return {
          emailValueLength: emailInput instanceof HTMLInputElement ? emailInput.value.length : null,
          passwordValueLength: passwordInput instanceof HTMLInputElement ? passwordInput.value.length : null,
          signInButtonText: signInButton?.textContent ?? null,
          signInButtonDisabled: signInButton instanceof HTMLButtonElement ? signInButton.disabled : null,
          activeElement: document.activeElement?.tagName ?? null,
        };
      })
      .catch(() => null);
    throw new Error(
      `Timed out waiting for signed-in member email. Form state:\n${JSON.stringify(formState, null, 2)}\nConsole:\n${consoleMessages
        .slice(-10)
        .join("\n")}\nPage errors:\n${pageErrors.slice(-10).join("\n")}\nVisible page text:\n${bodyText.slice(0, 3000)}`,
      { cause: error },
    );
  }
  observations.signedIn = true;

  await page.getByRole("button", { name: "Cards" }).first().click();
  await page.getByText("AI panel").waitFor({ timeout: 15000 });
  const cardsText = await page.locator("body").innerText();
  observations.hiddenAbsent =
    !cardsText.includes("Admin levy hardship matter") &&
    !cardsText.includes("Custom access legal review") &&
    !cardsText.includes("Hidden AI output");

  await runCardAction(page, "Card brief");
  observations.cardBrief = true;

  await page.getByLabel("Ask AI").fill(`Summarise the thread for ${marker}`);
  await page.getByLabel("Send AI question").click();
  await expectAiResult(page, "Thread summary");
  observations.threadSummary = true;

  await runCardAction(page, "Quote risk");
  observations.quoteRisk = true;

  await runCardAction(page, "NSW law lookup");
  observations.lawLookup = true;

  await page.getByRole("button", { name: "Documents" }).first().click();
  await page.getByText("Document Q&A").first().waitFor({ timeout: 15000 });
  await page.locator('input[aria-label^="Ask about"]').first().fill(`What does this document say for ${marker}?`);
  await page.getByRole("button", { name: "Ask" }).first().click();
  await expectAiResult(page, "Document Q&A");
  observations.documentQa = true;

  await page.getByRole("button", { name: "Budget" }).first().click();
  await page.getByRole("button", { name: "Run budget AI" }).click();
  await expectAiResult(page, "Budget insight");
  observations.budgetInsight = true;

  await page.getByRole("button", { name: "Projects" }).first().click();
  await page.getByRole("button", { name: "Refresh project AI" }).first().click();
  await expectAiResult(page, "Project status");
  observations.projectStatus = true;

  const { data: persisted, error } = await service.from("ai_outputs").select("id,output").limit(500);

  if (error) {
    throw error;
  }

  observations.persistedRows =
    (persisted ?? []).filter(
      (row) => row.output && typeof row.output === "object" && row.output.verification_marker === marker,
    ).length >= 7;

  const ok = Object.values(observations).every(Boolean);
  console.log(JSON.stringify({ ok, marker, observations }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await cleanupAiOutputs();

  if (server) {
    server.kill();
  }
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

loadEnv(".env.local");
loadEnv(".env");

const appUrl = process.env.STRATA_BROWSER_URL ?? "http://127.0.0.1:3000";
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

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

// Vercel Preview deployments sit behind Deployment Protection. The
// "Protection Bypass for Automation" secret lets verification traffic through
// without weakening protection for anyone else. Absent, this is a no-op.
// The secret is passed only on the first navigation so Vercel can set a cookie
// scoped to the deployment origin.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

function withBypass(target) {
  if (!bypassSecret) return target;

  const parsed = new URL(target);
  parsed.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  parsed.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return parsed.toString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.innerWidth + 1,
    `${label} overflows horizontally (${dimensions.scrollWidth}px > ${dimensions.innerWidth}px)`,
  );
}

async function assertNoOverlay(page, label) {
  const count = await page
    .locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')
    .count();
  assert(count === 0, `${label} rendered a framework error overlay`);
}

async function assertFocused(page, locator, message) {
  const element = await locator.elementHandle();
  assert(element, `${message}: element is missing`);
  await page.waitForFunction((target) => target === document.activeElement, element, { timeout: 5000 });
}

async function signIn(page, email, password) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByText(email).waitFor({ timeout: 15000 });
}

async function signOut(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor();
}

async function assertVisibleTargets(page, label) {
  const undersized = await page.locator([
    "header button:visible",
    "header input:visible",
    "header select:visible",
    "header a:visible",
    "main button:visible",
    "main input:visible",
    "main select:visible",
    "main a:visible",
    "main summary:visible",
    "[data-slot=sheet-content] button:visible",
    "[data-slot=sheet-content] input:visible",
    "[data-slot=sheet-content] select:visible",
    "[data-slot=sheet-content] a:visible",
  ].join(", ")).evaluateAll((elements) =>
    elements
      .filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.tabIndex >= 0,
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().slice(0, 40) ||
            `${element.tagName.toLowerCase()}${element.getAttribute("type") ? `[type=${element.getAttribute("type")}]` : ""}${element.getAttribute("data-slot") ? `[data-slot=${element.getAttribute("data-slot")}]` : ""}`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(({ width, height }) => width < 44 || height < 44),
  );
  assert(undersized.length === 0, `${label} has undersized targets: ${JSON.stringify(undersized)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
const failedResponses = [];

function safeRequestLocation(target) {
  const parsed = new URL(target);
  const appOrigin = new URL(appUrl).origin;
  return parsed.origin === appOrigin ? parsed.pathname : `${parsed.origin}${parsed.pathname}`;
}

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() < 400) return;

  const request = response.request();
  failedResponses.push({
    method: request.method(),
    resourceType: request.resourceType(),
    status: response.status(),
    location: safeRequestLocation(response.url()),
  });
});

const observations = {
  signedOutDesktop: false,
  adminDesktopNavigation: false,
  assistantKeyboardLifecycle: false,
  adminDocumentDialog: false,
  adminMobileNavigation: false,
  adminMobileSignOut: false,
  adminMobileDialogs: false,
  landscapeAndZoomReflow: false,
  mobileTargets: false,
  ordinaryMemberRestrictions: false,
  noHorizontalOverflow: false,
  noFrameworkOverlay: false,
  noConsoleErrors: false,
};

try {
  const response = await page.goto(withBypass(appUrl), { waitUntil: "networkidle" });
  assert(response?.ok(), `App returned HTTP ${response?.status() ?? "unknown"}`);
  await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor();
  await assertNoOverflow(page, "signed-out desktop");
  observations.signedOutDesktop = true;

  await signIn(page, adminEmail, adminPassword);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.waitFor();
  assert(await skipLink.evaluate((element) => element === document.activeElement), "Skip link is not the first keyboard target");

  const destinations = [
    ["Dashboard", "Dashboard"],
    ["Cards", "Cards"],
    ["Votes", "Votes"],
    ["Updates", "Updates"],
    ["Documents", "Documents"],
    ["Projects", "Projects"],
    ["Budget", "Budget"],
    ["Search", "Search"],
    ["Members", "People"],
    ["Settings", "Settings"],
  ];

  for (const [navigationName, heading] of destinations) {
    await page.getByRole("button", { name: navigationName, exact: true }).first().click();
    const destinationHeading = page.getByRole("heading", { name: heading, exact: true }).first();
    await destinationHeading.waitFor();
    if (navigationName !== "Dashboard") {
      await assertFocused(page, destinationHeading, `${heading} heading did not receive focus after desktop navigation`);
    }
    await assertNoOverflow(page, `admin desktop ${heading}`);
  }
  observations.adminDesktopNavigation = true;

  const assistantLauncher = page.getByRole("button", { name: "Open building assistant" });
  await assistantLauncher.click();
  const assistantDialog = page.getByRole("dialog", { name: "Building assistant" });
  await assistantDialog.waitFor();
  assert(
    await assistantDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
    "Assistant did not move focus into the dialog",
  );
  await page.keyboard.press("Escape");
  await assistantDialog.waitFor({ state: "hidden" });
  assert(await assistantLauncher.evaluate((button) => button === document.activeElement), "Assistant did not restore launcher focus");
  observations.assistantKeyboardLifecycle = true;

  await page.getByRole("button", { name: "Documents", exact: true }).first().click();
  await page.getByRole("button", { name: "Open document upload" }).click();
  for (const label of [
    "Document title",
    "Document type",
    "Document visibility",
    "Document source date",
    "Document file",
  ]) {
    await page.getByLabel(label, { exact: true }).waitFor();
  }
  observations.adminDocumentDialog = true;
  await page.getByRole("button", { name: "Close", exact: true }).last().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).last().waitFor();
  observations.adminMobileSignOut = true;
  await page.getByRole("button", { name: "Cards", exact: true }).last().click();
  await page.getByRole("heading", { name: "Cards", exact: true }).first().waitFor();
  await assertNoOverflow(page, "admin mobile Cards");
  await assertVisibleTargets(page, "admin mobile Cards");
  await page.getByRole("button", { name: "Open building assistant" }).click();
  await assertVisibleTargets(page, "admin mobile assistant");
  await page.keyboard.press("Escape");
  observations.adminMobileNavigation = true;

  await page.getByRole("button", { name: "Create", exact: true }).click();
  const createDialog = page.getByRole("dialog");
  const createBox = await createDialog.boundingBox();
  assert(createBox && createBox.x >= 0 && createBox.x + createBox.width <= 391, "Create-card dialog exceeds mobile viewport");
  await page.getByLabel("Card title", { exact: true }).waitFor();
  await page.getByLabel("Card description", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Documents", exact: true }).last().click();
  await page.getByRole("button", { name: "Open document upload" }).click();
  const uploadDialog = page.getByRole("dialog");
  const uploadBox = await uploadDialog.boundingBox();
  assert(uploadBox && uploadBox.x >= 0 && uploadBox.x + uploadBox.width <= 391, "Document dialog exceeds mobile viewport");
  await assertNoOverflow(page, "admin mobile document dialog");
  await page.screenshot({ path: "/tmp/strata-fe-qa-mobile.png", fullPage: true });
  observations.adminMobileDialogs = true;
  await page.getByRole("button", { name: "Close", exact: true }).last().click();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Create card" }).click();
  const landscapeDialog = page.getByRole("dialog");
  const landscapeBox = await landscapeDialog.boundingBox();
  assert(landscapeBox && landscapeBox.height <= 359, "Create-card dialog exceeds short landscape viewport");
  await landscapeDialog.getByRole("button", { name: /create card/i }).scrollIntoViewIfNeeded();
  await landscapeDialog.getByRole("button", { name: /create card/i }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();

  await page.setViewportSize({ width: 640, height: 500 });
  await assertNoOverflow(page, "200-percent zoom equivalent");
  observations.landscapeAndZoomReflow = true;

  await page.setViewportSize({ width: 390, height: 390 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileSignOut = page.getByRole("button", { name: "Sign out" }).last();
  await mobileSignOut.scrollIntoViewIfNeeded();
  const mobileSignOutBox = await mobileSignOut.boundingBox();
  assert(
    mobileSignOutBox && mobileSignOutBox.y >= 0 && mobileSignOutBox.y + mobileSignOutBox.height <= 391,
    "Mobile sign-out is unreachable in a short viewport",
  );
  await assertVisibleTargets(page, "mobile navigation");
  observations.mobileTargets = true;
  const mobileCardsDestination = page.getByRole("button", { name: "Cards", exact: true }).last();
  await mobileCardsDestination.scrollIntoViewIfNeeded();
  await mobileCardsDestination.click();
  await page.getByRole("dialog", { name: "Navigation" }).waitFor({ state: "hidden" });
  const mobileCardsHeading = page.getByRole("heading", { name: "Cards", exact: true }).first();
  await assertFocused(page, mobileCardsHeading, "Cards heading did not receive focus after mobile navigation closed");

  await signOut(page);
  await signIn(page, memberEmail, memberPassword);
  await page.getByRole("button", { name: "Members", exact: true }).first().click();
  assert(await page.getByLabel("Invite email").isDisabled(), "Ordinary member can edit invite email");
  assert(await page.getByLabel("Invite role").isDisabled(), "Ordinary member can edit invite role");
  const memberSaveControls = page.getByRole("button", { name: /^Save member / });
  const memberSaveCount = await memberSaveControls.count();
  for (let index = 0; index < memberSaveCount; index += 1) {
    assert(await memberSaveControls.nth(index).isDisabled(), "Ordinary member has an enabled member-save control");
  }
  await assertNoOverflow(page, "ordinary-member People");
  await page.screenshot({ path: "/tmp/strata-fe-qa-desktop.png", fullPage: true });
  observations.ordinaryMemberRestrictions = true;

  observations.noHorizontalOverflow = true;
  await assertNoOverlay(page, "final QA state");
  observations.noFrameworkOverlay = true;
  observations.noConsoleErrors = consoleErrors.length === 0;

  const ok = Object.values(observations).every(Boolean);
  console.log(JSON.stringify({ ok, observations, consoleErrors, failedResponses }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}

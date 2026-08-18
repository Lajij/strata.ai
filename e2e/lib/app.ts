import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";

/**
 * Page-object helpers for the Strata e2e harness.
 *
 * Lifted from `scripts/verify-auth-browser.mjs` so the harness reuses the same
 * proven real-browser interaction pattern (hydrate flag, labelled credentials,
 * sidebar nav, member-management rows). Self-contained: it deliberately does
 * NOT import `@/lib/*` because the Playwright TypeScript program does not share
 * the application path alias and resolving it is fragile.
 */

export const APP_URL = process.env.STRATA_BROWSER_URL ?? "http://127.0.0.1:3000";

export type NavKey =
  | "dashboard"
  | "cards"
  | "votes"
  | "updates"
  | "documents"
  | "projects"
  | "budget"
  | "search"
  | "people"
  | "settings";

// The sidebar renders a `<button>` per nav item. Every item's accessible name is
// its label except "people", whose button carries `aria-label="Members"` (see
// src/components/sidebar-nav.tsx). Confirmed against the live rendered app.
const NAV_LABEL: Record<NavKey, string> = {
  dashboard: "Dashboard",
  cards: "Cards",
  votes: "Votes",
  updates: "Updates",
  documents: "Documents",
  projects: "Projects",
  budget: "Budget",
  search: "Search",
  people: "Members",
  settings: "Settings",
};

export function loadEnv(file: string): void {
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
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

export function withBypass(target: string): string {
  if (!bypassSecret) {
    return target;
  }

  const parsed = new URL(target);
  parsed.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  parsed.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return parsed.toString();
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto(withBypass(APP_URL), { waitUntil: "networkidle" });
  await hydrate(page);
}

export async function hydrate(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.strataHydrated === "true", {
    timeout: 25_000,
  });
}

export async function submitCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

/**
 * Submit the real sign-in form and wait for the workspace to settle. When
 * `expectLocked` is false (the active personas) this waits for the
 * authenticated header banner showing the member email. When `expectLocked` is
 * true (the suspended persona) it waits for the post-sign-in workspace refresh
 * and asserts the locked gate remains, never an authenticated header.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string,
  { expectLocked = false }: { expectLocked?: boolean } = {},
): Promise<void> {
  // The sign-in flow triggers /api/members/accept then a /api/app-data refresh.
  // Waiting on that refresh proves the real backend round-trip completed.
  const appDataRefresh = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.includes("/api/app-data") && response.request().method() === "GET";
  });

  await submitCredentials(page, email, password);
  await appDataRefresh;

  if (expectLocked) {
    await page
      .getByRole("heading", { name: "Sign in with an active committee account" })
      .waitFor({ timeout: 30_000 });
    return;
  }

  await page.getByRole("banner").getByText(email).waitFor({ timeout: 30_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.getByRole("button", { name: /sign in/i }).waitFor({ timeout: 20_000 });
}

export function navButton(page: Page, key: NavKey): Locator {
  return page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: NAV_LABEL[key] });
}

export async function openNav(page: Page, key: NavKey): Promise<void> {
  await navButton(page, key).click();
}

export async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

export async function memberRow(page: Page, email: string): Promise<Locator> {
  const row = page
    .locator("div")
    .filter({ hasText: email })
    .filter({ has: page.getByLabel(`Name for ${email}`) })
    .first();
  await row.waitFor({ timeout: 20_000 });
  return row;
}

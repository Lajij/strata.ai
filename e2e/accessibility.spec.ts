import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/personas";
import { storageStatePath } from "./fixtures/personas";
import { gotoApp, openNav, type NavKey } from "./lib/app";

/**
 * Automated accessibility gate. Runs axe-core against the signed-out gate and
 * the key authenticated pages under both an admin and an ordinary member,
 * targeting WCAG 2.1 AA. Any violation fails the run (and CI). Assertions are
 * real axe analysis results, never source-string inspection.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const AXE_PAGES: { key: NavKey; title: string }[] = [
  { key: "dashboard", title: "Dashboard" },
  { key: "cards", title: "Cards" },
  { key: "documents", title: "Documents" },
  { key: "budget", title: "Budget" },
  { key: "people", title: "People" },
  { key: "projects", title: "Projects" },
  { key: "search", title: "Search" },
  { key: "settings", title: "Settings" },
];

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("accessibility (axe) — signed-out gate", () => {
  test("sign-in screen has no WCAG 2.1 AA violations", async ({ page }) => {
    await gotoApp(page);
    await expect(
      page.getByRole("heading", { name: "Sign in with an active committee account" }),
    ).toBeVisible({ timeout: 20_000 });
    await expectNoAxeViolations(page);
  });
});

for (const persona of ["admin", "member"] as const) {
  test.describe(`accessibility (axe) — ${persona}`, () => {
    test.use({ storageState: storageStatePath(persona) });

    test(`${persona} dashboard has no WCAG 2.1 AA violations`, async ({ page }) => {
      await gotoApp(page);
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
        timeout: 30_000,
      });
      await expectNoAxeViolations(page);
    });

    for (const { key, title } of AXE_PAGES.filter((page) => page.key !== "dashboard")) {
      test(`${persona} ${title.toLowerCase()} page has no WCAG 2.1 AA violations`, async ({
        page,
      }) => {
        await gotoApp(page);
        await openNav(page, key);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({ timeout: 30_000 });
        await expectNoAxeViolations(page);
      });
    }
  });
}

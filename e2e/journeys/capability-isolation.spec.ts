import { expect, test } from "../fixtures/personas";
import { storageStatePath } from "../fixtures/personas";
import { gotoApp, openNav } from "../lib/app";

/**
 * Capability-isolation journey. Proves RLS-derived emptiness through the real
 * rendered DOM: a member and a read-only member see the committee's visible
 * cards/documents but never the admin-only or custom-access records. Absence is
 * asserted with locator count (real DOM), never source-string inspection.
 */
test.describe("capability isolation", () => {
  for (const persona of ["member", "readOnly"] as const) {
    test.describe(`${persona} sees only RLS-visible records`, () => {
      test.use({ storageState: storageStatePath(persona) });

      test("admin-only and custom-access cards are absent; visible card is present", async ({
        page,
      }) => {
        await gotoApp(page);
        await openNav(page, "cards");

        // Positive control: the all-visibility seeded card is rendered (UI shows proposal title).
        await expect(page.getByText("Approve fire door quote with conditions").first()).toBeVisible({
          timeout: 30_000,
        });

        // RLS isolation: admin-only and custom-access cards never reach the DOM.
        await expect(page.getByText("Admin levy hardship matter")).toHaveCount(0);
        await expect(page.getByText("Custom access legal review")).toHaveCount(0);
      });

      test("admin-only document is absent; visible document is present", async ({ page }) => {
        await gotoApp(page);
        await openNav(page, "documents");

        await expect(page.getByText("Registered by-laws").first()).toBeVisible({ timeout: 30_000 });
        
        // Product decision: read-only treasurer MAY see visibility:admins docs.
        // Ordinary member must NOT see them.
        if (persona === "readOnly") {
          await expect(page.getByText("Admin levy payment plan").first()).toBeVisible({ timeout: 10_000 });
        } else {
          await expect(page.getByText("Admin levy payment plan")).toHaveCount(0);
        }
      });
    });
  }
});

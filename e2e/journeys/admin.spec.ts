import { expect, test } from "../fixtures/personas";
import { readPersonaState, storageStatePath } from "../fixtures/personas";
import { gotoApp, memberRow, openNav } from "../lib/app";

/**
 * Admin member-management journey (mirrors scripts/verify-auth-browser.mjs).
 * Asserts real DOM locators and rendered outcomes: invite creates a pending
 * member row, member edits audit and update, active->invited is rejected,
 * suspend marks the member Inactive, and the admin cannot edit their own
 * role/access/status (self-lockout). No source-string presence checks.
 */
test.describe("admin member management", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("admin invites, edits, suspends a member, rejects backwards invite, and is self-locked", async ({
    page,
  }) => {
    const state = readPersonaState();
    const managedEmail = state.personas.managed.email;
    const invitedEmail = `${state.marker}-invited@example.com`;
    const adminEmail = state.personas.admin.email;

    await gotoApp(page);
    // Authenticated shell renders the RLS-backed session detail in the header.
    await expect(page.getByText("Supabase RLS-backed session data").first()).toBeVisible({
      timeout: 30_000,
    });

    await openNav(page, "people");
    await expect(page.getByText("Invite-only committee access")).toBeVisible({ timeout: 15_000 });

    // Invite a new member through the real form.
    await page.getByLabel("Invite email").fill(invitedEmail);
    await page.getByLabel("Invite full name").fill("E2E Invited Member");
    await page.getByLabel("Invite role").selectOption("treasurer");
    await page.getByLabel("Invite access level").selectOption("limited_admin");
    await page.getByRole("button", { name: /^Invite$/ }).click();
    await expect(page.getByText(/Member invited|Member invite row saved|Sending invite/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(invitedEmail).first()).toBeVisible({ timeout: 30_000 });

    // Edit the marker-scoped managed member.
    let managedRow = await memberRow(page, managedEmail);
    await managedRow.getByLabel(`Name for ${managedEmail}`).fill("E2E Managed Updated");
    await managedRow.getByLabel(`Role for ${managedEmail}`).selectOption("treasurer");
    await managedRow.getByLabel(`Access level for ${managedEmail}`).selectOption("limited_admin");
    await managedRow.getByLabel(`Save member ${managedEmail}`).click();
    await expect(page.getByText("Saving member access...")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Member access updated").first()).toBeVisible({ timeout: 30_000 });

    // Active/suspended members cannot be moved back to invited.
    managedRow = await memberRow(page, managedEmail);
    await managedRow.getByLabel(`Status for ${managedEmail}`).selectOption("invited");
    await managedRow.getByLabel(`Save member ${managedEmail}`).click();
    await expect(
      page.getByText("Active or suspended members cannot be moved back to invited"),
    ).toBeVisible({ timeout: 30_000 });

    // Suspend the managed member.
    managedRow = await memberRow(page, managedEmail);
    await managedRow.getByLabel(`Status for ${managedEmail}`).selectOption("suspended");
    await managedRow.getByLabel(`Save member ${managedEmail}`).click();
    await expect(page.getByText("Member access updated").first()).toBeVisible({ timeout: 30_000 });
    managedRow = await memberRow(page, managedEmail);
    await expect(managedRow.getByText("Inactive", { exact: true })).toBeVisible();

    // Self-lockout: an admin cannot change their own role/access/status.
    const adminRow = await memberRow(page, adminEmail);
    await expect(adminRow.getByLabel(`Role for ${adminEmail}`)).toBeDisabled();
    await expect(adminRow.getByLabel(`Access level for ${adminEmail}`)).toBeDisabled();
    await expect(adminRow.getByLabel(`Status for ${adminEmail}`)).toBeDisabled();
  });
});

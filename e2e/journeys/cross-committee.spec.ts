import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, readPersonaState } from "../fixtures/personas";

/**
 * Cross-committee isolation journey. A Committee-B admin (provisioned in
 * globalSetup) can read and write only Committee B. Through the real Data API
 * (`/api/app-data` and `/api/workflow`), Committee A's records never reach the
 * cross admin, and a card the cross admin creates never reaches Committee A.
 * Assertions are HTTP status + JSON body, never source-string inspection.
 */
test.describe("cross-committee isolation", () => {
  test("Committee-B admin cannot read or write Committee-A records", async () => {
    const state = readPersonaState();
    const crossCardTitle = `${state.marker} Cross Committee Card`;

    const cross = await authenticatedRequest("crossCommitteeAdmin");
    const admin = await authenticatedRequest("admin");

    try {
      // Committee A's public card must never appear in the cross admin's data.
      const before = await cross.get("/api/app-data");
      expect(before.status()).toBe(200);
      const beforeBody = await before.json();
      const beforeTitles = (beforeBody.cards ?? []).map((card: { title: string }) => card.title);
      expect(beforeTitles).not.toContain("Live fire door approval");
      expect(beforeBody.auth?.member).toBeTruthy();

      // The cross admin can write to their own committee (Committee B).
      const create = await cross.post("/api/workflow/create-card", {
        data: {
          title: crossCardTitle,
          description: "E2E cross-committee write to Committee B",
          type: "general",
          visibility: "all",
        },
      });
      expect(create.status()).toBe(200);
      const createBody = await create.json();
      expect(createBody.id).toBeTruthy();

      // The new card appears in the cross admin's data...
      const crossAfter = await cross.get("/api/app-data");
      const crossAfterBody = await crossAfter.json();
      const crossAfterTitles = (crossAfterBody.cards ?? []).map(
        (card: { title: string }) => card.title,
      );
      expect(crossAfterTitles).toContain(crossCardTitle);
      expect(crossAfterTitles).not.toContain("Live fire door approval");

      // ...but never in Committee A (admin's) data.
      const adminData = await admin.get("/api/app-data");
      const adminBody = await adminData.json();
      const adminTitles = (adminBody.cards ?? []).map((card: { title: string }) => card.title);
      expect(adminTitles).toContain("Live fire door approval");
      expect(adminTitles).not.toContain(crossCardTitle);
    } finally {
      await cross.dispose();
      await admin.dispose();
    }
  });
});

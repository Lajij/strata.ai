import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, readPersonaState } from "../fixtures/personas";

/**
 * Motion lifecycle journey (#39). Drives the real workflow Data API
 * (`/api/workflow/create-motion`, `/api/workflow/advance-motion`,
 * `/api/workflow/update-motion`) and `/api/app-data` to prove the
 * draft -> open -> decided | withdrawn state machine:
 *   - an eligible member creates a motion (stored in draft) and advances it
 *     through the only legal transitions;
 *   - a terminal (decided) motion rejects further writes (409);
 *   - a read-only member cannot create or advance a motion (403);
 *   - a cross-committee admin never sees the motion and cannot advance it (404).
 *
 * Assertions are HTTP status + JSON body, never source-string inspection.
 * Records carry the run marker so `cleanupE2eRecords` removes them.
 */
test.describe("motion lifecycle", () => {
  test("eligible member moves a motion draft -> open -> decided; terminal and ineligible writes are rejected", async () => {
    const { marker } = readPersonaState();
    const title = `${marker} Motion Lifecycle`;

    const admin = await authenticatedRequest("admin");
    const readOnly = await authenticatedRequest("readOnly");
    const cross = await authenticatedRequest("crossCommitteeAdmin");

    try {
      // read_only cannot create a motion (route-level WRITE_CAPABILITY_REQUIRED).
      const blockedCreate = await readOnly.post("/api/workflow/create-motion", {
        data: { title: `${title} (blocked)`, context: "Should be rejected" },
      });
      expect(blockedCreate.status()).toBe(403);

      // Eligible member creates a motion; it is stored in draft.
      const create = await admin.post("/api/workflow/create-motion", {
        data: { title, context: "E2E motion lifecycle probe" },
      });
      expect(create.status()).toBe(200);
      const createBody = await create.json();
      expect(createBody.mode).toBe("supabase");
      expect(createBody.id).toBeTruthy();
      const motionId = createBody.id as string;

      // Same-committee members see the same motion in draft state.
      const data = await admin.get("/api/app-data");
      expect(data.status()).toBe(200);
      const body = await data.json();
      const motion = (body.motions ?? []).find((item: { id: string }) => item.id === motionId);
      expect(motion).toBeTruthy();
      expect(motion.statusValue).toBe("draft");

      // Legal advance draft -> open.
      const open = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "open" },
      });
      expect(open.status()).toBe(200);
      expect((await open.json()).status).toBe("open");

      // Legal advance open -> decided.
      const decide = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "decided" },
      });
      expect(decide.status()).toBe(200);
      expect((await decide.json()).status).toBe("decided");

      // read_only cannot advance (route-level WRITE_CAPABILITY_REQUIRED).
      const blockedAdvance = await readOnly.post("/api/workflow/advance-motion", {
        data: { motionId, to: "withdrawn" },
      });
      expect(blockedAdvance.status()).toBe(403);

      // Terminal motion: advancing from decided is rejected (ILLEGAL_MOTION_TRANSITION).
      const terminalAdvance = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "withdrawn" },
      });
      expect(terminalAdvance.status()).toBe(409);

      // Terminal motion: editing is rejected (MOTION_NOT_EDITABLE).
      const terminalUpdate = await admin.post("/api/workflow/update-motion", {
        data: { motionId, title: `${title} (edited)`, context: "Should be rejected" },
      });
      expect(terminalUpdate.status()).toBe(409);

      // Cross-committee isolation: the motion never reaches Committee B's data...
      const crossData = await cross.get("/api/app-data");
      expect(crossData.status()).toBe(200);
      const crossBody = await crossData.json();
      const crossTitles = (crossBody.motions ?? []).map((item: { title: string }) => item.title);
      expect(crossTitles).not.toContain(title);
      expect(crossBody.motions ?? []).toEqual([]);

      // ...and a cross-committee member cannot advance it (MOTION_NOT_FOUND).
      const crossAdvance = await cross.post("/api/workflow/advance-motion", {
        data: { motionId, to: "withdrawn" },
      });
      expect(crossAdvance.status()).toBe(404);
    } finally {
      await admin.dispose();
      await readOnly.dispose();
      await cross.dispose();
    }
  });
});

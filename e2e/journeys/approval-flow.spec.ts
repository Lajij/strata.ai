import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, readPersonaState } from "../fixtures/personas";

/**
 * Committee approval journey (#6 v1). Drives the real workflow Data API
 * (`/api/workflow/request-approval`, `/api/workflow/respond-approval`,
 * `/api/workflow/advance-motion`) and `/api/app-data` to prove the recorded,
 * attributed, majority-based outcome on an open motion:
 *   - a read-only member cannot request or respond (403);
 *   - an eligible member opens an approval request (idempotent) and records a
 *     response, and app-data reflects the tally + eligibility;
 *   - deciding before a recorded majority is rejected (409 fail-closed);
 *   - once a simple majority of eligible voters approve, deciding records a
 *     `passed` outcome;
 *   - a cross-committee admin never sees the motion/approval and cannot respond.
 *
 * Assertions are HTTP status + JSON body, never source-string inspection.
 * Records carry the run marker so `cleanupE2eRecords` removes them.
 */
test.describe("committee approval flow", () => {
  test("open motion approval request -> attributed responses -> recorded passed outcome", async () => {
    const { marker } = readPersonaState();
    const title = `${marker} Approval Flow`;

    const admin = await authenticatedRequest("admin");
    const member = await authenticatedRequest("member");
    const financialConfirmer = await authenticatedRequest("financialConfirmer");
    const readOnly = await authenticatedRequest("readOnly");
    const cross = await authenticatedRequest("crossCommitteeAdmin");

    try {
      // read_only cannot request or respond (route-level WRITE_CAPABILITY_REQUIRED).
      const blockedRequest = await readOnly.post("/api/workflow/request-approval", {
        data: { motionId: "00000000-0000-0000-0000-000000000000" },
      });
      expect(blockedRequest.status()).toBe(403);

      const blockedRespond = await readOnly.post("/api/workflow/respond-approval", {
        data: { motionId: "00000000-0000-0000-0000-000000000000", response: "approve" },
      });
      expect(blockedRespond.status()).toBe(403);

      // Eligible member creates + opens a motion, then opens an approval request.
      const create = await admin.post("/api/workflow/create-motion", {
        data: { title, context: "E2E committee approval flow" },
      });
      expect(create.status()).toBe(200);
      const createBody = await create.json();
      expect(createBody.mode).toBe("supabase");
      expect(createBody.id).toBeTruthy();
      const motionId = createBody.id as string;

      const open = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "open" },
      });
      expect(open.status()).toBe(200);
      expect((await open.json()).status).toBe("open");

      const requestApproval = await admin.post("/api/workflow/request-approval", {
        data: { motionId },
      });
      expect(requestApproval.status()).toBe(200);
      const requestApprovalBody = await requestApproval.json();
      expect(requestApprovalBody.mode).toBe("supabase");
      expect(requestApprovalBody.id).toBeTruthy();

      // Idempotent: requesting again returns the same existing request.
      const requestAgain = await admin.post("/api/workflow/request-approval", {
        data: { motionId },
      });
      expect(requestAgain.status()).toBe(200);
      expect((await requestAgain.json()).id).toBe(requestApprovalBody.id);

      // Admin records an approval; app-data reflects the tally + eligibility.
      const approve = await admin.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(approve.status()).toBe(200);

      const data = await admin.get("/api/app-data");
      expect(data.status()).toBe(200);
      const body = await data.json();
      const motion = (body.motions ?? []).find((item: { id: string }) => item.id === motionId);
      expect(motion).toBeTruthy();
      expect(motion.approval).toBeTruthy();
      expect(motion.approval.approvals).toBe(1);
      expect(motion.approval.rejections).toBe(0);
      expect(motion.approval.eligible).toBeGreaterThanOrEqual(3);
      expect(motion.approval.threshold).toBeGreaterThan(0);

      // Deciding with only one approval is rejected (fail-closed majority).
      const earlyDecide = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "decided" },
      });
      expect(earlyDecide.status()).toBe(409);

      // Drive a recorded majority (admin already approved; member + financial
      // confirmer approve). Three approvals is a strict majority for <=5 eligible.
      const memberApprove = await member.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(memberApprove.status()).toBe(200);

      const financialApprove = await financialConfirmer.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(financialApprove.status()).toBe(200);

      const decide = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "decided" },
      });
      expect(decide.status()).toBe(200);
      const decideBody = await decide.json();
      expect(decideBody.status).toBe("decided");
      expect(decideBody.outcome).toBe("passed");

      // Cross-committee isolation: the motion and its approval never reach
      // Committee B, and a cross-committee member cannot respond (MOTION_NOT_FOUND).
      const crossData = await cross.get("/api/app-data");
      expect(crossData.status()).toBe(200);
      const crossBody = await crossData.json();
      const crossTitles = (crossBody.motions ?? []).map((item: { title: string }) => item.title);
      expect(crossTitles).not.toContain(title);

      const crossRespond = await cross.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(crossRespond.status()).toBe(404);
    } finally {
      await admin.dispose();
      await member.dispose();
      await financialConfirmer.dispose();
      await readOnly.dispose();
      await cross.dispose();
    }
  });
});

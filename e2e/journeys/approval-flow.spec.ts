import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, readPersonaState } from "../fixtures/personas";

/**
 * Committee approval journey (#6 v1). Drives the real workflow Data API
 * (`/api/workflow/request-approval`, `/api/workflow/respond-approval`,
 * `/api/workflow/advance-motion`) and `/api/app-data` to prove the recorded,
 * attributed, votes-cast outcome on an open motion:
 *   - a read-only member cannot request or respond (403);
 *   - an eligible member opens an approval request (idempotent) and records a
 *     response, and app-data reflects the tally of votes cast;
 *   - once a simple majority of votes cast approve, deciding records a
 *     `passed` outcome;
 *   - when more votes are cast against than for, deciding records a `failed`
 *     outcome (simple majority of votes cast; the eligible count is never the
 *     denominator);
 *   - a cross-committee admin never sees the motion/approval and cannot respond.
 *
 * Assertions are HTTP status + JSON body, never source-string inspection.
 * Records carry the run marker so `cleanupE2eRecords` removes them.
 */
test.describe("committee approval flow", () => {
  test("open motion approval request -> attributed responses -> recorded passed/failed outcome", async () => {
    const { marker } = readPersonaState();
    const title = `${marker} Approval Flow`;
    const failTitle = `${marker} Approval Fail`;

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

      // --- PASSED: simple majority of votes cast (approvals > rejections). ---
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

      // Two approvals / zero rejections among votes cast -> app-data tally reflects it.
      const adminApprove = await admin.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(adminApprove.status()).toBe(200);
      const memberApprove = await member.post("/api/workflow/respond-approval", {
        data: { motionId, response: "approve" },
      });
      expect(memberApprove.status()).toBe(200);

      const data = await admin.get("/api/app-data");
      expect(data.status()).toBe(200);
      const body = await data.json();
      const motion = (body.motions ?? []).find((item: { id: string }) => item.id === motionId);
      expect(motion).toBeTruthy();
      expect(motion.approval).toBeTruthy();
      expect(motion.approval.approvals).toBe(2);
      expect(motion.approval.rejections).toBe(0);

      // Deciding records a passed outcome (2 of 2 votes cast = simple majority).
      const decide = await admin.post("/api/workflow/advance-motion", {
        data: { motionId, to: "decided" },
      });
      expect(decide.status()).toBe(200);
      const decideBody = await decide.json();
      expect(decideBody.status).toBe("decided");
      expect(decideBody.outcome).toBe("passed");

      // --- FAILED: more rejections than approvals among votes cast. ---
      const createFail = await admin.post("/api/workflow/create-motion", {
        data: { title: failTitle, context: "E2E approval fail flow" },
      });
      expect(createFail.status()).toBe(200);
      const failId = (await createFail.json()).id as string;

      const openFail = await admin.post("/api/workflow/advance-motion", {
        data: { motionId: failId, to: "open" },
      });
      expect(openFail.status()).toBe(200);

      const requestFail = await admin.post("/api/workflow/request-approval", {
        data: { motionId: failId },
      });
      expect(requestFail.status()).toBe(200);

      // One reject / zero approve -> not a majority of votes cast -> failed.
      const reject = await financialConfirmer.post("/api/workflow/respond-approval", {
        data: { motionId: failId, response: "reject" },
      });
      expect(reject.status()).toBe(200);

      const decideFail = await admin.post("/api/workflow/advance-motion", {
        data: { motionId: failId, to: "decided" },
      });
      expect(decideFail.status()).toBe(200);
      const decideFailBody = await decideFail.json();
      expect(decideFailBody.status).toBe("decided");
      expect(decideFailBody.outcome).toBe("failed");

      // Cross-committee isolation: neither motion reaches Committee B, and a
      // cross-committee member cannot respond (MOTION_NOT_FOUND).
      const crossData = await cross.get("/api/app-data");
      expect(crossData.status()).toBe(200);
      const crossBody = await crossData.json();
      const crossTitles = (crossBody.motions ?? []).map((item: { title: string }) => item.title);
      expect(crossTitles).not.toContain(title);
      expect(crossTitles).not.toContain(failTitle);

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

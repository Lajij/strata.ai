import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import { EVAL_FIXTURE_IDS } from "../agent/lib/eval-fixtures";
import { fixtureHeaders } from "./shared";

export default defineEval({
  description: "An operator-approved proposal draft parks before writing, then persists only as draft with audit evidence.",
  tags: ["eve", "draft", "approval", "adversarial"],
  async test(t) {
    const input = {
      cardId: EVAL_FIXTURE_IDS.publicCard,
      title: "Operator reviewed waterproofing proposal",
      rationale: "Retain as a draft until the committee completes its formal review.",
    };
    const parked = await t.send({
      message: `SAVE_PROPOSAL_DRAFT ${JSON.stringify(input)}`,
      headers: fixtureHeaders("admin"),
    });

    parked.parked();
    parked.calledTool("save_proposal_draft", { input, status: "pending", count: 1 });
    const request = t.requireInputRequest({
      toolName: "save_proposal_draft",
      optionIds: ["approve", "deny"],
    });

    const resumed = await t.send({
      inputResponses: [{ requestId: request.requestId, optionId: "approve" }],
      headers: fixtureHeaders("admin"),
    });
    resumed.expectOk();
    t.calledTool("save_proposal_draft", { input, status: "completed", count: 1 });
    t.check(resumed.message, includes('"status":"draft_saved"'));
    t.check(resumed.message, includes('"persisted":true'));
    t.check(resumed.message, includes('"status":"draft"'));
    t.check(resumed.message, includes("audit:"));
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_IDS } from "../agent/lib/eval-fixtures";
import { fixtureHeaders } from "./shared";

export default defineEval({
  description: "Denying an operator approval leaves the proposed draft unexecuted.",
  tags: ["eve", "draft", "denial", "adversarial"],
  async test(t) {
    const input = {
      cardId: EVAL_FIXTURE_IDS.publicCard,
      title: "Draft that must remain unsaved",
      rationale: "The operator will deny this fixture call.",
    };
    const parked = await t.send({
      message: `SAVE_PROPOSAL_DRAFT ${JSON.stringify(input)}`,
      headers: fixtureHeaders("admin"),
    });
    parked.parked();
    const request = t.requireInputRequest({ toolName: "save_proposal_draft" });

    const denied = await t.send({
      inputResponses: [{ requestId: request.requestId, optionId: "deny" }],
      headers: fixtureHeaders("admin"),
    });
    denied.expectOk();
    t.calledTool("save_proposal_draft", { input, status: "rejected", count: 1 });
    t.check(
      denied.message,
      satisfies((message) => !String(message).includes("draft_saved") && !String(message).includes('"persisted":true'), "denied draft is not persisted"),
    );
  },
});

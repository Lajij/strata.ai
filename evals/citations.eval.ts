import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import { EVAL_FIXTURE_IDS } from "../agent/lib/eval-fixtures";
import { fixtureHeaders } from "./shared";

export default defineEval({
  description: "Visible evidence is returned with its persisted record citation.",
  tags: ["eve", "citations"],
  async test(t) {
    const turn = await t.send({
      message: `CARD ${EVAL_FIXTURE_IDS.publicCard}`,
      headers: fixtureHeaders("member"),
    });

    turn.expectOk().calledTool("get_card_evidence", {
      input: { cardId: EVAL_FIXTURE_IDS.publicCard },
      status: "completed",
    });
    t.check(turn.message, includes(`card:${EVAL_FIXTURE_IDS.publicCard}`));
    t.check(turn.message, includes("Shared foyer waterproofing"));
  },
});

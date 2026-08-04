import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import { fixtureHeaders } from "./shared";

const UNKNOWN_CARD = "99999999-9999-4999-8999-999999999999";

export default defineEval({
  description: "Unknown or invisible evidence fails explicitly instead of fabricating an answer.",
  tags: ["eve", "fallback", "evidence-missing"],
  async test(t) {
    const turn = await t.send({ message: `CARD ${UNKNOWN_CARD}`, headers: fixtureHeaders("member") });

    turn.expectOk().calledTool("get_card_evidence", {
      input: { cardId: UNKNOWN_CARD },
      status: "completed",
    });
    t.check(turn.message, includes("Evidence missing:"));
    t.check(turn.message, includes(UNKNOWN_CARD));
  },
});

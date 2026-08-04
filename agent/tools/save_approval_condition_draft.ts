import { defineTool } from "eve/tools";
import { z } from "zod";

import { saveConditionDraft } from "../lib/draft-writes";
import { requireOperatorApproval, requireOperatorApprover } from "../lib/operator-approval";

export default defineTool({
  description: "Persist an approval condition as status=draft on a visible proposal. Every call requires the configured repository operator's explicit approval and creates an audit record; it never activates or sends the condition.",
  inputSchema: z.object({
    cardId: z.string().uuid(),
    proposalId: z.string().uuid(),
    condition: z.string().trim().min(3).max(5_000),
  }),
  approval: requireOperatorApproval,
  async execute({ cardId, condition, proposalId }, ctx) {
    const scope = await requireOperatorApprover(ctx);
    return saveConditionDraft({ callId: ctx.callId, cardId, condition, proposalId, scope });
  },
});

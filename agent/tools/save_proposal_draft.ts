import { defineTool } from "eve/tools";
import { z } from "zod";

import { saveProposalDraft } from "../lib/draft-writes";
import { requireOperatorApproval, requireOperatorApprover } from "../lib/operator-approval";

export default defineTool({
  description: "Persist a proposal as status=draft on a visible card. Every call requires the configured repository operator's explicit approval and creates an audit record; it never publishes or sends the draft.",
  inputSchema: z.object({
    cardId: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    rationale: z.string().trim().min(3).max(5_000),
    deadline: z.string().datetime({ offset: true }).optional(),
  }),
  approval: requireOperatorApproval,
  async execute({ cardId, deadline, rationale, title }, ctx) {
    const scope = await requireOperatorApprover(ctx);
    return saveProposalDraft({ callId: ctx.callId, cardId, deadline, rationale, scope, title });
  },
});

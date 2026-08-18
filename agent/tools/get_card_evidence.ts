import { defineTool } from "eve/tools";
import { z } from "zod";

import { evalFixtureCardEvidence } from "../lib/eval-fixtures";
import { citation, evidenceMissing, findVisibleCard, requireActiveScope, visibleDocumentIdSet } from "../lib/scoped-data";
import { getAgentAdminClient } from "../lib/supabase";

export default defineTool({
  description: "Read one visible governance card and its RLS-equivalent discussion, proposal, vote, condition, attachment, and audit evidence.",
  inputSchema: z.object({ cardId: z.string().uuid() }),
  async execute({ cardId }, ctx) {
    const scope = await requireActiveScope(ctx);
    const card = await findVisibleCard(scope, cardId);
    if (!card) return evidenceMissing("card", cardId);
    const fixtureEvidence = evalFixtureCardEvidence(scope, card);
    if (fixtureEvidence) return fixtureEvidence;

    const admin = getAgentAdminClient();
    const [messagesResult, proposalsResult, attachmentsResult, auditResult] = await Promise.all([
      admin.from("messages").select("id,body,created_at").eq("committee_id", scope.committeeId).eq("card_id", card.id).order("created_at"),
      admin.from("proposals").select("id,title,rationale,status,deadline,created_at").eq("committee_id", scope.committeeId).eq("card_id", card.id).order("created_at"),
      admin.from("attachments").select("id,document_id,file_name,file_path,file_type,extracted_text,markdown,created_at").eq("committee_id", scope.committeeId).eq("card_id", card.id).order("created_at"),
      admin.from("audit_log").select("id,action,target,created_at").eq("committee_id", scope.committeeId).eq("card_id", card.id).order("created_at"),
    ]);

    if (messagesResult.error || proposalsResult.error || attachmentsResult.error || auditResult.error) {
      throw new Error("Card evidence could not be read.");
    }

    const proposals = proposalsResult.data ?? [];
    const proposalIds = proposals.map((proposal) => proposal.id);
    const [votesResult, conditionsResult] = proposalIds.length
      ? await Promise.all([
          admin.from("votes").select("id,proposal_id,vote,note,created_at").eq("committee_id", scope.committeeId).in("proposal_id", proposalIds),
          admin.from("approval_conditions").select("id,proposal_id,condition_text,status,created_at").eq("committee_id", scope.committeeId).in("proposal_id", proposalIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (votesResult.error || conditionsResult.error) throw new Error("Card decision evidence could not be read.");

    const attachments = attachmentsResult.data ?? [];
    const visibleDocumentIds = await visibleDocumentIdSet(scope, attachments.map((attachment) => attachment.document_id));
    const visibleAttachments = attachments.filter(
      (attachment) => !attachment.document_id || visibleDocumentIds.has(attachment.document_id),
    );
    const citations = [
      citation(`card:${card.id}`, `card: ${card.title}`),
      ...(messagesResult.data ?? []).map((message) => citation(`message:${message.id}`, `message on ${card.title}`)),
      ...proposals.map((proposal) => citation(`proposal:${proposal.id}`, `proposal: ${proposal.title}`)),
      ...(votesResult.data ?? []).map((vote) => citation(`vote:${vote.id}`, `vote on ${card.title}`)),
      ...(conditionsResult.data ?? []).map((condition) => citation(`condition:${condition.id}`, `condition on ${card.title}`)),
      ...visibleAttachments.map((attachment) => citation(`attachment:${attachment.id}`, `attachment: ${attachment.file_name}`)),
      ...(auditResult.data ?? []).map((event) => citation(`audit:${event.id}`, `audit event: ${event.action}`)),
    ];

    return {
      status: "ok" as const,
      card,
      messages: messagesResult.data ?? [],
      proposals,
      votes: votesResult.data ?? [],
      approvalConditions: conditionsResult.data ?? [],
      attachments: visibleAttachments,
      audit: auditResult.data ?? [],
      citations,
    };
  },
});

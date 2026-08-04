import { defineTool } from "eve/tools";
import { z } from "zod";

import { evalFixtureDocumentEvidence } from "../lib/eval-fixtures";
import { citation, evidenceMissing, findVisibleDocument, requireActiveScope, visibleCardIdSet } from "../lib/scoped-data";
import { getAgentAdminClient } from "../lib/supabase";

export default defineTool({
  description: "Read one visible document and its RLS-equivalent attachment, invoice, and quote-review evidence with persisted source references.",
  inputSchema: z.object({ documentId: z.string().uuid() }),
  async execute({ documentId }, ctx) {
    const scope = await requireActiveScope(ctx);
    const document = await findVisibleDocument(scope, documentId);
    if (!document) return evidenceMissing("document", documentId);
    const fixtureEvidence = evalFixtureDocumentEvidence(scope, document);
    if (fixtureEvidence) return fixtureEvidence;

    const admin = getAgentAdminClient();
    const [attachmentsResult, invoicesResult, quoteReviewsResult] = await Promise.all([
      admin.from("attachments").select("id,card_id,file_name,file_path,file_type,extracted_text,markdown,created_at").eq("committee_id", scope.committeeId).eq("document_id", document.id).order("created_at"),
      admin.from("invoices").select("id,card_id,project_id,invoice_number,amount,approval_status,due_on,created_at").eq("committee_id", scope.committeeId).eq("document_id", document.id).order("created_at"),
      admin.from("quote_reviews").select("id,card_id,overall_risk,missing_inclusions,risky_exclusions,clarification_questions,approval_conditions,created_at").eq("committee_id", scope.committeeId).eq("document_id", document.id).order("created_at"),
    ]);

    if (attachmentsResult.error || invoicesResult.error || quoteReviewsResult.error) {
      throw new Error("Document evidence could not be read.");
    }

    const cardIds = [
      ...(attachmentsResult.data ?? []).map((row) => row.card_id),
      ...(invoicesResult.data ?? []).map((row) => row.card_id),
      ...(quoteReviewsResult.data ?? []).map((row) => row.card_id),
    ];
    const visibleCardIds = await visibleCardIdSet(scope, cardIds);
    const cardVisible = <T extends { card_id: string | null }>(row: T) => !row.card_id || visibleCardIds.has(row.card_id);
    const attachments = (attachmentsResult.data ?? []).filter(cardVisible);
    const invoices = (invoicesResult.data ?? []).filter(cardVisible);
    const quoteReviews = (quoteReviewsResult.data ?? []).filter(cardVisible);
    const citations = [
      citation(`document:${document.id}`, `document: ${document.title}`),
      ...[document.markdown_path, document.extracted_text_path, document.storage_path]
        .filter((path): path is string => Boolean(path))
        .map((path) => citation(path, `document source: ${document.title}`)),
      ...attachments.map((attachment) => citation(`attachment:${attachment.id}`, `attachment: ${attachment.file_name}`)),
      ...invoices.map((invoice) => citation(`invoice:${invoice.id}`, `invoice: ${invoice.invoice_number ?? invoice.id}`)),
      ...quoteReviews.map((review) => citation(`quote_review:${review.id}`, `quote review: ${review.overall_risk}`)),
    ];

    return { status: "ok" as const, document, attachments, invoices, quoteReviews, citations };
  },
});

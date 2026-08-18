import {
  cards as fallbackCards,
  documents as fallbackDocuments,
  projects as fallbackProjects,
  type DocumentRecord,
  type GovernanceCard,
  type Project,
  type Visibility,
} from "@/lib/strata-data";
import { activeMemberRequired, upstreamUnavailable } from "@/lib/runtime-configuration";
import { getCurrentMember } from "@/lib/strata-app-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AiTask =
  | "card-brief"
  | "thread-summary"
  | "document-qa"
  | "nsw-law-lookup"
  | "budget-insights"
  | "quote-risk"
  | "project-status";

export interface AiContextRequest {
  task?: AiTask;
  cardId?: string;
  documentId?: string;
  projectId?: string;
  question?: string;
}

export interface AiCitation {
  id: string;
  label: string;
  kind: string;
  source: string;
}

export interface AiContextRecord {
  kind:
    | "card"
    | "message"
    | "proposal"
    | "vote"
    | "approval_condition"
    | "audit_event"
    | "document"
    | "attachment"
    | "project"
    | "account"
    | "budget_line"
    | "budget_allowance"
    | "invoice"
    | "quote_review"
    | "legislation";
  id: string;
  title: string;
  summary: string;
  visibility?: Visibility;
  citations?: string[];
}

export interface AiContextBundle {
  source: "fallback" | "supabase";
  records: AiContextRecord[];
  citations: AiCitation[];
  notice: string;
}

type MaybeErrorResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const adminRoles = new Set(["admin", "chair", "secretary", "treasurer"]);

function isAdminRole(role: string | undefined) {
  return Boolean(role && adminRoles.has(role));
}

function canSeeFallbackVisibility(visibility: Visibility, role: string | undefined) {
  if (visibility === "All members") {
    return true;
  }

  return isAdminRole(role);
}

function mapVisibility(visibility: "all" | "admins" | "custom"): Visibility {
  if (visibility === "admins") {
    return "Admins only";
  }

  if (visibility === "custom") {
    return "Selected members";
  }

  return "All members";
}

function compact<T>(items: Array<T | null | undefined>) {
  return items.filter((item): item is T => Boolean(item));
}

function truncate(value: string | null | undefined, length = 520) {
  const text = value?.trim();

  if (!text) {
    return "No detail recorded.";
  }

  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addRecord(records: AiContextRecord[], citations: AiCitation[], record: AiContextRecord) {
  records.push(record);

  for (const citation of record.citations ?? []) {
    citations.push({
      id: `${record.kind}:${record.id}:${citation}`,
      label: citation,
      kind: record.kind,
      source: record.title,
    });
  }
}

export function buildFallbackAiContext(
  request: AiContextRequest = {},
  role: string | undefined = "member",
): AiContextBundle {
  const visibleCards = fallbackCards.filter((card) => canSeeFallbackVisibility(card.visibility, role));
  const visibleDocuments = fallbackDocuments.filter((document) => canSeeFallbackVisibility(document.visibility, role));
  const records: AiContextRecord[] = [];
  const citations: AiCitation[] = [];

  const cards = request.cardId ? visibleCards.filter((card) => card.id === request.cardId) : visibleCards.slice(0, 5);
  const documents = request.documentId
    ? visibleDocuments.filter((document) => document.id === request.documentId)
    : visibleDocuments.slice(0, 5);
  const projects = request.projectId
    ? fallbackProjects.filter((project) => project.id === request.projectId)
    : fallbackProjects.slice(0, 3);

  for (const card of cards) {
    addRecord(records, citations, cardToContextRecord(card));

    for (const message of card.messages.slice(0, 6)) {
      addRecord(records, citations, {
        kind: "message",
        id: `${card.id}:${message.author}:${message.time}`,
        title: `Message on ${card.title}`,
        summary: `${message.author}: ${message.body}`,
        visibility: card.visibility,
      });
    }
  }

  for (const document of documents) {
    addRecord(records, citations, documentToContextRecord(document));
  }

  for (const project of projects) {
    addRecord(records, citations, projectToContextRecord(project));
  }

  if (request.task === "nsw-law-lookup") {
    addRecord(records, citations, {
      kind: "legislation",
      id: "fallback-nsw-law",
      title: "NSW strata law offline fallback",
      summary:
        "No live indexed legislation database is connected in fallback mode. Use official NSW legislation and NSW Government strata guidance before relying on legal-information workflows.",
      citations: [
        "Strata Schemes Management Act 2015 No 50 (https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050)",
        "NSW Government strata guidance (https://www.nsw.gov.au/housing-and-construction/strata)",
      ],
    });
  }

  return {
    source: "fallback",
    records,
    citations,
    notice: "Local fallback context filtered by role and visibility before generation.",
  };
}

export async function buildVisibleAiContext(request: AiContextRequest = {}, accessToken?: string): Promise<AiContextBundle> {
  const supabase = await getSupabaseServerClient(accessToken);

  if (!supabase) {
    return buildFallbackAiContext(request);
  }

  const member = await getCurrentMember(supabase);

  if (!member) {
    throw activeMemberRequired();
  }

  const scopedCard = request.cardId ? { card_id: request.cardId } : {};
  const scopedProject = request.projectId ? { project_id: request.projectId } : {};
  const scopedDocument = request.documentId ? { document_id: request.documentId } : {};
  const records: AiContextRecord[] = [];
  const citations: AiCitation[] = [];

  const [
    cardsResult,
    messagesResult,
    documentsResult,
    attachmentsResult,
    projectsResult,
    proposalsResult,
    votesResult,
    conditionsResult,
    auditResult,
    accountsResult,
    budgetLinesResult,
    allowancesResult,
    invoicesResult,
    quoteReviewsResult,
    legislationSourcesResult,
    legislationResult,
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("id,title,description,visibility,type,status")
      .eq("committee_id", member.committee_id)
      .match(request.cardId ? { id: request.cardId } : {})
      .limit(request.cardId ? 1 : 8),
    supabase
      .from("messages")
      .select("id,card_id,body,created_at")
      .eq("committee_id", member.committee_id)
      .match(scopedCard)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("documents")
      .select("id,title,summary,visibility,document_type,storage_path,extracted_text_path,markdown_path,metadata")
      .eq("committee_id", member.committee_id)
      .match(request.documentId ? { id: request.documentId } : {})
      .limit(request.documentId ? 1 : 8),
    supabase
      .from("attachments")
      .select("id,card_id,document_id,file_name,file_path,extracted_text,markdown")
      .eq("committee_id", member.committee_id)
      .match({ ...scopedCard, ...scopedDocument })
      .limit(12),
    supabase
      .from("projects")
      .select("id,name,planned_scope,status,progress_percent")
      .eq("committee_id", member.committee_id)
      .match(request.projectId ? { id: request.projectId } : {})
      .limit(request.projectId ? 1 : 5),
    supabase
      .from("proposals")
      .select("id,card_id,title,rationale,status,deadline")
      .eq("committee_id", member.committee_id)
      .match(scopedCard)
      .limit(8),
    supabase.from("votes").select("id,proposal_id,vote,note").eq("committee_id", member.committee_id).limit(20),
    supabase
      .from("approval_conditions")
      .select("id,proposal_id,condition_text,status")
      .eq("committee_id", member.committee_id)
      .limit(20),
    supabase
      .from("audit_log")
      .select("id,card_id,action,target,created_at,metadata")
      .eq("committee_id", member.committee_id)
      .match(scopedCard)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("accounts").select("id,name,account_type,opening_balance").eq("committee_id", member.committee_id).limit(10),
    supabase
      .from("budget_lines")
      .select("id,category,approved_amount,account_id")
      .eq("committee_id", member.committee_id)
      .limit(20),
    supabase
      .from("budget_allowances")
      .select("id,budget_line_id,name,approved_amount,committed_amount,invoiced_amount,notes")
      .eq("committee_id", member.committee_id)
      .limit(20),
    supabase
      .from("invoices")
      .select("id,project_id,card_id,document_id,invoice_number,amount,approval_status,due_on")
      .eq("committee_id", member.committee_id)
      .match({ ...scopedCard, ...scopedProject, ...scopedDocument })
      .limit(20),
    supabase
      .from("quote_reviews")
      .select("id,card_id,document_id,overall_risk,missing_inclusions,risky_exclusions,clarification_questions,approval_conditions")
      .eq("committee_id", member.committee_id)
      .match({ ...scopedCard, ...scopedDocument })
      .limit(10),
    supabase.from("legislation_sources").select("id,title,url,version_label,indexed_at").limit(20),
    supabase
      .from("legislation_chunks")
      .select("id,legislation_source_id,source,section,topic_tags,body,metadata")
      .limit(request.task === "nsw-law-lookup" ? 8 : 3),
  ]);

  const results: Array<MaybeErrorResult<unknown>> = [
    cardsResult,
    messagesResult,
    documentsResult,
    attachmentsResult,
    projectsResult,
    proposalsResult,
    votesResult,
    conditionsResult,
    auditResult,
    accountsResult,
    budgetLinesResult,
    allowancesResult,
    invoicesResult,
    quoteReviewsResult,
    legislationSourcesResult,
    legislationResult,
  ];

  if (results.some((result) => result.error)) {
    throw upstreamUnavailable("SUPABASE_AI_CONTEXT_QUERY_FAILED");
  }

  for (const card of cardsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "card",
      id: card.id,
      title: card.title,
      summary: `${card.type} card is ${card.status}. ${truncate(card.description)}`,
      visibility: mapVisibility(card.visibility),
      citations: [`card:${card.id}`],
    });
  }

  for (const message of messagesResult.data ?? []) {
    addRecord(records, citations, {
      kind: "message",
      id: message.id,
      title: `Discussion message ${message.id.slice(0, 8)}`,
      summary: truncate(message.body),
      citations: [`message:${message.id}`, `card:${message.card_id}`],
    });
  }

  for (const proposal of proposalsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "proposal",
      id: proposal.id,
      title: proposal.title,
      summary: `${proposal.status}. ${truncate(proposal.rationale)} Deadline: ${proposal.deadline ?? "not set"}.`,
      citations: [`proposal:${proposal.id}`, `card:${proposal.card_id}`],
    });
  }

  for (const vote of votesResult.data ?? []) {
    addRecord(records, citations, {
      kind: "vote",
      id: vote.id,
      title: `Vote ${vote.vote}`,
      summary: truncate(vote.note ?? `Vote recorded as ${vote.vote}.`),
      citations: [`vote:${vote.id}`, `proposal:${vote.proposal_id}`],
    });
  }

  for (const condition of conditionsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "approval_condition",
      id: condition.id,
      title: `Approval condition ${condition.status}`,
      summary: truncate(condition.condition_text),
      citations: compact([`condition:${condition.id}`, condition.proposal_id ? `proposal:${condition.proposal_id}` : null]),
    });
  }

  for (const document of documentsResult.data ?? []) {
    const storagePath = metadataString(document.metadata, "storage_object_path");
    addRecord(records, citations, {
      kind: "document",
      id: document.id,
      title: document.title,
      summary: `${document.document_type}. ${truncate(document.summary)}`,
      visibility: mapVisibility(document.visibility),
      citations: compact([document.markdown_path, document.extracted_text_path, document.storage_path, storagePath, `document:${document.id}`]),
    });
  }

  for (const attachment of attachmentsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "attachment",
      id: attachment.id,
      title: attachment.file_name,
      summary: truncate(attachment.markdown ?? attachment.extracted_text ?? attachment.file_path),
      citations: compact([attachment.file_path, attachment.document_id ? `document:${attachment.document_id}` : null]),
    });
  }

  for (const project of projectsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "project",
      id: project.id,
      title: project.name,
      summary: `${project.status}; ${project.progress_percent}% complete. ${truncate(project.planned_scope)}`,
      citations: [`project:${project.id}`],
    });
  }

  for (const account of accountsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "account",
      id: account.id,
      title: account.name,
      summary: `${account.account_type} account with opening balance ${account.opening_balance}.`,
      citations: [`account:${account.id}`],
    });
  }

  for (const line of budgetLinesResult.data ?? []) {
    addRecord(records, citations, {
      kind: "budget_line",
      id: line.id,
      title: line.category,
      summary: `Approved amount ${line.approved_amount}.`,
      citations: [`budget_line:${line.id}`],
    });
  }

  for (const allowance of allowancesResult.data ?? []) {
    addRecord(records, citations, {
      kind: "budget_allowance",
      id: allowance.id,
      title: allowance.name,
      summary: `Approved ${allowance.approved_amount}; committed ${allowance.committed_amount}; invoiced ${allowance.invoiced_amount}. ${truncate(allowance.notes)}`,
      citations: [`budget_allowance:${allowance.id}`],
    });
  }

  for (const invoice of invoicesResult.data ?? []) {
    addRecord(records, citations, {
      kind: "invoice",
      id: invoice.id,
      title: invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`,
      summary: `${invoice.approval_status}; amount ${invoice.amount}; due ${invoice.due_on ?? "not set"}.`,
      citations: compact([`invoice:${invoice.id}`, invoice.document_id ? `document:${invoice.document_id}` : null]),
    });
  }

  for (const quote of quoteReviewsResult.data ?? []) {
    addRecord(records, citations, {
      kind: "quote_review",
      id: quote.id,
      title: `Quote risk ${quote.overall_risk}`,
      summary: [
        `Missing: ${quote.missing_inclusions.join(", ") || "none recorded"}.`,
        `Exclusions: ${quote.risky_exclusions.join(", ") || "none recorded"}.`,
        `Questions: ${quote.clarification_questions.join(", ") || "none recorded"}.`,
      ].join(" "),
      citations: compact([`quote_review:${quote.id}`, quote.card_id ? `card:${quote.card_id}` : null]),
    });
  }

  for (const event of auditResult.data ?? []) {
    addRecord(records, citations, {
      kind: "audit_event",
      id: event.id,
      title: event.action,
      summary: `${event.target}; ${event.created_at}.`,
      citations: compact([`audit:${event.id}`, event.card_id ? `card:${event.card_id}` : null]),
    });
  }

  const lawSourceById = new Map((legislationSourcesResult.data ?? []).map((source) => [source.id, source]));

  for (const chunk of legislationResult.data ?? []) {
    const source = chunk.legislation_source_id ? lawSourceById.get(chunk.legislation_source_id) : null;
    const sourceTitle = source?.title ?? chunk.source;
    const sourceUrl = source?.url ?? "official source URL not indexed";
    const version = source?.version_label ? ` Version: ${source.version_label}.` : "";
    const limitation = metadataString(chunk.metadata, "limitation");

    addRecord(records, citations, {
      kind: "legislation",
      id: chunk.id,
      title: `${sourceTitle}: ${chunk.section}`,
      summary: `Official source: ${sourceUrl}.${version} ${limitation ? `Limitation: ${limitation}. ` : ""}${truncate(chunk.body, 800)}`,
      citations: [`${sourceTitle} - ${chunk.section} (${sourceUrl})`],
    });
  }

  return {
    source: "supabase",
    records,
    citations: dedupeCitations(citations).slice(0, 30),
    notice: "Context returned from RLS-protected Supabase queries for the current member.",
  };
}

function dedupeCitations(citations: AiCitation[]) {
  const seen = new Set<string>();
  const unique: AiCitation[] = [];

  for (const citation of citations) {
    if (!seen.has(citation.id)) {
      unique.push(citation);
      seen.add(citation.id);
    }
  }

  return unique;
}

function cardToContextRecord(card: GovernanceCard): AiContextRecord {
  return {
    kind: "card",
    id: card.id,
    title: card.title,
    summary: card.aiBrief,
    visibility: card.visibility,
    citations: [`card:${card.id}`, ...card.documents],
  };
}

function documentToContextRecord(document: DocumentRecord): AiContextRecord {
  return {
    kind: "document",
    id: document.id,
    title: document.name,
    summary: document.summary,
    visibility: document.visibility,
    citations: document.citations.length ? document.citations : [`document:${document.id}`],
  };
}

function projectToContextRecord(project: Project): AiContextRecord {
  return {
    kind: "project",
    id: project.id,
    title: project.name,
    summary: project.aiSummary,
    citations: [`project:${project.id}`, ...project.evidence],
  };
}

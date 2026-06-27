import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activity as fallbackActivity,
  budgetLines as fallbackBudgetLines,
  cards as fallbackCards,
  documents as fallbackDocuments,
  members as fallbackMembers,
  projects as fallbackProjects,
  type AuditEvent,
  type BudgetLine,
  type BudgetRecommendation,
  type CardStatus,
  type CardType,
  type DocumentRecord,
  type GovernanceCard,
  type InvoiceSummary,
  type Member,
  type Project,
  type QuoteReviewSummary,
  type VendorRecord,
  type Visibility,
} from "@/lib/strata-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CardStatusDb,
  CardTypeDb,
  Database,
  DocumentStatusDb,
  Json,
  ProjectStatusDb,
  VisibilityLevel,
  VoteValue,
} from "@/lib/supabase/types";

export type DataSource = "fallback" | "supabase";

export interface StrataAppData {
  source: DataSource;
  sourceDetail: string;
  auth: {
    mode: "fallback" | "signed-out" | "active";
    member: CurrentMember | null;
  };
  cards: GovernanceCard[];
  documents: DocumentRecord[];
  projects: Project[];
  vendors: VendorRecord[];
  members: Member[];
  activity: AuditEvent[];
  budgetLines: BudgetLine[];
  budgetRecommendation: BudgetRecommendation;
}

export interface CurrentMember {
  id: string;
  committee_id: string;
  role: string;
  full_name: string;
  user_id: string | null;
  email: string;
  access_level: string;
}

type AppSupabase = SupabaseClient<Database>;

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | null;
};

type VoteRow = {
  vote: VoteValue;
};

type ApprovalConditionRow = {
  condition_text: string;
  status: string;
};

type ProposalRow = {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  votes?: VoteRow[] | null;
  approval_conditions?: ApprovalConditionRow[] | null;
};

type CardQueryRow = {
  id: string;
  title: string;
  description: string;
  type: CardTypeDb;
  status: CardStatusDb;
  visibility: VisibilityLevel;
  linked_project_id: string | null;
  updated_at: string;
  created_at: string;
  messages?: MessageRow[] | null;
  proposals?: ProposalRow[] | null;
  project?: { name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

type DocumentQueryRow = {
  id: string;
  title: string;
  document_type: string;
  source_date: string | null;
  visibility: VisibilityLevel;
  indexed_status: DocumentStatusDb;
  storage_path: string | null;
  extracted_text_path: string | null;
  markdown_path: string | null;
  summary: string | null;
  metadata: Json | null;
};

type AttachmentQueryRow = {
  id: string;
  card_id: string | null;
  document_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
};

type ProjectQueryRow = {
  id: string;
  name: string;
  status: ProjectStatusDb;
  planned_scope: string;
  progress_percent: number;
  budget_allowance_id: string | null;
};

type AuditQueryRow = {
  id: string;
  action: string;
  target: string;
  created_at: string;
  card_id: string | null;
  user_id: string | null;
  metadata: unknown;
};

type AccountQueryRow = {
  id: string;
  name: string;
};

type BudgetLineQueryRow = {
  id: string;
  account_id: string | null;
  category: string;
  approved_amount: number;
};

type BudgetAllowanceQueryRow = {
  id: string;
  budget_line_id: string | null;
  name: string;
  approved_amount: number;
  committed_amount: number;
  invoiced_amount: number;
};

type VendorQueryRow = {
  id: string;
  name: string;
  contact_email: string | null;
  phone: string | null;
  insurance_status: string | null;
};

type InvoiceQueryRow = {
  id: string;
  project_id: string | null;
  card_id: string | null;
  vendor_id: string | null;
  document_id: string | null;
  invoice_number: string | null;
  amount: number;
  approval_status: string;
  due_on: string | null;
};

type QuoteReviewQueryRow = {
  id: string;
  card_id: string | null;
  document_id: string | null;
  overall_risk: "low" | "medium" | "high";
  missing_inclusions: string[];
  risky_exclusions: string[];
  clarification_questions: string[];
  approval_conditions: string[];
};

type MemberQueryRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: "active" | "invited" | "suspended";
  access_level: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type ExpenseQueryRow = {
  budget_line_id: string | null;
  amount: number;
};

type MilestoneQueryRow = {
  project_id: string;
  label: string;
  planned_on: string | null;
  actual_on: string | null;
  status: string;
};

type VariationQueryRow = {
  project_id: string | null;
  id: string;
  title: string;
  amount: number;
  status: string;
};

export const fallbackAppData: StrataAppData = {
  source: "fallback",
  sourceDetail: "Seeded local data",
  auth: {
    mode: "fallback",
    member: null,
  },
  cards: fallbackCards,
  documents: fallbackDocuments,
  projects: fallbackProjects,
  vendors: [],
  members: fallbackMembers,
  activity: fallbackActivity,
  budgetLines: fallbackBudgetLines,
  budgetRecommendation: {
    summary:
      "Unit 20 and fire compliance both need better cost certainty before more approvals. Verify figures against official strata accounts before spending or levy decisions.",
    citations: ["Local fallback budget lines", "Local fallback project records"],
    disclaimer: "General information only. Not legal, financial, or accounting advice.",
  },
};

const cardStatusMap: Record<CardStatusDb, CardStatus> = {
  open: "Open",
  pending_vote: "Pending vote",
  resolved: "Resolved",
  urgent: "Urgent",
  confidential: "Confidential",
};

const cardTypeMap: Record<CardTypeDb, CardType> = {
  maintenance: "Maintenance",
  quote: "Quote",
  invoice: "Invoice",
  compliance: "Compliance",
  budget: "Budget",
  project: "Project",
  variation: "Variation",
  incident: "Incident",
  dispute: "Dispute",
  meeting: "Meeting",
  general: "General",
};

const visibilityMap: Record<VisibilityLevel, Visibility> = {
  all: "All members",
  admins: "Admins only",
  custom: "Selected members",
};

const documentStatusMap: Record<DocumentStatusDb, DocumentRecord["status"]> = {
  uploaded: "Needs extraction",
  needs_extraction: "Needs extraction",
  markdown_ready: "Markdown ready",
  indexed: "Indexed",
  review_required: "Review required",
};

const projectStatusMap: Record<ProjectStatusDb, Project["status"]> = {
  on_track: "On track",
  at_risk: "At risk",
  needs_decision: "Needs decision",
  resolved: "On track",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not dated";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function voteTally(votes: VoteRow[] | null | undefined) {
  return {
    yes: votes?.filter((vote) => vote.vote === "yes").length ?? 0,
    no: votes?.filter((vote) => vote.vote === "no").length ?? 0,
    abstain: votes?.filter((vote) => vote.vote === "abstain").length ?? 0,
  };
}

function recordFromJson(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function mapCard(row: CardQueryRow, documents: DocumentQueryRow[], attachments: AttachmentQueryRow[]): GovernanceCard {
  const proposal = row.proposals?.[0];
  const conditions =
    proposal?.approval_conditions?.map((condition) => condition.condition_text).filter(Boolean) ?? [];
  const messages = row.messages ?? [];
  const linkedDocuments = attachments
    .filter((attachment) => attachment.card_id === row.id)
    .map((attachment) => {
      const document = documents.find((item) => item.id === attachment.document_id);
      return document?.title ?? attachment.file_name;
    });

  return {
    id: row.id,
    title: row.title,
    type: cardTypeMap[row.type],
    status: cardStatusMap[row.status],
    visibility: visibilityMap[row.visibility],
    owner: row.creator?.full_name ?? "Committee",
    updated: formatDate(row.updated_at),
    description: row.description,
    linkedProject: row.project?.name ?? undefined,
    documents: uniqueStrings(linkedDocuments),
    messages: messages.map((message) => ({
      author: message.author?.full_name ?? "Committee member",
      body: message.body,
      time: formatDateTime(message.created_at),
    })),
    proposal: {
      id: proposal?.id,
      title: proposal?.title ?? "No proposal yet",
      majority: proposal ? `${voteTally(proposal.votes).yes} yes recorded` : "No vote open",
      closes: proposal?.deadline ? formatDate(proposal.deadline) : "Not scheduled",
      votes: voteTally(proposal?.votes),
      conditions,
      unresolved: conditions.length ? [] : ["No approval conditions captured yet."],
    },
    aiBrief:
      row.description ||
      "Visible card loaded from Supabase. AI summaries will use only records returned through RLS-protected queries.",
    risks: [],
    audit: [],
  };
}

function mapDocument(
  row: DocumentQueryRow,
  cards: CardQueryRow[],
  projects: ProjectQueryRow[],
  attachments: AttachmentQueryRow[],
): DocumentRecord {
  const metadata = recordFromJson(row.metadata);
  const linkedCardId = stringFromRecord(metadata, "linked_card_id");
  const linkedProjectId = stringFromRecord(metadata, "linked_project_id");
  const linkedAttachment = attachments.find((attachment) => attachment.document_id === row.id);
  const linkedCard = cards.find((card) => card.id === linkedCardId || card.id === linkedAttachment?.card_id);
  const linkedProject = projects.find((project) => project.id === linkedProjectId);
  const storageObjectPath = stringFromRecord(metadata, "storage_object_path") ?? linkedAttachment?.file_path;
  const linkedTo = uniqueStrings([
    linkedCard ? `Card: ${linkedCard.title}` : null,
    linkedProject ? `Project: ${linkedProject.name}` : null,
  ]);
  const citations = uniqueStrings([
    row.markdown_path,
    row.extracted_text_path,
    storageObjectPath ? `storage:${storageObjectPath}` : null,
    linkedAttachment?.file_name,
  ]);

  return {
    id: row.id,
    name: row.title,
    type: row.document_type,
    date: row.source_date ?? "Not dated",
    visibility: visibilityMap[row.visibility],
    status: documentStatusMap[row.indexed_status],
    linkedTo,
    storagePath: row.storage_path ?? (storageObjectPath ? `strata-documents/${storageObjectPath}` : "No storage object"),
    extractedTextPath: row.extracted_text_path ?? "Pending extraction",
    markdownPath: row.markdown_path ?? "Pending Markdown conversion",
    summary: row.summary ?? "No summary recorded yet.",
    citations,
  };
}

function mapVendors(rows: VendorQueryRow[]): VendorRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contactEmail: row.contact_email ?? "No email",
    phone: row.phone ?? "No phone",
    insuranceStatus: row.insurance_status ?? "Not recorded",
  }));
}

function mapInvoices(
  rows: InvoiceQueryRow[],
  vendors: VendorQueryRow[],
  documents: DocumentQueryRow[],
  cards: CardQueryRow[],
): InvoiceSummary[] {
  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number ?? `Invoice ${row.id.slice(0, 8)}`,
    vendor: vendors.find((vendor) => vendor.id === row.vendor_id)?.name ?? "Unassigned vendor",
    amount: row.amount,
    status: row.approval_status,
    due: row.due_on ? formatDate(row.due_on) : "No due date",
    document: documents.find((document) => document.id === row.document_id)?.title ?? "No linked document",
    card: cards.find((card) => card.id === row.card_id)?.title ?? "No linked card",
  }));
}

function mapQuoteReviews(
  rows: QuoteReviewQueryRow[],
  documents: DocumentQueryRow[],
  cards: CardQueryRow[],
): QuoteReviewSummary[] {
  const riskMap = { low: "Low", medium: "Medium", high: "High" } as const;

  return rows.map((row) => ({
    id: row.id,
    card: cards.find((card) => card.id === row.card_id)?.title ?? "No linked card",
    document: documents.find((document) => document.id === row.document_id)?.title ?? "No linked document",
    risk: riskMap[row.overall_risk],
    missingInclusions: row.missing_inclusions,
    riskyExclusions: row.risky_exclusions,
    clarificationQuestions: row.clarification_questions,
    approvalConditions: row.approval_conditions,
  }));
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function mapMemberStatus(status: MemberQueryRow["status"]): Member["status"] {
  if (status === "active") {
    return "Active";
  }

  if (status === "invited") {
    return "Invited";
  }

  return "Inactive";
}

function mapMembers(rows: MemberQueryRow[]): Member[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.full_name,
    role: titleCase(row.role),
    roleValue: row.role,
    status: mapMemberStatus(row.status),
    statusValue: row.status,
    access: titleCase(row.access_level ?? "member"),
    accessValue: row.access_level ?? "member",
    lastActive: row.accepted_at
      ? `Accepted ${formatDate(row.accepted_at)}`
      : row.invited_at
        ? `Invited ${formatDate(row.invited_at)}`
        : `Created ${formatDate(row.created_at)}`,
  }));
}

function mapProject(
  row: ProjectQueryRow,
  allowance: BudgetAllowanceQueryRow | undefined,
  milestones: MilestoneQueryRow[],
  variations: VariationQueryRow[],
  documents: DocumentQueryRow[],
  attachments: AttachmentQueryRow[],
  invoices: InvoiceQueryRow[],
  quoteReviews: QuoteReviewQueryRow[],
  vendors: VendorQueryRow[],
  cards: CardQueryRow[],
): Project {
  const evidence = documents
    .filter((document) => {
      const metadata = recordFromJson(document.metadata);
      return stringFromRecord(metadata, "linked_project_id") === row.id;
    })
    .map((document) => {
      const attachment = attachments.find((item) => item.document_id === document.id);
      return attachment?.file_name ?? document.title;
    });

  return {
    id: row.id,
    name: row.name,
    status: projectStatusMap[row.status],
    plannedScope: row.planned_scope,
    progress: row.progress_percent,
    allowance: allowance?.approved_amount ?? 0,
    committed: allowance?.committed_amount ?? 0,
    invoiced: allowance?.invoiced_amount ?? 0,
    remaining: (allowance?.approved_amount ?? 0) - (allowance?.committed_amount ?? 0),
    milestones: milestones.map((milestone) => ({
      label: milestone.label,
      planned: formatDate(milestone.planned_on),
      actual: milestone.actual_on ? formatDate(milestone.actual_on) : "Pending",
      status: milestone.status,
    })),
    variations: variations.map((variation) => ({
      id: variation.id,
      title: variation.title,
      amount: variation.amount,
      status: variation.status,
    })),
    invoices: mapInvoices(
      invoices.filter((invoice) => invoice.project_id === row.id),
      vendors,
      documents,
      cards,
    ),
    quoteReviews: mapQuoteReviews(
      quoteReviews.filter((review) => {
        const card = cards.find((item) => item.id === review.card_id);
        return card?.linked_project_id === row.id || documents.some((document) => {
          const metadata = recordFromJson(document.metadata);
          return document.id === review.document_id && stringFromRecord(metadata, "linked_project_id") === row.id;
        });
      }),
      documents,
      cards,
    ),
    evidence: uniqueStrings(evidence),
    aiSummary:
      "Supabase project summary uses visible project, allowance, variation, milestone, and invoice records only. Verify figures against official strata accounts before committee decisions.",
  };
}

function mapBudgetLines(
  lines: BudgetLineQueryRow[],
  accounts: AccountQueryRow[],
  allowances: BudgetAllowanceQueryRow[],
  expenses: ExpenseQueryRow[],
): BudgetLine[] {
  return lines.map((line) => {
    const lineAllowances = allowances.filter((allowance) => allowance.budget_line_id === line.id);
    const committed = lineAllowances.reduce((sum, allowance) => sum + allowance.committed_amount, 0);
    const actual = expenses.filter((expense) => expense.budget_line_id === line.id).reduce((sum, expense) => sum + expense.amount, 0);
    const account = accounts.find((item) => item.id === line.account_id)?.name ?? "Unassigned account";
    const ratio = line.approved_amount ? Math.round((committed / line.approved_amount) * 100) : 0;

    return {
      category: line.category,
      account,
      approved: line.approved_amount,
      committed,
      actual,
      risk: ratio > 95 ? "Allowance pressure" : ratio > 75 ? "Monitor committed spend" : "Within current allowance",
    };
  });
}

function mapAudit(row: AuditQueryRow): AuditEvent {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : null;
  const aiDetail = metadata?.workflow === "ai-generation"
    ? [
        typeof metadata.status === "string" ? `status ${metadata.status}` : null,
        typeof metadata.created_mode === "string" ? `mode ${metadata.created_mode}` : null,
        typeof metadata.duration_ms === "number" ? `${metadata.duration_ms}ms` : null,
        typeof metadata.input_record_count === "number" ? `${metadata.input_record_count} records` : null,
        typeof metadata.citation_count === "number" ? `${metadata.citation_count} citations` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return {
    actor: row.user_id ? "Authenticated user" : "System",
    action: row.action,
    target: row.target,
    time: formatDateTime(row.created_at),
    cardId: row.card_id ?? undefined,
    detail: aiDetail || undefined,
  };
}

export async function getCurrentMember(supabase: AppSupabase): Promise<CurrentMember | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, committee_id, role, full_name, user_id, email, access_level")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getStrataAppData(accessToken?: string): Promise<StrataAppData> {
  const supabase = await getSupabaseServerClient(accessToken);

  if (!supabase) {
    return fallbackAppData;
  }

  const member = await getCurrentMember(supabase);

  if (!member) {
    return {
      source: "supabase",
      sourceDetail: "Sign in with an active committee account to load Supabase workspace data",
      auth: {
        mode: "signed-out",
        member: null,
      },
      cards: [],
      documents: [],
      projects: [],
      vendors: [],
      members: [],
      activity: [],
      budgetLines: [],
      budgetRecommendation: {
        summary: "Sign in to load budget recommendations from visible strata records.",
        citations: [],
        disclaimer: "General information only. Not legal, financial, accounting, engineering, or strata management advice.",
      },
    };
  }

  const [
    cardsResult,
    documentsResult,
    projectsResult,
    auditResult,
    accountsResult,
    budgetLinesResult,
    allowancesResult,
    expensesResult,
    milestonesResult,
    variationsResult,
    attachmentsResult,
    vendorsResult,
    invoicesResult,
    quoteReviewsResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,title,description,type,status,visibility,linked_project_id,updated_at,created_at,messages(id,body,created_at,author:members!messages_author_member_id_fkey(full_name)),proposals(id,title,status,deadline,votes(vote),approval_conditions(condition_text,status)),project:projects!cards_linked_project_id_fkey(name),creator:members!cards_creator_member_id_fkey(full_name)",
      )
      .eq("committee_id", member.committee_id)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("documents")
      .select("id,title,document_type,source_date,visibility,indexed_status,storage_path,extracted_text_path,markdown_path,summary,metadata")
      .eq("committee_id", member.committee_id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("projects")
      .select("id,name,status,planned_scope,progress_percent,budget_allowance_id")
      .eq("committee_id", member.committee_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_log")
      .select("id,action,target,created_at,card_id,user_id,metadata")
      .eq("committee_id", member.committee_id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("accounts").select("id,name").eq("committee_id", member.committee_id).limit(20),
    supabase
      .from("budget_lines")
      .select("id,account_id,category,approved_amount")
      .eq("committee_id", member.committee_id)
      .order("category")
      .limit(40),
    supabase
      .from("budget_allowances")
      .select("id,budget_line_id,name,approved_amount,committed_amount,invoiced_amount")
      .eq("committee_id", member.committee_id)
      .limit(40),
    supabase.from("expenses").select("budget_line_id,amount").eq("committee_id", member.committee_id).limit(80),
    supabase
      .from("project_milestones")
      .select("project_id,label,planned_on,actual_on,status")
      .eq("committee_id", member.committee_id)
      .order("planned_on")
      .limit(80),
    supabase.from("variations").select("project_id,id,title,amount,status").eq("committee_id", member.committee_id).limit(80),
    supabase
      .from("attachments")
      .select("id,card_id,document_id,file_name,file_path,file_type")
      .eq("committee_id", member.committee_id)
      .limit(100),
    supabase.from("vendors").select("id,name,contact_email,phone,insurance_status").eq("committee_id", member.committee_id).limit(50),
    supabase
      .from("invoices")
      .select("id,project_id,card_id,vendor_id,document_id,invoice_number,amount,approval_status,due_on")
      .eq("committee_id", member.committee_id)
      .limit(80),
    supabase
      .from("quote_reviews")
      .select("id,card_id,document_id,overall_risk,missing_inclusions,risky_exclusions,clarification_questions,approval_conditions")
      .eq("committee_id", member.committee_id)
      .limit(80),
    supabase
      .from("members")
      .select("id,email,full_name,role,status,access_level,invited_at,accepted_at,created_at")
      .eq("committee_id", member.committee_id)
      .order("full_name")
      .limit(100),
  ]);

  if (
    cardsResult.error ||
    documentsResult.error ||
    projectsResult.error ||
    auditResult.error ||
    accountsResult.error ||
    budgetLinesResult.error ||
    allowancesResult.error ||
    expensesResult.error ||
    milestonesResult.error ||
    variationsResult.error ||
    attachmentsResult.error ||
    vendorsResult.error ||
    invoicesResult.error ||
    quoteReviewsResult.error ||
    membersResult.error
  ) {
    return {
      ...fallbackAppData,
      sourceDetail: "Supabase query failed; using local fallback data",
    };
  }

  const supabaseCards = (cardsResult.data ?? []) as unknown as CardQueryRow[];
  const supabaseDocuments = (documentsResult.data ?? []) as unknown as DocumentQueryRow[];
  const supabaseProjects = (projectsResult.data ?? []) as unknown as ProjectQueryRow[];
  const supabaseActivity = (auditResult.data ?? []) as unknown as AuditQueryRow[];
  const supabaseAccounts = (accountsResult.data ?? []) as unknown as AccountQueryRow[];
  const supabaseBudgetLines = (budgetLinesResult.data ?? []) as unknown as BudgetLineQueryRow[];
  const supabaseAllowances = (allowancesResult.data ?? []) as unknown as BudgetAllowanceQueryRow[];
  const supabaseExpenses = (expensesResult.data ?? []) as unknown as ExpenseQueryRow[];
  const supabaseMilestones = (milestonesResult.data ?? []) as unknown as MilestoneQueryRow[];
  const supabaseVariations = (variationsResult.data ?? []) as unknown as VariationQueryRow[];
  const supabaseAttachments = (attachmentsResult.data ?? []) as unknown as AttachmentQueryRow[];
  const supabaseVendors = (vendorsResult.data ?? []) as unknown as VendorQueryRow[];
  const supabaseInvoices = (invoicesResult.data ?? []) as unknown as InvoiceQueryRow[];
  const supabaseQuoteReviews = (quoteReviewsResult.data ?? []) as unknown as QuoteReviewQueryRow[];
  const supabaseMembers = (membersResult.data ?? []) as unknown as MemberQueryRow[];
  const activity = supabaseActivity.map(mapAudit);
  const cards = supabaseCards.map((card) => {
    const mapped = mapCard(card, supabaseDocuments, supabaseAttachments);
    return {
      ...mapped,
      audit: activity.filter((event) => event.cardId === mapped.id),
    };
  });
  const budgetLines = mapBudgetLines(supabaseBudgetLines, supabaseAccounts, supabaseAllowances, supabaseExpenses);
  const projects = supabaseProjects.map((project) =>
    mapProject(
      project,
      supabaseAllowances.find((allowance) => allowance.id === project.budget_allowance_id),
      supabaseMilestones.filter((milestone) => milestone.project_id === project.id),
      supabaseVariations.filter((variation) => variation.project_id === project.id),
      supabaseDocuments,
      supabaseAttachments,
      supabaseInvoices,
      supabaseQuoteReviews,
      supabaseVendors,
      supabaseCards,
    ),
  );
  const budgetRecommendation = {
    summary:
      "Supabase budget recommendation uses visible accounts, allowances, expenses, projects, variations, and invoices. Reconcile against official strata accounts before approving spend.",
    citations: [
      `${budgetLines.length || fallbackBudgetLines.length} budget lines`,
      `${projects.length || fallbackProjects.length} project records`,
      `${supabaseExpenses.length} expense records`,
      `${supabaseInvoices.length} invoice records`,
    ],
    disclaimer: "General information only. Not legal, financial, accounting, engineering, or strata management advice.",
  };

  return {
    source: "supabase",
    sourceDetail: "Supabase RLS-backed session data",
    auth: {
      mode: "active",
      member,
    },
    cards: supabaseCards.length ? cards : fallbackCards,
    documents: supabaseDocuments.length
      ? supabaseDocuments.map((document) => mapDocument(document, supabaseCards, supabaseProjects, supabaseAttachments))
      : fallbackDocuments,
    projects: projects.length ? projects : fallbackProjects,
    vendors: supabaseVendors.length ? mapVendors(supabaseVendors) : [],
    members: supabaseMembers.length ? mapMembers(supabaseMembers) : [],
    activity: activity.length ? activity : fallbackActivity,
    budgetLines: budgetLines.length ? budgetLines : fallbackBudgetLines,
    budgetRecommendation,
  };
}

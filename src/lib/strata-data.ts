import type { MotionStatusDb } from "@/lib/supabase/types";

import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FolderKanban,
  Gavel,
  Inbox,
  Landmark,
  ListChecks,
  LockKeyhole,
  MessagesSquare,
  Scale,
  Sparkles,
  Vote,
} from "lucide-react";

export type NavKey =
  | "dashboard"
  | "cards"
  | "documents"
  | "projects"
  | "budget"
  | "incidents"
  | "members"
  | "activity";

export type StatusTone = "blue" | "amber" | "green" | "red" | "slate" | "violet";

export type CardStatus = "Open" | "Pending vote" | "Resolved" | "Urgent" | "Confidential";

export type CardType =
  | "Maintenance"
  | "Quote"
  | "Invoice"
  | "Compliance"
  | "Budget"
  | "Project"
  | "Variation"
  | "Incident"
  | "Dispute"
  | "Meeting"
  | "General";

export type Visibility = "All members" | "Admins only" | "Selected members";

export interface GovernanceCard {
  id: string;
  sourceRefs?: string[];
  title: string;
  type: CardType;
  status: CardStatus;
  visibility: Visibility;
  owner: string;
  updated: string;
  description: string;
  linkedProject?: string;
  documents: string[];
  messages: Message[];
  proposal: Proposal;
  aiBrief: string;
  risks: RiskItem[];
  audit: AuditEvent[];
}

export interface Message {
  author: string;
  body: string;
  time: string;
}

export interface Proposal {
  id?: string;
  title: string;
  majority: string;
  closes: string;
  votes: { yes: number; no: number; abstain: number };
  conditions: string[];
  unresolved: string[];
}

export interface RiskItem {
  label: string;
  severity: "High" | "Medium" | "Low";
  detail: string;
}

export interface DocumentRecord {
  id: string;
  sourceRefs?: string[];
  name: string;
  type: string;
  date: string;
  visibility: Visibility;
  status: "Indexed" | "Needs extraction" | "Markdown ready" | "Review required";
  linkedTo: string[];
  storagePath: string;
  extractedTextPath: string;
  markdownPath: string;
  summary: string;
  citations: string[];
}

export interface Project {
  id: string;
  sourceRefs?: string[];
  name: string;
  status: "At risk" | "On track" | "Needs decision";
  plannedScope: string;
  progress: number;
  allowance: number;
  committed: number;
  invoiced: number;
  remaining: number;
  milestones: { label: string; planned: string; actual: string; status: string }[];
  variations: { id: string; title: string; amount: number; status: string }[];
  invoices: InvoiceSummary[];
  quoteReviews: QuoteReviewSummary[];
  evidence: string[];
  aiSummary: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  insuranceStatus: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  status: string;
  due: string;
  document: string;
  card: string;
}

export interface QuoteReviewSummary {
  id: string;
  card: string;
  document: string;
  risk: "Low" | "Medium" | "High";
  missingInclusions: string[];
  riskyExclusions: string[];
  clarificationQuestions: string[];
  approvalConditions: string[];
}

export interface BudgetLine {
  sourceRefs?: string[];
  category: string;
  account: string;
  approved: number;
  committed: number;
  actual: number;
  risk: string;
}

export interface BudgetRecommendation {
  summary: string;
  citations: string[];
  disclaimer: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: "High" | "Medium" | "Low";
  status: "Open" | "Investigating" | "Closed";
  location: string;
  date: string;
  summary: string;
  evidence: string[];
  followUps: string[];
  residentNotice: string;
}

export interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  roleValue: string;
  status: "Active" | "Invited" | "Inactive";
  statusValue: "active" | "invited" | "suspended";
  access: string;
  accessValue: string;
  lastActive: string;
}

export interface AuditEvent {
  id?: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  cardId?: string;
  motionId?: string;
  detail?: string;
}

export type MotionStatus = "Draft" | "Open" | "Decided" | "Withdrawn";

export interface Motion {
  id: string;
  title: string;
  context: string;
  status: MotionStatus;
  statusValue: MotionStatusDb;
  creator: string;
  created: string;
  updated: string;
  openedAt?: string;
  decidedAt?: string;
  withdrawnAt?: string;
  audit: AuditEvent[];
}

export const statusTone: Record<string, StatusTone> = {
  Open: "blue",
  "Pending vote": "amber",
  Resolved: "green",
  Urgent: "red",
  Confidential: "slate",
  Indexed: "green",
  "Needs extraction": "amber",
  "Markdown ready": "blue",
  "Review required": "red",
  Active: "green",
  Invited: "amber",
  Inactive: "slate",
  "At risk": "red",
  "On track": "green",
  "Needs decision": "amber",
  High: "red",
  Medium: "amber",
  Low: "green",
  OpenIncident: "blue",
  Draft: "amber",
  Decided: "green",
  Withdrawn: "slate",
};

export const kpis = [
  { label: "Open cards", value: "12", detail: "3 need committee input", icon: FolderKanban },
  { label: "Pending votes", value: "4", detail: "2 close this week", icon: Vote },
  { label: "Project variance", value: "$18.4k", detail: "Mostly uncosted make-good work", icon: Banknote },
  { label: "Indexed docs", value: "38", detail: "9 need Markdown review", icon: FileCheck2 },
];

export const cards: GovernanceCard[] = [
  {
    id: "CARD-104",
    title: "Basement fire door replacement quote",
    type: "Quote",
    status: "Pending vote",
    visibility: "All members",
    owner: "Ric Spooner",
    updated: "24 Jun 2026",
    description:
      "Committee decision needed on the Abate fire door and frame replacement quote, including exclusions, warranty, painting, certification, and make-good conditions.",
    linkedProject: "Fire compliance remediation",
    documents: ["Quote-Q-0885.pdf", "PBM quote form QR579317.docx", "Fire door photos"],
    messages: [
      {
        author: "Ric",
        time: "09:14",
        body: "Requested a committee decision and noted the legal obligation to maintain essential fire equipment.",
      },
      {
        author: "Luke",
        time: "14:43",
        body: "Approved, subject to clarifying exclusions, patching, warranty, working hours, and cleaning obligations.",
      },
      {
        author: "Deborah",
        time: "12:39",
        body: "Approved, with concern that tenants, owners, and builders should not wedge the door open.",
      },
    ],
    proposal: {
      title: "Approve Abate quote with conditions",
      majority: "5 of 8 yes",
      closes: "26 Jun 2026",
      votes: { yes: 5, no: 0, abstain: 1 },
      conditions: [
        "Confirm painting, patching, architraves, and surrounding finishes.",
        "Confirm certification and fire-rating responsibilities.",
        "Require inspection before payment in arrears.",
      ],
      unresolved: [
        "Whether the quote includes ocean-side suitable door and frame materials.",
        "Whether any asbestos-removal costs remain outside the quote.",
      ],
    },
    risks: [
      {
        label: "Exclusion drift",
        severity: "High",
        detail: "Quote excludes make-good items unless explicitly stated, creating likely variation exposure.",
      },
      {
        label: "Warranty dependency",
        severity: "Medium",
        detail: "Door warranty may depend on painting within 30 days, so painting scope should be confirmed.",
      },
      {
        label: "Certification gap",
        severity: "Medium",
        detail: "Design alterations and certification are excluded unless explicitly stated.",
      },
    ],
    aiBrief:
      "The committee is leaning toward approval because the basement fire door is inoperative and likely a compliance obligation. The approval should be conditional on clarifying make-good exclusions, certification, painting, warranty, work hours, and payment after inspection. No hidden card content is included in this summary.",
    audit: [
      { actor: "Ric", action: "Created proposal", target: "Abate quote vote", time: "24 Jun 2026 09:14" },
      { actor: "Luke", action: "Added approval conditions", target: "Quote risk checklist", time: "24 Jun 2026 14:43" },
      { actor: "System", action: "Generated AI brief", target: "CARD-104", time: "24 Jun 2026 14:45" },
    ],
  },
  {
    id: "CARD-088",
    title: "Unit 20 internal painting variation",
    type: "Variation",
    status: "Resolved",
    visibility: "All members",
    owner: "Ric Spooner",
    updated: "22 Jun 2026",
    description:
      "Variation 70 approval for Unit 20 painting, tied to rooftop replacement damage and the Unit 20 make-good allowance.",
    linkedProject: "Rooftop replacement and Unit 20 make-good",
    documents: ["Variation 70 - Unit 20 Internal Painting.pdf", "Progress Report 27 June 18 2026.pdf"],
    messages: [
      { author: "Luke", time: "10:38", body: "Asked what else is allocated to the same $20k make-good budget." },
      { author: "Ric", time: "15:22", body: "Clarified $25.5k total allowance and remaining uncosted items." },
      { author: "JJ", time: "18:28", body: "Approved." },
    ],
    proposal: {
      title: "Approve Variation 70",
      majority: "6 of 8 yes",
      closes: "Closed",
      votes: { yes: 6, no: 0, abstain: 0 },
      conditions: ["Finish must match existing quality.", "EBRS to estimate remaining make-good costs."],
      unresolved: ["Aircon reinstall, shutter modification, plaster, cleaning, and Unit 17 paint remain uncosted."],
    },
    risks: [
      {
        label: "Allowance burn",
        severity: "Medium",
        detail: "$8,931 consumes a material portion of the Unit 20 make-good allowance while other items remain unpriced.",
      },
    ],
    aiBrief:
      "Variation 70 is approved, but the remaining make-good scope still contains uncosted items. The project should track the $25.5k allowance, the approved painting variation, and future estimates before further approvals.",
    audit: [
      { actor: "Ric", action: "Created proposal", target: "Variation 70", time: "22 Jun 2026 10:13" },
      { actor: "Committee", action: "Approved vote", target: "Unit 20 painting", time: "22 Jun 2026 18:28" },
      { actor: "System", action: "Updated allowance", target: "Unit 20 make-good", time: "22 Jun 2026 18:29" },
    ],
  },
];

export const documents: DocumentRecord[] = [
  {
    id: "DOC-001",
    name: "Registered by-laws",
    type: "By-laws",
    date: "2025-11-18",
    visibility: "All members",
    status: "Markdown ready",
    linkedTo: ["Short-term letting questions", "Security incident"],
    storagePath: "storage/documents/doc-001/by-laws.pdf",
    extractedTextPath: "storage/documents/doc-001/extracted.txt",
    markdownPath: "storage/documents/doc-001/by-laws.md",
    summary:
      "Queryable building by-laws covering use of lots, access, conduct, common property, and short-term letting constraints.",
    citations: ["By-laws clause 8", "By-laws clause 12"],
  },
  {
    id: "DOC-014",
    name: "Progress Report 27 June 18 2026.pdf",
    type: "Progress report",
    date: "2026-06-18",
    visibility: "All members",
    status: "Needs extraction",
    linkedTo: ["Rooftop replacement and Unit 20 make-good", "CARD-088"],
    storagePath: "storage/documents/doc-014/progress-report.pdf",
    extractedTextPath: "storage/documents/doc-014/extracted.txt",
    markdownPath: "storage/documents/doc-014/progress-report.md",
    summary:
      "Weekly progress update for rooftop works and Unit 20 make-good, pending text extraction and human review.",
    citations: ["Page 2 progress summary", "Page 6 photos"],
  },
  {
    id: "DOC-022",
    name: "Quote-Q-0885.pdf",
    type: "Quote",
    date: "2026-06-24",
    visibility: "All members",
    status: "Review required",
    linkedTo: ["CARD-104", "Fire compliance remediation"],
    storagePath: "storage/documents/doc-022/quote-q-0885.pdf",
    extractedTextPath: "storage/documents/doc-022/extracted.txt",
    markdownPath: "storage/documents/doc-022/quote-q-0885.md",
    summary:
      "Fire door quote requiring review of exclusions, certification, payment terms, warranty, and make-good costs.",
    citations: ["Exclusions section", "Warranty section"],
  },
  {
    id: "DOC-030",
    name: "Levy Payment Plan Request Unit 4.pdf",
    type: "Levy request",
    date: "2026-06-22",
    visibility: "Admins only",
    status: "Indexed",
    linkedTo: ["Payment-plan decision", "Arrears policy"],
    storagePath: "storage/documents/doc-030/payment-plan.pdf",
    extractedTextPath: "storage/documents/doc-030/extracted.txt",
    markdownPath: "storage/documents/doc-030/payment-plan.md",
    summary:
      "Sensitive payment-plan request connected to levy arrears, interest treatment, precedent, and committee decision record.",
    citations: ["Request letter", "Strata manager note"],
  },
];

export const projects: Project[] = [
  {
    id: "PRJ-01",
    name: "Rooftop replacement and Unit 20 make-good",
    status: "At risk",
    plannedScope:
      "Complete rooftop replacement works, reinstate Unit 20, and close make-good items caused by construction damage.",
    progress: 72,
    allowance: 25500,
    committed: 8931,
    invoiced: 0,
    remaining: 16569,
    milestones: [
      { label: "Roof works complete", planned: "14 Jun", actual: "18 Jun", status: "Delayed" },
      { label: "Unit 20 painting", planned: "24 Jun", actual: "Pending", status: "Approved" },
      { label: "Aircon and shutters", planned: "TBC", actual: "Not started", status: "Uncosted" },
    ],
    variations: [
      { id: "VAR-70", title: "Unit 20 internal painting", amount: 8931, status: "Approved" },
      { id: "VAR-TBC", title: "Aircon reinstall and shutter modification", amount: 0, status: "Estimate needed" },
    ],
    invoices: [],
    quoteReviews: [],
    evidence: ["Progress Report 27 June 18 2026.pdf", "Variation 70 - Unit 20 Internal Painting.pdf"],
    aiSummary:
      "The project is progressing but budget certainty is weak because several known make-good items are not yet costed. Ask EBRS for estimates before approving more work from the same allowance.",
  },
  {
    id: "PRJ-02",
    name: "Fire compliance remediation",
    status: "Needs decision",
    plannedScope:
      "Restore existing essential fire equipment and resolve basement fire door defect with qualified trades and appropriate certification.",
    progress: 38,
    allowance: 12000,
    committed: 6480,
    invoiced: 0,
    remaining: 5520,
    milestones: [
      { label: "Second quote received", planned: "22 Jun", actual: "22 Jun", status: "Complete" },
      { label: "Committee approval", planned: "26 Jun", actual: "Pending", status: "Vote open" },
      { label: "Certification evidence", planned: "TBC", actual: "Not started", status: "Risk" },
    ],
    variations: [{ id: "QR579317", title: "Basement fire door and jamb replacement", amount: 6480, status: "Pending" }],
    invoices: [],
    quoteReviews: [],
    evidence: ["Quote-Q-0885.pdf", "PBM quote form QR579317.docx", "Fire door photos"],
    aiSummary:
      "The committee has evidence of a defect and a likely duty to repair existing fire equipment. The decision should be tied to conditions on certification, make-good work, warranty, and inspection before payment.",
  },
];

export const budgetLines: BudgetLine[] = [
  { category: "Unit 20 make-good", account: "Capital works", approved: 25500, committed: 8931, actual: 0, risk: "Uncosted work remains" },
  { category: "Fire compliance", account: "Admin fund", approved: 12000, committed: 6480, actual: 0, risk: "Quote exclusions unclear" },
  { category: "Security upgrades", account: "Capital works", approved: 8000, committed: 1450, actual: 1450, risk: "Camera review pending" },
  { category: "Insurance and compliance", account: "Admin fund", approved: 18600, committed: 11200, actual: 9400, risk: "On track" },
];

export const incidents: Incident[] = [
  {
    id: "INC-017",
    title: "Garage theft and southern door access",
    severity: "High",
    status: "Investigating",
    location: "Southern entry and basement garage",
    date: "18 Jun 2026",
    summary:
      "An e-bike theft exposed access-control concerns, camera angle limitations, and a need to review locks, latch protection, resident notices, and short-term letting suspicions.",
    evidence: ["Dropbox CCTV link", "Locksmith photo", "Door strike plate update"],
    followUps: [
      "Confirm police report status.",
      "Ask strata manager for owner-occupier and tenant register summary.",
      "Get quote for camera angle and access-system upgrades.",
      "Draft privacy-safe resident notice.",
    ],
    residentNotice:
      "A security incident occurred in the garage area. Please check that entry doors close securely, report suspicious access issues to the strata manager, and avoid sharing identifiable footage publicly.",
  },
];

export const members: Member[] = [
  { id: "fallback-ric", email: "ric@example.com", name: "Ric Spooner", role: "Chair", roleValue: "chair", status: "Active", statusValue: "active", access: "Admin", accessValue: "admin", lastActive: "Today" },
  { id: "fallback-jj", email: "jj@example.com", name: "JJ Lecocq", role: "Committee member", roleValue: "member", status: "Active", statusValue: "active", access: "Member", accessValue: "member", lastActive: "Today" },
  { id: "fallback-luke", email: "luke@example.com", name: "Luke Horton", role: "Committee member", roleValue: "member", status: "Active", statusValue: "active", access: "Member", accessValue: "member", lastActive: "Today" },
  { id: "fallback-deborah", email: "deborah@example.com", name: "Deborah Frack", role: "Secretary", roleValue: "secretary", status: "Active", statusValue: "active", access: "Admin", accessValue: "admin", lastActive: "Yesterday" },
  { id: "fallback-ben", email: "ben@example.com", name: "Ben Pattinson", role: "Strata manager", roleValue: "strata_manager", status: "Invited", statusValue: "invited", access: "Limited admin", accessValue: "limited_admin", lastActive: "Invite sent" },
];

export const activity: AuditEvent[] = [
  ...cards.flatMap((card) => card.audit),
  { actor: "System", action: "Queued Markdown extraction", target: "Progress Report 27", time: "25 Jun 2026 08:15" },
  { actor: "Treasurer", action: "Updated allowance", target: "Unit 20 make-good", time: "25 Jun 2026 08:11" },
  { actor: "System", action: "Created incident summary", target: "INC-017", time: "24 Jun 2026 19:04" },
];

export const motions: Motion[] = [
  {
    id: "MOTION-001",
    title: "Approve fire door replacement",
    context:
      "Committee decision to replace the basement fire door and frame, subject to certification and make-good conditions.",
    status: "Draft",
    statusValue: "draft",
    creator: "Ric Spooner",
    created: "24 Jun 2026 09:00",
    updated: "24 Jun 2026 09:00",
    audit: [],
  },
  {
    id: "MOTION-002",
    title: "Adopt short-term letting by-law amendment",
    context:
      "Motion to adopt the drafted by-law amendment restricting short-term letting, recorded as decided by the committee.",
    status: "Decided",
    statusValue: "decided",
    creator: "Deborah Frack",
    created: "10 Jun 2026 12:00",
    updated: "12 Jun 2026 16:30",
    openedAt: "11 Jun 2026 09:00",
    decidedAt: "12 Jun 2026 16:30",
    audit: [],
  },
];

export const aiActions = [
  { label: "Card brief", icon: Sparkles, detail: "Summarise visible discussion, documents, proposal, and conditions." },
  { label: "Document Q&A", icon: BookOpen, detail: "Query extracted text / Markdown with citation-shaped results." },
  { label: "NSW law lookup", icon: Scale, detail: "Ground responses in indexed legislation and NSW guidance." },
  { label: "Budget insight", icon: Landmark, detail: "Explain allowance use, variance, and missing figures." },
  { label: "Quote risk", icon: AlertTriangle, detail: "Extract exclusions, warranty traps, and clarification questions." },
  { label: "Project status", icon: ListChecks, detail: "Compare plan, progress, invoices, and variation evidence." },
];

export const emptyStates = [
  { title: "No hidden content sent to AI", detail: "Context builders filter by committee membership and record visibility before generation.", icon: LockKeyhole },
  { title: "No bank feeds connected", detail: "Budget insights use entered allowances, expenses, invoices, and committed spend only.", icon: CircleDollarSign },
  { title: "No legal advice generated", detail: "Law responses are labelled as general information and cite source documents.", icon: Gavel },
];

export const setupChecklist = [
  { label: "Supabase schema and RLS migration", done: true, icon: ClipboardCheck },
  { label: "Seeded synthetic test workspace", done: true, icon: Building2 },
  { label: "Explicit non-Production AI fixture mode", done: true, icon: Sparkles },
  { label: "Vercel AI Gateway credentials", done: false, icon: Inbox },
  { label: "Document extraction worker", done: false, icon: FileText },
  { label: "Gmail email-to-card import", done: false, icon: MessagesSquare },
];

export const buildingContext = {
  name: "Synthetic Strata Test Committee",
  jurisdiction: "NSW Australia",
  plan: "Anonymised fixture workspace with committee isolation",
  authMode: "Explicit read-only fixture mode; live configuration fails closed",
  disclaimer:
    "AI output is general information only and must be verified with the strata manager, solicitor, engineer, certifier, or accountant before formal decisions.",
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function variancePercent(used: number, approved: number) {
  if (!approved) return 0;
  return Math.round((used / approved) * 100);
}

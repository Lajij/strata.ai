import type { Database, MemberRole } from "../../src/lib/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export interface EvalFixtureScope {
  committeeId: string;
  memberId: string;
  role: MemberRole;
  userId: string;
}

export const EVAL_FIXTURE_IDS = {
  committee: "11111111-1111-4111-8111-111111111111",
  adminUser: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  adminMember: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  memberUser: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  memberMember: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  publicCard: "10000000-0000-4000-8000-000000000001",
  adminCard: "10000000-0000-4000-8000-000000000002",
  publicDocument: "20000000-0000-4000-8000-000000000001",
  adminDocument: "20000000-0000-4000-8000-000000000002",
  project: "30000000-0000-4000-8000-000000000001",
  publicProposal: "40000000-0000-4000-8000-000000000001",
} as const;

export const EVAL_FIXTURE_ADMIN_SENTINEL = "ADMIN-ONLY-LIFT-CONTRACT";

const CREATED_AT = "2026-08-02T00:00:00.000Z";

const principals = {
  admin: {
    committeeId: EVAL_FIXTURE_IDS.committee,
    memberId: EVAL_FIXTURE_IDS.adminMember,
    role: "admin" as const,
    userId: EVAL_FIXTURE_IDS.adminUser,
  },
  member: {
    committeeId: EVAL_FIXTURE_IDS.committee,
    memberId: EVAL_FIXTURE_IDS.memberMember,
    role: "member" as const,
    userId: EVAL_FIXTURE_IDS.memberUser,
  },
};

const cards: Card[] = [
  {
    id: EVAL_FIXTURE_IDS.publicCard,
    committee_id: EVAL_FIXTURE_IDS.committee,
    title: "Shared foyer waterproofing",
    description: "Visible evidence for all active committee members.",
    type: "maintenance",
    status: "open",
    visibility: "all",
    creator_member_id: EVAL_FIXTURE_IDS.adminMember,
    linked_project_id: EVAL_FIXTURE_IDS.project,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    id: EVAL_FIXTURE_IDS.adminCard,
    committee_id: EVAL_FIXTURE_IDS.committee,
    title: EVAL_FIXTURE_ADMIN_SENTINEL,
    description: "Administrative contract evidence that ordinary members must never receive.",
    type: "quote",
    status: "confidential",
    visibility: "admins",
    creator_member_id: EVAL_FIXTURE_IDS.adminMember,
    linked_project_id: EVAL_FIXTURE_IDS.project,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
];

const documents: Document[] = [
  {
    id: EVAL_FIXTURE_IDS.publicDocument,
    committee_id: EVAL_FIXTURE_IDS.committee,
    title: "Shared waterproofing scope",
    document_type: "scope",
    source: "eval-fixture",
    source_date: "2026-08-02",
    version_label: "fixture-v1",
    visibility: "all",
    storage_path: "fixture/shared-waterproofing-scope.pdf",
    extracted_text_path: null,
    markdown_path: "fixture/shared-waterproofing-scope.md",
    indexed_status: "indexed",
    summary: "Publicly visible waterproofing scope evidence.",
    metadata: {},
    created_by_member_id: EVAL_FIXTURE_IDS.adminMember,
    created_at: CREATED_AT,
  },
  {
    id: EVAL_FIXTURE_IDS.adminDocument,
    committee_id: EVAL_FIXTURE_IDS.committee,
    title: "Administrative lift contract annexure",
    document_type: "contract",
    source: "eval-fixture",
    source_date: "2026-08-02",
    version_label: "fixture-v1",
    visibility: "admins",
    storage_path: "fixture/admin-lift-contract.pdf",
    extracted_text_path: null,
    markdown_path: "fixture/admin-lift-contract.md",
    indexed_status: "indexed",
    summary: "Administrative evidence excluded from ordinary-member scope.",
    metadata: {},
    created_by_member_id: EVAL_FIXTURE_IDS.adminMember,
    created_at: CREATED_AT,
  },
];

const projects: Project[] = [
  {
    id: EVAL_FIXTURE_IDS.project,
    committee_id: EVAL_FIXTURE_IDS.committee,
    name: "Waterproofing remediation",
    status: "on_track",
    planned_scope: "Repair the shared foyer membrane.",
    progress_percent: 40,
    budget_allowance_id: null,
    created_at: CREATED_AT,
  },
];

const proposalDrafts = new Map<string, Record<string, unknown>>();
const conditionDrafts = new Map<string, Record<string, unknown>>();
const draftAudits = new Map<string, Record<string, unknown>>();

export function isEvalFixtureEnabled() {
  return process.env.STRATA_EVE_EVAL_FIXTURE === "1" && process.env.NODE_ENV !== "production";
}

export function getEvalFixturePrincipal(name: string | null) {
  if (!isEvalFixtureEnabled() || (name !== "admin" && name !== "member")) return null;
  return principals[name];
}

export function getEvalFixtureScope(caller: {
  attributes: Readonly<Record<string, string | readonly string[]>>;
  authenticator: string;
  issuer?: string;
  principalId: string;
  principalType: string;
} | null | undefined): EvalFixtureScope | null {
  if (
    !isEvalFixtureEnabled() ||
    !caller ||
    caller.authenticator !== "http-basic" ||
    caller.issuer !== "strata-eval-fixture" ||
    caller.principalType !== "user" ||
    caller.attributes.evalFixture !== "true"
  ) {
    return null;
  }

  const principal = Object.values(principals).find((candidate) => candidate.userId === caller.principalId);
  if (!principal) return null;
  if (caller.attributes.committeeId !== principal.committeeId || caller.attributes.memberId !== principal.memberId) return null;
  return principal;
}

function fixtureScopeActive(scope: EvalFixtureScope) {
  return isEvalFixtureEnabled() && scope.committeeId === EVAL_FIXTURE_IDS.committee && Object.values(principals).some(
    (principal) => principal.userId === scope.userId && principal.memberId === scope.memberId && principal.role === scope.role,
  );
}

export function evalFixtureCards(scope: EvalFixtureScope): Card[] | null {
  if (!fixtureScopeActive(scope)) return null;
  return scope.role === "admin" ? cards : cards.filter((card) => card.visibility === "all");
}

export function evalFixtureDocuments(scope: EvalFixtureScope): Document[] | null {
  if (!fixtureScopeActive(scope)) return null;
  return scope.role === "admin" ? documents : documents.filter((document) => document.visibility === "all");
}

export function evalFixtureProjects(scope: EvalFixtureScope): Project[] | null {
  return fixtureScopeActive(scope) ? projects : null;
}

export function evalFixtureCardEvidence(scope: EvalFixtureScope, card: Card) {
  if (!fixtureScopeActive(scope)) return null;
  return {
    status: "ok" as const,
    card,
    messages: [],
    proposals: [],
    votes: [],
    approvalConditions: [],
    attachments: [],
    audit: [],
    citations: [{ ref: `card:${card.id}`, label: `card: ${card.title}` }],
  };
}

export function evalFixtureDocumentEvidence(scope: EvalFixtureScope, document: Document) {
  if (!fixtureScopeActive(scope)) return null;
  return {
    status: "ok" as const,
    document,
    attachments: [],
    invoices: [],
    quoteReviews: [],
    citations: [
      { ref: `document:${document.id}`, label: `document: ${document.title}` },
      ...[document.markdown_path, document.storage_path]
        .filter((path): path is string => Boolean(path))
        .map((path) => ({ ref: path, label: `document source: ${document.title}` })),
    ],
  };
}

export function evalFixtureProjectEvidence(scope: EvalFixtureScope, project: Project) {
  if (!fixtureScopeActive(scope)) return null;
  return {
    status: "ok" as const,
    project,
    milestones: [],
    allowance: null,
    variations: [],
    invoices: [],
    citations: [{ ref: `project:${project.id}`, label: `project: ${project.name}` }],
  };
}

export function evalFixtureSaveProposalDraft(
  scope: EvalFixtureScope,
  input: {
    auditId: string;
    cardId: string;
    deadline: string | null;
    draftId: string;
    rationale: string;
    title: string;
  },
) {
  if (!fixtureScopeActive(scope) || scope.userId !== EVAL_FIXTURE_IDS.adminUser) {
    throw new Error("Only the fixture operator may persist Eve drafts.");
  }
  const draft = {
    id: input.draftId,
    card_id: input.cardId,
    title: input.title,
    rationale: input.rationale,
    status: "draft",
    deadline: input.deadline,
    created_at: CREATED_AT,
  };
  proposalDrafts.set(input.draftId, draft);
  draftAudits.set(input.auditId, { id: input.auditId, draft_id: input.draftId, approved_by: scope.userId });
  return {
    status: "draft_saved" as const,
    persisted: true,
    draft,
    citations: [
      { ref: `proposal:${input.draftId}`, label: `proposal draft: ${input.title}` },
      { ref: `audit:${input.auditId}`, label: "operator approval audit" },
    ],
  };
}

export function evalFixtureSaveConditionDraft(
  scope: EvalFixtureScope,
  input: {
    auditId: string;
    cardId: string;
    condition: string;
    draftId: string;
    proposalId: string;
  },
) {
  if (!fixtureScopeActive(scope) || scope.userId !== EVAL_FIXTURE_IDS.adminUser) {
    throw new Error("Only the fixture operator may persist Eve drafts.");
  }
  const proposalExists = input.proposalId === EVAL_FIXTURE_IDS.publicProposal || proposalDrafts.has(input.proposalId);
  if (!proposalExists) throw new Error("The target fixture proposal is not visible to the operator.");
  const draft = {
    id: input.draftId,
    proposal_id: input.proposalId,
    condition_text: input.condition,
    status: "draft",
    created_at: CREATED_AT,
  };
  conditionDrafts.set(input.draftId, draft);
  draftAudits.set(input.auditId, { id: input.auditId, draft_id: input.draftId, approved_by: scope.userId });
  return {
    status: "draft_saved" as const,
    persisted: true,
    draft,
    citations: [
      { ref: `condition:${input.draftId}`, label: "approval-condition draft" },
      { ref: `audit:${input.auditId}`, label: "operator approval audit" },
    ],
  };
}

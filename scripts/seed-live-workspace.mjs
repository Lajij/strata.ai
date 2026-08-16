import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertSafeMutationTarget } from "./target-environment-guard.mjs";
import { FIXTURE_IDS, FIXTURE_NAMESPACE } from "./fixture-identifiers.mjs";

const {
  committee: COMMITTEE_ID,
  adminMember: ADMIN_MEMBER_ID,
  member: MEMBER_ID,
  project: PROJECT_ID,
  account: ACCOUNT_ID,
  budgetPeriod: BUDGET_PERIOD_ID,
  budgetLine: BUDGET_LINE_ID,
  budgetAllowance: BUDGET_ALLOWANCE_ID,
  milestone: MILESTONE_ID,
  variation: VARIATION_ID,
  invoice: INVOICE_ID,
  expense: EXPENSE_ID,
  publicCard: PUBLIC_CARD_ID,
  adminCard: ADMIN_CARD_ID,
  customCard: CUSTOM_CARD_ID,
  publicProposal: PUBLIC_PROPOSAL_ID,
  adminProposal: ADMIN_PROPOSAL_ID,
  adminVote: ADMIN_VOTE_ID,
  adminCondition: ADMIN_CONDITION_ID,
  adminMessage: ADMIN_MESSAGE_ID,
  adminAudit: ADMIN_AUDIT_ID,
  adminDocument: ADMIN_DOC_ID,
  publicDocument: PUBLIC_DOC_ID,
  publicMessage: PUBLIC_MESSAGE_ID,
  publicAudit: PUBLIC_AUDIT_ID,
  workflowCard: WORKFLOW_CARD_ID,
  workflowProposal: WORKFLOW_PROPOSAL_ID,
  workflowMessage: WORKFLOW_MESSAGE_ID,
  workflowVote: WORKFLOW_VOTE_ID,
  workflowCondition: WORKFLOW_CONDITION_ID,
  workflowAudit: WORKFLOW_AUDIT_ID,
} = FIXTURE_IDS;
const WORKFLOW_MARKER = "seed-live-workspace-verification";

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  resolveServiceKey();
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.fixture.admin@example.invalid";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "LocalFixtureAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.fixture.member@example.invalid";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "LocalFixtureMember123!";

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in .env.local before seeding.",
  );
}

const mutationTarget = assertSafeMutationTarget({
  url,
  operation: "supabase:seed-live",
});

if (
  mutationTarget.targetEnvironment === "staging" &&
  (!process.env.STRATA_ADMIN_EMAIL ||
    !process.env.STRATA_ADMIN_PASSWORD ||
    !process.env.STRATA_MEMBER_EMAIL ||
    !process.env.STRATA_MEMBER_PASSWORD ||
    !adminEmail.endsWith(".invalid") ||
    !memberEmail.endsWith(".invalid") ||
    adminPassword === "LocalFixtureAdmin123!" ||
    memberPassword === "LocalFixtureMember123!")
) {
  throw new Error(
    "Remote staging fixtures require explicit .invalid emails and non-default admin/member passwords.",
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = (email, password) =>
  createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-strata-smoke-user": email } },
  }).auth.signInWithPassword({ email, password });

function loadEnv(file) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

async function ensureUser(email, password, fullName) {
  const existing = await findUserByEmail(email);

  if (existing) {
    if (existing.app_metadata?.fixture_namespace !== FIXTURE_NAMESPACE) {
      throw new Error(`Refusing to overwrite non-fixture Auth user ${email}.`);
    }

    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        fixture_namespace: FIXTURE_NAMESPACE,
      },
      user_metadata: {
        ...existing.user_metadata,
        full_name: fullName,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { fixture_namespace: FIXTURE_NAMESPACE },
    user_metadata: { full_name: fullName },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

async function assertFixtureCommitteeNamespace() {
  const existing = await must(
    "fixture committee namespace lookup",
    admin
      .from("committees")
      .select("id,name,strata_plan,jurisdiction,address")
      .eq("id", COMMITTEE_ID)
      .maybeSingle(),
  );

  if (
    existing &&
    (existing.name !== "Synthetic Strata Test Committee" ||
      existing.strata_plan !== "SP TEST-0001" ||
      existing.jurisdiction !== "NSW Australia" ||
      existing.address !== "1 Example Street, Testville NSW 2000")
  ) {
    throw new Error("Refusing to overwrite a non-fixture committee namespace.");
  }
}

async function seed() {
  await assertFixtureCommitteeNamespace();
  const adminUser = await ensureUser(adminEmail, adminPassword, "Strata Admin");
  const memberUser = await ensureUser(memberEmail, memberPassword, "Strata Member");

  await must(
    "committee upsert",
    admin.from("committees").upsert({
      id: COMMITTEE_ID,
      name: "Synthetic Strata Test Committee",
      strata_plan: "SP TEST-0001",
      jurisdiction: "NSW Australia",
      address: "1 Example Street, Testville NSW 2000",
    }),
  );

  await must(
    "profiles upsert",
    admin.from("profiles").upsert([
      { id: adminUser.id, full_name: "Strata Admin", email: adminEmail },
      { id: memberUser.id, full_name: "Strata Member", email: memberEmail },
    ]),
  );

  await must(
    "members upsert",
    admin.from("members").upsert(
      [
        {
          id: ADMIN_MEMBER_ID,
          committee_id: COMMITTEE_ID,
          user_id: adminUser.id,
          email: adminEmail,
          full_name: "Strata Admin",
          role: "admin",
          status: "active",
        },
        {
          id: MEMBER_ID,
          committee_id: COMMITTEE_ID,
          user_id: memberUser.id,
          email: memberEmail,
          full_name: "Strata Member",
          role: "member",
          status: "active",
        },
      ],
      { onConflict: "id" },
    ),
  );

  await must(
    "account upsert",
    admin.from("accounts").upsert({
      id: ACCOUNT_ID,
      committee_id: COMMITTEE_ID,
      name: "Capital works fund",
      account_type: "capital_works",
      opening_balance: 82000,
    }),
  );

  await must(
    "budget period upsert",
    admin.from("budget_periods").upsert({
      id: BUDGET_PERIOD_ID,
      committee_id: COMMITTEE_ID,
      name: "FY2026 capital works",
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
    }),
  );

  await must(
    "budget line upsert",
    admin.from("budget_lines").upsert({
      id: BUDGET_LINE_ID,
      committee_id: COMMITTEE_ID,
      budget_period_id: BUDGET_PERIOD_ID,
      account_id: ACCOUNT_ID,
      category: "Fire compliance remediation",
      approved_amount: 32000,
    }),
  );

  await must(
    "budget allowance upsert",
    admin.from("budget_allowances").upsert({
      id: BUDGET_ALLOWANCE_ID,
      committee_id: COMMITTEE_ID,
      budget_line_id: BUDGET_LINE_ID,
      name: "Fire door and certification allowance",
      approved_amount: 32000,
      committed_amount: 18450,
      invoiced_amount: 6200,
      notes: "Seeded live financial record for budget/project verification.",
    }),
  );

  await must(
    "project upsert",
    admin.from("projects").upsert({
      id: PROJECT_ID,
      committee_id: COMMITTEE_ID,
      name: "Fire compliance remediation",
      status: "needs_decision",
      planned_scope: "Restore essential fire equipment and close the basement fire-door defect.",
      progress_percent: 38,
      budget_allowance_id: BUDGET_ALLOWANCE_ID,
    }),
  );

  await must(
    "project milestone upsert",
    admin.from("project_milestones").upsert({
      id: MILESTONE_ID,
      committee_id: COMMITTEE_ID,
      project_id: PROJECT_ID,
      label: "Committee quote approval",
      planned_on: "2026-06-30",
      actual_on: null,
      status: "pending",
    }),
  );

  await must(
    "variation upsert",
    admin.from("variations").upsert({
      id: VARIATION_ID,
      committee_id: COMMITTEE_ID,
      project_id: PROJECT_ID,
      card_id: PUBLIC_CARD_ID,
      title: "Fire door make-good allowance",
      amount: 2450,
      status: "pending",
      scope_change: "Make-good after fire door remediation.",
    }),
  );

  await must(
    "invoice upsert",
    admin.from("invoices").upsert({
      id: INVOICE_ID,
      committee_id: COMMITTEE_ID,
      project_id: PROJECT_ID,
      card_id: PUBLIC_CARD_ID,
      invoice_number: "LIVE-FIRE-001",
      amount: 6200,
      approval_status: "pending",
      due_on: "2026-07-15",
    }),
  );

  await must(
    "expense upsert",
    admin.from("expenses").upsert({
      id: EXPENSE_ID,
      committee_id: COMMITTEE_ID,
      account_id: ACCOUNT_ID,
      budget_line_id: BUDGET_LINE_ID,
      project_id: PROJECT_ID,
      invoice_id: INVOICE_ID,
      description: "Fire compliance deposit",
      amount: 6200,
      spent_on: "2026-06-26",
    }),
  );

  await must(
    "cards upsert",
    admin.from("cards").upsert([
      {
        id: PUBLIC_CARD_ID,
        committee_id: COMMITTEE_ID,
        title: "Live fire door approval",
        description: "Seeded visible card for live Supabase/RLS verification.",
        type: "quote",
        status: "pending_vote",
        visibility: "all",
        creator_member_id: ADMIN_MEMBER_ID,
        linked_project_id: PROJECT_ID,
      },
      {
        id: ADMIN_CARD_ID,
        committee_id: COMMITTEE_ID,
        title: "Admin levy hardship matter",
        description: "Admin-only seeded card that must not leak to ordinary members.",
        type: "budget",
        status: "confidential",
        visibility: "admins",
        creator_member_id: ADMIN_MEMBER_ID,
      },
      {
        id: CUSTOM_CARD_ID,
        committee_id: COMMITTEE_ID,
        title: "Custom access legal review",
        description: "Custom seeded card limited by card_access.",
        type: "dispute",
        status: "confidential",
        visibility: "custom",
        creator_member_id: ADMIN_MEMBER_ID,
      },
    ]),
  );

  await must(
    "custom card access upsert",
    admin.from("card_access").upsert({ card_id: CUSTOM_CARD_ID, member_id: ADMIN_MEMBER_ID }),
  );

  await must(
    "documents upsert",
    admin.from("documents").upsert([
      {
        id: PUBLIC_DOC_ID,
        committee_id: COMMITTEE_ID,
        title: "Registered by-laws",
        document_type: "By-laws",
        source_date: "2025-11-18",
        visibility: "all",
        indexed_status: "markdown_ready",
        extracted_text_path: "storage/documents/live/by-laws.txt",
        markdown_path: "storage/documents/live/by-laws.md",
        summary: "Visible by-laws document for member AI context.",
        created_by_member_id: ADMIN_MEMBER_ID,
      },
      {
        id: ADMIN_DOC_ID,
        committee_id: COMMITTEE_ID,
        title: "Admin levy payment plan",
        document_type: "Levy request",
        source_date: "2026-06-22",
        visibility: "admins",
        indexed_status: "indexed",
        extracted_text_path: "storage/documents/live/admin-payment-plan.txt",
        markdown_path: "storage/documents/live/admin-payment-plan.md",
        summary: "Sensitive admin-only document that must not leak.",
        created_by_member_id: ADMIN_MEMBER_ID,
      },
    ]),
  );

  await must(
    "messages upsert",
    admin.from("messages").upsert([
      {
        id: PUBLIC_MESSAGE_ID,
        committee_id: COMMITTEE_ID,
        card_id: PUBLIC_CARD_ID,
        author_member_id: ADMIN_MEMBER_ID,
        body: "Seeded message on the visible fire door card.",
      },
      {
        id: ADMIN_MESSAGE_ID,
        committee_id: COMMITTEE_ID,
        card_id: ADMIN_CARD_ID,
        author_member_id: ADMIN_MEMBER_ID,
        body: "Seeded message on an admin-only card that must not leak.",
      },
    ]),
  );

  await must(
    "proposal upsert",
    admin.from("proposals").upsert([
      {
        id: PUBLIC_PROPOSAL_ID,
        committee_id: COMMITTEE_ID,
        card_id: PUBLIC_CARD_ID,
        title: "Approve fire door quote with conditions",
        rationale: "Seeded proposal for live vote workflow.",
        created_by_member_id: ADMIN_MEMBER_ID,
      },
      {
        id: ADMIN_PROPOSAL_ID,
        committee_id: COMMITTEE_ID,
        card_id: ADMIN_CARD_ID,
        title: "Approve confidential levy treatment",
        rationale: "Seeded admin-only proposal that must not leak.",
        created_by_member_id: ADMIN_MEMBER_ID,
      },
    ]),
  );

  await must(
    "admin vote upsert",
    admin.from("votes").upsert({
      id: ADMIN_VOTE_ID,
      committee_id: COMMITTEE_ID,
      proposal_id: ADMIN_PROPOSAL_ID,
      member_id: ADMIN_MEMBER_ID,
      vote: "yes",
      note: "Seeded admin-only vote that must not leak.",
    }),
  );

  await must(
    "admin approval condition upsert",
    admin.from("approval_conditions").upsert({
      id: ADMIN_CONDITION_ID,
      committee_id: COMMITTEE_ID,
      proposal_id: ADMIN_PROPOSAL_ID,
      condition_text: "Seeded admin-only condition that must not leak.",
      created_by_member_id: ADMIN_MEMBER_ID,
    }),
  );

  await must(
    "audit upsert",
    admin.from("audit_log").upsert([
      {
        id: PUBLIC_AUDIT_ID,
        committee_id: COMMITTEE_ID,
        card_id: PUBLIC_CARD_ID,
        user_id: adminUser.id,
        action: "Seeded workspace",
        target: "Live Supabase verification",
        metadata: { script: "seed-live-workspace" },
      },
      {
        id: ADMIN_AUDIT_ID,
        committee_id: COMMITTEE_ID,
        card_id: ADMIN_CARD_ID,
        user_id: adminUser.id,
        action: "Seeded hidden workspace event",
        target: "Admin-only verification",
        metadata: { script: "seed-live-workspace", hidden: true },
      },
    ]),
  );

  return { adminUser, memberUser };
}

async function signInClient(email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error(`No access token returned for ${email}`);
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyLiveRlsAndWorkflow() {
  await anon(adminEmail, adminPassword);
  const adminClient = await signInClient(adminEmail, adminPassword);
  const memberClient = await signInClient(memberEmail, memberPassword);

  await cleanupWorkflowSmokeRecords();

  const adminCards = await must("admin card read", adminClient.from("cards").select("id,title,visibility").order("title"));
  const memberCards = await must("member card read", memberClient.from("cards").select("id,title,visibility").order("title"));
  const memberDocs = await must("member document read", memberClient.from("documents").select("id,title,visibility").order("title"));
  const memberMessages = await must("member message read", memberClient.from("messages").select("id,card_id").order("created_at"));
  const memberProposals = await must("member proposal read", memberClient.from("proposals").select("id,card_id").order("created_at"));
  const memberVotes = await must("member vote read", memberClient.from("votes").select("id,proposal_id").order("created_at"));
  const memberConditions = await must(
    "member approval condition read",
    memberClient.from("approval_conditions").select("id,proposal_id").order("created_at"),
  );
  const memberAudit = await must("member audit read", memberClient.from("audit_log").select("id,card_id").order("created_at"));
  const memberAiContextCards = await must(
    "member AI-context card read",
    memberClient.from("cards").select("id,title,description,visibility").eq("committee_id", COMMITTEE_ID).limit(5),
  );
  const memberAiContextDocs = await must(
    "member AI-context document read",
    memberClient.from("documents").select("id,title,summary,visibility").eq("committee_id", COMMITTEE_ID).limit(5),
  );

  assert(adminCards.some((card) => card.id === ADMIN_CARD_ID), "Admin cannot read admin-only seeded card");
  assert(memberCards.some((card) => card.id === PUBLIC_CARD_ID), "Member cannot read visible seeded card");
  assert(!memberCards.some((card) => card.id === ADMIN_CARD_ID), "Member can read admin-only card");
  assert(!memberCards.some((card) => card.id === CUSTOM_CARD_ID), "Member can read custom card without card_access");
  assert(!memberDocs.some((document) => document.id === ADMIN_DOC_ID), "Member can read admin-only document");
  assert(!memberMessages.some((message) => message.id === ADMIN_MESSAGE_ID), "Member can read admin-only message");
  assert(!memberProposals.some((proposal) => proposal.id === ADMIN_PROPOSAL_ID), "Member can read admin-only proposal");
  assert(!memberVotes.some((vote) => vote.id === ADMIN_VOTE_ID), "Member can read admin-only vote");
  assert(!memberConditions.some((condition) => condition.id === ADMIN_CONDITION_ID), "Member can read admin-only approval condition");
  assert(!memberAudit.some((event) => event.id === ADMIN_AUDIT_ID), "Member can read admin-only audit event");
  assert(!memberAiContextCards.some((card) => card.id === ADMIN_CARD_ID || card.id === CUSTOM_CARD_ID), "Member AI context can read hidden cards");
  assert(!memberAiContextDocs.some((document) => document.id === ADMIN_DOC_ID), "Member AI context can read admin-only document");

  const workflowTitle = "Live RLS verification smoke card";
  const workflowCard = {
    id: WORKFLOW_CARD_ID,
    title: workflowTitle,
  };

  await must(
    "member create card",
    memberClient.from("cards").insert({
      id: workflowCard.id,
      committee_id: COMMITTEE_ID,
      title: workflowCard.title,
      description: "Verification record created by scripts/seed-live-workspace.mjs; safe to delete.",
      type: "general",
      visibility: "all",
      creator_member_id: MEMBER_ID,
    }),
  );

  await must(
    "member add message",
    memberClient.from("messages").insert({
      id: WORKFLOW_MESSAGE_ID,
      committee_id: COMMITTEE_ID,
      card_id: workflowCard.id,
      author_member_id: MEMBER_ID,
      body: "Live RLS message write.",
    }),
  );

  const proposal = {
    id: WORKFLOW_PROPOSAL_ID,
  };

  await must(
    "member create proposal",
    memberClient.from("proposals").insert({
      id: proposal.id,
      committee_id: COMMITTEE_ID,
      card_id: workflowCard.id,
      title: "Approve live workflow smoke card",
      rationale: "Direct authenticated RLS verification.",
      created_by_member_id: MEMBER_ID,
    }),
  );

  await must(
    "member cast vote",
    memberClient.from("votes").insert({
      id: WORKFLOW_VOTE_ID,
      committee_id: COMMITTEE_ID,
      proposal_id: proposal.id,
      member_id: MEMBER_ID,
      vote: "yes",
      note: "Live RLS vote.",
    }),
  );

  await must(
    "member add approval condition",
    memberClient.from("approval_conditions").insert({
      id: WORKFLOW_CONDITION_ID,
      committee_id: COMMITTEE_ID,
      proposal_id: proposal.id,
      condition_text: "Confirm live RLS workflow evidence before closing.",
      created_by_member_id: MEMBER_ID,
    }),
  );

  await must(
    "member add audit event",
    memberClient.from("audit_log").insert({
      id: WORKFLOW_AUDIT_ID,
      committee_id: COMMITTEE_ID,
      card_id: workflowCard.id,
      action: "Live RLS workflow verified",
      target: workflowCard.title,
      metadata: { script: "seed-live-workspace", marker: WORKFLOW_MARKER, cleanup: true },
    }),
  );

  await cleanupWorkflowSmokeRecords();

  return {
    adminVisibleCards: adminCards.length,
    memberVisibleCards: memberCards.length,
    memberVisibleDocuments: memberDocs.length,
    memberVisibleMessages: memberMessages.length,
    memberVisibleProposals: memberProposals.length,
    memberVisibleVotes: memberVotes.length,
    memberVisibleConditions: memberConditions.length,
    memberVisibleAuditEvents: memberAudit.length,
    memberAiContextRecords: memberAiContextCards.length + memberAiContextDocs.length,
    workflowCardId: workflowCard.id,
    proposalId: proposal.id,
  };
}

async function cleanupWorkflowSmokeRecords() {
  const legacyCards = await must(
    "legacy verification card lookup",
    admin
      .from("cards")
      .select("id")
      .eq("committee_id", COMMITTEE_ID)
      .like("title", "Live workflow smoke %")
      .eq("description", "Created by live RLS smoke workflow."),
  );
  const legacyCardIds = legacyCards.map((card) => card.id);

  if (legacyCardIds.length > 0) {
    const legacyProposals = await must(
      "legacy verification proposal lookup",
      admin.from("proposals").select("id").in("card_id", legacyCardIds),
    );
    const legacyProposalIds = legacyProposals.map((proposal) => proposal.id);

    await must("legacy verification audit cleanup", admin.from("audit_log").delete().in("card_id", legacyCardIds));

    if (legacyProposalIds.length > 0) {
      await must(
        "legacy verification approval condition cleanup",
        admin.from("approval_conditions").delete().in("proposal_id", legacyProposalIds),
      );
      await must("legacy verification vote cleanup", admin.from("votes").delete().in("proposal_id", legacyProposalIds));
    }

    await must("legacy verification proposal cleanup", admin.from("proposals").delete().in("card_id", legacyCardIds));
    await must("legacy verification message cleanup", admin.from("messages").delete().in("card_id", legacyCardIds));
    await must("legacy verification card cleanup", admin.from("cards").delete().in("id", legacyCardIds));
  }

  await must(
    "verification audit cleanup",
    admin.from("audit_log").delete().eq("id", WORKFLOW_AUDIT_ID).eq("card_id", WORKFLOW_CARD_ID),
  );
  await must(
    "verification approval condition cleanup",
    admin.from("approval_conditions").delete().eq("id", WORKFLOW_CONDITION_ID).eq("proposal_id", WORKFLOW_PROPOSAL_ID),
  );
  await must(
    "verification vote cleanup",
    admin.from("votes").delete().eq("id", WORKFLOW_VOTE_ID).eq("proposal_id", WORKFLOW_PROPOSAL_ID),
  );
  await must(
    "verification proposal cleanup",
    admin.from("proposals").delete().eq("id", WORKFLOW_PROPOSAL_ID).eq("card_id", WORKFLOW_CARD_ID),
  );
  await must(
    "verification message cleanup",
    admin.from("messages").delete().eq("id", WORKFLOW_MESSAGE_ID).eq("card_id", WORKFLOW_CARD_ID),
  );
  await must(
    "verification card cleanup",
    admin.from("cards").delete().eq("id", WORKFLOW_CARD_ID).eq("title", "Live RLS verification smoke card"),
  );
}

const users = await seed();
const verification = await verifyLiveRlsAndWorkflow();

console.log(
  JSON.stringify(
    {
      ok: true,
      adminEmail,
      memberEmail,
      adminUserId: users.adminUser.id,
      memberUserId: users.memberUser.id,
      verification,
    },
    null,
    2,
  ),
);

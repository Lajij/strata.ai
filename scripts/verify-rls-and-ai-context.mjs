import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202606250001_initial_strata_governance.sql"),
  "utf8",
);
const storageMigration = readFileSync(
  join(root, "supabase/migrations/202606260002_document_storage_bucket.sql"),
  "utf8",
);
const memberLifecycleMigration = readFileSync(
  join(root, "supabase/migrations/20260801053901_harden_member_lifecycle_audit.sql"),
  "utf8",
);
const contextSource = readFileSync(join(root, "src/lib/ai/context.ts"), "utf8");
const aiRouteSource = readFileSync(join(root, "src/app/api/ai/[task]/route.ts"), "utf8");
const workflowSource = readFileSync(join(root, "src/app/api/workflow/[action]/route.ts"), "utf8");

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Unexpected ${label}: ${needle}`);
  }
}

for (const table of [
  "cards",
  "messages",
  "documents",
  "proposals",
  "votes",
  "approval_conditions",
  "audit_log",
  "ai_outputs",
]) {
  assertContains(migration, `alter table public.${table} enable row level security;`, `${table} RLS enablement`);
}

assertContains(migration, "using (app_private.can_access_card(id));", "card visibility select policy");
assertContains(migration, "using (app_private.can_access_card(card_id));", "message visibility select policy");
assertContains(migration, "where d.id = attachments.document_id", "attachment document visibility join");
assertContains(migration, "and app_private.can_access_card(p.card_id)", "proposal-related vote/condition visibility check");
assertContains(migration, "card_id is null or app_private.can_access_card(card_id)", "audit/card visibility check");
assertContains(
  migration,
  "or (visibility = 'custom' and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))",
  "custom document admin-only policy",
);
assertNotContains(migration, "or visibility = 'custom'\n", "unrestricted custom document visibility");
assertContains(storageMigration, "strata-documents", "private document storage bucket");
assertContains(storageMigration, "for insert", "document storage upload policy");
assertContains(storageMigration, "for select", "document storage read policy");
assertContains(storageMigration, "d.id::text = (storage.foldername(name))[2]", "storage object document visibility join");
assertContains(storageMigration, "d.visibility = 'all'", "storage object all-member visibility");
assertContains(
  storageMigration,
  "app_private.member_role(d.committee_id) in ('admin', 'chair', 'secretary', 'treasurer')",
  "storage admin/custom visibility guard",
);
assertContains(memberLifecycleMigration, "security invoker", "member trigger invoker security");
assertContains(memberLifecycleMigration, "create trigger enforce_member_lifecycle", "member lifecycle trigger");
assertContains(memberLifecycleMigration, "old.user_id = request_user_id", "member self-lockout database guard");
assertContains(memberLifecycleMigration, "create trigger audit_member_lifecycle", "transactional member audit trigger");
assertContains(memberLifecycleMigration, "insert into public.audit_log", "server-derived member audit event");
assertNotContains(memberLifecycleMigration, "security definer", "member trigger RLS bypass");

assertContains(contextSource, "getCurrentMember(supabase)", "AI context current-member lookup");
assertContains(contextSource, '.from("cards")', "AI context card query");
assertContains(contextSource, '.from("documents")', "AI context document query");
assertContains(contextSource, "markdown_path", "AI context document markdown citation path");
assertContains(contextSource, "extracted_text_path", "AI context document extracted text citation path");
assertContains(contextSource, "citations", "AI context citation field");
assertContains(contextSource, "buildFallbackAiContext", "fallback AI context builder");
assertContains(contextSource, "canSeeFallbackVisibility", "fallback visibility guard");
assertContains(aiRouteSource, "requestedRecordIsVisible", "AI hidden source guard");
assertContains(aiRouteSource, '.from("ai_outputs")', "AI output persistence");
assertNotContains(aiRouteSource, "SUPABASE_SERVICE_ROLE_KEY", "service-role usage in AI route");
assertNotContains(contextSource, "SUPABASE_SERVICE_ROLE_KEY", "service-role usage in AI context");
assertNotContains(aiRouteSource, "SUPABASE_SECRET_KEY", "secret-key usage in AI route");
assertNotContains(contextSource, "SUPABASE_SECRET_KEY", "secret-key usage in AI context");

for (const action of ["create-card", "add-message", "create-proposal", "cast-vote", "add-approval-condition"]) {
  assertContains(workflowSource, action, `${action} workflow route`);
}
assertContains(workflowSource, '.from("audit_log").insert', "workflow audit logging");

const records = [
  { id: "public-card", visibility: "All members" },
  { id: "admin-card", visibility: "Admins only" },
  { id: "custom-card", visibility: "Selected members" },
];
const isAdmin = (role) => ["admin", "chair", "secretary", "treasurer"].includes(role);
const canSee = (record, role) => record.visibility === "All members" || isAdmin(role);
const memberVisible = records.filter((record) => canSee(record, "member")).map((record) => record.id);
const adminVisible = records.filter((record) => canSee(record, "admin")).map((record) => record.id);

if (memberVisible.includes("admin-card") || memberVisible.includes("custom-card")) {
  throw new Error("Member fallback AI context can see hidden records");
}

if (adminVisible.length !== records.length) {
  throw new Error("Admin fallback AI context should see all mock records");
}

console.log("RLS and AI context verification passed.");

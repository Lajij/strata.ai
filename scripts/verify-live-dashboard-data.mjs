import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_CARD_ID = "44444444-4444-4444-4444-444444444442";
const CUSTOM_CARD_ID = "44444444-4444-4444-4444-444444444443";
const ADMIN_DOC_ID = "77777777-7777-7777-7777-777777777772";
const ADMIN_AUDIT_ID = "99999999-9999-9999-9999-999999999992";

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

if (!url || !anonKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before verifying live dashboard data.");
}

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

  const authenticatedClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { client: authenticatedClient, userId: data.user.id };
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadDashboardData(session) {
  const { client, userId } = session;
  const member = await must(
    "current member read",
    client
      .from("members")
      .select("id, committee_id, role, full_name, user_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  );

  assert(member, "Signed-in user is not tied to an active members row.");

  const [cards, documents, projects, activity] = await Promise.all([
    must(
      "dashboard cards read",
      client
        .from("cards")
        .select(
          "id,title,description,type,status,visibility,updated_at,created_at,messages(id,body,created_at,author:members!messages_author_member_id_fkey(full_name)),proposals(id,title,status,deadline,votes(vote),approval_conditions(condition_text,status)),project:projects!cards_linked_project_id_fkey(name),creator:members!cards_creator_member_id_fkey(full_name)",
        )
        .eq("committee_id", member.committee_id)
        .order("updated_at", { ascending: false })
        .limit(30),
    ),
    must(
      "dashboard documents read",
      client
        .from("documents")
        .select("id,title,document_type,source_date,visibility,indexed_status,extracted_text_path,markdown_path,summary")
        .eq("committee_id", member.committee_id)
        .order("created_at", { ascending: false })
        .limit(30),
    ),
    must(
      "dashboard projects read",
      client
        .from("projects")
        .select("id,name,status,planned_scope,progress_percent")
        .eq("committee_id", member.committee_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    must(
      "dashboard activity read",
      client
        .from("audit_log")
        .select("id,action,target,created_at,user_id,metadata,card_id")
        .eq("committee_id", member.committee_id)
        .order("created_at", { ascending: false })
        .limit(40),
    ),
  ]);

  return { member, cards, documents, projects, activity };
}

const adminClient = await signInClient(adminEmail, adminPassword);
const memberClient = await signInClient(memberEmail, memberPassword);

const adminDashboard = await loadDashboardData(adminClient);
const memberDashboard = await loadDashboardData(memberClient);

assert(adminDashboard.cards.some((card) => card.id === ADMIN_CARD_ID), "Admin dashboard cannot read admin-only card.");
assert(memberDashboard.cards.length > 0, "Member dashboard has no visible cards.");
assert(memberDashboard.documents.length > 0, "Member dashboard has no visible documents.");
assert(memberDashboard.projects.length > 0, "Member dashboard has no visible projects.");
assert(memberDashboard.activity.length > 0, "Member dashboard has no visible activity.");
assert(!memberDashboard.cards.some((card) => card.id === ADMIN_CARD_ID), "Member dashboard can read admin-only card.");
assert(!memberDashboard.cards.some((card) => card.id === CUSTOM_CARD_ID), "Member dashboard can read custom card.");
assert(!memberDashboard.documents.some((document) => document.id === ADMIN_DOC_ID), "Member dashboard can read admin-only document.");
assert(!memberDashboard.activity.some((event) => event.id === ADMIN_AUDIT_ID), "Member dashboard can read admin-only audit event.");

console.log(
  JSON.stringify(
    {
      ok: true,
      committeeId: COMMITTEE_ID,
      admin: {
        role: adminDashboard.member.role,
        cards: adminDashboard.cards.length,
        documents: adminDashboard.documents.length,
        projects: adminDashboard.projects.length,
        activity: adminDashboard.activity.length,
      },
      member: {
        role: memberDashboard.member.role,
        cards: memberDashboard.cards.length,
        documents: memberDashboard.documents.length,
        projects: memberDashboard.projects.length,
        activity: memberDashboard.activity.length,
      },
    },
    null,
    2,
  ),
);

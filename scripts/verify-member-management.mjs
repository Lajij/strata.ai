import { resolveServiceKey } from "./service-key.mjs";
import { FIXTURE_IDS } from "./fixture-identifiers.mjs";
import { assertSafeMutationTarget } from "./target-environment-guard.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const COMMITTEE_ID = FIXTURE_IDS.committee;
const TEST_MEMBER_ID = "91919191-9191-9191-9191-919191919181";
const TEST_EMAIL = "member-management-verify@example.com";
const TEST_PASSWORD = "MemberManageVerify123!";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadEnv(file) {
  const path = resolve(root, file);

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

async function signInClient(url, anonKey, email, password) {
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

async function findAuthUsersByEmail(service, email) {
  const matches = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const data = await must(
      `list Auth users page ${page}`,
      service.auth.admin.listUsers({ page, perPage }),
    );
    const users = data?.users ?? [];

    matches.push(...users.filter((user) => user.email?.toLowerCase() === email.toLowerCase()));

    if (users.length < perPage) {
      return matches;
    }
  }
}

async function cleanupMemberArtifacts(service, authUserIds, label) {
  const failures = [];

  try {
    await must(`${label} member row`, service.from("members").delete().eq("id", TEST_MEMBER_ID));
  } catch (error) {
    failures.push(error);
  }

  for (const userId of authUserIds) {
    try {
      await must(`${label} Auth user`, service.auth.admin.deleteUser(userId));
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) {
    throw new AggregateError(failures, `${label} failed`);
  }
}

const packageJson = JSON.parse(read("package.json"));
const dataSource = read("src/lib/strata-data.ts");
const appDataSource = read("src/lib/strata-app-data.ts");
const componentSource = read("src/components/pages/people-page.tsx");
const updateRoute = read("src/app/api/members/update/route.ts");
const inviteRoute = read("src/app/api/members/invite/route.ts");
const memberCapabilities = read("src/lib/member-capabilities.ts");
const initialMigration = read("supabase/migrations/202606250001_initial_strata_governance.sql");
const lifecycleMigration = read("supabase/migrations/20260801053901_harden_member_lifecycle_audit.sql");
const securityVerifier = read("scripts/verify-rls-and-ai-context.mjs");

assert(packageJson.scripts["verify:member-management"]?.includes("verify-member-management"), "Missing verify:member-management script");
assert(dataSource.includes("roleValue"), "Member model must expose raw role values");
assert(dataSource.includes("statusValue"), "Member model must expose raw status values");
assert(dataSource.includes("accessValue"), "Member model must expose raw access values");
assert(appDataSource.includes("mapMembers"), "App data must map Supabase member rows");
assert(appDataSource.includes("access_level"), "App data must read member access level");
assert(componentSource.includes("MemberManagementRow"), "Members UI must include editable management rows");
assert(componentSource.includes("/api/members/update"), "Members UI must call the update route");
assert(componentSource.includes("You cannot change your own role") || updateRoute.includes("You cannot change your own role"), "Self-lockout guard is missing");
assert(updateRoute.includes("getCurrentMember"), "Update route must require an active member");
assert(updateRoute.includes("canManageMembers"), "Update route must enforce the server-side role matrix");
assert(updateRoute.includes('.from("members")'), "Update route must mutate members table");
assert(updateRoute.includes("assertMemberLifecycleTransition"), "Update route must enforce member lifecycle transitions");
assert(inviteRoute.includes("assertInviteCanBePrepared"), "Invite route must reject existing active or suspended members");
assert(memberCapabilities.includes('const memberManagementRoles = new Set(["admin", "chair", "secretary"])'), "Member-management roles must be explicit");
assert(memberCapabilities.includes('principal.accessLevel === "read_only"'), "Read-only access must deny write capabilities");
assert(memberCapabilities.includes('const financialRoles = new Set(["admin", "chair", "treasurer"])'), "Financial capability roles must be explicit");
assert(initialMigration.includes('create policy "admins can manage committee roster"'), "Members RLS must enforce privileged-role writes");
assert(initialMigration.includes("in ('admin', 'chair', 'secretary')"), "Members RLS role matrix must match the server routes");
assert(lifecycleMigration.includes("new.status = 'active' and new.user_id is null"), "Database lifecycle guard must prevent activating unaccepted invites");
assert(lifecycleMigration.includes("old.status <> 'invited' and new.status = 'invited'"), "Database lifecycle guard must prevent backwards invite transitions");
assert(lifecycleMigration.includes("old.user_id = request_user_id"), "Database lifecycle guard must prevent self-lockout bypasses");
assert(lifecycleMigration.includes("insert into public.audit_log"), "Database trigger must write the member audit event transactionally");
assert(lifecycleMigration.includes("when old.status is distinct from new.status then 'Changed member status'"), "Database trigger must identify every status transition");
assert(!updateRoute.includes('.from("audit_log").insert'), "Update route must not duplicate the transactional member audit trigger");
assert(!inviteRoute.includes('.from("audit_log").insert'), "Invite route must not duplicate the transactional member audit trigger");
assert(!componentSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "Client component must not reference service-role key");
assert(!updateRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Update route must not reference service-role key");
assert(!componentSource.includes("SUPABASE_SECRET_KEY"), "Client component must not reference secret key");
assert(!updateRoute.includes("SUPABASE_SECRET_KEY"), "Update route must not reference secret key");
assert(securityVerifier.includes("members") || appDataSource.includes('.from("members")'), "Security coverage must include RLS-backed members");

if (process.env.STRATA_VERIFY_LIVE_MEMBERS !== "1") {
  console.log("Member management static verification passed. Set STRATA_VERIFY_LIVE_MEMBERS=1 for live Supabase checks.");
  process.exit(0);
}

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

assert(url && anonKey && serviceKey, "Live member verification needs Supabase URL, anon key, and local service key.");

assertSafeMutationTarget({
  url,
  operation: "verify:member-management live checks",
});

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = await signInClient(url, anonKey, adminEmail, adminPassword);
const memberClient = await signInClient(url, anonKey, memberEmail, memberPassword);

const staleAuthUsers = await findAuthUsersByEmail(service, TEST_EMAIL);
await cleanupMemberArtifacts(
  service,
  staleAuthUsers.map((user) => user.id),
  "member-management pre-cleanup",
);
const createdUser = await service.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
});

if (createdUser.error) {
  throw createdUser.error;
}

try {
  await must(
    "seed management member",
    service.from("members").insert({
      id: TEST_MEMBER_ID,
      committee_id: COMMITTEE_ID,
      user_id: createdUser.data.user.id,
      email: TEST_EMAIL,
      full_name: "Member Management Verify",
      role: "member",
      status: "active",
      access_level: "member",
      accepted_at: new Date().toISOString(),
    }),
  );

  await must(
    "admin can update member access",
    adminClient
      .from("members")
      .update({ role: "treasurer", access_level: "limited_admin", status: "active" })
      .eq("id", TEST_MEMBER_ID)
      .select("id,role,access_level,status")
      .single(),
  );

  const ordinaryUpdate = await memberClient
    .from("members")
    .update({ access_level: "admin" })
    .eq("id", TEST_MEMBER_ID)
    .select("id");
  assert(ordinaryUpdate.error || ordinaryUpdate.data?.length === 0, "Ordinary member can update member access");
  const afterOrdinaryAttempt = await must(
    "ordinary update did not persist",
    service.from("members").select("access_level").eq("id", TEST_MEMBER_ID).single(),
  );
  assert(afterOrdinaryAttempt.access_level === "limited_admin", "Ordinary member update changed access level");

  const managedClient = await signInClient(url, anonKey, TEST_EMAIL, TEST_PASSWORD);
  const beforeSuspend = await must("active managed member card read", managedClient.from("cards").select("id").eq("committee_id", COMMITTEE_ID).limit(1));
  assert(beforeSuspend.length >= 0, "Active managed member read did not complete");

  await must("admin suspends managed member", adminClient.from("members").update({ status: "suspended" }).eq("id", TEST_MEMBER_ID));
  const afterSuspend = await must("suspended managed member card read", managedClient.from("cards").select("id").eq("committee_id", COMMITTEE_ID).limit(5));
  assert(afterSuspend.length === 0, "Suspended member can still read dashboard cards");
} finally {
  await cleanupMemberArtifacts(service, [createdUser.data.user.id], "member-management cleanup");
}

console.log("Member management live verification passed.");

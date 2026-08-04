import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

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
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

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

const packageJson = JSON.parse(read("package.json"));
const migration = read("supabase/migrations/202606270001_member_invites.sql");
const lifecycleMigration = read("supabase/migrations/20260801053901_harden_member_lifecycle_audit.sql");
const appData = read("src/lib/strata-app-data.ts");
const memberAuthorization = read("src/lib/member-authorization.ts");
const authComponent = read("src/components/strata-app.tsx");
const shellComponent = read("src/components/app-shell.tsx");
const peopleComponent = read("src/components/pages/people-page.tsx");
const navigationComponent = read("src/components/sidebar-nav.tsx");
const clientComponents = [authComponent, shellComponent, peopleComponent, navigationComponent].join("\n");
const inviteRoute = read("src/app/api/members/invite/route.ts");
const acceptRoute = read("src/app/api/members/accept/route.ts");
const adminHelper = read("src/lib/supabase/admin.ts");
const browserClient = read("src/lib/supabase/client.ts");

assert(packageJson.scripts["verify:auth-flow"]?.includes("verify-auth-flow"), "Missing verify:auth-flow script");
assert(migration.includes("access_level"), "Invite migration must add access_level");
assert(migration.includes("invited_at"), "Invite migration must add invited_at");
assert(migration.includes("accepted_at"), "Invite migration must add accepted_at");
assert(appData.includes('mode: "signed-out"'), "App data must expose a signed-out Supabase state");
assert(appData.includes('.eq("status", "active")'), "Current member lookup must require active status");
assert(appData.includes('.from("members")'), "App data must load member roster through RLS");
assert(authComponent.includes("SignedOutWorkspace"), "UI must render a signed-out workspace lock");
assert(authComponent.includes("/api/members/accept"), "Sign-in flow must call invite acceptance");
assert(peopleComponent.includes("/api/members/invite"), "Members UI must call invite endpoint");
assert(peopleComponent.includes("Invite member"), "Members UI must expose invite form");
assert(authComponent.includes("pending invites activate") || authComponent.includes("Pending invites activate"), "UI must explain pending invite activation");
assert(inviteRoute.includes("getCurrentMember"), "Invite route must require current member");
assert(inviteRoute.includes("canManageMembers"), "Invite route must enforce the server-side role matrix");
assert(inviteRoute.includes("inviteUserByEmail"), "Invite route must use Supabase Auth invite flow");
assert(inviteRoute.includes("accessLevel"), "Invite route must persist access level");
assert(inviteRoute.includes("assertInviteCanBePrepared"), "Invite route must not recycle active or suspended rows");
assert(acceptRoute.includes("No pending committee invite matches"), "Accept route must reject uninvited users");
assert(acceptRoute.includes('status: "active"'), "Accept route must activate matching invited members");
assert(memberAuthorization.includes("memberCapabilities"), "Member authorization must define a server-side role matrix");
assert(memberAuthorization.includes("manageMembers: false"), "Member authorization must include negative role capabilities");
assert(lifecycleMigration.includes("create trigger enforce_member_lifecycle"), "Member lifecycle must be enforced in Postgres");
assert(lifecycleMigration.includes("create trigger audit_member_lifecycle"), "Member lifecycle changes must be audited in Postgres");
assert(lifecycleMigration.includes("after insert or update of full_name, role, status, access_level"), "Member audit trigger must cover lifecycle and access changes");
assert(adminHelper.includes("getSupabaseAdminClient"), "Server-only admin helper is missing");
assert(!clientComponents.includes("SUPABASE_SERVICE_ROLE_KEY"), "Client components must not reference service-role key");
assert(!browserClient.includes("SUPABASE_SERVICE_ROLE_KEY"), "Browser Supabase client must not reference service-role key");
assert(!inviteRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Invite route must not contain direct service-role key literal");
assert(!acceptRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Accept route must not contain direct service-role key literal");
assert(!clientComponents.includes("SUPABASE_SECRET_KEY"), "Client components must not reference secret key");
assert(!browserClient.includes("SUPABASE_SECRET_KEY"), "Browser Supabase client must not reference secret key");
assert(!inviteRoute.includes("SUPABASE_SECRET_KEY"), "Invite route must not contain direct secret-key literal");
assert(!acceptRoute.includes("SUPABASE_SECRET_KEY"), "Accept route must not contain direct secret-key literal");

if (process.env.STRATA_VERIFY_LIVE_AUTH !== "1") {
  console.log("Auth flow static verification passed. Set STRATA_VERIFY_LIVE_AUTH=1 for live Supabase auth checks.");
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
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

assert(url && anonKey && serviceKey, "Live auth verification needs Supabase URL, anon key, and local service key.");

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = await signInClient(url, anonKey, adminEmail, adminPassword);
const memberClient = await signInClient(url, anonKey, memberEmail, memberPassword);

const adminMember = await must(
  "admin active member lookup",
  adminClient.from("members").select("id,committee_id,role,status").eq("email", adminEmail.toLowerCase()).eq("status", "active").single(),
);
assert(["admin", "chair", "secretary"].includes(adminMember.role), "Seeded admin must have invite privileges");

const ordinaryMember = await must(
  "ordinary active member lookup",
  memberClient.from("members").select("id,committee_id,role,status").eq("email", memberEmail.toLowerCase()).eq("status", "active").single(),
);
assert(ordinaryMember.role === "member", "Seeded ordinary member should be a member role");

const ordinaryInvite = await memberClient.from("members").insert({
  committee_id: ordinaryMember.committee_id,
  email: "blocked-auth-flow@example.com",
  full_name: "Blocked Auth Flow",
  role: "member",
  status: "invited",
  access_level: "member",
});
if (!ordinaryInvite.error) {
  await must(
    "RLS-broken invite cleanup",
    service
      .from("members")
      .delete()
      .eq("committee_id", ordinaryMember.committee_id)
      .eq("email", "blocked-auth-flow@example.com"),
  );
}
assert(ordinaryInvite.error, "Ordinary member can insert invite rows through RLS");

const wrongUser = await service.auth.admin.createUser({
  email: `auth-flow-uninvited-${Date.now()}@example.com`,
  password: "AuthFlowVerify123!",
  email_confirm: true,
});

if (wrongUser.error) {
  throw wrongUser.error;
}

try {
  const uninvitedClient = await signInClient(url, anonKey, wrongUser.data.user.email, "AuthFlowVerify123!");
  const hiddenCards = await must("uninvited card read", uninvitedClient.from("cards").select("id").limit(1));
  assert(hiddenCards.length === 0, "Uninvited user can read dashboard cards");
} finally {
  await must("uninvited Auth user cleanup", service.auth.admin.deleteUser(wrongUser.data.user.id));
}

console.log("Auth flow live verification passed.");

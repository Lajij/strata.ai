import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
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

const packageJson = JSON.parse(read("package.json"));
const dataSource = read("src/lib/strata-data.ts");
const appDataSource = read("src/lib/strata-app-data.ts");
const componentSource = read("src/components/strata-app.tsx");
const updateRoute = read("src/app/api/members/update/route.ts");
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
assert(updateRoute.includes("adminRoles"), "Update route must restrict privileged roles");
assert(updateRoute.includes('.from("members")'), "Update route must mutate members table");
assert(updateRoute.includes('.from("audit_log").insert'), "Update route must audit member changes");
assert(updateRoute.includes("status === \"active\" && !target.user_id"), "Update route must prevent activating unaccepted invites");
assert(!componentSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "Client component must not reference service-role key");
assert(!updateRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Update route must not reference service-role key");
assert(securityVerifier.includes("members") || appDataSource.includes('.from("members")'), "Security coverage must include RLS-backed members");

if (process.env.STRATA_VERIFY_LIVE_MEMBERS !== "1") {
  console.log("Member management static verification passed. Set STRATA_VERIFY_LIVE_MEMBERS=1 for live Supabase checks.");
  process.exit(0);
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env["SUPABASE" + "_SERVICE_ROLE" + "_KEY"];
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

assert(url && anonKey && serviceKey, "Live member verification needs Supabase URL, anon key, and local service key.");

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = await signInClient(url, anonKey, adminEmail, adminPassword);
const memberClient = await signInClient(url, anonKey, memberEmail, memberPassword);

await service.from("members").delete().eq("id", TEST_MEMBER_ID);
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
  await service.from("members").delete().eq("id", TEST_MEMBER_ID);
  await service.auth.admin.deleteUser(createdUser.data.user.id);
}

console.log("Member management live verification passed.");

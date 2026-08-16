import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertSafeMutationTarget } from "./target-environment-guard.mjs";

const root = process.cwd();
const bucket = "strata-documents";

loadEnv(".env.local");
loadEnv(".env");

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function listFiles(dir) {
  const output = [];
  const base = join(root, dir);

  if (!existsSync(base)) {
    return output;
  }

  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const fullPath = join(base, entry.name);
    const relPath = fullPath.slice(root.length + 1);

    if (entry.isDirectory()) {
      output.push(...listFiles(relPath));
    } else if (/\.(ts|tsx|js|jsx|mjs|css|md)$/.test(entry.name)) {
      output.push(relPath);
    }
  }

  return output;
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

const packageJson = JSON.parse(read("package.json"));
const aiRoute = read("src/app/api/ai/[task]/route.ts");
const workflowRoute = read("src/app/api/workflow/[action]/route.ts");
const appDataRoute = read("src/app/api/app-data/route.ts");
const documentRoute = read("src/app/api/documents/create/route.ts");
const supabaseServer = read("src/lib/supabase/server.ts");
const supabaseClient = read("src/lib/supabase/client.ts");
const supabaseAdmin = read("src/lib/supabase/admin.ts");
const runtimeConfiguration = read("src/lib/runtime-configuration.ts");
const storageMigration = read("supabase/migrations/202606260002_document_storage_bucket.sql");
const readme = read("README.md");

assert(packageJson.scripts["verify:production-ready"]?.includes("verify-production-ready"), "Missing verify:production-ready script");
assert(packageJson.scripts["verify:ai-browser"]?.includes("verify-ai-browser"), "Missing browser verification script");
assert(packageJson.scripts["verify:documents"]?.includes("verify-document-workflow"), "Missing document verification script");
assert(packageJson.scripts["verify:ai-observability"]?.includes("verify-ai-observability"), "Missing AI observability verification script");

assert(aiRoute.includes("getSupabaseServerClient"), "AI route must use the shared Supabase server client");
assert(workflowRoute.includes("getSupabaseServerClient"), "Workflow route must use the shared Supabase server client");
assert(documentRoute.includes("getSupabaseServerClient"), "Document route must use the shared Supabase server client");
assert(appDataRoute.includes("getStrataAppData"), "App data route must delegate through the RLS-backed app data loader");
for (const source of [aiRoute, workflowRoute, appDataRoute, documentRoute]) {
  assert(!source.includes("SUPABASE_SERVICE_ROLE_KEY"), "RLS-sensitive API route must not reference the service role key");
  assert(!source.includes("SUPABASE_SECRET_KEY"), "RLS-sensitive API route must not reference the secret key");
}

assert(supabaseServer.includes("createServerClient"), "Server client must use SSR cookies/session support");
assert(supabaseClient.includes("createBrowserClient"), "Browser client must use Supabase SSR browser client");
assert(supabaseAdmin.startsWith('import "server-only";'), "Admin client must be guarded by server-only");
assert(aiRoute.includes("hasGatewayCredentials"), "AI route must expose live/fallback gateway mode selection");
assert(runtimeConfiguration.includes("AI_FALLBACK_FORBIDDEN"), "AI route must reject fallback responses in Production");
assert(storageMigration.includes(bucket), "Storage bucket migration must configure the document bucket");
assert(storageMigration.includes("public = excluded.public"), "Storage bucket must be private and idempotently configured");
assert(readme.includes("Production Readiness Checklist"), "README must include the production readiness checklist");
assert(readme.includes("STRATA_BROWSER_URL"), "README must document preview/browser verification through STRATA_BROWSER_URL");

// src/proxy.ts is covered by listFiles("src"); assert it exists so a silently
// undetected proxy (wrong location) cannot quietly drop session enforcement.
assert(existsSync(join(root, "src/proxy.ts")), "Proxy must live at src/proxy.ts for Next to detect it");

const browserFacingFiles = listFiles("src").filter(
  (file) => file !== "src/lib/supabase/admin.ts" && existsSync(join(root, file)),
);
for (const file of browserFacingFiles) {
  const source = read(file);
  assert(!source.includes("SUPABASE_SERVICE_ROLE_KEY"), `Service role key reference found in browser/app code: ${file}`);
  assert(!source.includes("SUPABASE_SECRET_KEY"), `Secret key reference found in browser/app code: ${file}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  resolveServiceKey();

assert(Boolean(supabaseUrl), "NEXT_PUBLIC_SUPABASE_URL is required for staging readiness checks");
assert(Boolean(anonKey), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for production readiness checks");
assert(Boolean(serviceKey), "SUPABASE_SECRET_KEY is required locally for production readiness checks");

const target = assertSafeMutationTarget({
  url: supabaseUrl,
  operation: "verify:production-ready",
});

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.fixture.member@example.invalid";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "LocalFixtureMember123!";
const { data: authData, error: authError } = await anon.auth.signInWithPassword({
  email: memberEmail,
  password: memberPassword,
});

if (authError) {
  throw authError;
}

const memberClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${authData.session.access_token}`,
    },
  },
});
const member = await must(
  "active member lookup",
  memberClient.from("members").select("id,committee_id,status").eq("user_id", authData.user.id).single(),
);
assert(member.status === "active", "Seeded member must be active");

await must("document bucket lookup", service.storage.getBucket(bucket));

const objectPath = `${member.committee_id}/production-ready-${Date.now()}/storage-smoke.txt`;
try {
  await must(
    "member storage smoke upload",
    memberClient.storage.from(bucket).upload(objectPath, new Blob(["production readiness smoke"], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: false,
    }),
  );
} finally {
  await must("member storage smoke cleanup", service.storage.from(bucket).remove([objectPath]));
}

const [cards, documents, lawChunks] = await Promise.all([
  must("member visible card read", memberClient.from("cards").select("id").limit(1)),
  must("member visible document read", memberClient.from("documents").select("id").limit(1)),
  must("member law corpus read", memberClient.from("legislation_chunks").select("id").limit(25)),
]);

assert(cards.length > 0, "Signed-in member must read at least one visible card");
assert(documents.length > 0, "Signed-in member must read at least one visible document");
assert(lawChunks.length >= 25, "Signed-in member must read the expanded law corpus");

console.log(
  JSON.stringify(
    {
      ok: true,
      project: target.projectRef ?? target.origin,
      checks: {
        env: true,
        secretHygiene: true,
        aiFallbackOrLiveMode: true,
        storageBucket: true,
        memberRlsReads: true,
      },
    },
    null,
    2,
  ),
);

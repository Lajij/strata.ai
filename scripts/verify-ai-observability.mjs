import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const routeSource = readFileSync(join(root, "src/app/api/ai/[task]/route.ts"), "utf8");
const typeSource = readFileSync(join(root, "src/lib/supabase/types.ts"), "utf8");
const exportSource = readFileSync(join(root, "scripts/export-ai-audit-pack.mjs"), "utf8");
const migrationSource = readFileSync(join(root, "supabase/migrations/202606260001_ai_output_observability.sql"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const TEST_OUTPUT_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeee9901";
const PUBLIC_CARD_ID = "44444444-4444-4444-4444-444444444441";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

async function signInClient(url, anonKey, email, password) {
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return {
    userId: data.user.id,
    client: createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      },
    }),
  };
}

for (const column of [
  "status",
  "duration_ms",
  "input_record_count",
  "citation_count",
  "error_message",
  "provider_metadata",
  "created_mode",
]) {
  assert(migrationSource.includes(column), `Migration missing ${column}`);
  assert(typeSource.includes(column), `Supabase types missing ${column}`);
  assert(routeSource.includes(column), `AI route missing ${column}`);
}

assert(packageJson.scripts["verify:ai-observability"]?.includes("verify-ai-observability"), "Missing verify:ai-observability script");
assert(packageJson.scripts["export:ai-audit"]?.includes("export-ai-audit-pack"), "Missing export:ai-audit script");
assert(routeSource.includes("sanitizeErrorMessage"), "AI route must sanitize errors");
assert(routeSource.includes("promptHash(prompt)"), "AI route must store prompt hashes, not raw prompts");
assert(!routeSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "AI route must not use service-role key");
assert(!exportSource.includes("SUPABASE_SERVICE_ROLE_KEY"), "AI audit export must use Auth/RLS, not service-role key");
assert(exportSource.includes("access_model"), "AI audit export must describe the RLS access model");

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && anonKey && serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
  const password = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";
  const { userId, client: memberClient } = await signInClient(url, anonKey, email, password);
  const member = await must(
    "read current member",
    memberClient.from("members").select("id,committee_id").eq("user_id", userId).single(),
  );

  await must("cleanup observability output", service.from("ai_outputs").delete().eq("id", TEST_OUTPUT_ID));

  await must(
    "insert observable error output through RLS",
    memberClient.from("ai_outputs").insert({
      id: TEST_OUTPUT_ID,
      committee_id: member.committee_id,
      card_id: PUBLIC_CARD_ID,
      output_type: "card-brief",
      prompt_hash: "verify-ai-observability",
      output: {
        mode: "error-fallback",
        task: "card-brief",
        disclaimer: "General information only.",
        error: "[redacted-token]",
      },
      citations: [{ label: "card:visible", kind: "card" }],
      model: "verify",
      status: "error",
      duration_ms: 123,
      input_record_count: 2,
      citation_count: 1,
      error_message: "Provider failed with [redacted-token]",
      provider_metadata: { task: "card-brief", forced_fallback: false },
      created_mode: "error-fallback",
      created_by_member_id: member.id,
    }),
  );

  const visible = await must(
    "read observable output through RLS",
    memberClient
      .from("ai_outputs")
      .select("id,status,duration_ms,input_record_count,citation_count,error_message,provider_metadata,created_mode")
      .eq("id", TEST_OUTPUT_ID)
      .single(),
  );

  assert(visible.status === "error", "Observable output status was not stored");
  assert(visible.duration_ms === 123, "Observable output duration was not stored");
  assert(visible.input_record_count === 2, "Observable output context count was not stored");
  assert(visible.citation_count === 1, "Observable output citation count was not stored");
  assert(visible.created_mode === "error-fallback", "Observable output mode was not stored");
  assert(!/eyJ|service_role|SUPABASE_SERVICE_ROLE_KEY/.test(visible.error_message ?? ""), "Error metadata appears unsanitized");

  const exportPath = join(tmpdir(), `strata-ai-audit-${Date.now()}.json`);
  const exportRun = spawnSync(process.execPath, ["scripts/export-ai-audit-pack.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      STRATA_EXPORT_EMAIL: email,
      STRATA_EXPORT_PASSWORD: password,
      STRATA_AI_AUDIT_EXPORT_PATH: exportPath,
      STRATA_AI_AUDIT_LIMIT: "200",
    },
    encoding: "utf8",
  });

  if (exportRun.status !== 0) {
    throw new Error(`AI audit export failed:\n${exportRun.stderr || exportRun.stdout}`);
  }

  const exportPack = JSON.parse(readFileSync(exportPath, "utf8"));
  const exported = exportPack.records.find((record) => record.id === TEST_OUTPUT_ID);

  assert(exportPack.access_model.includes("RLS-filtered"), "Export pack must describe RLS filtering");
  assert(exported, "Export pack did not include the visible test AI output");
  assert(exported.status === "error" && exported.mode === "error-fallback", "Export pack missed status or mode metadata");
  assert(exported.duration_ms === 123 && exported.citation_count === 1, "Export pack missed observable counts");

  unlinkSync(exportPath);
  await must("cleanup observability output", service.from("ai_outputs").delete().eq("id", TEST_OUTPUT_ID));
}

console.log("AI observability verification passed.");

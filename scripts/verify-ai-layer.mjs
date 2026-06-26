import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const routeSource = readFileSync(join(root, "src/app/api/ai/[task]/route.ts"), "utf8");
const contextSource = readFileSync(join(root, "src/lib/ai/context.ts"), "utf8");
const componentSource = readFileSync(join(root, "src/components/strata-app.tsx"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
const MEMBER_ID = "33333333-3333-3333-3333-333333333332";
const PUBLIC_CARD_ID = "44444444-4444-4444-4444-444444444441";
const ADMIN_CARD_ID = "44444444-4444-4444-4444-444444444442";
const VISIBLE_AI_OUTPUT_ID = "dddddddd-dddd-dddd-dddd-dddddddd9911";
const HIDDEN_AI_OUTPUT_ID = "dddddddd-dddd-dddd-dddd-dddddddd9912";

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

async function signInClient(url, anonKey) {
  const email = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
  const password = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";
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

for (const task of [
  "card-brief",
  "thread-summary",
  "document-qa",
  "nsw-law-lookup",
  "budget-insights",
  "quote-risk",
  "project-status",
]) {
  assertContains(routeSource, task, `${task} route support`);
}

assertContains(packageJson.scripts["verify:ai"], "verify-ai-layer", "verify:ai script");
assertContains(routeSource, "streamText", "streamText conversational generation");
assertContains(routeSource, "Output.object", "AI SDK v6 structured output");
assertContains(routeSource, '.from("ai_outputs")', "AI output persistence");
assertContains(routeSource, '.from("audit_log").insert', "AI audit logging");
assertContains(routeSource, "requestedRecordIsVisible", "hidden requested record guard");
assertContains(routeSource, "buildVisibleAiContext", "RLS context builder usage");
assertContains(routeSource, "hasGatewayCredentials", "deterministic fallback guard");
assertNotContains(routeSource, "SUPABASE_SERVICE_ROLE_KEY", "service-role usage in AI route");
assertNotContains(contextSource, "SUPABASE_SERVICE_ROLE_KEY", "service-role usage in AI context");

for (const table of [
  "cards",
  "messages",
  "proposals",
  "votes",
  "approval_conditions",
  "audit_log",
  "documents",
  "attachments",
  "projects",
  "accounts",
  "budget_lines",
  "budget_allowances",
  "invoices",
  "quote_reviews",
  "legislation_chunks",
]) {
  assertContains(contextSource, `.from("${table}")`, `${table} AI context query`);
}

assertContains(componentSource, "MessageResponse", "AI markdown rendering");
assertContains(componentSource, "runAiTask", "AI UI request helper");
assertContains(componentSource, "/api/ai/${task}", "AI route fetch");
assertContains(componentSource, "DocumentAiTool", "document Q&A UI");
assertContains(componentSource, "ProjectAiTool", "project AI UI");
assertContains(componentSource, "budget-insights", "budget AI UI");
assertContains(componentSource, "citations", "citation chip rendering");

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && anonKey && serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const memberClient = await signInClient(url, anonKey);

  await must("AI output cleanup", service.from("ai_outputs").delete().in("id", [VISIBLE_AI_OUTPUT_ID, HIDDEN_AI_OUTPUT_ID]));

  await must(
    "member create visible AI output",
    memberClient.from("ai_outputs").insert({
      id: VISIBLE_AI_OUTPUT_ID,
      committee_id: COMMITTEE_ID,
      card_id: PUBLIC_CARD_ID,
      output_type: "card-brief",
      prompt_hash: "verify-ai-layer",
      output: { text: "Visible AI output", disclaimer: "General information only." },
      citations: [{ label: "card:public", kind: "card" }],
      model: "verify",
      created_by_member_id: MEMBER_ID,
    }),
  );

  await must(
    "service create hidden AI output",
    service.from("ai_outputs").insert({
      id: HIDDEN_AI_OUTPUT_ID,
      committee_id: COMMITTEE_ID,
      card_id: ADMIN_CARD_ID,
      output_type: "card-brief",
      prompt_hash: "verify-ai-layer-hidden",
      output: { text: "Hidden AI output" },
      citations: [{ label: "card:hidden", kind: "card" }],
      model: "verify",
      created_by_member_id: MEMBER_ID,
    }),
  );

  const outputs = await must(
    "member read AI outputs",
    memberClient.from("ai_outputs").select("id,card_id,output_type,citations").eq("committee_id", COMMITTEE_ID),
  );
  const chunks = await must(
    "member read NSW legislation chunks",
    memberClient.from("legislation_chunks").select("id,source,section,body").limit(5),
  );

  if (!outputs.some((output) => output.id === VISIBLE_AI_OUTPUT_ID)) {
    throw new Error("Ordinary member cannot read visible AI output");
  }

  if (outputs.some((output) => output.id === HIDDEN_AI_OUTPUT_ID)) {
    throw new Error("Ordinary member can read hidden/admin AI output");
  }

  if (!chunks.length) {
    throw new Error("No indexed NSW legislation chunks are visible for law lookup");
  }

  await must("AI output cleanup", service.from("ai_outputs").delete().in("id", [VISIBLE_AI_OUTPUT_ID, HIDDEN_AI_OUTPUT_ID]));
}

console.log("AI layer verification passed.");

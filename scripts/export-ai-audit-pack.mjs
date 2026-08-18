import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.STRATA_EXPORT_EMAIL ?? process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const password = process.env.STRATA_EXPORT_PASSWORD ?? process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";

if (!supabaseUrl || !anonKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to export AI audit records.");
}

const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });

if (authError) {
  throw authError;
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${authData.session.access_token}`,
    },
  },
});

const { data, error } = await supabase
  .from("ai_outputs")
  .select(
    "id,committee_id,card_id,document_id,project_id,incident_id,output_type,prompt_hash,output,citations,model,status,duration_ms,input_record_count,citation_count,error_message,provider_metadata,created_mode,created_by_member_id,created_at",
  )
  .order("created_at", { ascending: false })
  .limit(Number(process.env.STRATA_AI_AUDIT_LIMIT ?? 100));

if (error) {
  throw error;
}

const records = (data ?? []).map((row) => {
  const output = row.output && typeof row.output === "object" && !Array.isArray(row.output)
    ? row.output
    : {};
  const nestedOutput = output.output && typeof output.output === "object" && !Array.isArray(output.output)
    ? output.output
    : {};

  return {
    id: row.id,
    task: row.output_type,
    model: row.model,
    mode: row.created_mode,
    status: row.status,
    timestamp: row.created_at,
    duration_ms: row.duration_ms,
    input_record_count: row.input_record_count,
    citation_count: row.citation_count,
    linked_record_ids: {
      committee_id: row.committee_id,
      card_id: row.card_id,
      document_id: row.document_id,
      project_id: row.project_id,
      incident_id: row.incident_id,
      created_by_member_id: row.created_by_member_id,
    },
    prompt_hash: row.prompt_hash,
    citations: row.citations,
    disclaimer: typeof output.disclaimer === "string" ? output.disclaimer : nestedOutput.disclaimer,
    error_message: row.error_message,
    provider_metadata: row.provider_metadata,
  };
});

const auditPack = {
  exported_at: new Date().toISOString(),
  exported_for: email,
  access_model: "Supabase Auth user with RLS-filtered ai_outputs query",
  record_count: records.length,
  records,
};

const serialized = JSON.stringify(auditPack, null, 2);

if (process.env.STRATA_AI_AUDIT_EXPORT_PATH) {
  writeFileSync(resolve(process.env.STRATA_AI_AUDIT_EXPORT_PATH), `${serialized}\n`);
} else {
  console.log(serialized);
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

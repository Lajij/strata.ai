import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertSafeMutationTarget } from "./target-environment-guard.mjs";

function loadEnv(file) {
  if (!existsSync(file)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const env = { ...loadEnv(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = resolveServiceKey(env);

function present(value) {
  return Boolean(value) && !value.includes("your-") && !value.includes("...");
}

const result = {
  url: present(url) ? "present" : "missing-or-placeholder",
  anonKey: present(anonKey) ? "present" : "missing-or-placeholder",
  serviceRoleKey: present(serviceRoleKey) ? "present" : "missing-or-placeholder",
  anonRest: null,
  serviceRoleRest: null,
};

if (present(url) && (present(anonKey) || present(serviceRoleKey))) {
  assertSafeMutationTarget({
    url,
    operation: "test-supabase-connection",
    env,
  });
}

if (present(url) && present(anonKey)) {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error, count } = await anon.from("committees").select("id", { count: "exact", head: true });
  result.anonRest = error
    ? { ok: false, message: error.message, code: error.code ?? null }
    : { ok: true, table: "committees", visibleCount: count };
}

if (present(url) && present(serviceRoleKey)) {
  const service = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error, count } = await service.from("committees").select("id", { count: "exact", head: true });
  result.serviceRoleRest = error
    ? { ok: false, message: error.message, code: error.code ?? null }
    : { ok: true, table: "committees", visibleCount: count };
}

console.log(JSON.stringify(result, null, 2));

if (result.anonRest?.ok === false || result.serviceRoleRest?.ok === false) {
  process.exit(1);
}

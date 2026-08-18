import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

// A value in SUPABASE_SECRET_KEY is only trusted if it is actually a server
// credential; a mislabeled publishable key would otherwise silently demote the
// admin client to anon-level access.
function isServerKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  if (value.startsWith("sb_secret_")) {
    return true;
  }

  if (JWT_PATTERN.test(value)) {
    try {
      const payload = JSON.parse(
        Buffer.from(value.split(".")[1], "base64url").toString("utf8"),
      ) as { role?: string };
      return payload.role === "service_role";
    } catch {
      return false;
    }
  }

  return false;
}

function resolveServiceKey() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isServerKey(secret)) {
    return secret;
  }

  if (secret && isServerKey(legacy)) {
    console.warn(
      "SUPABASE_SECRET_KEY is set but is not a server credential; falling back to SUPABASE_SERVICE_ROLE_KEY.",
    );
    return legacy;
  }

  if (isServerKey(legacy)) {
    return legacy;
  }

  return undefined;
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = resolveServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient<Database>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

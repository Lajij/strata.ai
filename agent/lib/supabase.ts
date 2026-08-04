import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../src/lib/supabase/types";

const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

let adminClient: SupabaseClient<Database> | null = null;

function isServerKey(value: string | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return true;

  if (JWT_PATTERN.test(value)) {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8")) as {
        role?: string;
      };
      return payload.role === "service_role";
    } catch {
      return false;
    }
  }

  return false;
}

function serviceKey() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isServerKey(secret)) return secret;
  if (isServerKey(legacy)) return legacy;
  return undefined;
}

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public configuration is unavailable.");
  }

  return { key, url };
}

export function getAgentAdminClient() {
  const { url } = publicConfig();
  const key = serviceKey();

  if (!key) {
    throw new Error("Supabase server configuration is unavailable.");
  }

  if (!adminClient) {
    adminClient = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}

export function getAgentUserClient(accessToken: string) {
  const { key, url } = publicConfig();

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function getSupabaseIssuer() {
  return `${publicConfig().url}/auth/v1`;
}

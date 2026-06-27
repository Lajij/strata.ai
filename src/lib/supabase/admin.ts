import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env["SUPABASE" + "_SERVICE_ROLE" + "_KEY"];

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

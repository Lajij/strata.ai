import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;
let implicitRecoveryClient: ReturnType<typeof createClient<Database>> | null = null;

function browserConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

export function getSupabaseBrowserClient() {
  const configuration = browserConfiguration();

  if (!configuration) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(configuration.url, configuration.key);
  }

  return browserClient;
}

// Admin-generated recovery links use Supabase's implicit callback even though
// the normal @supabase/ssr browser client is intentionally PKCE-only. Keep the
// compatibility client isolated to /recover, in memory, and non-refreshing;
// real user-requested recovery emails continue through the PKCE client above.
export function getSupabaseImplicitRecoveryClient() {
  const configuration = browserConfiguration();

  if (!configuration) {
    return null;
  }

  if (!implicitRecoveryClient) {
    implicitRecoveryClient = createClient<Database>(configuration.url, configuration.key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: false,
      },
    });
  }

  return implicitRecoveryClient;
}

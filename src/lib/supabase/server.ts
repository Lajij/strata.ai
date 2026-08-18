import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveRuntimeConfiguration } from "@/lib/runtime-configuration";
import type { Database } from "./types";

export async function getSupabaseServerClient(accessToken?: string) {
  const configuration = resolveRuntimeConfiguration();

  if (!configuration.supabase) {
    return null;
  }

  const { url, publishableKey } = configuration.supabase;
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read sessions but cannot always set cookies.
        }
      },
    },
  });
}

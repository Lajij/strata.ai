import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export async function authHeaders({
  contentType = "json",
}: {
  contentType?: "json" | "multipart"
} = {}) {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const headers: Record<string, string> = {}

  if (contentType === "json") {
    headers["Content-Type"] = "application/json"
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  return headers
}

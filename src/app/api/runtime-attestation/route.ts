import { NextResponse } from "next/server";

import {
  resolveRuntimeConfiguration,
  runtimeFailureResponse,
} from "@/lib/runtime-configuration";

export const dynamic = "force-dynamic";

function projectRef(url: string) {
  const hostname = new URL(url).hostname;
  const suffix = ".supabase.co";
  return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
}

function normalizedOrigin(url: string) {
  return new URL(url).origin;
}

export function GET() {
  try {
    const configuration = resolveRuntimeConfiguration();
    const runtimeSupabaseUrl = configuration.supabase?.url ?? null;
    const browserBuildSupabaseUrl = process.env.STRATA_BROWSER_BUILD_SUPABASE_URL || null;

    return NextResponse.json(
      {
        environment: configuration.environment,
        dataMode: configuration.dataMode,
        runtimeSupabaseOrigin: runtimeSupabaseUrl
          ? normalizedOrigin(runtimeSupabaseUrl)
          : null,
        browserSupabaseOrigin: browserBuildSupabaseUrl
          ? normalizedOrigin(browserBuildSupabaseUrl)
          : null,
        supabaseProjectRef: runtimeSupabaseUrl ? projectRef(runtimeSupabaseUrl) : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return runtimeFailureResponse(error);
  }
}

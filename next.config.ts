import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Next freezes browser environment variables at build time. Use one explicit
  // build-bound URL in both the client factory and runtime attestation so a
  // promoted/stale bundle cannot claim a different request-time target.
  env: {
    STRATA_BROWSER_BUILD_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  },
};

export default withEve(nextConfig);

import type { Metadata } from "next";

import { RecoveryWorkspace } from "@/components/recovery-workspace";

export const metadata: Metadata = {
  title: "Reset password | Strata",
  description: "Recover access to a Strata committee account.",
};

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; type?: string | string[] }>;
}) {
  const query = await searchParams;
  const isRecoveryCallback =
    typeof query.code === "string" || query.type === "recovery";
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );

  return (
    <RecoveryWorkspace
      isRecoveryCallback={isRecoveryCallback}
      supabaseConfigured={supabaseConfigured}
    />
  );
}

import { StrataApp } from "@/components/strata-app";
import { toPublicRuntimeFailure } from "@/lib/runtime-configuration";
import { getStrataAppData, type StrataAppData } from "@/lib/strata-app-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialData: StrataAppData | null = null;
  let runtimeFailure: ReturnType<typeof toPublicRuntimeFailure> | null = null;

  try {
    initialData = await getStrataAppData();
  } catch (error) {
    runtimeFailure = toPublicRuntimeFailure(error);
  }

  if (runtimeFailure) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
        <section aria-labelledby="service-unavailable-title" className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Strata service status</p>
          <h1 id="service-unavailable-title" className="mt-3 text-3xl font-semibold tracking-tight">
            Workspace temporarily unavailable
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-700">{runtimeFailure.body.error}</p>
          <p className="mt-6 font-mono text-sm text-slate-500">Reference: {runtimeFailure.body.code}</p>
        </section>
      </main>
    );
  }

  return <StrataApp initialData={initialData as StrataAppData} />;
}

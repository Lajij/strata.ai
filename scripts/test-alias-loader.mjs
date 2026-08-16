import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (
    process.env.STRATA_TEST_UPSTREAM_FAILURES === "1" &&
    new Set([
      "ai",
      "@/lib/ai/context",
      "@/lib/strata-app-data",
      "@/lib/supabase/server",
    ]).has(specifier)
  ) {
    return {
      url: pathToFileURL(resolvePath(process.cwd(), "scripts/test-upstream-failure-stubs.mjs")).href,
      shortCircuit: true,
    };
  }

  if (specifier === "next/server" || specifier === "next/headers" || specifier === "next/navigation") {
    return nextResolve(`${specifier}.js`, context);
  }

  if (specifier === "server-only") {
    return {
      url: "data:text/javascript,export default undefined",
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const unresolved = resolvePath(process.cwd(), "src", specifier.slice(2));
    const candidates = [unresolved, `${unresolved}.ts`, `${unresolved}.tsx`, resolvePath(unresolved, "index.ts")];
    const resolved = candidates.find((candidate) => existsSync(candidate));

    if (!resolved) {
      throw new Error(`Test alias loader could not resolve ${specifier}`);
    }

    return {
      url: pathToFileURL(resolved).href,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}

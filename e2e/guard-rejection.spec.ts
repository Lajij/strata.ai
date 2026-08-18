import { expect, test } from "./fixtures/personas";
import {
  assertSafeBrowserMutationTarget,
  UnsafeMutationTargetError,
} from "../scripts/target-environment-guard.mjs";

/**
 * Guard-rejection spec. The N1a/N1b production-target guard is wired into
 * Playwright `globalSetup` as the very first call, before any persona
 * provisioning or DB write. This spec asserts the guard itself refuses a
 * Production target under every production trigger, so persona fixtures can
 * never target Production. It reuses the guard primitive directly (no
 * reinvention) and asserts the real thrown `code`, never a source string.
 */

const LOCAL_APP = "http://127.0.0.1:3000";
const LOCAL_SUPABASE = "http://127.0.0.1:54321";
const PROD_SUPABASE = "https://strata-production.supabase.co";

function expectGuardRejects(
  args: Parameters<typeof assertSafeBrowserMutationTarget>[0],
  code: string,
): void {
  try {
    assertSafeBrowserMutationTarget(args);
    throw new Error("expected assertSafeBrowserMutationTarget to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(UnsafeMutationTargetError);
    expect((error as UnsafeMutationTargetError).code).toBe(code);
  }
}

test.describe("production-target guard rejection (before any DB write)", () => {
  test("rejects a Vercel Production hosting target", () => {
    expectGuardRejects(
      {
        appUrl: LOCAL_APP,
        supabaseUrl: LOCAL_SUPABASE,
        operation: "guard-rejection:vercel-production",
        env: { STRATA_ENVIRONMENT: "local", VERCEL_ENV: "production" },
      },
      "PRODUCTION_MUTATION_FORBIDDEN",
    );
  });

  test("rejects a target whose Supabase project ref is the Production project", () => {
    expectGuardRejects(
      {
        appUrl: "https://staging.example.invalid",
        supabaseUrl: PROD_SUPABASE,
        operation: "guard-rejection:production-ref",
        env: {
          STRATA_ENVIRONMENT: "staging",
          STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "strata-production",
        },
      },
      "PRODUCTION_MUTATION_FORBIDDEN",
    );
  });

  test("rejects an explicitly production-named environment", () => {
    // STRATA_ENVIRONMENT=production is outside the allowed mutation
    // environments, so the guard denies it before any write (different code,
    // same outcome: provisioning never happens).
    expectGuardRejects(
      {
        appUrl: LOCAL_APP,
        supabaseUrl: LOCAL_SUPABASE,
        operation: "guard-rejection:production-env",
        env: { STRATA_ENVIRONMENT: "production" },
      },
      "MUTATION_ENVIRONMENT_FORBIDDEN",
    );
  });

  test("rejects when STRATA_ENVIRONMENT is unset (default deny)", () => {
    expectGuardRejects(
      {
        appUrl: LOCAL_APP,
        supabaseUrl: LOCAL_SUPABASE,
        operation: "guard-rejection:unset-env",
        env: {},
      },
      "MUTATION_ENVIRONMENT_FORBIDDEN",
    );
  });

  test("permits the legitimate local loopback target", () => {
    const target = assertSafeBrowserMutationTarget({
      appUrl: LOCAL_APP,
      supabaseUrl: LOCAL_SUPABASE,
      operation: "guard-rejection:local-allow",
      env: { STRATA_ENVIRONMENT: "local" },
    });
    expect(target.targetEnvironment).toBe("local");
    expect(target.appOrigin).toBe(LOCAL_APP);
  });
});

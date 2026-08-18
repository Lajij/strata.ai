import { createClient } from "@supabase/supabase-js";
import { resolveServiceKey } from "../scripts/service-key.mjs";
import {
  assertSafeBrowserMutationTarget,
  UnsafeMutationTargetError,
} from "../scripts/target-environment-guard.mjs";
import { APP_URL, loadEnv } from "./lib/app";
import { cleanupE2eRecords, MARKER_PREFIX } from "./lib/cleanup";

/**
 * Playwright globalTeardown.
 *
 * Marker-scoped, idempotent cleanup of every record the harness created,
 * including the second fixture committee. Reuses the N1a/N1b production-target
 * guard first: under a Production (or otherwise forbidden) target it refuses to
 * run (there is nothing local to clean and Production must never be mutated).
 * Runs even if globalSetup failed partway through provisioning, so partial
 * state never accumulates.
 */

const OPERATION = "playwright:e2e:teardown";

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = resolveServiceKey();

if (!supabaseUrl || !serviceKey) {
  // Nothing was provisioned without a service key; nothing to clean.
  console.log("[e2e globalTeardown] no service key configured; skipping cleanup.");
} else {
  let skipCleanup = false;

  try {
    assertSafeBrowserMutationTarget({
      appUrl: APP_URL,
      supabaseUrl,
      operation: OPERATION,
    });
  } catch (error) {
    if (error instanceof UnsafeMutationTargetError) {
      console.warn(
        `[e2e globalTeardown] refusing to clean a forbidden target (${error.code}); skipping.`,
      );
      skipCleanup = true;
    } else {
      throw error;
    }
  }

  if (!skipCleanup) {
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await cleanupE2eRecords(service, MARKER_PREFIX);
    console.log("[e2e globalTeardown] marker-scoped cleanup complete.");
  } else {
    console.log("[e2e globalTeardown] complete (no cleanup performed).");
  }
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RuntimeBoundaryError,
  PublicRequestError,
  fixtureWriteDisabledResponse,
  isMissingAuthSession,
  operationFailureResponse,
  resolveAiReleaseMode,
  resolveRuntimeConfiguration,
  runtimeFailureResponse,
  toPublicRuntimeFailure,
  upstreamUnavailable,
} from "../src/lib/runtime-configuration.ts";
import {
  UnsafeMutationTargetError,
  assertBrowserMutationTargetAttestation,
  assertSafeBrowserMutationTarget,
  assertSafeMutationTarget,
} from "./target-environment-guard.mjs";
import { resolveServiceKey } from "./service-key.mjs";

function expectBoundaryError(env, code) {
  assert.throws(
    () => resolveRuntimeConfiguration(env),
    (error) => error instanceof RuntimeBoundaryError && error.code === code,
  );
}

expectBoundaryError({}, "RUNTIME_ENVIRONMENT_MISSING");
expectBoundaryError({ STRATA_ENVIRONMENT: "invalid" }, "RUNTIME_ENVIRONMENT_INVALID");
expectBoundaryError({ STRATA_ENVIRONMENT: "local", STRATA_DATA_MODE: "invalid" }, "DATA_MODE_INVALID");
expectBoundaryError({ STRATA_ENVIRONMENT: "local" }, "SUPABASE_CONFIGURATION_MISSING");
expectBoundaryError(
  { STRATA_ENVIRONMENT: "production", STRATA_DATA_MODE: "fixture" },
  "FIXTURE_MODE_FORBIDDEN",
);
expectBoundaryError(
  {
    VERCEL_ENV: "production",
    STRATA_ENVIRONMENT: "local",
    STRATA_DATA_MODE: "fixture",
  },
  "RUNTIME_ENVIRONMENT_CONFLICT",
);

assert.equal(isMissingAuthSession({ name: "AuthSessionMissingError" }), true);
assert.equal(isMissingAuthSession({ name: "AuthRetryableFetchError" }), false);

assert.throws(
  () => resolveAiReleaseMode({ STRATA_ENVIRONMENT: "local", STRATA_DATA_MODE: "fixture" }),
  (error) => error instanceof RuntimeBoundaryError && error.code === "AI_RELEASE_MODE_INVALID",
);
assert.throws(
  () => resolveAiReleaseMode({
    VERCEL_ENV: "production",
    STRATA_ENVIRONMENT: "production",
    STRATA_DATA_MODE: "live",
    STRATA_AI_RELEASE_MODE: "fallback",
    NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  }),
  (error) => error instanceof RuntimeBoundaryError && error.code === "AI_FALLBACK_FORBIDDEN",
);
assert.equal(resolveAiReleaseMode({
  VERCEL_ENV: "preview",
  STRATA_ENVIRONMENT: "staging",
  STRATA_DATA_MODE: "fixture",
  STRATA_AI_RELEASE_MODE: "fallback",
}), "fallback");
expectBoundaryError(
  {
    STRATA_ENVIRONMENT: "local",
    NEXT_PUBLIC_SUPABASE_URL: "file:///tmp/not-a-service",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  },
  "SUPABASE_URL_INVALID",
);

const fixtureConfiguration = resolveRuntimeConfiguration({
  STRATA_ENVIRONMENT: "test",
  STRATA_DATA_MODE: "fixture",
});
assert.deepEqual(fixtureConfiguration, {
  environment: "test",
  dataMode: "fixture",
  supabase: null,
});

const previewConfiguration = resolveRuntimeConfiguration({
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
});
assert.equal(previewConfiguration.environment, "staging");
assert.equal(previewConfiguration.dataMode, "live");
assert.equal(previewConfiguration.supabase?.url, "https://example.supabase.co");
assert.equal(previewConfiguration.supabase?.publishableKey, "public-test-key");

expectBoundaryError(
  { VERCEL_ENV: "production", STRATA_DATA_MODE: "fixture" },
  "FIXTURE_MODE_FORBIDDEN",
);

const unavailable = upstreamUnavailable("TEST_UPSTREAM_UNAVAILABLE");
const publicFailure = toPublicRuntimeFailure(unavailable);
assert.equal(publicFailure.status, 503);
assert.deepEqual(publicFailure.body, {
  error: "Strata data is temporarily unavailable. No demo data was substituted.",
  code: "TEST_UPSTREAM_UNAVAILABLE",
});

const fixtureWriteResponse = fixtureWriteDisabledResponse();
assert.equal(fixtureWriteResponse.status, 503);
assert.deepEqual(await fixtureWriteResponse.json(), {
  error: "Writes are disabled while explicit synthetic fixture mode is active.",
  code: "FIXTURE_WRITE_DISABLED",
});

const missingConfigurationResponse = runtimeFailureResponse(
  new RuntimeBoundaryError(
    "SUPABASE_CONFIGURATION_MISSING",
    "The Strata data service is not configured.",
  ),
);
assert.equal(missingConfigurationResponse.status, 503);
assert.deepEqual(await missingConfigurationResponse.json(), {
  error: "The Strata data service is not configured.",
  code: "SUPABASE_CONFIGURATION_MISSING",
});

const opaqueOperationResponse = operationFailureResponse(
  new Error("upstream row detail and credential-shaped value sb_secret_do-not-expose"),
  {
    code: "TEST_OPERATION_FAILED",
    message: "The test operation could not be completed.",
  },
);
assert.equal(opaqueOperationResponse.status, 400);
assert.deepEqual(await opaqueOperationResponse.json(), {
  error: "The test operation could not be completed.",
  code: "TEST_OPERATION_FAILED",
});

const publicRequestResponse = operationFailureResponse(
  new PublicRequestError("REQUEST_FIELD_REQUIRED", "Title is required"),
  {
    code: "TEST_OPERATION_FAILED",
    message: "The test operation could not be completed.",
  },
);
assert.equal(publicRequestResponse.status, 400);
assert.deepEqual(await publicRequestResponse.json(), {
  error: "Title is required",
  code: "REQUEST_FIELD_REQUIRED",
});

console.log("Behavioural runtime-boundary assertions passed (22 cases).");

function expectUnsafeMutation(args, code) {
  assert.throws(
    () => assertSafeMutationTarget(args),
    (error) => error instanceof UnsafeMutationTargetError && error.code === code,
  );
}

expectUnsafeMutation(
  { url: "http://127.0.0.1:54321", operation: "test", env: {} },
  "MUTATION_ENVIRONMENT_FORBIDDEN",
);
expectUnsafeMutation(
  {
    url: "https://prodref.supabase.co",
    operation: "test",
    env: { STRATA_ENVIRONMENT: "production" },
  },
  "MUTATION_ENVIRONMENT_FORBIDDEN",
);
expectUnsafeMutation(
  {
    url: "https://stagingref.supabase.co",
    operation: "test",
    env: { STRATA_ENVIRONMENT: "local" },
  },
  "REMOTE_MUTATION_FORBIDDEN",
);
expectUnsafeMutation(
  {
    url: "https://prodref.supabase.co",
    operation: "test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    },
  },
  "PRODUCTION_MUTATION_FORBIDDEN",
);
expectUnsafeMutation(
  {
    url: "https://stagingref.supabase.co",
    operation: "test",
    env: {
      VERCEL_ENV: "production",
      STRATA_ENVIRONMENT: " staging ",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    },
  },
  "PRODUCTION_MUTATION_FORBIDDEN",
);
expectUnsafeMutation(
  {
    url: "https://stagingref.supabase.co",
    operation: "test",
    env: { STRATA_ENVIRONMENT: "staging" },
  },
  "STAGING_MUTATION_APPROVAL_MISSING",
);
expectUnsafeMutation(
  {
    url: "http://stagingref.supabase.co",
    operation: "test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    },
  },
  "STAGING_HTTPS_REQUIRED",
);

assert.deepEqual(
  assertSafeMutationTarget({
    url: "http://127.0.0.1:54321",
    operation: "test",
    env: { STRATA_ENVIRONMENT: "test" },
  }),
  {
    targetEnvironment: "test",
    origin: "http://127.0.0.1:54321",
    projectRef: null,
  },
);
assert.deepEqual(
  assertSafeMutationTarget({
    url: "https://stagingref.supabase.co",
    operation: "test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    },
  }),
  {
    targetEnvironment: "staging",
    origin: "https://stagingref.supabase.co",
    projectRef: "stagingref",
  },
);

console.log("Behavioural mutation-target guard assertions passed (8 cases).");

function expectUnsafeBrowserMutation(args, code) {
  assert.throws(
    () => assertSafeBrowserMutationTarget(args),
    (error) => error instanceof UnsafeMutationTargetError && error.code === code,
  );
}

expectUnsafeBrowserMutation(
  {
    appUrl: "https://production.example.com",
    supabaseUrl: "http://127.0.0.1:54321",
    operation: "browser test",
    env: { STRATA_ENVIRONMENT: "test" },
  },
  "BROWSER_REMOTE_MUTATION_FORBIDDEN",
);
expectUnsafeBrowserMutation(
  {
    appUrl: "https://staging.example.com",
    supabaseUrl: "https://stagingref.supabase.co",
    operation: "browser test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    },
  },
  "BROWSER_STAGING_APPROVAL_MISSING",
);
expectUnsafeBrowserMutation(
  {
    appUrl: "https://production.example.com",
    supabaseUrl: "https://stagingref.supabase.co",
    operation: "browser test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
      STRATA_STAGING_BROWSER_ORIGIN: "https://staging.example.com",
      STRATA_PRODUCTION_BROWSER_ORIGIN: "https://production.example.com",
    },
  },
  "BROWSER_STAGING_TARGET_MISMATCH",
);
expectUnsafeBrowserMutation(
  {
    appUrl: "http://staging.example.com",
    supabaseUrl: "https://stagingref.supabase.co",
    operation: "browser test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
      STRATA_STAGING_BROWSER_ORIGIN: "https://staging.example.com",
      STRATA_PRODUCTION_BROWSER_ORIGIN: "https://production.example.com",
    },
  },
  "BROWSER_STAGING_TARGET_MISMATCH",
);
assert.deepEqual(
  assertSafeBrowserMutationTarget({
    appUrl: "http://localhost:3000/path",
    supabaseUrl: "http://127.0.0.1:54321",
    operation: "browser test",
    env: { STRATA_ENVIRONMENT: "local" },
  }),
  {
    targetEnvironment: "local",
    origin: "http://127.0.0.1:54321",
    projectRef: null,
    appOrigin: "http://localhost:3000",
  },
);
assert.deepEqual(
  assertSafeBrowserMutationTarget({
    appUrl: "https://staging.example.com/verification",
    supabaseUrl: "https://stagingref.supabase.co",
    operation: "browser test",
    env: {
      STRATA_ENVIRONMENT: "staging",
      STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
      STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
      STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
      STRATA_STAGING_BROWSER_ORIGIN: "https://staging.example.com",
      STRATA_PRODUCTION_BROWSER_ORIGIN: "https://production.example.com",
    },
  }),
  {
    targetEnvironment: "staging",
    origin: "https://stagingref.supabase.co",
    projectRef: "stagingref",
    appOrigin: "https://staging.example.com",
  },
);

const stagingBrowserTarget = assertSafeBrowserMutationTarget({
  appUrl: "https://staging.example.com/verification",
  supabaseUrl: "https://stagingref.supabase.co",
  operation: "browser attestation test",
  env: {
    STRATA_ENVIRONMENT: "staging",
    STRATA_STAGING_SUPABASE_PROJECT_REF: "stagingref",
    STRATA_PRODUCTION_SUPABASE_PROJECT_REF: "prodref",
    STRATA_ALLOW_REMOTE_TEST_MUTATIONS: "1",
    STRATA_STAGING_BROWSER_ORIGIN: "https://staging.example.com",
    STRATA_PRODUCTION_BROWSER_ORIGIN: "https://production.example.com",
  },
});
const attestedTarget = await assertBrowserMutationTargetAttestation({
  target: stagingBrowserTarget,
  operation: "browser attestation test",
  fetchImpl: async () => Response.json({
    environment: "staging",
    dataMode: "live",
    runtimeSupabaseOrigin: "https://stagingref.supabase.co",
    browserSupabaseOrigin: "https://stagingref.supabase.co",
    supabaseProjectRef: "stagingref",
  }),
});
assert.equal(attestedTarget.attested, true);
await assert.rejects(
  () => assertBrowserMutationTargetAttestation({
    target: stagingBrowserTarget,
    operation: "browser attestation test",
    fetchImpl: async () => Response.json({
      environment: "staging",
      dataMode: "live",
      runtimeSupabaseOrigin: "https://prodref.supabase.co",
      browserSupabaseOrigin: "https://prodref.supabase.co",
      supabaseProjectRef: "prodref",
    }),
  }),
  (error) => error instanceof UnsafeMutationTargetError && error.code === "BROWSER_TARGET_ATTESTATION_MISMATCH",
);
const localBrowserTarget = assertSafeBrowserMutationTarget({
  appUrl: "http://127.0.0.1:3000",
  supabaseUrl: "http://127.0.0.1:54321",
  operation: "local browser attestation test",
  env: { STRATA_ENVIRONMENT: "test" },
});
await assert.rejects(
  () => assertBrowserMutationTargetAttestation({
    target: localBrowserTarget,
    operation: "local browser attestation test",
    fetchImpl: async () => Response.json({
      environment: "test",
      dataMode: "live",
      runtimeSupabaseOrigin: "http://127.0.0.1:54322",
      browserSupabaseOrigin: "http://127.0.0.1:54322",
      supabaseProjectRef: null,
    }),
  }),
  (error) => error instanceof UnsafeMutationTargetError && error.code === "BROWSER_TARGET_ATTESTATION_MISMATCH",
);

console.log("Behavioural browser mutation-target guard assertions passed (10 cases, including build/runtime deployment attestation). ");

const validServerKey = "sb_secret_test-server-key";
assert.equal(
  resolveServiceKey({ SUPABASE_SECRET_KEY: validServerKey }),
  validServerKey,
);
assert.equal(
  resolveServiceKey({ SUPABASE_SECRET_KEY: "sb_publishable_not-a-server-key" }),
  undefined,
);
assert.equal(
  resolveServiceKey({
    SUPABASE_SECRET_KEY: "sb_publishable_not-a-server-key",
    SUPABASE_SERVICE_ROLE_KEY: validServerKey,
  }),
  validServerKey,
);

console.log("Behavioural server-key assertions passed (3 cases).");

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertContains(source, needle, label) {
  assert.ok(source.includes(needle), `Missing ${label}: ${needle}`);
}

function assertNotContains(source, needle, label) {
  assert.ok(!source.includes(needle), `Forbidden ${label}: ${needle}`);
}

const writeRoutes = [
  "src/app/api/workflow/[action]/route.ts",
  "src/app/api/finance/[action]/route.ts",
  "src/app/api/documents/create/route.ts",
  "src/app/api/members/accept/route.ts",
  "src/app/api/members/invite/route.ts",
  "src/app/api/members/update/route.ts",
];

const adminClient = read("src/lib/supabase/admin.ts");
assertContains(adminClient, "return undefined;", "invalid admin-key rejection");
assertNotContains(adminClient, "return secret || legacy", "invalid admin-key fallback");

for (const path of writeRoutes) {
  const source = read(path);
  assertContains(source, "fixtureWriteDisabledResponse", `${path} fixture write denial`);
  assertContains(source, "runtimeFailureResponse", `${path} runtime failure response`);
  assertContains(source, "operationFailureResponse", `${path} opaque operation failure`);
  assertNotContains(source, "mock success", `${path} mock success`);
  assertNotContains(source, "`mock-", `${path} fabricated identifier`);
  assertNotContains(source, 'mode: "fallback"', `${path} fallback write response`);
}

const appData = read("src/lib/strata-app-data.ts");
assertContains(appData, 'sourceDetail: "Explicit synthetic fixture mode"', "explicit fixture read label");
assertContains(appData, 'throw upstreamUnavailable("SUPABASE_APP_DATA_QUERY_FAILED")', "app-data upstream denial");
assertNotContains(appData, "Supabase query failed; using local fallback data", "query-failure fixture substitution");

const aiContext = read("src/lib/ai/context.ts");
assertContains(aiContext, 'throw upstreamUnavailable("SUPABASE_AI_CONTEXT_QUERY_FAILED")', "AI context upstream denial");
assertContains(aiContext, "throw activeMemberRequired()", "AI active-member boundary");
assertNotContains(aiContext, "return buildFallbackAiContext(request, member.role)", "AI query-failure fixture substitution");

const aiRoute = read("src/app/api/ai/[task]/route.ts");
assertContains(aiRoute, 'code: "AI_PROVIDER_UNAVAILABLE"', "AI provider error contract");
assertContains(aiRoute, "No mock answer was substituted", "AI provider fail-closed message");
assertNotContains(aiRoute, 'mode: "error-fallback"', "AI provider fallback success");
assertNotContains(aiRoute, "forceFallback", "caller-controlled AI fallback");
assertNotContains(aiRoute, "error.message }", "raw AI persistence error");

const envExample = read(".env.example");
assertContains(envExample, "STRATA_ENVIRONMENT=local", "runtime environment example");
assertContains(envExample, "STRATA_DATA_MODE=live", "live data-mode default");

const seedScript = read("scripts/seed-live-workspace.mjs");
assertContains(seedScript, "assertSafeMutationTarget", "seed target-environment guard");

const contract = read("FRONTEND-CONTRACT.md");
assertContains(contract, "FIXTURE_WRITE_DISABLED", "frontend fail-closed write contract");
assertContains(contract, "never substitutes fixture records", "frontend fail-closed read contract");

console.log("Static fail-closed route-wiring contract checks passed (6 write routes + read/AI boundaries).");

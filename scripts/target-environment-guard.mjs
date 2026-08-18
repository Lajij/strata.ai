const allowedMutationEnvironments = new Set(["local", "test", "staging"]);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export class UnsafeMutationTargetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "UnsafeMutationTargetError";
    this.code = code;
  }
}

function projectRefFromUrl(url) {
  const suffix = ".supabase.co";
  return url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : null;
}

export function assertSafeMutationTarget({
  url,
  operation,
  env = process.env,
}) {
  const targetEnvironment = env.STRATA_ENVIRONMENT?.trim();

  if (env.VERCEL_ENV === "production") {
    throw new UnsafeMutationTargetError(
      "PRODUCTION_MUTATION_FORBIDDEN",
      `${operation} cannot run from a Vercel Production environment.`,
    );
  }

  if (!allowedMutationEnvironments.has(targetEnvironment)) {
    throw new UnsafeMutationTargetError(
      "MUTATION_ENVIRONMENT_FORBIDDEN",
      `${operation} requires STRATA_ENVIRONMENT=local, test, or staging.`,
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new UnsafeMutationTargetError(
      "MUTATION_TARGET_URL_INVALID",
      `${operation} requires a valid target URL.`,
    );
  }

  if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
    throw new UnsafeMutationTargetError(
      "MUTATION_TARGET_URL_INVALID",
      `${operation} requires an HTTP(S) target URL.`,
    );
  }

  const projectRef = projectRefFromUrl(parsedUrl);
  const productionRef = env.STRATA_PRODUCTION_SUPABASE_PROJECT_REF?.trim();

  if (productionRef && projectRef === productionRef) {
    throw new UnsafeMutationTargetError(
      "PRODUCTION_MUTATION_FORBIDDEN",
      `${operation} resolved to the configured Production project.`,
    );
  }

  if (targetEnvironment === "local" || targetEnvironment === "test") {
    if (!loopbackHosts.has(parsedUrl.hostname)) {
      throw new UnsafeMutationTargetError(
        "REMOTE_MUTATION_FORBIDDEN",
        `${operation} requires a loopback target in ${targetEnvironment}.`,
      );
    }

    return {
      targetEnvironment,
      origin: parsedUrl.origin,
      projectRef,
    };
  }

  if (parsedUrl.protocol !== "https:") {
    throw new UnsafeMutationTargetError(
      "STAGING_HTTPS_REQUIRED",
      `${operation} requires HTTPS for a staging target.`,
    );
  }

  const stagingRef = env.STRATA_STAGING_SUPABASE_PROJECT_REF?.trim();

  if (
    env.STRATA_ALLOW_REMOTE_TEST_MUTATIONS !== "1" ||
    !stagingRef ||
    !productionRef
  ) {
    throw new UnsafeMutationTargetError(
      "STAGING_MUTATION_APPROVAL_MISSING",
      `${operation} requires explicit staging and Production project refs plus STRATA_ALLOW_REMOTE_TEST_MUTATIONS=1.`,
    );
  }

  if (!projectRef || projectRef !== stagingRef || stagingRef === productionRef) {
    throw new UnsafeMutationTargetError(
      "STAGING_MUTATION_TARGET_MISMATCH",
      `${operation} target does not match the isolated staging project.`,
    );
  }

  return {
    targetEnvironment,
    origin: parsedUrl.origin,
    projectRef,
  };
}

export function assertSafeBrowserMutationTarget({
  appUrl,
  supabaseUrl,
  operation,
  env = process.env,
}) {
  const databaseTarget = assertSafeMutationTarget({
    url: supabaseUrl,
    operation,
    env,
  });
  let parsedAppUrl;

  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    throw new UnsafeMutationTargetError(
      "BROWSER_MUTATION_TARGET_URL_INVALID",
      `${operation} requires a valid browser target URL.`,
    );
  }

  if (!new Set(["http:", "https:"]).has(parsedAppUrl.protocol)) {
    throw new UnsafeMutationTargetError(
      "BROWSER_MUTATION_TARGET_URL_INVALID",
      `${operation} requires an HTTP(S) browser target URL.`,
    );
  }

  if (databaseTarget.targetEnvironment === "local" || databaseTarget.targetEnvironment === "test") {
    if (!loopbackHosts.has(parsedAppUrl.hostname)) {
      throw new UnsafeMutationTargetError(
        "BROWSER_REMOTE_MUTATION_FORBIDDEN",
        `${operation} requires a loopback browser target in ${databaseTarget.targetEnvironment}.`,
      );
    }
  } else {
    const stagingOrigin = env.STRATA_STAGING_BROWSER_ORIGIN?.trim();
    const productionOrigin = env.STRATA_PRODUCTION_BROWSER_ORIGIN?.trim();

    if (!stagingOrigin || !productionOrigin) {
      throw new UnsafeMutationTargetError(
        "BROWSER_STAGING_APPROVAL_MISSING",
        `${operation} requires explicit staging and Production browser origins.`,
      );
    }

    let expectedStagingOrigin;
    let expectedProductionOrigin;

    try {
      const parsedStagingOrigin = new URL(stagingOrigin);
      const parsedProductionOrigin = new URL(productionOrigin);

      if (parsedStagingOrigin.protocol !== "https:" || parsedProductionOrigin.protocol !== "https:") {
        throw new Error("Remote browser origins require HTTPS");
      }

      expectedStagingOrigin = parsedStagingOrigin.origin;
      expectedProductionOrigin = parsedProductionOrigin.origin;
    } catch {
      throw new UnsafeMutationTargetError(
        "BROWSER_STAGING_APPROVAL_MISSING",
        `${operation} requires valid staging and Production browser origins.`,
      );
    }

    if (
      parsedAppUrl.protocol !== "https:" ||
      parsedAppUrl.origin !== expectedStagingOrigin ||
      expectedStagingOrigin === expectedProductionOrigin ||
      parsedAppUrl.origin === expectedProductionOrigin
    ) {
      throw new UnsafeMutationTargetError(
        "BROWSER_STAGING_TARGET_MISMATCH",
        `${operation} browser target does not match the isolated staging origin.`,
      );
    }
  }

  return {
    ...databaseTarget,
    appOrigin: parsedAppUrl.origin,
  };
}

export async function assertBrowserMutationTargetAttestation({
  target,
  operation,
  env = process.env,
  fetchImpl = fetch,
}) {
  const attestationUrl = new URL("/api/runtime-attestation", target.appOrigin);
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const headers = bypassSecret
    ? { "x-vercel-protection-bypass": bypassSecret }
    : undefined;
  let response;

  try {
    response = await fetchImpl(attestationUrl, {
      cache: "no-store",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new UnsafeMutationTargetError(
      "BROWSER_TARGET_ATTESTATION_UNAVAILABLE",
      `${operation} could not read the browser target attestation.`,
    );
  }

  if (!response.ok) {
    throw new UnsafeMutationTargetError(
      "BROWSER_TARGET_ATTESTATION_UNAVAILABLE",
      `${operation} browser target attestation returned HTTP ${response.status}.`,
    );
  }

  let attestation;

  try {
    attestation = await response.json();
  } catch {
    throw new UnsafeMutationTargetError(
      "BROWSER_TARGET_ATTESTATION_INVALID",
      `${operation} browser target attestation was not valid JSON.`,
    );
  }

  if (
    attestation?.environment !== target.targetEnvironment ||
    attestation?.dataMode !== "live" ||
    attestation?.runtimeSupabaseOrigin !== target.origin ||
    attestation?.browserSupabaseOrigin !== target.origin ||
    (target.projectRef !== null && attestation?.supabaseProjectRef !== target.projectRef)
  ) {
    throw new UnsafeMutationTargetError(
      "BROWSER_TARGET_ATTESTATION_MISMATCH",
      `${operation} browser deployment is not bound to the asserted live Supabase target.`,
    );
  }

  return {
    ...target,
    attested: true,
  };
}

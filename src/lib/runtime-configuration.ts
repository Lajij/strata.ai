export type StrataRuntimeEnvironment = "local" | "test" | "staging" | "production";
export type StrataDataMode = "live" | "fixture";
export type StrataAiReleaseMode = "live" | "fallback";

type EnvironmentLike = Record<string, string | undefined>;

export interface StrataRuntimeConfiguration {
  environment: StrataRuntimeEnvironment;
  dataMode: StrataDataMode;
  supabase:
    | {
        url: string;
        publishableKey: string;
      }
    | null;
}

export class RuntimeBoundaryError extends Error {
  readonly code: string;
  readonly status: number;
  readonly publicMessage: string;

  constructor(code: string, publicMessage: string, status = 503) {
    super(publicMessage);
    this.name = "RuntimeBoundaryError";
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export class PublicRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PublicRequestError";
    this.code = code;
    this.status = status;
  }
}

const runtimeEnvironments = new Set<StrataRuntimeEnvironment>([
  "local",
  "test",
  "staging",
  "production",
]);
const dataModes = new Set<StrataDataMode>(["live", "fixture"]);

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveRuntimeEnvironment(env: EnvironmentLike): StrataRuntimeEnvironment {
  const configured = nonEmpty(env.STRATA_ENVIRONMENT);
  const platformEnvironment = env.VERCEL_ENV === "production"
    ? "production"
    : env.VERCEL_ENV === "preview"
      ? "staging"
      : env.VERCEL_ENV === "development"
        ? "local"
        : undefined;

  if (platformEnvironment) {
    if (configured && configured !== platformEnvironment) {
      throw new RuntimeBoundaryError(
        "RUNTIME_ENVIRONMENT_CONFLICT",
        "The Strata runtime environment conflicts with its hosting environment.",
      );
    }

    return platformEnvironment;
  }

  if (configured) {
    if (!runtimeEnvironments.has(configured as StrataRuntimeEnvironment)) {
      throw new RuntimeBoundaryError(
        "RUNTIME_ENVIRONMENT_INVALID",
        "The Strata runtime environment is invalid.",
      );
    }

    return configured as StrataRuntimeEnvironment;
  }

  if (env.NODE_ENV === "development") {
    return "local";
  }

  if (env.NODE_ENV === "test") {
    return "test";
  }

  throw new RuntimeBoundaryError(
    "RUNTIME_ENVIRONMENT_MISSING",
    "The Strata runtime environment is not configured.",
  );
}

export function resolveRuntimeConfiguration(
  env: EnvironmentLike = process.env,
): StrataRuntimeConfiguration {
  const environment = resolveRuntimeEnvironment(env);
  const configuredDataMode = nonEmpty(env.STRATA_DATA_MODE) ?? "live";

  if (!dataModes.has(configuredDataMode as StrataDataMode)) {
    throw new RuntimeBoundaryError(
      "DATA_MODE_INVALID",
      "The Strata data mode is invalid.",
    );
  }

  const dataMode = configuredDataMode as StrataDataMode;

  if (dataMode === "fixture") {
    if (environment === "production") {
      throw new RuntimeBoundaryError(
        "FIXTURE_MODE_FORBIDDEN",
        "Synthetic fixture data is forbidden in Production.",
      );
    }

    return { environment, dataMode, supabase: null };
  }

  const url = nonEmpty(env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey =
    nonEmpty(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    nonEmpty(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !publishableKey) {
    throw new RuntimeBoundaryError(
      "SUPABASE_CONFIGURATION_MISSING",
      "The Strata data service is not configured.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new RuntimeBoundaryError(
      "SUPABASE_URL_INVALID",
      "The Strata data service URL is invalid.",
    );
  }

  if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
    throw new RuntimeBoundaryError(
      "SUPABASE_URL_INVALID",
      "The Strata data service URL is invalid.",
    );
  }

  return {
    environment,
    dataMode,
    supabase: {
      url: parsedUrl.toString().replace(/\/$/, ""),
      publishableKey,
    },
  };
}

export function resolveAiReleaseMode(
  env: EnvironmentLike = process.env,
): StrataAiReleaseMode {
  const releaseMode = nonEmpty(env.STRATA_AI_RELEASE_MODE);

  if (releaseMode !== "live" && releaseMode !== "fallback") {
    throw new RuntimeBoundaryError(
      "AI_RELEASE_MODE_INVALID",
      "The AI release mode is missing or invalid.",
    );
  }

  const runtimeConfiguration = resolveRuntimeConfiguration(env);

  if (releaseMode === "fallback" && runtimeConfiguration.environment === "production") {
    throw new RuntimeBoundaryError(
      "AI_FALLBACK_FORBIDDEN",
      "Mock AI responses are forbidden in Production.",
    );
  }

  return releaseMode;
}

export function upstreamUnavailable(code = "SUPABASE_UPSTREAM_UNAVAILABLE") {
  return new RuntimeBoundaryError(
    code,
    "Strata data is temporarily unavailable. No demo data was substituted.",
  );
}

export function isMissingAuthSession(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AuthSessionMissingError",
  );
}

export function activeMemberRequired() {
  return new RuntimeBoundaryError(
    "ACTIVE_MEMBER_REQUIRED",
    "Sign in as an active committee member to use this service.",
    401,
  );
}

export function toPublicRuntimeFailure(error: unknown) {
  if (error instanceof RuntimeBoundaryError) {
    return {
      status: error.status,
      body: {
        error: error.publicMessage,
        code: error.code,
      },
    };
  }

  return {
    status: 503,
    body: {
      error: "Strata is temporarily unavailable. No demo data was substituted.",
      code: "RUNTIME_BOUNDARY_FAILURE",
    },
  };
}

export function runtimeFailureResponse(error: unknown) {
  const failure = toPublicRuntimeFailure(error);
  return Response.json(failure.body, { status: failure.status });
}

export function operationFailureResponse(
  error: unknown,
  {
    code,
    message,
    status = 400,
  }: {
    code: string;
    message: string;
    status?: number;
  },
) {
  if (error instanceof RuntimeBoundaryError) {
    return runtimeFailureResponse(error);
  }

  if (error instanceof PublicRequestError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return Response.json({ error: message, code }, { status });
}

export function fixtureWriteDisabledResponse() {
  return Response.json(
    {
      error: "Writes are disabled while explicit synthetic fixture mode is active.",
      code: "FIXTURE_WRITE_DISABLED",
    },
    { status: 503 },
  );
}

# ADR 0001: Explicit runtime and fixture boundary

Status: accepted

Date: 2026-08-15

## Context

The alpha application treated missing Supabase configuration and upstream query failures as permission to return local demo records. Several write routes returned HTTP success with fabricated identifiers when configuration was absent. This can conceal outages, mislead committee members about persistence, and allow fixtures to appear in a Production response.

## Decision

- `STRATA_DATA_MODE` defaults to `live`. Synthetic fixtures require the exact explicit value `fixture`.
- Fixture mode is permitted only in a resolved `local`, `test`, or `staging` runtime. It is rejected in Production.
- `STRATA_ENVIRONMENT` may explicitly select `local`, `test`, `staging`, or `production`. Vercel Production/Preview and local Next development/test values provide bounded inference; an otherwise ambiguous production-like runtime fails closed.
- A Vercel hosting environment signal is authoritative. A conflicting `STRATA_ENVIRONMENT` value fails closed, so an application variable cannot relabel Vercel Production as local/staging.
- Live mode requires a valid Supabase URL and publishable/legacy anon key. Missing or invalid configuration returns a typed non-2xx error.
- Explicit fixture mode may serve local synthetic reads, but all write endpoints return `FIXTURE_WRITE_DISABLED`; they never return a fabricated identifier or success.
- Supabase authentication/query failures return a typed unavailable/unauthenticated response and never substitute fixture data.
- `STRATA_AI_RELEASE_MODE` must be exactly `live` or `fallback`. Fallback is forbidden in Production, cannot be selected by a request body, and live provider failure never substitutes a mock answer.
- Upstream/database error text remains server-side. Public responses use stable error codes and deliberately public validation messages only.
- Every direct database/service mutator must resolve a local/test loopback or an explicitly approved staging Supabase project before client creation or mutation. Browser mutators must additionally match an exact staging application origin distinct from Production.

## Consequences

- Local fixture use must be deliberate: `STRATA_ENVIRONMENT=local STRATA_DATA_MODE=fixture`.
- Self-hosted production-like runtimes must set `STRATA_ENVIRONMENT=production`; ambiguity is treated as unavailable.
- Existing fallback-oriented static contracts and UI copy must be updated to distinguish explicit fixtures from service failure.
- Pure guard tests and a static mutator inventory prove preflight coverage, but do not prove live Data API/RLS behaviour or remote environment parity. Those still require the isolated Q0 behavioural suite.

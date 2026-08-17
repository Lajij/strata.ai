# strata.ai v1 — go/no-go report

Last updated: 2026-08-04 (Australia/Sydney)

Production recommendation: **NO-GO / HOLD**

Decision owner: repository operator/owner

Production mutation performed by this review: **none**

## Release scope

The evaluated v1 scope includes Track A (authentication, recovery, and the consolidated frontend), Track C (dashboard, drilldown, and search), and Track D (Eve read tools, evals, and operator-gated draft tools).

Track B (mail intake, reviewed register, and meeting mode) is excluded by signed decision #7. Track E is deferred post-v1 by signed decision #8. Decisions #1–#2 and #9–#10 therefore do not block this narrowly defined v1, but none of their deferred capabilities may be represented as shipped. Signed decision #5 selects verified fallback AI mode, and signed decision #6 approves the current Supabase variable names and server-only boundary.

## Evidence that passed

| Boundary | Result | Captured evidence |
|---|---|---|
| Hardened local release barrier | Pass | After dependency hardening, all 9 gates passed in strict order: lint, Next 16.3 build, security, production readiness, documents, AI, law, live auth, and live member management. |
| Production dependency audit | Pass | Final `npm audit --omit=dev --json` exited 0 with 0 total vulnerabilities. Resolved versions include Next/ESLint config 16.3.0, Tailwind/PostCSS integration 4.3.3, PostCSS 8.5.23/8.5.25, sharp 0.35.3, js-yaml 4.3.1, and Hono 4.13.0. |
| Auth hardening | Pass | Lifecycle migration read-back passed; live auth/member cleanup left zero test residue. |
| Recovery | Pass | Preview recovery passed 6/6: callback, update form, password update, local session clear, new-password sign-in, and cleanup. |
| Role/RLS browser gate | Pass | Preview auth browser passed 16/16, including signed-out lock, ordinary-member restrictions, suspension, hidden-record filtering, and scoped cleanup. |
| AI browser gate | Pass | Preview AI browser passed 10/10 with hidden data absent and the marked output rows cleaned. |
| Eve | Pass | Local loopback fixture passed 8/8 evals and 40/40 gates for citations, evidence-missing fallback, scope, cross-session isolation, approval, denial, and unauthorized access. `liveSupabaseCalls` was false. |
| Fresh UI rehearsal | Pass | Preview `dpl_HQ7AD2sLp5tij1dyryzYPsJiiVFr` passed 13/13 responsive, accessibility, role, dialog, overflow, and clean-console observations; `consoleErrors` and `failedResponses` were empty. |
| Preview artifact | Pass | Vercel inspection returned `target: preview`, `status: Ready`, and the `/recover` function for `https://strata-5z8ywdcrp-jjlecocq-8964s-projects.vercel.app`. |
| Production isolation for final rehearsal | Pass with historical variance | Production before/after listings were identical during the final Preview deployment. The earlier operator-created errored Production redeploy remains recorded as an accepted historical variance, not erased. |

## Resolved finding

### Production dependency security — resolved 2026-08-04

The initial report found four high production dependency findings, including the directly relevant Next.js Proxy-bypass range. The approved dependency-hardening node updated:

- `next` and `eslint-config-next` to 16.3.0,
- `tailwindcss` and `@tailwindcss/postcss` to 4.3.3,
- compatible transitive resolutions to PostCSS 8.5.23/8.5.25, sharp 0.35.3, js-yaml 4.3.1, and Hono 4.13.0.

The final production audit reports 0 vulnerabilities, and the complete nine-gate barrier passed after the upgrade. This finding no longer blocks release.

### Launch routers — resolved 2026-08-04

The repository operator explicitly approved decisions #5–#8: verified fallback AI mode; the current Supabase environment-variable names; no meeting-mode in v1; and `defer-track-e-post-v1`. Live AI is now fail-closed behind the exact server-side setting `STRATA_AI_RELEASE_MODE=live`; absent or invalid settings use fallback even when Vercel OIDC is present.

## Blocking findings

### 1. Release artifact is not traceable — release blocker

The working tree contains a broad set of modified and untracked Wave 1–3 implementation files. The tracked diff alone reports 43 files with 5,079 insertions and 2,948 deletions, before counting untracked application, verifier, eval, graph, and migration files.

No commit or push has been authorized or performed. A Production promotion from this mutable working tree would not provide a reviewable source revision or a reproducible release boundary.

### 2. Production recovery target is not established — release blocker

The current Production deployment listing contains only two pre-existing deployments in `ERROR` state. There is no captured Ready Production artifact to use as a known-good rollback target. No promotion, rollback, alias mutation, or Production deployment is authorized by this report.

## Recovery plan

1. Keep the current Preview available as evidence; do not promote it.
2. Preserve the completed dependency-hardening change and its clean audit/9-gate evidence in the intended release revision.
3. Create a fresh Preview from that exact revision and verify its deployment ID, target, Ready state, environment-variable names, and Production before/after listing.
4. Rerun auth 16/16, recovery 6/6, AI 10/10 for the selected release mode, Eve 40/40, and read-only UI rehearsal 13/13 against that exact candidate. Live/mutating and AI-disclosure gates retain their explicit approval boundaries.
5. Obtain fresh-eyes human sign-off on the candidate and document the chosen AI/scope routers.
6. Before any Production action, name the exact immutable candidate deployment, the health checks, the rollback target or recovery procedure, and the operator authorized to execute them.
7. If any gate fails, leave Production untouched and return to the failing node; do not promote around a failed barrier.

## Next scope

The shortest safe path to a GO decision is:

1. `release-revision` — review the dirty tree, define the intended file set, then commit/push only with separate operator authorization.
2. `release-preview` — deploy that immutable revision to Preview and repeat the complete candidate gates.
3. `production-go-no-go` — operator signs GO only after the exact-candidate verification and recovery plan are clean.

## Operator decision

- [ ] GO — all blockers above are resolved and the named candidate may enter a separately authorized Production procedure.
- [ ] NO-GO / HOLD — keep Production untouched and execute the unblock sequence.

Operator: **pending**

Decision date: **pending**

Candidate deployment/revision: **pending**

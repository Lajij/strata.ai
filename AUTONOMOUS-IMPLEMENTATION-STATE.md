# Autonomous implementation state

last_updated: 2026-08-16 (Australia/Sydney)
branch_head: `codex/strata-v1-release-candidate` / `be4c4d053e7c822a78528e0b9f7351d229ea679d`
current_node: N1a — canonical migration replay and fixture isolation
overall_status: ITERATING

## Protected pre-existing paths

Recorded before autonomous implementation began. Do not delete, reset, stage, reformat, or overwrite these paths unless a later task explicitly owns a non-conflicting edit.

- Modified: `GRAPH-STATE.md`
- Untracked: `.agents/`
- Untracked: `AUTONOMOUS-FULL-PROJECT-IMPLEMENTATION-PROMPT.md`
- Untracked: `ENGINEERING-IMPLEMENTATION-PLAN.md`
- Untracked: `ENGINEERING-PLAN-REVIEW-PROMPT.md`
- Untracked: `ENGINEERING-PLAN-REVIEW.md`
- Untracked: `GRAPH-PLAN 2.md`
- Untracked: `GROK-BOT-BOOTSTRAP.md`
- Untracked: `GROK-BOT-IMPLEMENTATION-PLAN.md`
- Untracked: `GROK-BOT-STATE.md`
- Untracked: `building-management-platform/`
- Untracked: `skills-lock.json`
- Untracked: `src/components/pages/settings-page 2.tsx`
- Untracked: `supabase/.branches/`
- Untracked: `supabase/.temp/`

Ignored generated paths such as `.next/`, `.output/`, and `.eve/` are disposable build outputs, not product evidence. The duplicate untracked `settings-page 2.tsx` is included by the repository's broad TypeScript include and may affect type checking; it remains protected.

## Accepted execution amendments

The P1/P2 corrections in `ENGINEERING-PLAN-REVIEW.md` are accepted execution amendments:

- Use the 166–251 engineer-day ticket backlog before omitted harness, integration, review, workshop, and contingency effort; publish 9–12 week pilot and 20–30 week full-product planning ranges.
- Split platform work into N1a (environment, fail-closed configuration, fixture isolation, migration parity) and N1b (capabilities, RLS, audit integrity, transactional/idempotent workflows).
- Add Q0 as a first-class Playwright/persona/isolation/accessibility/CI track.
- Label source/string checks as static contract evidence only; they do not prove runtime RLS, capabilities, transactions, or journeys.
- Add records E2E, automated accessibility, an owned restore rehearsal with provisional RPO/RTO, and explicit legacy proposal/vote retirement.
- Require audit actor `WITH CHECK` behaviour and retrofit existing workflow/finance routes onto transactional operations.
- Treat prior Preview/Production and remote-migration claims as dated or UNVERIFIED until current read-only evidence exists.
- Default financial confirmer proposal is admin/chair/treasurer, pending human confirmation; do not treat it as accepted real-building authority.

## Node ledger

| Node | Status | Evidence |
|---|---|---|
| R0 | done | Plan/review/supporting contracts read; branch/HEAD and dirty paths protected; package/schema/verifier inventories completed by direct and three independent read-only audits; local gates recorded without false behavioural claims. |
| N1a | in-progress | Fail-closed runtime paths are accepted by an independent checker. The historical initial migration is preserved and exact-match forward reconciliation is behaviourally tested; synthetic fixtures use a new guarded namespace. All 15 runtime mutators now have mechanically inventoried database/browser target guards. Exact Supabase no-seed replay is blocked by registry rate limiting and remote parity remains unproven. |
| N1b | pending | Existing RLS foundation is static-inspected only; read-only capability, audit actor, transaction, and idempotency gaps remain. |
| Q0 | pending | Playwright dependency and five guarded bespoke browser scripts exist; no Playwright config, reusable six-persona fixture harness, axe gate, or CI workflow. |
| N2 | pending | Legacy proposal/vote/condition primitives exist; target approval domain absent. |
| N3 | pending | Legacy decision UI exists; approval inbox/detail/register E2E absent. |
| N4 | pending | Basic upload exists; signed retrieval, versions/checksums, extraction pipeline/review/retention and records E2E absent. |
| N5 | pending | Read-mostly project primitives exist; full control model/read models/extraction/decision queue absent. |
| N6 | pending | Budget presentation primitives exist; import/reconciliation/locks/reversal/comparison absent. |
| N7 | pending | Deterministic scenario engine and independent calculator absent. |
| N8 | pending | Existing Eve tools/evals target the alpha/legacy model; deterministic budget-agent track absent. |
| N9 | pending | Separate development-agent deployment/router/channel/gates absent. |
| N10 | in-progress | Existing responsive UI is useful dated evidence; continuous accessibility automation absent. |
| N11 | in-progress | Historical release evidence/runbooks exist; current CI, restore rehearsal, full observability, and consolidated gates absent. |
| N12a | pending | Synthetic/anonymised full-product technical UAT fixtures absent. |
| N12b | blocked(human-private-data-and-UAT) | Real 33 Malvern import, financial confirmation, and committee UAT require explicit scope/authority. |
| L1 | blocked(human-production-go) | Production migration/deploy/promotion/rollback requires action-time approval after exact-candidate gates. |

## DOD scorecard

Scores are intentionally conservative; static/source evidence cannot lift behavioural criteria to 8.

| DOD | Score | Evidence | Weakest gap |
|---|---:|---|---|
| DOD-01 | 5 | Explicit modes reject Production fixtures; covered runtime failures are behaviourally fail-closed; exact legacy rows reconcile forward with altered/dependent-data preservation; schema-push policy rejects seed inclusion; all 15 runtime mutators are guarded. | Exact Supabase replay and current environment parity remain unresolved. |
| DOD-02 | 3 | RLS policies and member-management restrictions exist. | No six-persona live Data API matrix; `read_only` is not a general write capability; transactions/audit actor unproven. |
| DOD-03 | 2 | Legacy proposals/votes/conditions and workflow UI exist. | Target versioned asynchronous approval lifecycle and E2E absent. |
| DOD-04 | 3 | Upload, Storage, evidence links, and basic extraction status exist. | Signed retrieval, versions/checksums, worker/review/retention and records E2E absent. |
| DOD-05 | 3 | Projects, milestones, variations, invoices, and presentation primitives exist. | Control schema, deterministic financial read models, cited extraction and journey E2E absent. |
| DOD-06 | 2 | Budget/account/invoice primitives exist. | Idempotent imports, mappings, reconciliation, locks/reversals, two-period fixtures and drill-down parity absent. |
| DOD-07 | 1 | Contract intent only. | Engine, persistence, reference calculator, UI/export and benchmarks absent. |
| DOD-08 | 3 | Eve agent, scoped evidence tools, draft tools, and eight behavioural evals exist. | Tools use legacy/alpha data and lack deterministic financial scenario/proactive recommendation contracts. |
| DOD-09 | 1 | Separate-agent plan documents exist only as protected reference artifacts. | Implemented isolated dev agent, adapters, durable router, external-effect gates and evals absent. |
| DOD-10 | 4 | Existing responsive feature UI and bespoke read-only browser QA provide dated evidence. | Required IA/deep links, automated accessibility, chart parity and full-product states absent. |
| DOD-11 | 3 | Historical exact-candidate Preview evidence and some scripts exist. | No repository CI, canonical replay, automated restore proof/current owner, full monitoring/alert contracts. |
| DOD-12 | 1 | Historical synthetic alpha Preview only. | Full synthetic technical UAT, real-data acceptance, committee UAT and Production smoke/GO absent. |

## AUT scorecard

| Criterion | Score | Current basis / blocker |
|---|---:|---|
| AUT-01 | 8 | Repository baseline, protected paths, local tool/environment evidence, migrations, and verifier classification recorded; live deploy/database state remains explicitly UNVERIFIED and no mutation occurred. |
| AUT-02 | 5 | Runtime failures return typed non-2xx responses without synthetic records/IDs. Eight migrations have a current-worktree checksum manifest; exact-match forward reconciliation preserves altered/dependent data. All 15 runtime mutators are inventoried and guarded across database plus browser origins; safe push runs integrity first and rejects seeds. Exact Supabase replay and remote parity remain unproven. |
| AUT-03 | 3 | Static RLS foundation only; persona, cross-committee, audit, transaction, and idempotency runtime proof absent. |
| AUT-04 | 3 | Five bespoke browser scripts now share an exact database/application target guard, but the Q0 harness/config/six-persona fixtures/axe/CI remain absent. |
| AUT-05 | 2 | Legacy ballot-like domain only. |
| AUT-06 | 3 | Basic upload/storage path only. |
| AUT-07 | 3 | Basic project primitives only. |
| AUT-08 | 2 | Basic budget primitives only. |
| AUT-09 | 1 | Scenario engine absent. |
| AUT-10 | 3 | Existing Eve alpha agent only. |
| AUT-11 | 1 | Development agent absent. |
| AUT-12 | 4 | Existing UI quality is partial and dated; automated accessibility absent. |
| AUT-13 | 3 | Historical release evidence exists; current full operations barrier absent. |
| AUT-14 | 1 | Full synthetic technical candidate absent. |
| AUT-15 | 4 | Human-gate categories identified, but safe technical work remains. |

## Environments

- Local: repository contains ignored `.env.local`; variable names/values were not printed. Node 24.14.0 and npm 11.9.0 are installed.
- Local database tooling: Homebrew Postgres 17.10 tools are installed. Supabase CLI 2.111.0 is pinned in package/lock and generated the committed local config. Docker Desktop 29.5.3 was started only for isolated replay work and the partial Supabase stack was stopped afterward; no Supabase containers remain running.
- Preview/staging: prior `GRAPH-STATE.md` reports an immutable Preview for alpha commit `be4c4d0`; this is dated evidence only. Current isolation, credentials, and state are UNVERIFIED because no live check is authorised or required for R0.
- Production: UNVERIFIED and untouched. No deployment, migration, seed, alias, promotion, rollback, or external mutation was performed.
- Fixture rule: `STRATA_DATA_MODE=fixture` is explicit, read-only, and rejected in Production. Missing/invalid live configuration and upstream failure now return typed non-2xx responses; deterministic route tests prove no fixture/mock substitution on the covered paths.

## Migrations

Local canonical inventory now (8 files):

1. `202606250001_initial_strata_governance.sql`
2. `202606260001_ai_output_observability.sql`
3. `202606260002_document_storage_bucket.sql`
4. `202606260003_legislation_chunk_metadata.sql`
5. `202606270001_member_invites.sql`
6. `20260628145525_tighten_attachment_document_visibility.sql`
7. `20260801053901_harden_member_lifecycle_audit.sql`
8. `20260815220003_reconcile_legacy_embedded_fixtures.sql`

Applied/remote parity: UNVERIFIED. Do not infer from `supabase/.branches/` or `.temp/`. Clean replay: UNVERIFIED pending isolated local Postgres/Supabase harness.

The initial migration still contains its published SP 6430/placeholder DML byte-for-byte (`ae484431...`) so applied history is not rewritten. The forward reconciliation migration deletes only exact legacy rows on a fresh/empty chain, preserves altered committee/law metadata and non-placeholder chunks, and aborts if the exact legacy committee has any dependent tenant rows. An ephemeral Postgres test proves these branches. Synthetic seed data now uses UUID/email namespace `strata-synthetic-v2`; the guarded seeder trusts only a server-owned Auth `app_metadata` fixture marker, preserves unrelated metadata, rejects non-fixture users/committee identities, and derives staging credential rules from the canonicalized guard result. Exact Supabase replay and remote parity remain UNVERIFIED.

## Verifier classification

R0 inventoried the original 28 `scripts/verify-*.mjs` files and 8 Eve evals. The current worktree has 35 verifier files; the seven new boundary/migration gates are classified below as well:

- Static/source-contract primary: admin, dashboard, documents UI, drilldown, Eve tools, frontend contract, projects, recovery source, security/RLS source, workflow UI, and the Eve eval meta-check.
- Unit/mocked: search index behaviour; a small in-memory visibility example inside the otherwise-static security script.
- Hybrid static plus optional live: auth, member management, AI layer, AI observability, law sources, and quote/invoice. Several can exit 0 after only static work when credentials are absent or an explicit static flag is set.
- Direct integration/behavioural: fallback build, budget workflow (always live), document workflow, and live dashboard. These are not a complete isolated persona/RLS matrix.
- Browser behaviour: five standalone Chromium scripts for AI, auth, legacy workflow, frontend QA, and recovery. All require a shared pre-mutation Supabase/application-origin guard plus a live deployment-to-database attestation; they still do not use a Playwright config/fixture/project harness.
- Boundary verification: `verify-fail-closed.mjs` is executable unit behaviour plus labelled static wiring; `verify-fail-closed-routes.mjs` executes route negative paths under a stubbed runtime; `verify-upstream-failures.mjs` deterministically stubs Supabase/AI provider outages; `verify-mutation-targets.mjs` is a static meta-gate with executable negative ordering fixtures.
- Migration verification: `verify-migrations.mjs` is static checksum/config/source integrity plus executable pre-network seed-push rejection; `verify-migration-reconciliation.mjs` is local ephemeral-Postgres behaviour; `verify-migrations-replay.mjs` is the destructive-local Supabase replay/ledger gate and remains unproven because its image prerequisite failed before SQL.
- Agent behaviour: eight strict Eve evals use a mock model and loopback in-memory fixtures; they prove bounded alpha-agent routing/policy, not database RLS or Production permissions.
- Missing: completed exact Supabase migration replay, automated accessibility, reusable persona/cleanup fixtures, cross-committee/read-only/direct-Data-API adversarial suite, records/project/finance/scenario E2E, and CI workflow.

## Worktrees/branches

- Main workspace: `/Users/jjlecocq/Documents/Codex/strata.ai`
- Branch: `codex/strata-v1-release-candidate`
- HEAD/upstream at R0: `be4c4d053e7c822a78528e0b9f7351d229ea679d`
- No autonomous worktree, branch, commit, push, PR, or external tracker artifact created.

## Seen failure fingerprints and attempts

| Fingerprint | Attempts | Status / decision |
|---|---:|---|
| `tsc: TS6053 .next/types/validator 2.ts not found` | 1 | Resolved without deleting protected artifacts by regenerating Next types with `npx next typegen`; subsequent `tsc --noEmit` passes. |
| `next/Turbopack globals.css -> creating new process -> binding to a port -> Operation not permitted` | 2 | Blocked in Codex runtime after sandboxed and elevated evidence-equivalent failures. Historical operator build passed; no third retry in this session. |
| `Supabase local replay image refresh -> public.ecr.aws 429 Too Many Requests` | 2 | Exact `db reset --local --no-seed` did not reach migration SQL. First attempt ended during Postgres image refresh; one recovery attempt received registry 429. Partial local containers were stopped; do not retry unchanged in this session. |

## Open P0/P1 defects

- P0 executable risk: read-only access is not a general write capability; no direct-Data-API behavioural matrix.
- P0 executable risk: business mutations and audit inserts are not consistently transactional/idempotent.
- P0 executable risk: audit actor/time/action can be forged through direct insert; member deletion is not covered by the lifecycle audit trigger.
- P0 executable risk: incident evidence, AI-output parent visibility, storage object ownership, actor attribution, and tenant child-link consistency have static RLS integrity gaps pending behavioural proof/fix.
- P1 readiness gap: exact Supabase no-seed replay and remote parity remain unproven; the narrower forward reconciliation logic is behaviourally proven on ephemeral Postgres.
- P1 readiness gap: no reusable isolated Playwright/persona/cleanup/accessibility/CI harness.
- P1 product gap: legacy proposal/vote semantics are not retired or isolated.
- P1 evidence gap: records E2E, automated accessibility, and owned restore rehearsal absent.

## Human gates parked

- Confirm named/role holders of `confirm_financial_figures` (proposed default: admin/chair/treasurer).
- Authorise private mailbox/document sources, date ranges, confidentiality, retention, and access-export policy.
- Provide/approve anonymised accounting/document fixtures if repository-safe synthetic equivalents are insufficient; confirm actual imported financial/project values later.
- Provide live Telegram/WhatsApp, Linear/GitHub, billing, OAuth, or persistent credentials when those adapters reach live acceptance.
- Authorise any external issue/PR/message creation, git push/merge/publication, and live environment mutation.
- Complete committee UAT and give action-time Production migration/deploy/promotion/rollback GO.

These gates are parked; none currently blocks the next safe local technical task.

## Decisions/ADRs

- R0-D1 accepted: review amendments supersede the old node headline and calendar.
- R0-D2 accepted: prior graph/release evidence is dated alpha evidence, not proof that the full product is complete or waiting only on Production.
- R0-D3 accepted: keep fixture/demo data only behind an explicit local/test contract; missing configuration and upstream failure fail closed.
- R0-D4 accepted: do not modify protected duplicate/generated-looking user artifacts merely to make type checking pass; first isolate the compiler/build cause.
- R0-D5 amended: preserve the published initial migration bytes; reconcile embedded rows only through the forward eighth migration. Abort instead of deleting when the legacy committee has dependent data. Remote parity remains UNVERIFIED.
- N1a-D1 accepted in `docs/adr/0001-explicit-runtime-and-fixture-boundary.md`: runtime environment and live/fixture mode are explicit; Vercel environment is authoritative; fixture writes and Production fixture/mock AI are forbidden; upstream failures do not substitute fixtures.

## Latest PLAN / DO / VERIFY / DECIDE

### PLAN

Node: N1a mutator-guard and migration-hardening slice. Outcome: close the remaining fixture/reconciliation safety findings and make every runtime verifier mutation resolve an approved database plus browser target before work begins.

### DO

- Restored the initial migration to its original hash and created `20260815220003_reconcile_legacy_embedded_fixtures.sql` with the pinned CLI.
- Restricted reconciliation to the exact original committee, law-source fields, and placeholder chunk fields; altered metadata/non-placeholder content is preserved and dependent tenant data aborts atomically.
- Moved the fixture Auth marker to server-owned `app_metadata`, preserved unrelated Auth metadata, and derived remote-staging credential enforcement from the canonicalized guard result.
- Added a browser-aware guard requiring an exact staging app origin distinct from Production, then wired database/browser guards into all 15 detected direct runtime mutators.
- Added a fail-closed mutator inventory that changes-fails when a new direct Supabase/Playwright mutator is not classified and guarded.
- Bound the safe schema-push wrapper to the migration integrity gate before linked-project inspection or CLI execution.
- Added current-worktree migration checksums, generated Supabase config, pinned CLI/package lock, exact replay gate, local Docker-context/version/ledger/empty-table checks, and a schema-only push wrapper that rejects seed inclusion and requires environment refs/action-time GO.
- Updated runbooks/contracts and cleared two high-severity transitive tooling advisories (`brace-expansion`, `nanoid`) with the dry-run-confirmed compatible patch versions.

### VERIFY

- `npm run verify:migrations`: exit 0; eight historical/current hashes, exact-match reconciliation/static guards, exact package/lock/install CLI pin, safe-push integrity binding, and behavioral seed-push rejection.
- `npm run verify:migrations:reconciliation`: exit 0 on an ephemeral Postgres 17 cluster; exact empty legacy rows removed, altered committee/law metadata and non-placeholder content preserved, and dependent committee preserved with expected abort.
- `STRATA_ALLOW_LOCAL_DB_RESET=1 npm run verify:migrations:replay`: incomplete before SQL because the required pinned service-image refresh hit registry 429; no pass claimed.
- `npm run verify:fail-closed`, `npm run verify:mutation-targets`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check`: exit 0. Guard behavior covers local/test loopback, canonicalized staging, exact database/browser targets, missing approval, Production ref/origin, and Vercel Production.
- `npm audit`: zero known vulnerabilities after installed/lock tree synchronization.
- `git diff --check` and original-initial-migration byte comparison: exit 0.
- No linked/remote Supabase project, deployment, Production service, or external application data was contacted or mutated. Read-only official docs/npm registry and local Docker image registries were contacted for tooling.

### DECIDE

ITERATING. Fail-closed behavior, fixture reconciliation, and complete mutator preflight coverage are locally evidenced; independent re-audits are running. Exact Supabase replay is externally blocked and remote parity is intentionally unverified, so AUT-02/DOD-01 remain 5/10. Continue to N1b safe local schema/capability hardening without claiming live RLS proof.

## Next task packet

Node: N1b / FND-07 capability and direct-RLS foundation.

Outcome: introduce an explicit capability model for financial confirmation and read-only access, pin write attribution/audit integrity in Postgres, and prepare a deterministic six-persona Data API matrix without contacting a remote project.

Why now: environment and fixture boundaries are guarded; the highest remaining executable risks are role-only writes, forgeable attribution/audit rows, and non-transactional critical mutations. Exact replay cannot progress unchanged while the registry is rate-limited.

Inputs: current migrations/RLS policies, `src/lib/member-authorization.ts`, workflow/finance/document/AI write routes, generated types, and the six-persona matrix from the reviewed plan.

Allowed mutations: forward-only migration(s), server capability helpers, transactional RPC call sites, deterministic local/static verifiers, docs/state.

Forbidden mutations: executing live/hybrid/browser verifiers, linked/remote databases, credentials/env values, protected paths, deployment/commit/push/external artifacts; do not invent the human financial-confirmer policy beyond the documented provisional default.

Verifier: local migration/source gates plus deterministic policy-unit tests for admin, financial confirmer, member, read-only, suspended, outsider, and cross-committee principals; exact/live RLS remains separately labelled until the replay barrier clears.

Acceptance evidence: read-only cannot write critical resources, financial confirmation is explicit, attribution/audit fields cannot be caller-forged, cross-committee links are rejected, critical write/audit operations have a transaction/idempotency contract, and independent re-audit/state are updated without overstating local static evidence.

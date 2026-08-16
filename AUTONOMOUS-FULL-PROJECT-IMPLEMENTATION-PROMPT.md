# Autonomous full-project implementation prompt

This prompt is designed for an engineering agent that can operate across multiple sessions and maintain repository state. It runs without routine human input and continues every safe, independent task until only explicit human-authority gates remain.

## Verdict

Use an unattended implementation loop for the technical build. It is appropriate because the product has bounded nodes, repository-visible state and objective gates.

“Without human involvement” cannot safely include granting credentials, importing private committee data, confirming official financial figures, accepting UAT, creating unapproved external artifacts, or promoting Production. The agent must complete everything else autonomously and return `WAITING-HUMAN` only when no independent work remains.

## Fit Test

- The work is repeatable across PLAN/DO/VERIFY/DECIDE cycles.
- Most outcomes are objectively checkable with migrations, integration tests, browser journeys and evals.
- The build can use local/staging synthetic data until private data is authorised.
- Reversible engineering decisions can be documented through ADRs without interrupting execution.
- Financial truth, committee consent and production release remain judgment/authority gates and cannot be delegated safely.

## Trigger

Start manually by pasting the prompt below into a dedicated engineering agent rooted at:

`/Users/jjlecocq/Documents/Codex/strata.ai`

Resume automatically from `AUTONOMOUS-IMPLEMENTATION-STATE.md` in every later session.

## State and Dedupe

The implementation agent must maintain:

- Current git branch/HEAD and protected pre-existing dirty paths.
- Node status and evidence.
- DOD scorecard.
- Seen failure fingerprints and attempts.
- Applied/pending migration identifiers.
- Test/fixture identities and cleanup status.
- Open worktrees/branches.
- Accepted/rejected/superseded engineering decisions.
- Human gates and exact action packets.

Deduplicate failures, jobs, fixtures, imports, notifications, recommendations and product requests against every seen state, including rejected and superseded records.

## Maker and Gates

- Use a bounded maker for each node.
- Use an independent checker/subagent where supported for RLS/security, financial arithmetic, approval concurrency, accessibility and agent permissions.
- If no independent checker is available, require behavioural tests against isolated infrastructure and mark judgment-only claims below 8 until external review.
- Do not count source/string inspection as behavioural proof.
- Every node must have an input contract, output contract, tests and evidence before completion.

## Router

- Unblocked technical node: implement and verify.
- Reversible ambiguity: choose the safest/simple option, record an ADR and continue.
- Missing private data: use representative synthetic fixtures and continue; park real-data acceptance.
- Missing credential/external permission: build and test the adapter behind a fake/local contract; park the live connection.
- High-risk migration/production action: produce the exact reviewed procedure and park execution.
- Repeated gate failure: block that node after two evidence-equivalent failures and continue independent nodes.
- Only human gates remain: produce `WAITING-HUMAN` with one consolidated action packet.

## Hard Stops

- Exposing or committing secrets.
- Placing server credentials in client/public variables.
- Production database mutation, deployment, promotion, domain/alias change or rollback without action-time approval.
- Destructive or irreversible live data actions.
- Reading/importing private committee data beyond explicit scope.
- Confirming a figure, approval or decision on behalf of a person.
- Sending committee communications.
- Creating external Linear/GitHub/chat artifacts without the specific action being authorised.
- Merging, pushing or publishing without authority.
- Weakening tests, RLS, validation, audit or acceptance criteria.
- Overwriting/deleting pre-existing user-owned worktree changes.
- LLM-owned financial arithmetic.
- Budget/development agent access to prohibited systems.

## Human Gates

Only these may stop final completion:

- Secrets, billing, OAuth or persistent credential/permission grants.
- Approval of a new dependency when required by the execution environment/policy.
- Private mailbox/document scope and retention policy.
- Named holders of `confirm_financial_figures`.
- Confirmation of actual imported financial/project values.
- External issue/PR/message creation when not already specifically authorised.
- Git push/merge/release publication.
- Production migration/deploy/promotion/rollback.
- Committee UAT and final production GO.

The agent must not request these early. It should park the affected node, complete all other work, then present one consolidated request.

## Metric

Track:

- DOD-01 through DOD-12 scores.
- Behavioural versus source-inspection gate count.
- Open P0/P1 defects.
- Passing RLS persona/cross-committee matrix.
- Passing browser journeys.
- Migration replay parity.
- Financial reconciliation and scenario benchmark variance.
- Agent prohibited-effect evals.
- Accessibility failures.
- Failed/retried nodes.
- Human gates remaining.
- Exact release revision and rollback readiness.

## Paste-ready prompt

```text
* SELF-CHECKING LOOP

You are the autonomous lead engineer and delivery manager for strata.ai in:

/Users/jjlecocq/Documents/Codex/strata.ai

You will work across sessions until the complete product is implemented and objectively verified, or until every safe technical task is complete and only explicit human-authority gates remain.

TASK

Implement the full strata.ai product for SP 6430 / 33 Malvern Avenue according to:

- ENGINEERING-IMPLEMENTATION-PLAN.md
- ENGINEERING-PLAN-REVIEW.md

Treat the review's P1 findings and required corrections as approved execution amendments to the plan. Do not repeat the review; incorporate it and build.

Deliver:

1. Secure, fail-closed committee identity and capabilities.
2. Day-to-day issues, discussion and evidence.
3. Email-style asynchronous committee approvals, not a statutory ballot.
4. Versioned documents, extraction/OCR, review and provenance.
5. Major-project timelines, milestones, risks, variations, budgets and spend.
6. Reconciled financial imports, period comparison and drill-down.
7. A deterministic levy/project/reserve scenario engine.
8. A cited, bounded and proactive budget agent.
9. A separate, human-gated Telegram/WhatsApp-to-Linear/GitHub development agent.
10. An accessible committee-ready UI, CI, observability, backup/restore, UAT evidence and release procedure.

AUTHORITY AND CONTEXT ORDER

1. Follow system/tool safety policies and AGENTS.md.
2. Read ENGINEERING-IMPLEMENTATION-PLAN.md completely.
3. Read ENGINEERING-PLAN-REVIEW.md completely.
4. Read AUTONOMOUS-IMPLEMENTATION-STATE.md if it exists; resume from it rather than chat memory.
5. Inspect current code, migrations, tests, package scripts, git state and safe environment evidence.
6. Read relevant installed documentation under node_modules/next/dist/docs/ before changing Next.js code.
7. Read node_modules/eve/docs/README.md and relevant installed Eve docs before changing Eve.
8. Use FRONTEND-CONTRACT.md and IMPLEMENTATION_PLAN_ADDENDUM.md as supporting contracts.
9. Treat GRAPH-PLAN.md, GRAPH-STATE.md, HANDOFF.md, GO-NO-GO.md and RELEASE-REVISION.md as dated evidence only.

Do not trust a prose claim when current code, schema, behavioural tests or read-only environment evidence contradicts it.

MANDATORY REVIEW CORRECTIONS

Incorporate these before claiming the execution system is ready:

1. Re-baseline from the ticket backlog, not the old node headline:
   - Use 166–251 engineer-days before omitted QA/integration/review/contingency.
   - Use a 20–30 week full-product planning range and 9–12 week pilot range.
   - Do not optimise work or verification to fit those estimates.

2. Split the universal platform prefix:
   - N1a: environments, fail-closed configuration, fixture isolation and migration parity.
   - N1b: capabilities, RLS, audit integrity and transactional/idempotent workflows.

3. Add a first-class QA/E2E track early:
   - Playwright configuration.
   - Isolated target-environment guard.
   - Authenticated persona fixtures and cleanup.
   - Cross-committee/read-only/direct-Data-API adversarial journeys.
   - Approval, records, project, finance, scenario and production-smoke journeys.
   - Automated accessibility gate.

4. Label existing verification accurately:
   - Source/string-presence scripts are static contract checks only.
   - They cannot prove runtime RLS, capability, transaction or user-journey behaviour.
   - DOD-01 and DOD-02 require real behavioural tests against isolated Postgres/Supabase.

5. Close missing coverage:
   - Add a records E2E ticket and verifier.
   - Add automated accessibility assertions in CI.
   - Give restore rehearsal an owner, explicit RPO/RTO target and pass/fail evidence.
   - Add an explicit migration/retirement task from legacy proposal/vote semantics to approvals.
   - Ensure existing workflow/finance routes are included in transactional/audit retrofits.

AUTONOMOUS OPERATING POLICY

- Do not ask routine questions.
- Make safe, reversible assumptions and record them in an ADR under docs/adr/ or the state file.
- Prefer the simplest design satisfying the plan and negative tests.
- Use local/staging synthetic fixtures whenever real/private data is unavailable.
- Park only the affected node when a human gate appears; continue every independent node.
- Do not repeatedly request the same approval.
- Create a consolidated human action packet only when all other independent work is exhausted.
- Preserve existing working behaviour and all pre-existing user-owned changes.
- Do not clean, reset, delete, stage or reformat unrelated dirty paths.
- Local implementation and test changes are authorised by this task.
- Local branches/commits are allowed only when they preserve unrelated work; never push, merge or publish without authority.
- Do not deploy or mutate external environments unless that exact action is already authorised.

PERSISTENT STATE

Create and maintain:

/Users/jjlecocq/Documents/Codex/strata.ai/AUTONOMOUS-IMPLEMENTATION-STATE.md

State format:

# Autonomous implementation state
last_updated:
branch_head:
current_node:
overall_status:

## Protected pre-existing paths
## Accepted execution amendments
## Node ledger
<node> | pending / in-progress / blocked(reason) / verified / done | evidence
## DOD scorecard
<DOD-01..DOD-12> | 1-10 | evidence | weakest gap
## Environments
## Migrations
## Worktrees/branches
## Seen failure fingerprints and attempts
## Open P0/P1 defects
## Human gates parked
## Decisions/ADRs
## Latest PLAN / DO / VERIFY / DECIDE
## Next task packet

Update this state after every meaningful gate and before ending any session.

EXECUTION GRAPH

Use this corrected topology:

R0 — establish current baseline, protect worktree and record review amendments.

N1a — environment separation, configuration validation, fail-closed behaviour, fixture isolation and canonical migration replay.

N1b — capability model, route/RPC enforcement, behavioural RLS, audit integrity, transactional/idempotent workflow retrofit and security baseline.

Q0 — Playwright/behavioural-test harness, persona fixtures, isolated environment guards, accessibility base and CI wiring. Start contract/fixture work after R0; wire behavioural data gates after N1a/N1b.

N2 — approval contracts, schema, RLS and transactional operations, including retirement/migration of legacy proposal/vote semantics.

N3 — mobile/desktop approval inbox/detail, notifications, deep links, decision register and approval E2E.

N4 — signed records retrieval, versions/checksums, extraction worker, review queue, retention, orphan reconciliation and records E2E.

N5 — project-control contracts, schema, deterministic read models, extraction, dashboard/timeline, variation/invoice queue and E2E.

N6 — financial contracts, imports/mapping, reconciliation/period lock/reversal, read models, dashboard, accessible chart/table parity and E2E.

N7 — deterministic scenario engine, persistence, independent reference calculator, UI/export and E2E.

N8 — budget-agent policy/tools/drafts/proactive recommendations/evals and run observability.

N9 — separate development-agent permissions, Telegram pilot, durable router, Linear/GitHub approval gates, isolated maker/checker, WhatsApp adapter and evals.

N10 — continuous UX/accessibility gate across every release, not a final phase.

N11 — continuous CI/observability/backup/restore/release gate across every release, including Q0 ownership.

N12a — complete synthetic/anonymised staging onboarding and technical UAT.

N12b — real 33 Malvern import/reconciliation and committee UAT; human/private-data gate.

L1 — exact production candidate, migration/backup/rollback packet and action-time Production GO; human gate.

Dependencies:

- R0 -> N1a and Q0 contract work.
- N1a -> N1b.
- N1b -> N2 and N4 production contracts.
- N2 -> N3.
- N4 -> N5.
- N1b -> N6; N4 evidence contract joins N6 later.
- N5 + N6 -> N7.
- N7 -> N8.
- N1b + Q0 CI/sandbox boundary -> N9.
- N10 and N11 gate every release fan-in.
- N3 + essential N4 + Q0 -> committee-operations candidate.
- N5 + N6 + N7 + Q0 -> project/financial candidate.
- N8 + N9 + N12a -> complete autonomous technical candidate.
- N12b + L1 require human authority.

PARALLELISM

- After R0, start N1a and Q0 contract/fixture scaffolding in parallel if isolated writers are available.
- After N1b, N2, N4, N6-contract work and N9-contract work can fan out.
- Build frontend against frozen JSON/API contracts while backend implementation proceeds in an isolated worktree; converge only at wiring/E2E.
- N5 and N6 are parallel tracks after their dependencies.
- N7 waits for confirmed N5/N6 read contracts.
- N8 waits for N7 deterministic tools.
- Use one writer per file and independent worktrees for colliding changes.
- If parallel workers/subagents are unavailable, interleave tracks without inventing false dependencies.

SUCCESS CRITERIA (be strict, no soft passes)

AUT-01 Baseline and execution control:
- Current git/deployment/database state is recorded from direct evidence.
- Pre-existing dirty/untracked paths are protected.
- Review amendments are reflected in state/backlog.
- No production mutation occurs.

AUT-02 Environment and migration foundation:
- Local/staging/production boundaries are documented and enforced.
- Missing configuration and upstream failure never return demo data or mock success.
- Canonical migrations replay on a clean isolated database.
- Repository/remote migration parity is proven where authorised, otherwise exact human gate is recorded.
- Fixtures cannot appear in Production.

AUT-03 Capabilities, RLS, audit and transactions:
- Admin, financial confirmer, member, read-only, suspended and outsider pass route and direct-database positive/negative tests.
- Cross-committee reads/writes fail.
- Audit actor/time/committee are server-derived and ordinary users cannot change/delete audit entries.
- Critical business write and audit commit/rollback together.
- Retried writes are idempotent.

AUT-04 Behavioural/E2E harness:
- Playwright configuration and local/Preview target guard exist.
- Persona fixtures and cleanup are deterministic.
- Browser journeys execute behaviour, not source-string assertions.
- Automated accessibility checks run in CI.
- Source-inspection and behavioural gates are labelled separately.

AUT-05 Committee approvals:
- Approval participant/rule snapshot, evidence version/hash, request-information, response change, reminder, expiry, withdrawal, supersession and finalisation are implemented.
- Material evidence/question/amount changes cannot reuse old approvals silently.
- Legacy proposal/vote product semantics are removed/migrated or isolated behind a proven compatibility boundary.
- Mobile/desktop approval and decision-register E2E passes.

AUT-06 Records:
- RLS-protected upload, signed download/preview, version/checksum, dedupe and source metadata work.
- Representative text PDF, scanned PDF, DOCX and XLSX fixtures produce reviewable extracted drafts with locators.
- Human confirmation transition is server-derived/audited; drafts do not appear as official.
- Failure/retry/orphan reconciliation and records E2E pass.
- Retention/legal-hold/access-export contracts are implemented with synthetic policy fixtures; real policy remains a human gate if unresolved.

AUT-07 Projects:
- Project/workstream, milestones/dependencies, updates, risks/actions, contracts/vendors, budget lines, append-only cost events, variations/invoices/payments and evidence links work.
- Baseline, committed, invoiced, paid, forecast and contingency derive deterministically.
- Minutes/payment-sheet/quote extraction produces cited drafts.
- Dashboard/timeline/financial/risk/evidence views and E2E pass.

AUT-08 Financial intelligence:
- At least two representative synthetic/anonymised periods import idempotently.
- Mapping exceptions remain visible and block false reconciliation.
- Opening/closing balances and transaction movements reconcile.
- Period locks, controlled correction/reversal and project/evidence linking pass.
- Dashboard aggregates equal drill-down rows and accessible chart tables.
- Real accounting figures remain a human/private-data acceptance gate if unavailable.

AUT-09 Scenarios:
- Versioned deterministic engine models balances, threshold breach, closing balance and levy range.
- Same engine version/input produces canonical same projection.
- Independent reference calculator matches benchmark cases.
- Invalid assumptions fail clearly.
- LLM does no financial arithmetic.
- Scenario UI/compare/export E2E passes.

AUT-10 Budget agent:
- Server-derived committee/user scope.
- Confirmed-by-default reads with explicit draft/conflict/stale labels.
- Numeric responses equal deterministic tools and cite permitted sources.
- Only draft scenarios/recommendations/approvals may be created.
- Proactive scheduler uses thresholds, cooldown and dedupe across accepted/dismissed/snoozed states.
- Hidden/stale/draft/arithmetic/citation/cross-session/prohibited-write evals pass.

AUT-11 Development agent:
- Separate deployment/state/credentials and no building-data or Production access.
- Telegram webhook/identity/dedupe/router work using safe local/fake adapters until credentials are authorised.
- Linear/GitHub side effects are approval-gated and may remain contract-tested fakes until authorised.
- Coding work uses isolated maker/checker and can produce only a draft PR.
- Unmapped, duplicate, rejected, high-risk, failed-gate, merge/deploy and permission-expansion evals pass.
- WhatsApp adapter shares normalized state/handlers; live setup may remain a human credential gate.

AUT-12 UX and accessibility:
- Required top-level navigation and deep links exist.
- Mobile/desktop responsive journeys pass at agreed widths.
- Loading/error/empty/read-only states are explicit.
- Keyboard/focus/labels/headings/reduced-motion/contrast/chart-table checks pass.
- No misleading ballot, audience, confidentiality or persistence language remains.

AUT-13 Operations:
- CI gates lock install, lint, type, build, migration replay, behavioural RLS, unit/integration/E2E, accessibility, dependency audit and agent evals.
- Health, structured errors/request IDs, worker/webhook/agent observability and alert contracts exist.
- Backup/restore procedure and automated verification hooks exist.
- Use provisional documented RPO/RTO targets for synthetic rehearsal if no owner target exists; mark final acceptance human-gated.
- Release/rollback/smoke runbooks are complete and dry-run where safe.

AUT-14 Technical UAT candidate:
- Synthetic/anonymised committee, project, document and financial fixtures exercise all six core journeys.
- No fixture/demo path can enter Production.
- Immutable candidate revision passes the consolidated local/staging barrier where authorised.
- No unresolved P0/P1 technical defect remains.

AUT-15 Human-gate packet:
- Every unresolved human-only requirement is consolidated once with exact action, scope, risk and downstream criterion.
- Real-data reconciliation, named financial confirmer, live channel credentials, external artifact creation, committee UAT and Production GO are never falsely marked proven.
- No safe independent technical work remains before printing WAITING-HUMAN.

LOOP PROTOCOL — repeat every turn

1. PLAN
   - Read the state file.
   - Select the weakest unproven, unblocked criterion on the critical path.
   - Confirm dependencies and file ownership.
   - Write one bounded task packet:
     Node; outcome; why now; inputs; allowed mutations; forbidden mutations; verifier; acceptance evidence.

2. DO
   - Implement only the bounded task.
   - Read matching installed framework docs before changing Next.js/Eve.
   - Add/strengthen behavioural tests for risky invariants.
   - Make reversible assumptions and record ADRs.
   - Use synthetic/local data when human/private inputs are missing.
   - Continue without asking unless the action itself is a human gate.

3. VERIFY
   - Run the narrow test during iteration and the full node barrier before completion.
   - Record command, revision/environment, exit code and artifact.
   - Distinguish source inspection from behavioural evidence.
   - Score AUT-01 through AUT-15 from 1–10.
   - List exact weak, failing, blocked and unproven items.
   - Never score 8+ from intention, code shape, mocks alone or a source grep when runtime proof is required.

4. DECIDE
   - If every AUT criterion is 8+ and every real human gate has been resolved with evidence: print FINAL, summarize product/evidence and stop.
   - If technical work remains: print ITERATING, update state and attack the weakest unblocked criterion next.
   - If a node hits a human gate: park it and continue other nodes.
   - If all safe independent work is complete and only human gates remain: print WAITING-HUMAN once, with the consolidated action packet and the exact scores it blocks.

SCORING

- 10: directly proven; no meaningful residual risk.
- 8–9: proven enough for the criterion; minor caveat only.
- 6–7: material coverage or confidence missing.
- 4–5: partial/fragile implementation.
- 1–3: absent, failing, blocked or asserted only.

RULES

- Do not ask questions for ordinary implementation decisions.
- Do not stop an entire graph because one branch is human-blocked.
- Fix the weakest unblocked criterion first.
- Preserve unrelated user work.
- Never reset/clean/delete broadly.
- Never print or commit secrets.
- Never weaken security, tests or validation.
- Never convert a static/source test into a claim of runtime proof.
- Never let an extracted/AI value become official without authorised confirmation.
- Never let an LLM own financial arithmetic.
- Never let an agent approve, merge, deploy, expand permissions or mutate Production autonomously.
- After two evidence-equivalent failures at the same gate, block the node, record the failure fingerprint and work elsewhere.
- Do not create an unrelated loop after FINAL or WAITING-HUMAN.

STARTING TASK

Begin at R0:

- Read AGENTS.md, the engineering plan and its review completely.
- Inspect current git status/branch/HEAD and protect pre-existing changes.
- Read package scripts, migration inventory and relevant current implementation.
- Create AUTONOMOUS-IMPLEMENTATION-STATE.md.
- Re-run safe local baseline gates.
- Classify each existing verifier as source-inspection or behavioural.
- Record the corrected node graph, P1 amendments, current DOD/AUT scores and first unblocked implementation task.
- Do not deploy, migrate a live database, seed Production or contact external services.

Begin. Continue until FINAL or WAITING-HUMAN.
```

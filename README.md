# strata.ai

First production-minded iteration of a NSW strata committee governance app for one personal building, while keeping the data model multi-tenant-ready.

## What Is Included

- Next.js App Router, TypeScript, Tailwind CSS, lucide-react.
- Invite-only Supabase session shell, plus an explicit non-Production synthetic fixture mode.
- Dashboard, cards, document vault, project control, budget center, incidents, members, and audit activity.
- Card detail workflow with discussion, proposal, votes, approval conditions, quote risk, AI panel, and audit events.
- Document vault with document categories, extracted text path, Markdown path, indexed status, linked records, and citation-shaped Q&A affordances.
- Project control with planned scope, milestones, progress reports, variations, invoices, budget allowance, committed spend, invoiced spend, and AI plan-vs-current summary UI.
- Budget center with accounts, budget lines, allowances, expenses, project spend progress, variance, and non-binding recommendations.
- Incident view for security, compliance, defects, evidence, follow-up tasks, and resident notice drafts.
- Supabase schema migrations with RLS policies, pgvector-ready legislation chunks, and visibility helpers; synthetic seed data is separate.
- Typed Supabase server/browser clients plus RLS-backed dashboard/card/document/project/activity reads when an authenticated member session exists.
- Writable card workflow endpoints for creating cards, posting messages, creating proposals, casting votes, adding approval conditions, and appending audit events.
- Vercel AI SDK v6 route stubs for summaries, document Q&A, card chat, NSW law lookup, budget insights, project status, quote risk, and incident notices.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For deliberate read-only synthetic development, set `STRATA_ENVIRONMENT=local` and `STRATA_DATA_MODE=fixture`. Missing live configuration fails closed; fixture mode is rejected in Production and all fixture-mode writes return `FIXTURE_WRITE_DISABLED`.

## Environment

Copy `.env.example` to `.env.local` and fill in values when ready:

```bash
cp .env.example .env.local
```

Supabase:

- `STRATA_ENVIRONMENT` (`local`, `test`, `staging`, or `production`)
- `STRATA_DATA_MODE` (`live` by default; exact `fixture` opt-in outside Production only)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains a temporary fallback)
- `SUPABASE_SECRET_KEY` for local seeding and live RLS verification only (legacy `SUPABASE_SERVICE_ROLE_KEY` remains a temporary fallback). Never expose either server key in browser code.
- `STRATA_EVE_APPROVER_USER_ID` is the Supabase Auth user UUID of the repository operator/owner. Eve draft writes fail closed when it is absent or does not match the authenticated active member.
- `STRATA_ADMIN_EMAIL` / `STRATA_ADMIN_PASSWORD`
- `STRATA_MEMBER_EMAIL` / `STRATA_MEMBER_PASSWORD`

Vercel AI Gateway:

- Prefer `vercel link`
- Enable AI Gateway in the Vercel project
- Run `vercel env pull .env.local`

`STRATA_AI_RELEASE_MODE=fallback` explicitly enables the bounded mock AI adapter. When live AI is selected, missing Gateway credentials or provider failure returns a non-2xx error and never substitutes a mock answer.

When live Supabase configuration is missing or unavailable, reads and writes return typed non-2xx failures. Synthetic data is served only through explicit fixture mode, and writable APIs never fabricate success or identifiers. When live configuration and an active authenticated member session are present, reads and writes use the publishable key and rely on RLS.

The Eve agent exposes four scoped read tools and two draft-only write tools. Every draft write requires the configured operator's approval on every call, revalidates the active member after approval, persists only `status: "draft"`, and records audit evidence. Eve has no publish, send, activate, update, or delete tool.

## Supabase

The repository canonical migration set is every ordered SQL file under:

```text
supabase/migrations/*.sql
```

Do not apply only the initial migration and do not apply this set to a live target yet. The published alpha migration is preserved byte-for-byte; a forward migration removes its legacy empty-workspace/placeholder rows and aborts if the building row has acquired dependent data. A checksum manifest verifies current-worktree self-consistency. Exact local replay and remote/local parity remain gates; live migration execution requires the reviewed environment-specific procedure and action-time approval.

Run the static integrity gate at any time. The replay command is intentionally destructive only to the isolated local Supabase database, skips the synthetic seed, and requires an explicit opt-in plus a running Docker-compatible runtime:

```bash
npm run verify:migrations
npm run verify:migrations:reconciliation
STRATA_ALLOW_LOCAL_DB_RESET=1 npm run verify:migrations:replay
```

The reconciliation gate uses an ephemeral loopback Postgres cluster to prove that only the exact empty legacy fixture is removed, altered committee/law metadata is preserved, and a committee with dependent rows aborts without partial deletion. It is narrower than the exact Supabase replay gate.

It creates:

- Core tenancy and membership tables.
- Cards, custom visibility, messages, proposals, votes, approval conditions, and audit log.
- Document vault, attachments, extracted text / Markdown paths, legislation sources, legislation chunks, and AI outputs.
- Budget accounts, periods, lines, allowances, expenses, invoices, vendors, projects, milestones, variations, and quote reviews.
- Incidents and incident evidence.
- Future email-to-card source metadata.
- RLS policies that scope reads by committee membership and record visibility.

Important security note: AI routes must only receive context after server-side visibility filtering. Current RLS provides a tenancy/visibility baseline, but the N1b incident-evidence, linked-parent, capability, audit, and transaction gates remain unresolved; `verify:security` is static evidence only.

Synthetic fixture path (local/isolated staging only; never Production):

1. Wait for the canonical migration replay gate to pass on an isolated target.
2. Put that isolated target's URL, publishable key, and secret key in `.env.local`.
3. After the target guard accepts the environment, run:

```bash
npm run supabase:seed-live
```

Remote staging seeding additionally requires explicit `.invalid` fixture emails and non-default passwords. Existing Auth users without the server-owned `app_metadata.fixture_namespace` marker and non-fixture committee identities are rejected rather than overwritten; user-editable Auth metadata cannot authorize a password reset.

All remote schema pushes must use `npm run supabase:push:dry-run` and, after action-time approval, `npm run supabase:push:schema`. Before any linked action, the wrapper runs the checksum/integrity gate; it then validates the linked staging/Production ref, exact CLI version, distinct environments, and mechanically rejects seed inclusion. Direct Production CLI pushes are outside the supported release procedure.

The guarded seed script creates/updates one admin and one ordinary member, ties both users to the `members` table, seeds visible and hidden synthetic committee records, then signs in with the publishable key to prove:

- Admin can see admin-only records.
- Ordinary member can see visible records.
- Ordinary member cannot see admin-only/custom cards or admin-only documents.
- Ordinary member can create a card, message, proposal, vote, approval condition, and audit event through RLS.

Writable workflow endpoints:

- `POST /api/workflow/create-card`
- `POST /api/workflow/add-message`
- `POST /api/workflow/create-proposal`
- `POST /api/workflow/cast-vote`
- `POST /api/workflow/add-approval-condition`

## AI Routes

POST to `/api/ai/[task]`:

- `card-summary`
- `document-summary`
- `document-qa`
- `card-chat`
- `law-lookup`
- `budget-insights`
- `project-summary`
- `quote-risk`
- `incident-summary`

Structured outputs use AI SDK v6 `generateText` with `Output.object(...)` where appropriate. Chat/Q&A tasks use `streamText` when live credentials are present.

All legal, budget, engineering, compliance, and fire-safety outputs must remain non-binding and cite available source evidence.

## Verification

```bash
npm run verify:production-ready
npm run lint
npm run verify:security
npm run build
```

`npm run verify:security` is a static source-contract check over migration text and an in-memory visibility example. It does not prove live RLS, capabilities, audit integrity, or direct Data API denial.

`npm run verify:fail-closed` executes the runtime configuration/error boundary, invokes the affected route handlers for negative-path behaviour, simulates Supabase-read and AI-provider outages, and separately labels source-wiring assertions as static evidence. It also inventories all 15 direct database/service/browser mutators and requires the appropriate pre-mutation target guard.

`npm run verify:production-ready` is a mutating readiness check for an isolated local/test or explicitly approved staging target. It checks configuration, server-key absence from browser/app code, Storage access, member login, and RLS-backed reads, then removes its smoke object. The target guard rejects Production and unapproved remote projects.

To run browser verification against a Vercel Preview or another deployed staging URL, set `STRATA_ENVIRONMENT=staging`, both distinct Supabase project refs, `STRATA_ALLOW_REMOTE_TEST_MUTATIONS=1`, and exact distinct HTTPS `STRATA_STAGING_BROWSER_ORIGIN` / `STRATA_PRODUCTION_BROWSER_ORIGIN` values. The configured Supabase project and browser origin must both match staging. Before any service-client cleanup or browser launch, the verifier reads `/api/runtime-attestation` from that exact origin and requires the deployment to report the same live environment and Supabase project ref. Then build/deploy that target separately and run:

```bash
STRATA_BROWSER_URL=https://your-preview-url.example npm run verify:auth-browser
STRATA_BROWSER_URL=https://your-preview-url.example npm run verify:recovery-browser
STRATA_BROWSER_URL=https://your-preview-url.example npm run verify:ai-browser
```

`verify:recovery-browser` uses the server-side admin API to generate a one-time recovery link for a disposable active member, so it neither sends nor reads mailbox messages. Supabase Auth must allow the Preview's fixed `/recover` callback URL. The verifier changes only the disposable user's password and independently removes its member and Auth records afterward.

For UI QA, run the dev server and check desktop and mobile layouts:

```bash
npm run dev
```

## Production Readiness Checklist

Before production promotion:

- Vercel env vars: set `STRATA_ENVIRONMENT=production`, `STRATA_DATA_MODE=live`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `STRATA_AI_RELEASE_MODE=live`. Production AI also requires Vercel-managed OIDC or a server-side `AI_GATEWAY_API_KEY`; missing credentials fail closed and Production mock/fallback mode is rejected.
- Server-only secrets: keep `SUPABASE_SECRET_KEY` in secure server/operator tooling only when an admin workflow requires it. Never expose it through a `NEXT_PUBLIC_*` variable or client code; invalid or publishable-shaped keys are rejected.
- Supabase setup: after an explicit GO, apply every reviewed migration in order and confirm the private `strata-documents` bucket and migration ledger. Never run `npm run supabase:seed-live` or `npm run seed:law` against Production.
- Access proof: run mutating integration and browser checks against the isolated staging project first. Set both staging/Production project refs and the explicit staging mutation opt-in; the target guard must identify staging and reject Production. Production promotion uses the resulting staging evidence plus non-mutating sentinel checks.
- Rollback/export: use `npm run export:ai-audit` for AI audit metadata and keep Supabase point-in-time recovery/export procedures ready before destructive changes.
- Preview proof: run the guarded auth, recovery, and AI browser suites against the approved Preview before promotion. Do not point mutating browser checks at the Production hostname.

## First Production Gaps

- Connect real Supabase Auth invite flow.
- Add asynchronous PDF/DOCX extraction beyond deterministic ingestion placeholders.
- Add richer production invite and member-management workflows.
- Add Gmail email-to-card import after the core workflow is stable.

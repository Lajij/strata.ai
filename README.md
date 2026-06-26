# strata.ai

First production-minded iteration of a NSW strata committee governance app for one personal building, while keeping the data model multi-tenant-ready.

## What Is Included

- Next.js App Router, TypeScript, Tailwind CSS, lucide-react.
- Invite-only mocked session shell when Supabase env vars are absent.
- Dashboard, cards, document vault, project control, budget center, incidents, members, and audit activity.
- Card detail workflow with discussion, proposal, votes, approval conditions, quote risk, AI panel, and audit events.
- Document vault with document categories, extracted text path, Markdown path, indexed status, linked records, and citation-shaped Q&A affordances.
- Project control with planned scope, milestones, progress reports, variations, invoices, budget allowance, committed spend, invoiced spend, and AI plan-vs-current summary UI.
- Budget center with accounts, budget lines, allowances, expenses, project spend progress, variance, and non-binding recommendations.
- Incident view for security, compliance, defects, evidence, follow-up tasks, and resident notice drafts.
- Supabase migration with schema, seed data, RLS policies, pgvector-ready legislation chunks, and visibility helpers.
- Typed Supabase server/browser clients plus RLS-backed dashboard/card/document/project/activity reads when an authenticated member session exists.
- Writable card workflow endpoints for creating cards, posting messages, creating proposals, casting votes, adding approval conditions, and appending audit events.
- Vercel AI SDK v6 route stubs for summaries, document Q&A, card chat, NSW law lookup, budget insights, project status, quote risk, and incident notices.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app works without Supabase or AI credentials by using seeded local data and mock AI responses.

## Environment

Copy `.env.example` to `.env.local` and fill in values when ready:

```bash
cp .env.example .env.local
```

Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for local seeding and live RLS verification only. Never expose it in browser code.
- `STRATA_ADMIN_EMAIL` / `STRATA_ADMIN_PASSWORD`
- `STRATA_MEMBER_EMAIL` / `STRATA_MEMBER_PASSWORD`

Vercel AI Gateway:

- Prefer `vercel link`
- Enable AI Gateway in the Vercel project
- Run `vercel env pull .env.local`

When Gateway credentials are absent, `/api/ai/[task]` returns safe mock responses instead of failing local development.

When Supabase env vars are absent, the app uses seeded fallback data and the writable workflow API returns mock success responses. When Supabase env vars and an active authenticated member session are present, reads and writes use the anon key and rely on RLS.

## Supabase

The initial migration is:

```text
supabase/migrations/202606250001_initial_strata_governance.sql
```

It creates:

- Core tenancy and membership tables.
- Cards, custom visibility, messages, proposals, votes, approval conditions, and audit log.
- Document vault, attachments, extracted text / Markdown paths, legislation sources, legislation chunks, and AI outputs.
- Budget accounts, periods, lines, allowances, expenses, invoices, vendors, projects, milestones, variations, and quote reviews.
- Incidents and incident evidence.
- Future email-to-card source metadata.
- RLS policies that scope reads by committee membership and record visibility.

Important security note: AI routes must only receive context after server-side visibility filtering. The migration supports that by enforcing card/document/project/incident access in RLS and by storing AI outputs per committee and linked record.

Live setup path:

1. Apply `supabase/migrations/202606250001_initial_strata_governance.sql` to the confirmed Supabase development project or branch.
2. Put the project URL, anon key, and service role key in `.env.local`.
3. Run:

```bash
npm run supabase:seed-live
```

The seed script creates/updates one admin and one ordinary member, ties both users to the `members` table, seeds visible and hidden building records, then signs in with the anon key to prove:

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

`npm run verify:security` checks the migration for RLS on key workflow tables, verifies hidden card/message/document/audit policy guards, and validates the fallback AI-context visibility model.

`npm run verify:production-ready` checks local production readiness without deploying: Supabase project URL, anon/service env presence, service-role absence from browser/app code, AI fallback/live mode support, Storage bucket access, seeded member login, and RLS-backed reads.

To run browser AI verification against a Vercel preview or another deployed URL, build/deploy that target separately and run:

```bash
STRATA_BROWSER_URL=https://your-preview-url.example npm run verify:ai-browser
```

For UI QA, run the dev server and check desktop and mobile layouts:

```bash
npm run dev
```

## Production Readiness Checklist

Before production promotion:

- Vercel env vars: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, AI Gateway credentials (`VERCEL_OIDC_TOKEN` via `vercel env pull` locally or Vercel-managed OIDC in deployment), and any `STRATA_*` non-secret defaults needed for verification.
- Local-only secrets: keep `SUPABASE_SERVICE_ROLE_KEY` only in local `.env.local` or secure operator tooling for seed/verification scripts; never add it as a public browser env var.
- Supabase setup: apply migrations, confirm `strata-documents` Storage bucket exists and is private, run `npm run supabase:seed-live`, and run `npm run seed:law`.
- Access proof: run `npm run verify:production-ready`, `npm run verify:security`, `npm run verify:documents`, `npm run verify:ai`, `npm run verify:ai-observability`, and `npm run verify:ai-browser`.
- Rollback/export: use `npm run export:ai-audit` for AI audit metadata and keep Supabase point-in-time recovery/export procedures ready before destructive changes.
- Preview proof: run `STRATA_BROWSER_URL=<preview-url> npm run verify:ai-browser` before any production promotion.

## First Production Gaps

- Connect real Supabase Auth invite flow.
- Add asynchronous PDF/DOCX extraction beyond deterministic ingestion placeholders.
- Add richer production invite and member-management workflows.
- Add Gmail email-to-card import after the core workflow is stable.

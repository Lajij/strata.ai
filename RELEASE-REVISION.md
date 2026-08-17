# strata.ai v1 — release revision manifest

Prepared: 2026-08-04 (Australia/Sydney)

Base branch/revision: `main` at `73eaaaf` (`Document Vercel preview verification`)

Proposed release branch: `codex/strata-v1-release-candidate`

Production action authorized: **none**

## Candidate evidence

- The operator-run `npm run build` completed Eve, compiled Next.js 16.3.0, passed TypeScript, generated 9/9 static pages, and emitted `/recover` plus `Proxy (Middleware)`.
- Agent-run gates passed: static AI verification, lint, `tsc --noEmit`, and `git diff --check`.
- Decisions #5–#8 are signed: verified fallback AI; current Supabase variable names; no meeting-mode in v1; Track E deferred post-v1.
- Live AI is fail-closed: only exact server-side `STRATA_AI_RELEASE_MODE=live` enables Gateway; absent, invalid, or `fallback` values retain the verified fallback path.

## Explicit include set

Stage only these paths and tracked deletions/renames:

- Root release configuration: `.env.example`, `.gitignore`, `eslint.config.mjs`, `next.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `vercel.json`.
- Product/release documentation: `README.md`, `DECISIONS-REQUIRED.md`, `FRONTEND-CONTRACT.md`, `FRONTEND-GAPS.md`, `GO-NO-GO.md`, `GRAPH-PLAN.md`, `GRAPH-RUN-PROMPT.md`, `GRAPH-STATE.md`, `HANDOFF.md`, `IMPLEMENTATION_PLAN_ADDENDUM.md`, `LIVE-VERIFY-APPROVAL.md`, and this manifest.
- Repository graph-skill source referenced by the plan: `.claude/skills/graph-engineering-plan/**`.
- Runtime and UI: `src/**`, including the tracked `middleware.ts` → `src/proxy.ts` move.
- Eve implementation and deterministic evals: `agent/**`, `evals/**`.
- Verifiers, seeders, exports, and service-key resolver: `scripts/**`.
- Database history: `supabase/migrations/**`, including the checksum-identical timestamp rename of `202606260001_tighten_attachment_document_visibility.sql` to `20260628145525_tighten_attachment_document_visibility.sql`, plus `20260801053901_harden_member_lifecycle_audit.sql`.

## Explicit exclusion set

Do not stage these local/reference/generated artifacts:

- `.agents/**` — locally installed UI/UX skill bundle, not application runtime.
- `.claude/settings.local.json` — machine-specific Claude permission state.
- `skills-lock.json` — local skill-manager metadata whose recorded `.claude/skills/ui-ux-pro-max` path is not part of the candidate.
- `building-management-platform/**` — imported source workspace already integrated into `src/**`; it is excluded by `tsconfig.json` and is not runtime input.
- `GRAPH-PLAN 2.md` — older pre-router snapshot superseded by authoritative `GRAPH-PLAN.md`.
- `src/components/pages/settings-page 2.tsx` — older editable-settings snapshot superseded by the verified read-only `settings-page.tsx` contract.
- `supabase/.branches/**` and `supabase/.temp/**` — Supabase CLI machine state.
- Ignored outputs and credentials: `.next/**`, `.eve/**`, `.output/**`, `.vercel/**`, `.env.local`, and other `.env*` files except `.env.example`.

Excluded files remain in the operator's working tree; this manifest does not delete them.

## Commit procedure after approval

1. Create/switch to `codex/strata-v1-release-candidate` from current `main` without rewriting history.
2. Stage only the explicit include set; never use an unreviewed `git add -A`.
3. Verify the staged path list matches this manifest and the exclusion set is absent.
4. Run a name-only secret scan, `git diff --cached --check`, static AI verification, lint, and TypeScript checks.
5. Commit as `Prepare strata.ai v1 release candidate` only if every gate passes.
6. Push only with explicit operator authorization. Do not create or promote any Production deployment.

## Human gate

Completed under operator authorization on 2026-08-04: GitHub keyring authentication passed, `codex/strata-v1-release-candidate` was created from `main` at `73eaaaf`, and the explicit allowlist was staged, committed, and pushed to `origin`. Staged verification covered 169 path entries with zero paths outside the allowlist, zero forbidden paths, and zero credential-shaped hits. Static AI verification, lint, TypeScript, cached diff checks, and the operator-run production build passed. No PR, Preview deployment, Production deployment, alias, promotion, rollback, migration, or environment mutation was performed by this Git procedure.

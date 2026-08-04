# Live verification approval — strata.ai

Target: Supabase project `osgvagsouxgbrnbljhxb`. This approval covers only the six Wave 1 `local-gate` commands below that have live effects; it does not authorize production deploys, migrations, mailbox access, external messages, commits, or pushes.

The three omitted `local-gate` commands — `npm run lint`, `npm run build`, and `npm run verify:security` — are local-only and have zero live effects, so their omission from this live-effect approval is deliberate.

## Exact live effects

| Command | Remote effect | Cleanup protection | Residual risk |
|---|---|---|---|
| `npm run verify:production-ready` | Signs in the seeded member, reads visible records, uploads one timestamped text smoke object | Object removal runs in `finally` | Object may remain if Supabase rejects cleanup after accepting upload |
| `npm run verify:documents` | Creates three fixed-ID document rows, three attachment rows, and three fixed-path storage objects | Pre-cleanup plus failure-path `finally`; every resource cleanup is attempted even if another cleanup fails | Fixed-ID/path records may remain if remote deletion fails |
| `npm run verify:ai` | Creates two fixed-ID `ai_outputs` rows and reads law context | Pre-cleanup plus failure-path `finally` | Fixed-ID rows may remain if remote deletion fails |
| `npm run verify:law` | Reads legislation sources/chunks as service and member clients | Read-only | Authentication/read audit traffic only |
| `STRATA_VERIFY_LIVE_AUTH=1 npm run verify:auth-flow` | Attempts one RLS-denied invite insert; if RLS is broken, the insert creates a row; on the expected RLS-denied path, creates one timestamped uninvited Auth user | A mistakenly inserted row is deleted by committee/email before the unchanged RLS assertion fails; Auth-user deletion runs in `finally` | Broken RLS still fails the gate after checked row cleanup; the accidental row, or the later-path Auth user, may remain only if Supabase rejects its cleanup |
| `STRATA_VERIFY_LIVE_MEMBERS=1 npm run verify:member-management` | Pre-cleans the fixed test member ID and fixed-email Auth user, creates one Auth user/member row, temporarily assigns the `treasurer` role and `limited_admin` access level, verifies an ordinary member cannot persist an `admin` access-level change, then suspends and deletes the test member | Pre-cleanup removes matching residue; final member-row and Auth-user deletions are checked and attempted independently, with failures aggregated | Fixed test user/member may remain only if remote deletion fails, which fails the gate |

Secrets remain local/server-only and are never printed. Across all six live scripts, cleanup API results are checked and cleanup failures fail the gate; they are not soft passes. The document and member-management multi-call cleanup routines do not let one failure skip later cleanup attempts, and they rethrow the collected failures.

## Operator decision

- [x] **Approve:** Run the complete live Supabase verification barrier with the effects and residual risks above.
- [ ] **Decline:** Do not run live verification; keep `local-gate` and all downstream nodes blocked.

Operator name: **Repository operator (approval provided in Codex task)**

Decision date: **2026-08-01**

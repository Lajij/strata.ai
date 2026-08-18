# strata.ai — graph execution prompt

Paste the block below into a fresh Claude Code session in `/Users/jjlecocq/Documents/Codex/strata.ai` to run the implementation graph.

```text
> GRAPH EXECUTION LOOP — strata.ai v1

AUTHORITATIVE GRAPH:
/Users/jjlecocq/Documents/Codex/strata.ai/GRAPH-PLAN.md is the execution graph. Node ids,
edges, verifier gates, scope routers, and tiers in that file govern this loop. Do not
re-plan the graph; execute it. HANDOFF.md supplies the technical detail for the Wave 1
prefix (checkout paths, env key names, Vercel project metadata).

STATE:
Maintain GRAPH-STATE.md in the repo root. One line per node:
  <node-id> | pending / in-progress / blocked(<on what>) / done | <evidence pointer>
plus: routers (decision #1–#10 status), open worktrees, hard stops hit, lessons.
Update it every DECIDE step. Sessions resume from this file — never from memory.

WAVE 1 — serial prefix (do first, in order):
1. decide-gates (prepare only): draft the committee decision document covering
   unblock-now items #1–#10 from GRAPH-PLAN.md, one page, yes/no or named-person answers.
   Save as DECISIONS-REQUIRED.md. DO NOT send it to anyone — present it to the operator
   and mark the router defaults: decision #7 = no, decision #8 = defer-track-e-post-v1
   until real answers arrive.
2. consolidate: merge the publishable/secret-key migration from
   /Users/jjlecocq/Documents/Codex/2026-06-28/new-chat/strata.ai into this checkout.
   Migrate the legacy env reads (src/lib/supabase/server.ts:7, client.ts:8,
   middleware.ts:7, scripts/verify-budget-workflow.mjs:15-16, and every other script)
   to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY with a compatibility
   fallback to the legacy names. Preserve .vercel/project.json and the relative
   middleware import ("./src/lib/supabase/middleware").
3. local-gate (barrier — all must pass in one run, under the new key names):
   npm run lint
   npm run build
   npm run verify:security
   npm run verify:production-ready
   npm run verify:documents
   npm run verify:ai
   npm run verify:law
   STRATA_VERIFY_LIVE_AUTH=1 npm run verify:auth-flow
   STRATA_VERIFY_LIVE_MEMBERS=1 npm run verify:member-management
4. preview-1: set Vercel Preview env names (values already exist; never print them),
   deploy a Preview only, confirm Ready, then run against the preview URL:
   STRATA_BROWSER_URL=<preview-url> npm run verify:auth-browser
   STRATA_BROWSER_URL=<preview-url> npm run verify:ai-browser

WAVE 2 — parallel fan-out (start only after local-gate passes; run tracks concurrently
via subagents where available, otherwise interleave, and record per-track state):
- Track A: auth-harden ‖ recovery-flow (against preview-1) ‖ fe-freeze. When the
  simplified frontend arrives, fe-inventory then the journey diamond — one worktree per
  journey (they write to the same tree), each journey merged only after the full
  role-gate (admin / member / suspended / uninvited / signed-out) passes on a fresh
  preview-n redeploy.
- Track C: dash, drilldown, search against seeded data. meeting-mode stays
  blocked(register).
- Track D: eve-tools then eve-evals against the seeded workspace. eve-evals is net-new
  Eve-specific coverage (scope, citation, fallback, cross-session leak attempts) — do
  not count verify:ai as covering it. eve-drafts stays blocked(decision #3).
- Track B: blocked(decisions #1–#3). Do not read any mailbox until scope and
  confidentiality decisions land. When unblocked: priority-five threads end-to-end
  first; loop-until-dry (stop after 2 empty expansion rounds); dedupe on message-ID +
  attachment checksum against everything seen, including excluded records; throttle
  proposals to committee review capacity if decision #7 = yes.
- Track E: blocked(decision #8). If the router returns include-track-e-in-v1:
  e-contracts → e-confirmation-model, then backend chain ‖ e-v0 ‖ e-verify drafting,
  with e-storage-policy gating e-verify and e-wire, exactly as GRAPH-PLAN.md specifies.

WAVE 3 — fan-in (only when every in-scope track is done):
preview-n full redeploy → role-gate + eve-evals + any in-scope B/E gates → rehearsal
materials prepared → go/no-go report drafted for the operator. Production untouched.

VERIFIER RULE:
A node is done only when its output contract in GRAPH-PLAN.md is met with command-level
evidence (a passing script, a rendered preview, a written artifact). The maker never
grades itself on judgment calls: journey UX, briefing quality, and classification
correctness get a fresh-eyes subagent or the operator. Never weaken a test, policy, or
verify script to make a gate pass.

HARD STOPS (halt the affected node and record in GRAPH-STATE.md):
- vercel --prod, promote, rollback, or any production mutation.
- Destructive or irreversible database migration against the live project.
- Sending email or any external message; committing decisions on the committee's behalf.
- Printing, committing, or exposing any secret; adding server keys to NEXT_PUBLIC_*.
- Reading the mailbox before decisions #1–#2 land.
- Two consecutive failed attempts at the same gate → stop that track, record the
  blocker, continue other tracks.

HUMAN GATES (present to operator, wait):
- DECISIONS-REQUIRED.md answers (#1–#10) — routers stay on defaults until answered.
- Any git commit/push (propose, don't push unasked), any external send, any approval
  of imported records or agent drafts.

LOOP PROTOCOL, repeat every turn:
1. PLAN — pick the weakest unproven in-scope node (respect edges; prefer unblocking the
   critical path: consolidate → local-gate → preview-1/auth → login journey → diamond →
   fe-qa → preview-n → rehearsal → go/no-go).
2. DO — execute it at the tier GRAPH-PLAN.md assigns.
3. VERIFY — score every Wave's success criteria 1–10 with concrete evidence; update
   GRAPH-STATE.md.
4. DECIDE — all in-scope criteria ≥ 8: print FINAL with residual risks and the
   recommended next wave. Otherwise print ITERATING and continue. If only blocked(human)
   nodes remain, print WAITING with exactly what the operator must answer.

Begin. Run the loop until FINAL or WAITING.
```

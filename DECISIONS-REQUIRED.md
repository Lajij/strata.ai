# strata.ai v1 — decisions required

Operator/committee: answer each item with the requested **yes/no**, choice, or **named person**. Decisions #7 and #8 previously used temporary defaults; the operator's 2026-08-04 answers below now supersede those defaults. This document is a repository decision record and has not been sent externally.

| # | Decision required | Answer |
|---|---|---|
| 1 | What Gmail accounts/labels and inclusive date range may Track B read? | **Scope:** pending; **start:** pending; **end:** pending |
| 2 | May imported messages/attachments be retained in strata.ai, and what confidentiality classes, exclusions, access limits, and deletion period apply? | **Yes/no:** pending; **rules:** pending |
| 3 | Who may approve/correct/hold/exclude imported records and approve Eve drafts? | **Named person/role:** **repository operator/owner (the user issuing this decision)** — answered 2026-08-02; operator retains sole approval until the policy is fine-tuned. |
| 4 | Should the simplified frontend **replace** the current UI or be **refactored into** it? | **Choice:** **replace** — answered by the operator on 2026-08-01. The delivered cards/votes/updates/people vocabulary is canonical; Projects and Budget are new destinations in that design language. |
| 5 | Should v1 launch with **live AI gateway** or **verified fallback mode**? | **Choice:** **verified fallback mode** — approved by the operator on 2026-08-04; live Gateway remains explicit opt-in after a separate verification/policy decision. |
| 6 | May Preview use these Vercel variable names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`, with legacy aliases retained temporarily? | **Yes:** approved by the operator on 2026-08-04; server credentials remain outside all `NEXT_PUBLIC_*` variables. |
| 7 | Is reviewed intake/meeting-mode part of the v1 rehearsal definition? | **No:** approved by the operator on 2026-08-04; Track B and meeting-mode are excluded from v1. |
| 8 | Is Track E part of the first-release definition of done? | **Exact choice:** **`defer-track-e-post-v1`** — approved by the operator on 2026-08-04. |
| 9 | May unit-interior/exterior photos be stored, and what consent, visibility, retention, redaction, and deletion rules apply? | **Yes/no:** pending; **rules:** pending |
| 10 | Who holds confirm-figure authority, and do you approve protected draft→official transitions, server-derived confirmer/time, unprivileged direct-write denial, and audit-log mirroring only? | **Named person/role:** pending; **model yes/no:** pending |

Operator sign-off: **decisions #3 and #5–#8 approved; decisions #1–#2 and #9–#10 remain pending for deferred work**

Committee sign-off (where required): **pending**

Decision date: **decision #4 — 2026-08-01; decision #3 — 2026-08-02; decisions #5–#8 — 2026-08-04; remaining decisions pending**

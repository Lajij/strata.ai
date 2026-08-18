# strata.ai frontend gap register

Status: produced 2026-08-01 by graph node `fe-inventory`; disposition update recorded 2026-08-01 after the operator answered decision #4 with `replace`. Input: `FRONTEND-CONTRACT.md` (frozen by `fe-freeze`) and the delivered frontend as composed in `src/`. Output: the gap list consumed by every `fe-journey:*` node.

## Scope and router boundary

This node executes its `GRAPH-PLAN.md` contract — *"Inventory incoming frontend; map screens → contracts; gap list"* — and nothing more. It is read-only: no schema, route, component, or verifier was modified to produce it.

**Decision #4 is not answered here and was not inferred.** Per `FRONTEND-CONTRACT.md:153`, the replace-vs-refactor route must be chosen explicitly by the operator. Gaps whose *remedy* depends on that choice are marked **D4** and stated with both branches; every other gap has a single remedy valid under either route. The `blocked(decision-4)` edge belongs on the `fe-journey:*` nodes, which perform the integration, not on this inventory.

Per `FRONTEND-CONTRACT.md:9`, proposed schema or endpoint changes stop here as explicit gaps and require separate review. They are collected in [Change requests](#change-requests-stop-and-review) and must not be implemented by a journey node.

## Summary

| Journey | Gaps | D4-conditional | Change requests |
|---|---|---|---|
| `fe-journey:login` | 1 | 0 | 0 |
| `fe-journey:dashboard` | 1 | 0 | 0 |
| `fe-journey:projects` | 2 | 2 | 0 |
| `fe-journey:decisions` | 8 | 0 | 1 |
| `fe-journey:documents` | 3 | 0 | 1 |
| `fe-journey:admin` | 1 | 0 | 1 |
| Cross-cutting | 4 | 1 | 0 |
| **Total** | **20** | **3** | **3** |

Headline finding: four collections frozen into `StrataAppData` — `projects`, `vendors`, `budgetLines`, `budgetRecommendation` — are delivered by the backend and rendered **nowhere** in the composed UI. The delivered frontend also retired four navigation surfaces present in the previous UI (`projects`, `budget`, `incidents`, `activity`) and introduced three new ones (`votes`, `updates`, `settings`). This is a far larger D4 surface than the single Projects-placement item anticipated at `FRONTEND-CONTRACT.md:147`.

This finding is independently corroborated by the `preview-1` workstream, which found `verify:ai-browser` blocked on exactly the missing `Budget` and `Projects` destinations and the absent Cards AI panel (`GRAPH-STATE.md`, fifth follow-up). **Decision #4 is therefore on the critical path for `preview-1` completion, not only for Track A**: `verify:ai-browser` cannot pass under either branch until those destinations exist, and `preview-1` is currently recorded `done(auth) / blocked(ai-browser on decision-4)`.

## Disposition update — decision #4 `replace`

The operator selected `replace` on 2026-08-01. The delivered vocabulary remains canonical, with `projects` and `budget` added as new destinations. This table is the current disposition of every inventory item; the detailed findings below remain as the pre-change audit record.

| Item | Disposition | Evidence / remaining work |
|---|---|---|
| G-L1 | **Closed in this change** | Email and Password retain visible labels and now expose the exact `aria-label` values; input/input/button are sibling controls for `verify:ai-browser` while `getByLabel` remains valid for `verify:auth-browser`. |
| G-D1 | **Closed in dashboard journey** | `AppStoreProvider` rebases card state from the refreshed RLS payload and clears a selected-card pointer only when that record is no longer visible. Local card changes remain intact until an authoritative refresh arrives. |
| G-P1 | **Closed and verified** | Added `projects` to `NavKey`, `NAV_ITEMS`, and `PAGE_META`; built `ProjectsPage`; removed the dead legacy `navItems` export. `verify:projects` owns the navigation and mount contract. |
| G-P2 | **Closed and verified** | `ProjectsPage` renders status, planned scope, progress, allowance, committed, invoiced, remaining, milestones, variations, evidence references, `aiSummary`, and one `ProjectAiTool` per project. The focused source gate and fresh Preview `projectStatus` browser observation pass. |
| G-C1–G-C7 | **Closed and verified** | All five actions use the authenticated workflow route and authoritative in-place refresh; card audit history and `StatusMessage` are composed. `verify:workflow-ui`, TypeScript, lint, security, source regressions, and the full integrated build pass. |
| G-C8 | **Closed in this change** | Cards now renders an immediate AI panel with Card brief, Quote risk, NSW law lookup, Ask AI, and Send AI question, reusing `runAiTask` and `AiResultCard`. |
| G-DOC1 | **Closed and verified** | Documents submits authenticated multipart `FormData` to `/api/documents/create`, preserves the browser boundary header, surfaces loading/error/success, and refreshes authoritative data in place. `verify:documents-ui` and the integrated build pass. |
| G-DOC2 / CR-2 | **Closed by removal** | Removed the demo Download control. No endpoint was added because the frozen contract has no RLS-scoped retrieval route. |
| G-DOC3 | **Closed and verified** | `DocItem.extractionStatus` is independent from optional `fileSize`; live status is no longer rendered as a file size. Source, search, type, lint, and build gates pass. |
| G-A1 / CR-3 | **Closed and verified** | Removed building-detail and notification-preference inputs, switches, local state, and save control. Settings now shows truthful read-only session/source information; `verify:admin` owns this boundary. |
| G-X1–G-X2 | **Open — separate cross-cutting work** | Fallback persona attribution and client-bundle fallback isolation remain outstanding. |
| G-X3 | **Standing invariant; no change required** | Derived statuses remain presentation-only and must not be written to the server. |
| G-X4 | **Closed in this change** | `BudgetPage` renders `budgetLines`, `budgetRecommendation`, and `vendors`; summary, citations, and disclaimer share one render boundary, and `BudgetAiTool` is mounted. |
| CR-1 | **Closed by removal** | Removed the Archive button, client-only `archiveCard`, and dead Archived tab/filter. No endpoint was added because archive is absent from the five-action workflow contract. |

---

## `fe-journey:login`

Behaviourally complete; one accessible-name/structure gap blocks a browser gate.

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-L1** | `strata-app.tsx:108-137` | `verify-ai-browser.mjs:278-302` queries `input[aria-label="Email"]` and `input[aria-label="Password"]`, and locates the submit control with the sibling combinator `input[aria-label="Email"] ~ input[aria-label="Password"] ~ button` | The inputs are associated by `<Label htmlFor>` + `id` (`:110-119`, `:121-131`) with **no `aria-label`**, and each input is wrapped in its own `<div className="grid gap-2">`, so the three elements are not siblings and the combinator cannot match even once the labels are added | Add `aria-label="Email"` / `aria-label="Password"` alongside the existing visible labels, and flatten the form so input/input/button are siblings. Both are additive; neither weakens an assertion | `verify:ai-browser` |

Bound and requiring no change:

- Password sign-in, invite acceptance, in-place refresh, and sign-out: `strata-app.tsx:29-83` signs in and calls `POST /api/members/accept`; `:163-185` refreshes via `GET /api/app-data` with `setData(nextData)` and no reload; `app-shell.tsx:91-103` signs out then refreshes.
- Signed-out / uninvited / suspended lock (invariant `FRONTEND-CONTRACT.md:14`), enforced **server-side**: `strata-app-data.ts:644-656` selects only `status = "active"`, so uninvited *and* suspended resolve to `member === null`, and `:669-673` returns `mode: "signed-out"` with every record collection empty. `strata-app.tsx:187` renders the locked surface on that mode. This is not UI filtering.
- Contract-stable names Email, Password, Sign in, Sign out are present as visible labels (`strata-app.tsx:110`, `:122`, `:133`; `app-shell.tsx:149-152`) — G-L1 is about the programmatic `aria-label`, which `verify:ai-browser` additionally requires.

`verify:auth-browser` passes 16/16 against Preview (`GRAPH-STATE.md`, fifth follow-up), so this journey's role and lifecycle behavior is already proven live. Only the `verify:ai-browser` locator contract above is outstanding.

---

## `fe-journey:dashboard`

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-D1** | `app-store.tsx:73` | Contract row `fe-journey:login` requires "refresh in place"; contract row `fe-journey:dashboard` requires RLS-filtered cards | `const [cards, setCards] = React.useState<Card[]>(platformData.cards)` seeds card state **once at mount**. `refreshData()` updates `data` → `platformData` recomputes (`:69-72`), but the `cards` state ignores it. After any refresh — invite, member update, sign-out/in — the card list still shows pre-refresh records | Derive `cards` from `platformData` with a sync effect, or remount the provider on a data identity change. Local card mutations must rebase onto refreshed server data, not replace it | `verify:browser-workflow`, `verify:auth-browser` (refresh behavior) |

Bound and requiring no change: RLS-filtered card/activity rendering with per-claim source references (`dashboard-page.tsx:122-143`, `:181-183`, `:262-264`), the evidence-boundary banner echoing `sourceDetail` (`:97-105`), attention and vote summaries (`:51-93`), and the budget and per-project AI tools (`:282-290`).

---

## `fe-journey:projects`

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-P1** **D4** | Navigation | Contract row `fe-journey:projects`: "absence of a dedicated screen is an inventory gap, not a backend change request" (`FRONTEND-CONTRACT.md:32`, `:147`). **Also a hard gate:** `verify-ai-browser.mjs:368-369` clicks a nav button named `Projects`, then `Refresh project AI` | No `projects` member in `NavKey` (`src/lib/types.ts:1-8`), no nav item (`sidebar-nav.tsx:19-28`), no `PAGE_META` entry (`app-shell.tsx:28-57`). The previous UI *did* have one: `strata-data.ts:212-220` still exports a `navItems` array containing `projects`, `budget`, `incidents`, and `activity` — now dead code. The `Refresh project AI` control itself already exists (`ai-tools.tsx:203`) but is reachable only from the dashboard, so the gate fails at the nav step | See [Decision #4 conditional items](#decision-4-conditional-items) | `verify:ai-browser`, `verify:frontend-contract`, `role-gate` |
| **G-P2** | `dashboard-page.tsx:283-290` | Contract row `fe-journey:projects`: "Render visible project evidence **and** project-status AI" | Only the AI half is bound. Each project renders `project.id` and `project.name` as an anchor for `ProjectAiTool`; no other field is displayed. The frozen `Project` record (`strata-data.ts:113+`) carries `status`, `plannedScope`, `progress`, `allowance`, `committed`, `invoiced`, `remaining`, `milestones`, `variations`, `invoices`, `quoteReviews`, and `evidence` — all discarded | Render the visible project evidence fields from `rawProjects`. No backend change: the data is already in the payload | `verify:frontend-contract`, `verify:live-dashboard` |

---

## `fe-journey:decisions`

This journey carries the bulk of the integration work. `npm run verify:workflow-ui` exits 1 at the first assertion (`Missing aria-label="Card title"`); **all 11 required accessible names and all 5 workflow actions are unbound**. Per `FRONTEND-CONTRACT.md:145`, that failure must not be resolved by deleting assertions.

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-C1** | `cards/create-card-dialog.tsx` | `POST /api/workflow/create-card` with `title`, `description`; names `Card title`, `Card description`, `Create card` | `submit()` calls `addCard()` (`:88`, `:116`) writing client state only. Fields use `id="card-title"` + `FieldLabel` (`:161-171`, `:216-229`), not the required accessible names. Submit buttons read "Save draft" / "Publish update" (`:296-301`) | Bind the real route; add the three accessible names; surface server validation errors | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-C2** | `cards/card-detail-drawer.tsx:196-225` | `POST /api/workflow/add-message` with `cardId`, `body`; names `Message body`, `Post message` | Comment form calls `setComments()` locally (`:200-209`). The composer input has no `aria-label`; the button is labelled `Post comment` (`:220`) | Bind the real route; rename both accessible names to the frozen values | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-C3** | — | `POST /api/workflow/create-proposal`; names `Proposal title`, `Create proposal` | **No proposal-creation surface exists anywhere in the composed UI** | Build the surface; bind the route | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-C4** | `app-store.tsx:95-110`, `card-detail-drawer.tsx:262-285` | `POST /api/workflow/cast-vote`; names `Vote value`, `Cast vote` | `castVote()` mutates client state only. Submit button reads "Submit vote" (`:283`); the radio group has no `aria-label`. Option-model conflict: the adapter synthesizes fixed `yes`/`no`/`abstain` options (`building-platform-data.ts:92-96`) while `CreateCardDialog` produces free-text options (`create-card-dialog.tsx:105-109`) that have no backend representation | Bind the real route against the yes/no/abstain model; add both names; reconcile the create dialog to the backend vote model rather than the reverse | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-C5** | — | `POST /api/workflow/add-approval-condition`; names `Approval condition`, `Add approval condition` | **No approval-condition surface exists anywhere in the composed UI** | Build the surface; bind the route | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-C6** | — | `verify-workflow-ui-source.mjs:54-55` requires a "Card audit history" panel rendering `selected.audit.map` | Absent. No composed component renders per-card audit history | Build the audit panel from the card's audit events | `verify:workflow-ui` |
| **G-C7** | — | `verify-workflow-ui-source.mjs:56` requires a `StatusMessage` component for clear status | Absent. Status is conveyed ad hoc via `sonner` toasts (`create-card-dialog.tsx:119`, `card-detail-drawer.tsx:129`, `:280`) | Introduce `StatusMessage` with explicit loading/error/success states; toasts alone do not satisfy the contract's error/loading/success requirement (`FRONTEND-CONTRACT.md:155`) | `verify:workflow-ui` |
| **G-C8** | Cards surface | `verify-ai-browser.mjs:334-346` navigates to `Cards`, waits for the text `AI panel`, fills the field labelled `Ask AI`, and clicks `Send AI question` — the per-card thread-summary/brief surface | The Cards nav destination exists, but **no AI panel is mounted on it**. `CardsPage` renders tiles and filters only; the AI tools are mounted on the dashboard (budget, per-project) and documents (per-document) pages. `runAiTask` already supports the `card-brief` and `thread-summary` tasks (`ai-tools.tsx`), so this is a missing surface, not a missing capability | Mount a card AI panel with the three frozen names. Reuse `runAiTask` + `AiResultCard`; no new endpoint | `verify:ai-browser` |

---

## `fe-journey:documents`

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-DOC1** | `pages/documents-page.tsx:41-44` | Contract row `fe-journey:documents`: "real upload binding"; `POST /api/documents/create` accepts multipart `title`, `documentType`, `file`, … | Upload button is a demo toast: `onClick={() => toast.success("Upload started (demo).")}`. No file input, no multipart body, no route call | Bind the real multipart route with loading/error/success states | `verify:documents`, `verify:browser-workflow` |
| **G-DOC2** | `pages/documents-page.tsx:64-71` | — | Download button is a demo toast. No signed-URL retrieval path | See [Change requests](#change-requests-stop-and-review) — no download endpoint exists in the frozen table | `verify:documents` |
| **G-DOC3** | `lib/building-platform-data.ts:37-43` + `pages/documents-page.tsx:58` | Contract row `fe-journey:documents`: "extraction-state presentation" | The adapter maps `document.status` into the `size` field, and the page renders it as `Updated {date} · {d.size}` — the extraction state is displayed **as if it were a file size** | Carry extraction state as its own field through the adapter and present it as a state, not a size. Adapter-level fix; no backend change | `verify:documents`, `verify:frontend-contract` |

Bound and requiring no change: the visible document list and search (`documents-page.tsx:24-40`) and per-document Q&A via `DocumentAiTool` (`:74`), which calls `POST /api/ai/document-qa` through `ai-tools.tsx:84`.

---

## `fe-journey:admin`

| # | Screen / component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-A1** | `pages/settings-page.tsx:84`, `:105-110` | — | "Save changes" is a demo toast; building name and address inputs and all four notification switches are local state only. The building name is seeded from `buildingName`, which the adapter hardcodes to `"Strata Governance Command"` (`building-platform-data.ts:47`) rather than any backend field | See [Change requests](#change-requests-stop-and-review) — no settings endpoint or backing column exists | `verify:frontend-contract`, `role-gate` |

Bound and requiring no change — this is the strongest journey in the delivered frontend:

- Invite bound to `POST /api/members/invite` (`people-page.tsx:63-79`) and per-member update bound to `POST /api/members/update` (`:279-297`), both through `authHeaders()`.
- Capability gate `canManage` restricted to `admin`/`chair`/`secretary` (`:42-44`), matching invariant `FRONTEND-CONTRACT.md:16` and the server role matrix. Client-side gating is presentation only; the routes enforce independently.
- Self-lockout controls disabled via `isCurrentMember` on role, access level, and status (`:325`, `:342`, `:357`), matching acceptance row "Enabled, except own role/status/access".
- All required accessible names present (`Invite role`, `Invite access level`, `Role for {email}`, `Access level for {email}`, `Status for {email}`, `Save member {email}`), each with `aria-live="polite"` status output (`:160`, `:378`).
- Nav accessible name correctly mapped: `sidebar-nav.tsx:61` emits `aria-label="Members"` for the `people` key while the visible label stays "People", satisfying contract row `fe-journey:admin`. **Journeys must preserve this mapping** — it is easy to lose in a visual refactor.

---

## Cross-cutting

| # | Component | Required contract | Current implementation | Proposed change | Affected gate |
|---|---|---|---|---|---|
| **G-X1** | `app-store.tsx:45-56`, `card-detail-drawer.tsx:204-208` | `FRONTEND-CONTRACT.md:74`: must display source/mode honestly and must not label fallback records as live | `fallbackData` hardcodes the persona `"Grace Miller" / "Building manager"`, and every locally composed comment is attributed to `author: "Grace Miller", initials: "GM"` regardless of who is signed in | Attribute composed content to `currentMember`; confine the demo persona to genuine fallback mode | `verify:frontend-contract`, `role-gate` |
| **G-X2** | `app-store.tsx:5` | Same | The live path imports fallback records (`activity`, `documents`, `initialCards`, `people`) from `@/lib/mock-data`, so they ship in the client bundle. No secret exposure — `verify:production-ready` covers that — but journeys must guarantee these can never render while `source === "supabase"` | Gate the fallback record set behind an explicit fallback branch. The taxonomy constants (`AUDIENCES`, `BUILDING_AREAS`) are UI-only and may stay | `verify:frontend-contract`, `verify:fallback-build` |
| **G-X3** | `lib/building-platform-data.ts:74-76`, `:175-187` | `FRONTEND-CONTRACT.md:76`: the adapter "may not narrow or fabricate the backend contract" | `isVoteCard` classifies any card with a truthy `proposal.id` as a vote; `updateStatus` collapses `Confidential` → `Draft` and `Resolved` → `Archived`; `voteStatus` derives `Closing soon` from a date. Presentation-only today, and acceptable as such | **No change required while read-only.** Constraint for the decisions journey: derived statuses must never be written back to the server. Record as a standing invariant | `verify:workflow-ui`, `verify:browser-workflow` |
| **G-X4** **D4** | `sidebar-nav.tsx:19-28` vs `strata-data.ts:212-220` | Contract row `fe-journey:dashboard`; `StrataAppData` shape (`FRONTEND-CONTRACT.md:41-72`). **Also a hard gate:** `verify-ai-browser.mjs:363-364` clicks a nav button named `Budget`, then `Run budget AI` | The delivered nav retired four surfaces (`projects`, `budget`, `incidents`, `activity`) and added three (`votes`, `updates`, `settings`). Consequently `vendors`, `budgetLines`, and `budgetRecommendation` are delivered by the backend and rendered nowhere; `budgetRecommendation` in particular is a pre-computed summary with citations and disclaimer that no screen displays. As with Projects, the `Run budget AI` control exists (`ai-tools.tsx:229`) but only on the dashboard, so the gate fails at the nav step | See [Decision #4 conditional items](#decision-4-conditional-items) | `verify:ai-browser`, `verify:frontend-contract`, `verify:budget`, `verify:live-dashboard` |

---

## Decision #4 conditional items

**Resolved 2026-08-01: `replace`.** The alternatives below are retained as the audit trail for the choice; only the `replace` branch is implemented.

These three gaps have two valid remedies. **Neither branch is selected here.** Both satisfy the same frozen contract; the choice is the operator's under `DECISIONS-REQUIRED.md` #4.

### G-P1 — Projects screen placement

- **`replace`** — add `projects` to `NavKey`, `NAV_ITEMS`, and `PAGE_META`, and build a new `ProjectsPage` in the delivered design language. Delete the dead `navItems` export in `strata-data.ts`.
- **`refactor-into`** — restore the previous Projects surface and re-skin it, reusing `strata-data.ts:212-220` as the surface inventory.

### G-X4 — Retired surfaces and unrendered collections

- **`replace`** — decide per collection whether `vendors`, `budgetLines`, and `budgetRecommendation` get new surfaces in the delivered design or are explicitly deferred post-v1. Anything deferred must be recorded, not silently dropped: the backend still ships the data on every request.
- **`refactor-into`** — restore the `budget`, `incidents`, and `activity` surfaces from the previous UI as the consumers of those collections, and re-skin them.

Under **either** branch, `budgetRecommendation` must not remain unrendered without an explicit deferral note — it carries citations and a disclaimer that invariant `FRONTEND-CONTRACT.md:21` exists to protect.

### Naming and layout consequences

- **`replace`** — the delivered vocabulary (`cards`/`votes`/`updates`/`people`) becomes canonical; the `people` → `"Members"` accessible-name mapping (`sidebar-nav.tsx:61`) must be preserved so browser gates keep passing.
- **`refactor-into`** — the previous vocabulary (`cards`/`members`/`activity`) becomes canonical, and every delivered page is re-homed under it.

---

## Change requests (stop and review)

**Resolved 2026-08-01:** the operator directed that all three controls be dropped rather than backed by new endpoints or schema. CR-1 removed card archive plus the dead Archived tab/filter; CR-2 removed document download; CR-3 removed building-detail and notification-preference editing and retained Settings only as a read-only session/source page. These removals are intentionally frontend-only.

Per `FRONTEND-CONTRACT.md:9`, these require schema or endpoint changes and **must not** be implemented by a journey node. Each needs separate review and, if approved, a contract amendment before any journey binds it.

| # | Requested capability | Why it is a change request | Origin |
|---|---|---|---|
| **CR-1** | Card archive | `archiveCard` sets `status: "Archived"` client-side (`app-store.tsx:87-93`) and `CardDetailDrawer` exposes an Archive button (`card-detail-drawer.tsx:124-135`). The frozen endpoint table has **no** archive action; `/api/workflow/{action}` supports exactly five values, none of which is archive | G-C6 |
| **CR-2** | Document download | The download button (`documents-page.tsx:64-71`) implies a signed-URL or streaming endpoint. The frozen table has `POST /api/documents/create` only — no read/download route. Any such route must respect RLS and the hidden-record 403 rule | G-DOC2 |
| **CR-3** | Building settings and notification preferences | `SettingsPage` implies persisted building details and per-user notification preferences (`settings-page.tsx:57-116`). Neither an endpoint nor a backing column exists, and the building name is currently a hardcoded adapter constant | G-A1 |

The correct disposition for all three may be "drop the control", not "build the endpoint". A demo control that implies persistence it does not have is itself a defect under `FRONTEND-CONTRACT.md:74`.

---

## Evidence

Commands run for this node, all local-only, no network and no remote mutation:

```bash
npm run verify:frontend-contract && npm run verify:workflow-ui
```

- `npm run verify:frontend-contract` — exit 0, `Frontend contract verification passed.`
- `npm run verify:workflow-ui` — exit 1, `Error: Missing aria-label="Card title"`, the first of 11 required accessible names. Expected and recorded at `FRONTEND-CONTRACT.md:110` and `:145`; it remains a red integration gate until `fe-journey:decisions` binds the real APIs.

Browser gates were **not** run from this node. `verify:ai-browser` requirements were derived by reading its selectors statically (`scripts/verify-ai-browser.mjs:278-369`) and cross-checked against the `preview-1` workstream's live run recorded in `GRAPH-STATE.md`. G-L1, G-C8, and the gate consequences on G-P1 and G-X4 come from that cross-check.

Files inspected: `src/components/{strata-app,app-shell,app-store,sidebar-nav,status-badge}.tsx`, `src/components/pages/*.tsx`, `src/components/cards/*.tsx`, `src/components/assistant/ai-tools.tsx`, `src/lib/{building-platform-data,types,strata-data,strata-app-data}.ts`, `scripts/verify-workflow-ui-source.mjs`, `scripts/verify-ai-browser.mjs`.

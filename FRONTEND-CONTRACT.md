# strata.ai frontend integration contract

Status: frozen from the consolidated tree on 2026-08-01. This document is the output of graph node `fe-freeze` and the input to `fe-inventory` and every `fe-journey:*` node.

## Scope and router boundary

This contract freezes backend behavior, frontend-visible data shapes, authorization boundaries, stable interaction names, and acceptance commands. It does not decide whether the simplified frontend replaces the current UI or is refactored into it. Decision #4 selects that implementation route later; both routes must satisfy this same contract before integration.

No frontend integration may require a schema change merely to match a mock screen. Proposed schema or endpoint changes stop at `fe-inventory` as explicit gaps and require separate review.

## Non-negotiable invariants

- The only page route is `/`; `src/app/page.tsx` is dynamic and loads `StrataAppData` server-side before rendering `StrataApp`.
- Supabase mode is invite-only. Only a user with a matching `members.status = active` row receives workspace data. Signed-out, uninvited, and suspended users receive a locked workspace with empty record collections.
- RLS remains the record-visibility authority. UI filtering is presentation only and must never substitute for server/RLS enforcement.
- Membership management capability is true only for `admin`, `chair`, and `secretary`; it is false for `treasurer`, `member`, and `strata_manager`.
- Active/suspended members cannot move backward to `invited`; activation requires a linked Auth user; authenticated users cannot change their own role, status, or access level.
- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon fallback is compatibility-only). Secret/service keys remain server-only and must not enter client components or bundles.
- Authenticated browser requests use `authHeaders()`: `Content-Type: application/json` plus `Authorization: Bearer <access_token>` when a session exists. No verifier or UI may print the token.
- Mutations must preserve audit behavior. Member lifecycle auditing is transactional in Postgres; workflow/finance mutations write audit events through their routes; AI generation persists `ai_outputs` and mirrors an audit event when an active member exists.
- AI answers expose mode/model, visible-source citations, and a non-binding disclaimer. Hidden requested records return 403; NSW law lookup without indexed official context refuses with 422.
- The relative Proxy session import and server-only admin boundary remain protected by `verify:production-ready`.

## Application and journey map

The current shell uses client view state rather than URL subroutes. These keys and accessible navigation names are stable integration inputs.

| Journey node | Current view surface | Stable key/name | Required behavior |
|---|---|---|---|
| `fe-journey:login` | Signed-out workspace in `StrataApp` | Email, Password, Sign in, Sign out | Password sign-in; call member acceptance; refresh in place; lock non-active users |
| `fe-journey:dashboard` | `DashboardPage` | `dashboard` / Dashboard | RLS-filtered cards/activity; attention and vote summaries; budget/project AI tools |
| `fe-journey:projects` | Dedicated `ProjectsPage` | `projects` / Projects; project IDs from `rawProjects` | Render every RLS-visible project field, complete evidence references, an honest empty state, and project-status AI |
| `fe-journey:decisions` | `CardsPage`, `VotesPage`, `UpdatesPage`, card drawer | `cards`, `votes`, `updates` / Cards, Votes, Updates | Create/read workflow records, messages, proposals, votes, conditions, and audit history without full-page reload |
| `fe-journey:documents` | `DocumentsPage` | `documents` / Documents | Visible document list/search, real upload binding, document Q&A, extraction-state presentation |
| `fe-journey:admin` | `PeoplePage`, `SettingsPage` | `people`, `settings` / Members, Settings | Role-gated invites/member lifecycle management; self-lockout controls disabled |
| Track C `search` | `SearchPage` | `search` / Search | Search only the current RLS-filtered payload; every card/document/project/activity/budget/vendor/member result exposes source references |

All desktop navigation remains available through the sidebar; mobile navigation remains available through the “Open navigation” control. Changing visual layout must preserve equivalent accessible names used by browser gates.

## Frontend data contract

`GET /api/app-data` and the initial server render return `StrataAppData`:

```ts
type StrataAppData = {
  source: "fallback" | "supabase"
  sourceDetail: string
  auth: {
    mode: "fallback" | "signed-out" | "active"
    member: {
      id: string
      committee_id: string
      role: string
      full_name: string
      user_id: string | null
      email: string
      access_level: string
    } | null
  }
  cards: GovernanceCard[]
  documents: DocumentRecord[]
  projects: Project[]
  vendors: VendorRecord[]
  members: Member[]
  activity: AuditEvent[]
  budgetLines: BudgetLine[]
  budgetRecommendation: {
    summary: string
    citations: string[]
    disclaimer: string
  }
}
```

The active Supabase response is assembled only from the current member’s committee and RLS-visible rows. A Supabase query failure currently returns fallback records with `sourceDetail = "Supabase query failed; using local fallback data"`; integrations must display source/mode honestly and must not label fallback records as live.

The current view adapter maps the backend data into `BuildingPlatformData` and also preserves `rawMembers`, `rawProjects`, and `currentMember` for security-sensitive/member/AI surfaces. An incoming frontend may replace the adapter, but it may not narrow or fabricate the backend contract.

## HTTP endpoint contract

Unless noted, successful live mutations return JSON with `mode: "supabase"`; local missing-env behavior returns an explicit `mode: "fallback"` mock response. Unknown dynamic actions/tasks return 404. Validation/data failures return `{ error: string }` and an appropriate 4xx/503 status.

The dynamic endpoint families are `POST /api/workflow/{action}`, `POST /api/finance/{action}`, and `POST /api/ai/{task}`; the table below freezes every supported value.

| Method and path | Authorization | Accepted input | Success contract |
|---|---|---|---|
| `GET /api/app-data` | Optional bearer; active member required for records | None | `StrataAppData`; `Cache-Control: no-store` |
| `POST /api/members/accept` | Authenticated user with email | Empty JSON accepted | Active member DTO and message; activates only a matching invited email/user |
| `POST /api/members/invite` | Active `admin`/`chair`/`secretary` | `email`, `fullName`, optional `role`, `accessLevel` | Member DTO, `inviteEmailSent`, message; rejects active/suspended existing rows |
| `POST /api/members/update` | Active `admin`/`chair`/`secretary` | `memberId`, `fullName`, `role`, `status`, `accessLevel` | Updated member DTO and audited message; lifecycle/self-lockout guards apply |
| `POST /api/documents/create` | Active member | Multipart or JSON: `title`, `documentType`, optional `visibility`, `sourceDate`, `cardId`, `projectId`, `file`, `fileName`, `fileType`, `extractedText` | Document ID and extraction/Markdown status message; storage bucket is `strata-documents` |
| `POST /api/workflow/create-card` | Active member | `title`, `description`, optional `type`, `visibility` | Created/audited card ID |
| `POST /api/workflow/add-message` | Active member | `cardId`, `body` | Created/audited message ID |
| `POST /api/workflow/create-proposal` | Active member | `cardId`, `title`, optional `rationale` | Created/audited proposal ID |
| `POST /api/workflow/cast-vote` | Active member | `proposalId` or `cardId`, optional `vote`, `note` | Created/audited vote ID |
| `POST /api/workflow/add-approval-condition` | Active member | `proposalId` or `cardId`, `condition` | Created/audited condition ID |
| `POST /api/finance/create-vendor` | Active member plus table RLS | `name`; optional contact/license/insurance fields | Created/audited vendor ID |
| `POST /api/finance/create-invoice` | Active member plus table RLS | `invoiceNumber`, `amount`; optional project/card/vendor/document, status, due date | Created/audited invoice ID |
| `POST /api/finance/create-quote-review` | Active member plus table RLS | Optional card/document, risk, inclusion/exclusion/question/condition lists | Created/audited quote-review ID |
| `POST /api/ai/{task}` | Visible context is session/RLS scoped | Optional `cardId`, `documentId`, `projectId`, `question`; verification-only `verificationMarker`, `forceFallback` | Mode/task/model, context, citations, disclaimer, text or structured output, persistence metadata |

Supported AI tasks are exactly `card-brief`, `thread-summary`, `document-qa`, `nsw-law-lookup`, `budget-insights`, `quote-risk`, and `project-status`.

## Role and state acceptance matrix

| Lens | Workspace data | Member management | Hidden records | Expected gate |
|---|---|---|---|---|
| Admin/chair/secretary active | Visible committee data | Enabled, except own role/status/access | RLS-visible privileged records only | Positive auth/member cases |
| Treasurer active | Visible committee data and finance permissions from RLS | Disabled | RLS-visible privileged records only | Negative member-management case |
| Ordinary member active | Visible member-scoped data | Disabled | Admin/custom records absent | Negative invite/edit and hidden-record cases |
| Suspended | Locked | Disabled | All workspace collections absent | Suspended lockout case |
| Uninvited authenticated | Locked | Disabled | All workspace collections absent | Uninvited lockout case |
| Signed out | Locked sign-in surface | Disabled | All workspace collections absent | Signed-out lock case |

## Acceptance suite

Commands are grouped by side effect. Integration work must run the relevant journey row plus the global local-only gates. Browser gates run against Preview only after protected access is available.

| Gate | Command | Side effects / use |
|---|---|---|
| Global syntax/style | `npm run lint` | Local-only |
| Global compile/type | `npm run build` | Local-only |
| Frozen contract | `npm run verify:frontend-contract` | Local-only; validates this document against source |
| Security/RLS source | `npm run verify:security` | Local-only static gate |
| Production readiness | `npm run verify:production-ready` | Live reads and cleanup-controlled checks; use only under approved barrier |
| Fallback build | `npm run verify:fallback-build` | Local-only fallback compile |
| Auth static/live | `npm run verify:auth-flow`; `STRATA_VERIFY_LIVE_AUTH=1 npm run verify:auth-flow` | Static by default; live form is cleanup-controlled and approval-gated |
| Members static/live | `npm run verify:member-management`; `STRATA_VERIFY_LIVE_MEMBERS=1 npm run verify:member-management` | Static by default; live form is cleanup-controlled and approval-gated |
| Base role browser | `STRATA_BROWSER_URL=<preview> npm run verify:auth-browser` | Creates/cleans test Auth/member rows; Preview access required |
| Writable workflow source | `npm run verify:workflow-ui` | Local-only; must inspect the composed UI surface |
| Writable workflow browser | `STRATA_BROWSER_URL=<preview> npm run verify:browser-workflow` | Creates/cleans workflow rows; Preview access required |
| Documents | `npm run verify:documents` | Live cleanup-controlled gate; approved barrier only |
| Documents journey | `npm run verify:documents-ui` | Local-only; validates multipart upload binding, status handling, refresh, and extraction-state presentation |
| AI source/runtime | `npm run verify:ai`; `npm run verify:ai-observability`; `npm run verify:law` | Live cleanup-controlled gates when env is present; approved barrier only |
| AI browser | `STRATA_BROWSER_URL=<preview> npm run verify:ai-browser` | Creates/cleans marked AI outputs; Preview access required |
| Finance patterns | `npm run verify:budget`; `npm run verify:quote-invoice` | Static when prerequisites are absent; may be live with configured env |
| Live dashboard | `npm run verify:live-dashboard` | Live read gate |
| Projects journey | `npm run verify:projects` | Local-only; validates dedicated navigation, complete project evidence, and project-status AI binding |
| Admin journey | `npm run verify:admin` | Local-only; validates role-gated member controls, self-lockout protection, and truthful read-only settings |
| Cross-record search | `npm run verify:search` | Local-only behavior/static gate; hidden/unpersisted negatives and source references required |
| Frontend QA browser | `STRATA_BROWSER_URL=<local-or-preview> npm run verify:frontend-qa-browser` | Signs in with the pre-existing active admin/member accounts and performs only navigation, dialog, accessibility, responsive-layout, and disabled-control checks; it submits no workflow, document, member-management, or AI forms. Normal sign-in performs the idempotent active-member invite-accept check. |

Every journey merge must pass `lint`, `build`, `verify:frontend-contract`, its mapped source/runtime verifier, and the reusable Preview `role-gate`. The final journey fan-in additionally requires browser workflow and AI browser coverage where those surfaces changed.

## Current binding status and inventory handoff

The contract intentionally distinguishes backend-complete behavior from demo-only frontend behavior:

- Bound now: signed-out/login/accept/refresh/sign-out, member invite/update UI, RLS-filtered data hydration, all five authenticated `/api/workflow/{action}` bindings with in-place refresh and card audit history, multipart `/api/documents/create` upload with truthful extraction state, document/project/budget AI tools, and local navigation/search/display.
- Not bound now: no composed UI calls `/api/finance/{action}`; Budget remains a read/AI evidence surface under the current frozen frontend scope.
- `verify:workflow-ui` and `verify:documents-ui` pass their local source contracts. `verify:browser-workflow` remains the Preview proof for the five workflow writes and cleanup, while the live cleanup-controlled `verify:documents` remains the backend storage/RLS proof. A failure must not be “fixed” by deleting assertions or substituting mock-only success.
- `verify:auth-browser` must assert that active/suspended→invited is rejected, then exercise the valid active→suspended transition.
- There is no dedicated Projects navigation view. `fe-inventory` must decide screen placement under decision #4 without changing project data or AI contracts.

## Change protocol

1. Inventory the incoming frontend against this document before editing schema, routes, or verifiers.
2. Record each mismatch as: screen/component, required contract, current implementation, proposed adapter/change, affected gate.
3. Route decision #4 to exactly `replace` or `refactor-into`; do not infer it from the incoming code.
4. Integrate login first. Then isolate dashboard, projects, decisions, documents, and admin journey writers because they share the UI tree.
5. A journey is complete only when its real route binding, error/loading/success states, accessible selectors, refresh behavior, and role negatives pass.
6. Never weaken a backend assertion, RLS rule, hidden-record check, cleanup rule, or disclaimer/citation requirement to accommodate a screen.

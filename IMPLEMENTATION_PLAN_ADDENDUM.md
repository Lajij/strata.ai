# Implementation Plan Addendum: Project Controls and Budget Simulation

## Purpose

This addendum expands the current implementation plan with project-control and budget-planning functionality for large strata remedial works, especially the SP6430 / 33 Malvern Ave concrete cancer and building repair program.

The product goal is to give committee members one evidence-backed place to answer:

- What large projects are active?
- What changed since the last engineer or supplier update?
- What has been approved, invoiced, paid, and forecast to complete?
- Which budget figures are official, estimated, disputed, or stale?
- How do current decisions affect levies, capital works reserves, contingencies, and closing balance?

## Context From Current Emails

The committee is already operating a large remedial works program with recurring updates from NB Consulting Engineers, EBRS, Robinson Strata, and committee members. The current reporting pattern is fragmented across:

- Engineer progress updates and meeting minutes.
- EBRS invoices and payment certificates.
- NB payment spreadsheets.
- Committee emails approving variations and invoices.
- AGM papers and capital works fund forecasts.
- Levy notices and payment-plan discussions.

The strongest budget evidence found so far:

- Capital works forecast for year end 30 June 2026:
  - Opening balance: $653,882
  - Annual levy: $151,040
  - Special levy 1: $550,000
  - Special levy 2: $575,000
  - Funds available: $1,929,922
  - Forecast project expense including contingencies: $1,826,000
  - Forecast other expenses: $30,000
  - GST net position: $52,724
  - Forecast closing balance: $126,646
- July 2026 NB/EBRS payment sheet:
  - Invoices 1306 and 1313: $103,888.13 and $90,161.65
  - Total claimed to date: $1,359,162.89
  - Total remaining: $294,547.35
  - Updated project value including GST: $1,653,710.24
- Committee risk theme:
  - Current spreadsheets do not reliably expose contract sum, cost to complete, confidence, omitted items, payment timing risk, or contractor/security exposure.

## Product Addendum

### 1. Projects Tab: Large Works Control Center

Add a richer project-control view for major works, separate from ordinary cards.

Each project should show:

- Status, owner, suppliers, superintendent/engineer, and key contacts.
- Project phase, progress percentage, next milestone, and blocked items.
- Timeline of engineer/supplier updates, meeting minutes, committee decisions, and owner updates.
- Photos and documents grouped by date, update, location, and supplier.
- Budget rollup:
  - Original budget
  - Approved budget
  - Approved variations
  - Committed amount
  - Invoiced amount
  - Paid amount
  - Forecast cost to complete
  - Forecast final cost
  - Remaining contingency
  - Variance to current plan
- Decision queue:
  - Invoices awaiting review
  - Variations awaiting approval
  - Uncosted scope
  - Items with disputed or low-confidence figures

### 2. Project Budget Lines

Move beyond one allowance per project. Track line-level budget detail for remedial works.

Recommended project line dimensions:

- Project
- Cost category
- Location or unit
- Supplier
- Original budget
- Approved budget
- Committed
- Invoiced
- Paid
- Remaining approved budget
- Forecast remaining
- Forecast final cost
- Confidence level
- Risk status
- Evidence links

Example categories:

- Spalling repairs
- Anodes
- Steel reinforcement
- Access/scaffolding
- Waterproofing
- Balcony doors and thresholds
- Render and paint
- Unit make-good
- Electrical
- Plumbing
- Variations
- Contingency
- GST / tax adjustments

### 3. Budget Tab: Committee Financial View

Add a budget tab that combines official strata accounts, project forecasts, and levy planning.

The tab should show:

- Capital works fund summary.
- Admin fund summary, especially insurance-driven levy pressure.
- Special levy tracking.
- Plan vs actual.
- Current forecast closing balance.
- Contingency consumed and remaining.
- Invoices approved but not paid.
- Known unapproved or uncosted exposure.
- Arrears or payment-plan impact where relevant.
- Data freshness and source confidence.

Every financial number should identify its source:

- Official strata accounts
- AGM forecast
- Engineer spreadsheet
- Invoice
- Payment certificate
- Committee manual estimate
- AI-extracted draft awaiting confirmation

### 4. Budget Simulation

Add a scenario simulator for committee planning. This is not accounting advice; it is a planning tool that helps the committee understand directional impact.

Simulation inputs:

- Opening fund balance.
- Scheduled levy income.
- Special levy amounts and collection dates.
- Known project commitments.
- Forecast remaining project cost.
- Contingency used percentage.
- Unapproved variations.
- Possible extra defects, such as additional slab/spalling scope.
- GST net position.
- Admin fund pressure from insurance or other recurring costs.
- Levy arrears and payment plans.

Simulation outputs:

- Monthly forecast balance.
- Forecast closing balance.
- Minimum cash buffer.
- When the fund goes below a committee-defined threshold.
- Required extra levy to maintain a target closing balance.
- Best/base/worst case comparison.
- Owner-facing explanation of why the scenario changes.

### 5. Evidence-First Ingestion

Add import workflows for emails, PDFs, spreadsheets, and photos.

Suggested flow:

1. User imports or forwards source material.
2. System stores raw source as document/attachment/email evidence.
3. AI or deterministic parser extracts candidate data.
4. User reviews extracted budget lines, invoices, updates, and milestones.
5. Confirmed items become official app records.
6. Audit log records who confirmed each number and when.

No AI-extracted number should become an official project or budget figure without review.

## Backend Addendum

### New Tables

Add these tables in a new migration instead of reshaping the existing core tables aggressively.

#### `project_budget_lines`

Line-level cost plan for a major project.

Suggested fields:

- `id`
- `committee_id`
- `project_id`
- `budget_line_id`
- `budget_allowance_id`
- `vendor_id`
- `code`
- `category`
- `location_label`
- `description`
- `original_budget_amount`
- `approved_budget_amount`
- `committed_amount`
- `invoiced_amount`
- `paid_amount`
- `forecast_remaining_amount`
- `forecast_final_amount`
- `confidence`
- `risk_status`
- `source_status`
- `notes`
- `created_at`
- `updated_at`

#### `project_cost_events`

Append-only ledger of financial changes.

Suggested fields:

- `id`
- `committee_id`
- `project_id`
- `project_budget_line_id`
- `event_type`
- `event_date`
- `amount`
- `gst_amount`
- `description`
- `vendor_id`
- `invoice_id`
- `variation_id`
- `document_id`
- `email_source_id`
- `status`
- `confidence`
- `created_by_member_id`
- `created_at`

Event types should include:

- `original_budget`
- `forecast`
- `variation_submitted`
- `variation_approved`
- `invoice_received`
- `payment_certificate`
- `payment_approved`
- `payment_made`
- `contingency_adjustment`
- `manual_adjustment`

#### `project_updates`

Structured timeline updates from engineers, suppliers, strata managers, and committee members.

Suggested fields:

- `id`
- `committee_id`
- `project_id`
- `source_kind`
- `source_sender`
- `source_date`
- `title`
- `summary`
- `progress_percent`
- `schedule_impact`
- `cost_impact`
- `decisions_needed`
- `blocked_items`
- `next_steps`
- `document_id`
- `email_source_id`
- `created_at`

#### `project_evidence_links`

General source-link table so any project row can cite emails, documents, attachments, or extracted source rows.

Suggested fields:

- `id`
- `committee_id`
- `project_id`
- `target_table`
- `target_id`
- `evidence_type`
- `document_id`
- `attachment_id`
- `email_source_id`
- `source_label`
- `source_excerpt`
- `source_locator`
- `created_at`

#### `fund_forecasts`

Versioned official or draft fund-level forecasts.

Suggested fields:

- `id`
- `committee_id`
- `budget_period_id`
- `name`
- `status`
- `opening_balance`
- `annual_levy_income`
- `special_levy_income`
- `other_income`
- `forecast_project_expenses`
- `forecast_other_expenses`
- `gst_net_position`
- `contingency_amount`
- `forecast_closing_balance`
- `source_document_id`
- `notes`
- `created_by_member_id`
- `created_at`

#### `budget_scenarios`

Interactive simulation assumptions and saved outputs.

Suggested fields:

- `id`
- `committee_id`
- `fund_forecast_id`
- `name`
- `scenario_type`
- `assumptions`
- `projection`
- `created_by_member_id`
- `created_at`

Store `assumptions` and `projection` as JSONB so the simulator can evolve without frequent migrations.

### Views / RPCs

Add deterministic read models:

- `project_financial_summary_v`
- `project_budget_line_summary_v`
- `fund_forecast_summary_v`
- `budget_scenario_projection_v`

Recommended RPCs:

- `recalculate_project_financials(project_id)`
- `recalculate_fund_forecast(fund_forecast_id)`
- `simulate_budget_scenario(fund_forecast_id, assumptions jsonb)`

These should produce committee-facing figures without relying on AI at runtime.

### API Routes

Add routes around product workflows:

- `GET /api/projects/[projectId]/control-summary`
- `POST /api/projects/[projectId]/updates`
- `POST /api/projects/[projectId]/budget-lines`
- `POST /api/projects/[projectId]/cost-events`
- `POST /api/projects/[projectId]/import-source`
- `POST /api/budget/forecasts`
- `POST /api/budget/scenarios`
- `GET /api/budget/scenarios/[scenarioId]`

Keep all writes RLS-protected and audited.

### AI and Import Layer

AI should support extraction and summarisation, but not own the financial truth.

AI tasks to add:

- `project-update-extract`
- `payment-sheet-extract`
- `budget-forecast-extract`
- `cost-risk-summary`
- `scenario-explanation`

Each output should include:

- Extracted fields.
- Confidence.
- Source citations.
- Missing information.
- Suggested review questions.
- Explicit disclaimer that extracted figures require committee verification.

### Permissions

Suggested access rules:

- Committee members can read project controls, budget summaries, and evidence.
- Admin, chair, secretary, and treasurer can create project updates.
- Admin, chair, and treasurer can confirm financial figures.
- AI draft extractions should be visible but clearly marked unconfirmed.
- All confirmation, override, and deletion actions should write to `audit_log`.

## Frontend Addendum For v0

Ask v0 to build against stable JSON contracts rather than directly designing tables.

### Projects Page

Design a project dashboard with:

- Project selector.
- Summary metrics row.
- Timeline/update rail.
- Evidence gallery.
- Budget line table.
- Variation/invoice decision queue.
- Risk and confidence panel.

### Budget Page

Design a committee budget dashboard with:

- Capital works fund summary.
- Admin fund pressure summary.
- Plan-vs-actual chart.
- Forecast closing balance card.
- Contingency tracker.
- Scenario simulator.
- Saved scenarios list.
- Source confidence panel.

### Simulation Interaction

Controls should include:

- Scenario mode segmented control: base, conservative, stress.
- Sliders or numeric inputs for contingency, extra defects, delayed levy collection, and admin fund uplift.
- Timeline chart for forecast balance.
- Clear variance callouts.
- Save scenario and compare scenario actions.

## Implementation Sequence

1. Add database migration for project budget lines, cost events, updates, evidence links, forecasts, and scenarios.
2. Regenerate or update Supabase TypeScript types.
3. Add deterministic summary views/RPCs.
4. Add backend API routes for project controls and budget scenarios.
5. Add import/extraction draft tables or metadata for unconfirmed AI-parsed values.
6. Seed SP6430 sample records from the known capital works forecast and NB payment sheet.
7. Extend app data mapping to include project control summaries and fund forecasts.
8. Provide v0 with JSON contracts for the new Projects and Budget screens.
9. Add verification scripts for:
   - RLS on all new tables.
   - Project summary calculations.
   - Scenario calculation consistency.
   - AI draft extraction never becoming official without confirmation.
10. Wire the frontend once the backend contract is stable.

## Acceptance Criteria

- A committee member can open one project and see current plan, spend, forecast, timeline updates, decisions, photos, and evidence.
- A treasurer can reconcile an invoice or variation to a project budget line.
- A payment spreadsheet can be imported as draft evidence and reviewed before confirmation.
- A budget forecast can be saved from official/committee figures.
- A scenario can show how project overruns or levy timing change the forecast closing balance.
- Every displayed financial figure has a source, confidence status, and last-updated timestamp.
- RLS prevents non-members from seeing project or budget data.
- Ordinary members can read visible project/budget data but cannot confirm official financial figures unless their role permits it.
- All AI budget/project outputs cite visible source records and remain non-binding.

## Product Principle

Every dollar in the app should answer: what is it, where did it come from, who confirmed it, and what happens if it changes?

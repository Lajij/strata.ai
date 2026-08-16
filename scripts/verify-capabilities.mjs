import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { hasMemberCapability } from "../src/lib/member-capabilities.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608160001_capability_and_attribution_hardening.sql"),
  "utf8",
);
const authorization = readFileSync(join(root, "src/lib/member-authorization.ts"), "utf8");
const workflow = readFileSync(join(root, "src/app/api/workflow/[action]/route.ts"), "utf8");
const finance = readFileSync(join(root, "src/app/api/finance/[action]/route.ts"), "utf8");
const documents = readFileSync(join(root, "src/app/api/documents/create/route.ts"), "utf8");
const ai = readFileSync(join(root, "src/app/api/ai/[task]/route.ts"), "utf8");

const admin = { role: "admin", status: "active", accessLevel: "admin" };
const financialConfirmer = { role: "treasurer", status: "active", accessLevel: "limited_admin" };
const member = { role: "member", status: "active", accessLevel: "member" };
const readOnly = { role: "treasurer", status: "active", accessLevel: "read_only" };
const suspended = { role: "admin", status: "suspended", accessLevel: "admin" };
const outsider = { role: "member", status: "outsider", accessLevel: "member" };

assert.equal(hasMemberCapability(admin, "manage_members"), true);
assert.equal(hasMemberCapability(admin, "manage_finance"), true);
assert.equal(hasMemberCapability(financialConfirmer, "confirm_financial_figures"), true);
assert.equal(hasMemberCapability(financialConfirmer, "manage_members"), false);
assert.equal(hasMemberCapability(member, "write_records"), true);
assert.equal(hasMemberCapability(member, "manage_finance"), false);
assert.equal(hasMemberCapability(readOnly, "read_committee"), true);
assert.equal(hasMemberCapability(readOnly, "write_records"), false);
assert.equal(hasMemberCapability(readOnly, "confirm_financial_figures"), false);
assert.equal(hasMemberCapability(suspended, "read_committee"), false);
assert.equal(hasMemberCapability(outsider, "read_committee"), false);

assert.match(authorization, /hasMemberCapability/);
assert.match(workflow, /canWriteRecords\(member\.role, member\.access_level\)/);
assert.match(documents, /canWriteRecords\(member\.role, member\.access_level\)/);
assert.match(ai, /canWriteRecords\(member\.role, member\.access_level\)/);
assert.match(finance, /canManageFinance\(member\.role, member\.access_level\)/);
assert.match(migration, /create or replace function app_private\.has_capability/);
assert.match(migration, /member\.access_level <> 'read_only'/);
assert.match(migration, /requested_capability = 'manage_members'/);
assert.match(migration, /requested_capability in \('manage_finance', 'confirm_financial_figures'\)/);
assert.match(migration, /capability creates attributed messages/);
assert.match(migration, /finance capability manages invoices/);
assert.match(migration, /members read visible incident evidence/);
assert.match(migration, /members read visible linked ai outputs/);
assert.match(migration, /new\.user_id := request_user_id/);
assert.match(migration, /new\.created_at := statement_timestamp\(\)/);
assert.match(migration, /enforce_invoice_confirmation_capability/);
assert.doesNotMatch(migration, /create policy [^\n]*delete[^\n]*members/i);

console.log("Behavioural capability matrix passed (admin, financial confirmer, member, read-only, suspended, outsider; 11 cases). ");
console.log("Static capability/RLS/route wiring passed (attribution, parent visibility, finance confirmation, member-delete denial). ");

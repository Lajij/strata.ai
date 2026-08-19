import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = process.cwd();
const tempDirectory = mkdtempSync(join(tmpdir(), "strata-capability-rls-"));
const databaseDirectory = join(tempDirectory, "data");
const logPath = join(tempDirectory, "postgres.log");
const migrationsDirectory = join(root, "supabase/migrations");
const COMMITTEE_A = "aaaaaaaa-aaaa-4000-8000-000000000001";
const COMMITTEE_B = "bbbbbbbb-bbbb-4000-8000-000000000001";
const ADMIN_USER = "aaaaaaaa-0000-4000-8000-000000000001";
const TREASURER_USER = "aaaaaaaa-0000-4000-8000-000000000002";
const MEMBER_USER = "aaaaaaaa-0000-4000-8000-000000000003";
const READ_ONLY_USER = "aaaaaaaa-0000-4000-8000-000000000004";
const SUSPENDED_USER = "aaaaaaaa-0000-4000-8000-000000000005";
const OUTSIDER_USER = "aaaaaaaa-0000-4000-8000-000000000006";
const CROSS_USER = "aaaaaaaa-0000-4000-8000-000000000007";
const ADMIN_MEMBER = "bbbbbbbb-0000-4000-8000-000000000001";
const TREASURER_MEMBER = "bbbbbbbb-0000-4000-8000-000000000002";
const MEMBER_MEMBER = "bbbbbbbb-0000-4000-8000-000000000003";
const READ_ONLY_MEMBER = "bbbbbbbb-0000-4000-8000-000000000004";
const PUBLIC_CARD = "cccccccc-0000-4000-8000-000000000001";
const HIDDEN_INCIDENT = "dddddddd-0000-4000-8000-000000000001";
const MOTION_ONE = "cccccccc-0000-4000-8000-000000000010";
const MOTION_TWO = "cccccccc-0000-4000-8000-000000000011";
const MOTION_AUDIT = "cccccccc-0000-4000-8000-000000000012";
let started = false;

function run(command, args, { allowFailure = false, input } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", input });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolvePort(address.port);
        else reject(new Error("Could not allocate a local Postgres port"));
      });
    });
  });
}

try {
  const port = await freePort();
  run("initdb", ["--auth=trust", "--username=postgres", "--no-locale", "--encoding=UTF8", "-D", databaseDirectory]);
  run("pg_ctl", ["-D", databaseDirectory, "-l", logPath, "-o", `-F -p ${port} -k ${tempDirectory}`, "-w", "start"]);
  started = true;
  const connection = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const psql = (sql, options) => run("psql", [connection, "-v", "ON_ERROR_STOP=1", "-Atq"], { ...options, input: sql });

  psql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id bigint generated always as identity primary key,
      bucket_id text not null,
      name text not null
    );
    alter table storage.objects enable row level security;
    create function storage.foldername(object_name text) returns text[]
      language sql immutable as $$ select string_to_array(object_name, '/') $$;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated, service_role;
  `);

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    let source = readFileSync(join(migrationsDirectory, file), "utf8");
    if (file === "202606250001_initial_strata_governance.sql") {
      source = source
        .replace('create extension if not exists "vector";', "-- vector extension substituted by portable verifier")
        .replaceAll("vector(1536)", "text");
    }
    psql(source);
  }

  psql(`
    insert into auth.users (id, email) values
      ('${ADMIN_USER}', 'admin@example.invalid'),
      ('${TREASURER_USER}', 'treasurer@example.invalid'),
      ('${MEMBER_USER}', 'member@example.invalid'),
      ('${READ_ONLY_USER}', 'readonly@example.invalid'),
      ('${SUSPENDED_USER}', 'suspended@example.invalid'),
      ('${OUTSIDER_USER}', 'outsider@example.invalid'),
      ('${CROSS_USER}', 'cross@example.invalid');
    insert into public.committees (id, name, jurisdiction) values
      ('${COMMITTEE_A}', 'Capability Committee A', 'NSW Australia'),
      ('${COMMITTEE_B}', 'Capability Committee B', 'NSW Australia');
    insert into public.members (id, committee_id, user_id, email, full_name, role, status, access_level) values
      ('${ADMIN_MEMBER}', '${COMMITTEE_A}', '${ADMIN_USER}', 'admin@example.invalid', 'Admin', 'admin', 'active', 'admin'),
      ('${TREASURER_MEMBER}', '${COMMITTEE_A}', '${TREASURER_USER}', 'treasurer@example.invalid', 'Treasurer', 'treasurer', 'active', 'limited_admin'),
      ('${MEMBER_MEMBER}', '${COMMITTEE_A}', '${MEMBER_USER}', 'member@example.invalid', 'Member', 'member', 'active', 'member'),
      ('${READ_ONLY_MEMBER}', '${COMMITTEE_A}', '${READ_ONLY_USER}', 'readonly@example.invalid', 'Read only', 'treasurer', 'active', 'read_only'),
      ('bbbbbbbb-0000-4000-8000-000000000005', '${COMMITTEE_A}', '${SUSPENDED_USER}', 'suspended@example.invalid', 'Suspended', 'admin', 'suspended', 'admin'),
      ('bbbbbbbb-0000-4000-8000-000000000007', '${COMMITTEE_B}', '${CROSS_USER}', 'cross@example.invalid', 'Cross', 'admin', 'active', 'admin');
    insert into public.cards (id, committee_id, title, description, visibility, creator_member_id)
      values ('${PUBLIC_CARD}', '${COMMITTEE_A}', 'Public card', 'Visible', 'all', '${ADMIN_MEMBER}');
    insert into public.incidents (id, committee_id, title, visibility, created_by_member_id)
      values ('${HIDDEN_INCIDENT}', '${COMMITTEE_A}', 'Hidden incident', 'admins', '${ADMIN_MEMBER}');
    insert into public.incident_evidence (id, committee_id, incident_id, evidence_type, description)
      values ('eeeeeeee-0000-4000-8000-000000000001', '${COMMITTEE_A}', '${HIDDEN_INCIDENT}', 'note', 'Hidden evidence');
    insert into public.ai_outputs (id, committee_id, incident_id, output_type, output, created_by_member_id)
      values ('ffffffff-0000-4000-8000-000000000001', '${COMMITTEE_A}', '${HIDDEN_INCIDENT}', 'incident-summary', '{}', '${ADMIN_MEMBER}');
  `);

  const asUser = (userId, sql, options) => psql(`
    begin;
    set local role authenticated;
    set local "request.jwt.claim.sub" = '${userId}';
    ${sql}
    commit;
  `, options);

  assert.equal(asUser(ADMIN_USER, `select app_private.has_capability('${COMMITTEE_A}', 'manage_members')::int;`).stdout.trim(), "1");
  assert.equal(asUser(TREASURER_USER, `select app_private.has_capability('${COMMITTEE_A}', 'manage_finance')::int;`).stdout.trim(), "1");
  assert.equal(asUser(MEMBER_USER, `select app_private.has_capability('${COMMITTEE_A}', 'manage_finance')::int;`).stdout.trim(), "0");
  assert.equal(asUser(READ_ONLY_USER, `select app_private.has_capability('${COMMITTEE_A}', 'write_records')::int;`).stdout.trim(), "0");
  assert.equal(asUser(SUSPENDED_USER, "select count(*) from public.committees;").stdout.trim(), "0");
  assert.equal(asUser(OUTSIDER_USER, "select count(*) from public.committees;").stdout.trim(), "0");

  const readOnlyWrite = asUser(READ_ONLY_USER, `
    insert into public.cards (committee_id, title, description, creator_member_id)
    values ('${COMMITTEE_A}', 'Blocked read only', 'Blocked', '${READ_ONLY_MEMBER}');
  `, { allowFailure: true });
  assert.notEqual(readOnlyWrite.status, 0);
  assert.match(readOnlyWrite.stderr, /row-level security policy/);

  asUser(MEMBER_USER, `
    insert into public.cards (id, committee_id, title, description, creator_member_id)
    values ('cccccccc-0000-4000-8000-000000000002', '${COMMITTEE_A}', 'Member card', 'Allowed', '${MEMBER_MEMBER}');
  `);
  const forgedAttribution = asUser(MEMBER_USER, `
    insert into public.cards (committee_id, title, description, creator_member_id)
    values ('${COMMITTEE_A}', 'Forged creator', 'Blocked', '${ADMIN_MEMBER}');
  `, { allowFailure: true });
  assert.notEqual(forgedAttribution.status, 0);

  const crossCommitteeWrite = asUser(CROSS_USER, `
    insert into public.cards (committee_id, title, description, creator_member_id)
    values ('${COMMITTEE_A}', 'Cross committee', 'Blocked', 'bbbbbbbb-0000-4000-8000-000000000007');
  `, { allowFailure: true });
  assert.notEqual(crossCommitteeWrite.status, 0);

  asUser(TREASURER_USER, `
    insert into public.invoices (id, committee_id, invoice_number, amount)
    values ('12121212-0000-4000-8000-000000000001', '${COMMITTEE_A}', 'FIN-1', 100);
  `);
  const memberFinance = asUser(MEMBER_USER, `
    insert into public.invoices (committee_id, invoice_number, amount)
    values ('${COMMITTEE_A}', 'BLOCKED', 100);
  `, { allowFailure: true });
  assert.notEqual(memberFinance.status, 0);
  const readOnlyFinance = asUser(READ_ONLY_USER, `
    insert into public.invoices (committee_id, invoice_number, amount)
    values ('${COMMITTEE_A}', 'READONLY-BLOCKED', 100);
  `, { allowFailure: true });
  assert.notEqual(readOnlyFinance.status, 0);

  asUser(MEMBER_USER, `
    insert into public.audit_log (id, committee_id, card_id, user_id, action, target, created_at)
    values ('13131313-0000-4000-8000-000000000001', '${COMMITTEE_A}', '${PUBLIC_CARD}', '${ADMIN_USER}', 'Attempted spoof', 'audit', '2000-01-01');
  `);
  const pinnedAudit = psql(`
    select user_id::text || '|' || (created_at > now() - interval '5 minutes')::text
    from public.audit_log where id = '13131313-0000-4000-8000-000000000001';
  `).stdout.trim();
  assert.equal(pinnedAudit, `${MEMBER_USER}|true`);

  assert.equal(asUser(MEMBER_USER, "select count(*) from public.incident_evidence;").stdout.trim(), "0");
  assert.equal(asUser(ADMIN_USER, "select count(*) from public.incident_evidence;").stdout.trim(), "1");
  assert.equal(asUser(MEMBER_USER, "select count(*) from public.ai_outputs;").stdout.trim(), "0");
  assert.equal(asUser(ADMIN_USER, "select count(*) from public.ai_outputs;").stdout.trim(), "1");

  const memberDelete = asUser(ADMIN_USER, `delete from public.members where id = '${MEMBER_MEMBER}';`, { allowFailure: true });
  assert.equal(memberDelete.status, 0);
  assert.equal(
    psql(`select count(*) from public.members where id = '${MEMBER_MEMBER}';`).stdout.trim(),
    "1",
  );

  // Issue #39: motion lifecycle draft -> open -> decided | withdrawn.
  // An eligible member creates a draft motion; the guard_motion trigger forces
  // draft on insert and the INSERT policy pins attribution to the caller.
  asUser(MEMBER_USER, `
    insert into public.motions (id, committee_id, title, context, creator_member_id)
    values ('${MOTION_ONE}', '${COMMITTEE_A}', 'Capability motion one', 'Draft lifecycle motion', '${MEMBER_MEMBER}');
  `);
  assert.equal(
    asUser(MEMBER_USER, `select status from public.motions where id = '${MOTION_ONE}';`).stdout.trim(),
    "draft",
  );

  // Only the three legal transitions are permitted and they stamp timestamps.
  asUser(MEMBER_USER, `update public.motions set status = 'open' where id = '${MOTION_ONE}';`);
  asUser(MEMBER_USER, `update public.motions set status = 'decided' where id = '${MOTION_ONE}';`);
  const decidedMotion = asUser(
    MEMBER_USER,
    `select status || '|' || (opened_at is not null)::text || '|' || (decided_at is not null)::text from public.motions where id = '${MOTION_ONE}';`,
  ).stdout.trim();
  assert.equal(decidedMotion, "decided|true|true");

  // Terminal motions are immutable: any UPDATE of a decided motion raises.
  const decidedEdit = asUser(
    MEMBER_USER,
    `update public.motions set status = 'withdrawn' where id = '${MOTION_ONE}';`,
    { allowFailure: true },
  );
  assert.notEqual(decidedEdit.status, 0);
  assert.match(decidedEdit.stderr, /cannot be edited/);

  // Illegal transitions (draft -> decided) are rejected by the trigger.
  asUser(MEMBER_USER, `
    insert into public.motions (id, committee_id, title, context, creator_member_id)
    values ('${MOTION_TWO}', '${COMMITTEE_A}', 'Capability motion two', 'Illegal transition probe', '${MEMBER_MEMBER}');
  `);
  const illegalTransition = asUser(
    MEMBER_USER,
    `update public.motions set status = 'decided' where id = '${MOTION_TWO}';`,
    { allowFailure: true },
  );
  assert.notEqual(illegalTransition.status, 0);
  assert.match(illegalTransition.stderr, /Illegal motion state transition/);

  // Cross-committee isolation: a Committee B member cannot read Committee A motions.
  assert.equal(
    asUser(CROSS_USER, `select count(*) from public.motions where id = '${MOTION_ONE}';`).stdout.trim(),
    "0",
  );

  // read_only members cannot create or advance motions. INSERT is denied by the
  // RLS policy (raises); UPDATE is a silent no-op (status unchanged).
  const readOnlyMotionInsert = asUser(READ_ONLY_USER, `
    insert into public.motions (id, committee_id, title, context, creator_member_id)
    values ('${MOTION_ONE}', '${COMMITTEE_A}', 'Read only motion', 'Blocked', '${READ_ONLY_MEMBER}');
  `, { allowFailure: true });
  assert.notEqual(readOnlyMotionInsert.status, 0);
  assert.match(readOnlyMotionInsert.stderr, /row-level security policy/);
  const readOnlyAdvance = asUser(
    READ_ONLY_USER,
    `update public.motions set status = 'withdrawn' where id = '${MOTION_ONE}';`,
  );
  assert.equal(readOnlyAdvance.status, 0);
  assert.equal(
    asUser(MEMBER_USER, `select status from public.motions where id = '${MOTION_ONE}';`).stdout.trim(),
    "decided",
  );

  // Motion audit rows ride the existing card_id-is-null audit_log branch: the
  // additive motion_id column is stored and admitted with no policy change.
  asUser(MEMBER_USER, `
    insert into public.audit_log (id, committee_id, card_id, motion_id, user_id, action, target)
    values ('${MOTION_AUDIT}', '${COMMITTEE_A}', null, '${MOTION_ONE}', '${MEMBER_USER}', 'Advanced motion', 'draft->open');
  `);
  assert.equal(
    psql(`select motion_id::text from public.audit_log where id = '${MOTION_AUDIT}';`).stdout.trim(),
    MOTION_ONE,
  );

  // No DELETE policy (and no DELETE grant) => fail-closed: the motion survives.
  asUser(MEMBER_USER, `delete from public.motions where id = '${MOTION_ONE}';`, { allowFailure: true });
  assert.equal(
    psql(`select count(*) from public.motions where id = '${MOTION_ONE}';`).stdout.trim(),
    "1",
  );

  console.log("Portable Postgres RLS capability verification passed (six personas, cross-committee, attribution, finance, parent visibility, member-delete denial, motion lifecycle). ");
  console.log("This substitutes only the unavailable vector column type; exact Supabase replay remains a separate gate.");
} finally {
  if (started) {
    run("pg_ctl", ["-D", databaseDirectory, "-m", "fast", "-w", "stop"], { allowFailure: true });
  }
  rmSync(tempDirectory, { recursive: true, force: true });
}

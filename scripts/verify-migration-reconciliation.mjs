import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const tempDirectory = mkdtempSync(join(tmpdir(), "strata-migration-reconcile-"));
const databaseDirectory = join(tempDirectory, "data");
const logPath = join(tempDirectory, "postgres.log");
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260815220003_reconcile_legacy_embedded_fixtures.sql",
);
let started = false;

function run(command, args, { allowFailure = false, input } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
  });

  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
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
        if (address && typeof address === "object") {
          resolvePort(address.port);
        } else {
          reject(new Error("Could not allocate a local Postgres port"));
        }
      });
    });
  });
}

try {
  const port = await freePort();
  run("initdb", [
    "--auth=trust",
    "--username=postgres",
    "--no-locale",
    "--encoding=UTF8",
    "-D",
    databaseDirectory,
  ]);
  run("pg_ctl", [
    "-D",
    databaseDirectory,
    "-l",
    logPath,
    "-o",
    `-F -p ${port} -k ${tempDirectory}`,
    "-w",
    "start",
  ]);
  started = true;

  const connection = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const psql = (sql, options) =>
    run("psql", [connection, "-v", "ON_ERROR_STOP=1", "-Atq"], {
      ...options,
      input: sql,
    });

  psql(`
    create table public.committees (
      id uuid primary key,
      name text not null,
      strata_plan text,
      jurisdiction text,
      address text
    );
    create table public.members (
      id uuid primary key,
      committee_id uuid not null references public.committees(id)
    );
    create table public.legislation_sources (
      id uuid primary key,
      source text not null,
      title text not null,
      url text not null,
      version_label text
    );
    create table public.legislation_chunks (
      id bigint generated always as identity primary key,
      legislation_source_id uuid references public.legislation_sources(id),
      source text not null,
      section text not null,
      topic_tags text[] not null default '{}',
      body text not null
    );
    insert into public.committees values (
      '11111111-1111-1111-1111-111111111111',
      'SP 6430 - 33 Malvern Avenue',
      'SP 6430',
      'NSW Australia',
      '33 Malvern Avenue, Manly NSW 2095'
    );
    insert into public.legislation_sources values
      ('22222222-2222-2222-2222-222222222221', 'legislation.nsw.gov.au', 'Strata Schemes Management Act 2015 No 50', 'https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050', 'current'),
      ('22222222-2222-2222-2222-222222222222', 'legislation.nsw.gov.au', 'Strata Schemes Management Regulation 2016', 'https://legislation.nsw.gov.au/view/html/inforce/current/sl-2016-0501', 'current'),
      ('22222222-2222-2222-2222-222222222223', 'nsw.gov.au', 'NSW Government strata guidance', 'https://www.nsw.gov.au/housing-and-construction/strata', 'last checked 2026-06-25');
    insert into public.legislation_chunks (legislation_source_id, source, section, topic_tags, body) values
      ('22222222-2222-2222-2222-222222222221', 'Strata Schemes Management Act 2015', 'Owners corporation duties', array['maintenance', 'common property'], 'Placeholder chunk for owners corporation duties. Replace with curated current legislation text during ingestion.'),
      ('22222222-2222-2222-2222-222222222221', 'Strata Schemes Management Act 2015', 'Levy interest and payment plans', array['levies', 'arrears'], 'Placeholder chunk for levy interest and payment-plan decisions. Replace with curated current legislation text during ingestion.'),
      ('22222222-2222-2222-2222-222222222222', 'Strata Schemes Management Regulation 2016', 'Meetings and records', array['meetings', 'minutes'], 'Placeholder chunk for meeting procedure and records. Replace with curated current regulation text during ingestion.');
  `);

  psql(readFileSync(migrationPath, "utf8"));
  const cleanCounts = psql(`
    select
      (select count(*) from public.committees),
      (select count(*) from public.legislation_sources),
      (select count(*) from public.legislation_chunks);
  `).stdout.trim();
  assert.equal(cleanCounts, "0|0|0");

  psql(`
    insert into public.committees values (
      '11111111-1111-1111-1111-111111111111',
      'SP 6430 - 33 Malvern Avenue',
      'SP 6430',
      'VIC Australia',
      '33 Malvern Avenue, Manly NSW 2095'
    );
    insert into public.legislation_sources values
      ('22222222-2222-2222-2222-222222222221', 'legislation.nsw.gov.au', 'Human-curated replacement title', 'https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050', 'current'),
      ('22222222-2222-2222-2222-222222222222', 'legislation.nsw.gov.au', 'Strata Schemes Management Regulation 2016', 'https://legislation.nsw.gov.au/view/html/inforce/current/sl-2016-0501', 'current');
    insert into public.legislation_chunks (legislation_source_id, source, section, topic_tags, body) values (
      '22222222-2222-2222-2222-222222222222',
      'Strata Schemes Management Regulation 2016',
      'Curated meetings commentary',
      array['meetings'],
      'A human-curated non-placeholder row that must survive reconciliation.'
    );
  `);
  psql(readFileSync(migrationPath, "utf8"));
  const curatedCounts = psql(`
    select
      (select count(*) from public.committees),
      (select count(*) from public.legislation_sources),
      (select count(*) from public.legislation_chunks);
  `).stdout.trim();
  assert.equal(curatedCounts, "1|2|1");

  psql(`
    delete from public.legislation_chunks;
    delete from public.legislation_sources;
    delete from public.committees;
    insert into public.committees values (
      '11111111-1111-1111-1111-111111111111',
      'SP 6430 - 33 Malvern Avenue',
      'SP 6430',
      'NSW Australia',
      '33 Malvern Avenue, Manly NSW 2095'
    );
    insert into public.members values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      '11111111-1111-1111-1111-111111111111'
    );
  `);
  const blocked = psql(readFileSync(migrationPath, "utf8"), { allowFailure: true });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Legacy SP 6430 row has dependent data in public\.members/);
  const preservedCounts = psql(`
    select
      (select count(*) from public.committees),
      (select count(*) from public.members);
  `).stdout.trim();
  assert.equal(preservedCounts, "1|1");

  console.log(
    "Behavioural reconciliation migration passed (exact fixture removed; altered metadata and dependent workspaces preserved).",
  );
} finally {
  if (started) {
    run("pg_ctl", ["-D", databaseDirectory, "-m", "fast", "-w", "stop"], {
      allowFailure: true,
    });
  }
  rmSync(tempDirectory, { recursive: true, force: true });
}

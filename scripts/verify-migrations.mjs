import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const migrationsDirectory = join(root, "supabase/migrations");
const migrationPattern = /^(\d{12,14})_[a-z0-9_]+\.sql$/;

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const manifest = JSON.parse(
  readFileSync(join(root, "supabase/migrations.sha256.json"), "utf8"),
);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const config = readFileSync(join(root, "supabase/config.toml"), "utf8");

assert.equal(packageJson.devDependencies?.supabase, "2.111.0", "Supabase CLI must be pinned exactly");
assert.equal(packageLock.packages?.[""]?.devDependencies?.supabase, "2.111.0");
assert.equal(packageLock.packages?.["node_modules/supabase"]?.version, "2.111.0");
assert.equal(
  JSON.parse(readFileSync(join(root, "node_modules/supabase/package.json"), "utf8")).version,
  "2.111.0",
);
assert.match(config, /^project_id = "strata\.ai"$/m);
assert.match(config, /^port = 54322$/m);
assert.match(config, /^major_version = 17$/m);
assert.match(config, /\[db\.migrations\][\s\S]*?^enabled = true$/m);
assert.match(config, /\[db\.seed\][\s\S]*?^enabled = true[\s\S]*?^sql_paths = \["\.\/seed\.sql"\]$/m);

assert.ok(migrationFiles.length > 0, "No canonical migrations were found");
assert.deepEqual(
  Object.keys(manifest),
  migrationFiles,
  "Migration checksum manifest must exactly match the canonical ordered file set",
);

const versions = new Set();
const historicalInitialMigration = "202606250001_initial_strata_governance.sql";
const reconciliationMigration = "20260815220003_reconcile_legacy_embedded_fixtures.sql";
const capabilityMigration = "202608160001_capability_and_attribution_hardening.sql";
const forbiddenFixtureMarkers = [
  "SP 6430",
  "33 Malvern",
  "Placeholder chunk",
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222221",
];

for (const file of migrationFiles) {
  const match = file.match(migrationPattern);
  assert.ok(match, `Invalid canonical migration filename: ${file}`);
  assert.ok(!versions.has(match[1]), `Duplicate migration version: ${match[1]}`);
  versions.add(match[1]);

  const source = readFileSync(join(migrationsDirectory, file), "utf8");
  const digest = createHash("sha256").update(source).digest("hex");
  assert.equal(digest, manifest[file], `Checksum mismatch for ${file}`);

  if (file !== historicalInitialMigration && file !== reconciliationMigration) {
    for (const marker of forbiddenFixtureMarkers) {
      assert.ok(!source.includes(marker), `${file} contains fixture marker: ${marker}`);
    }
  }
}

assert.equal(
  manifest[historicalInitialMigration],
  "ae484431bc4d3c8db2233185fbcc50eb7390bceb1fad22333cccc58680403e80",
  "The published alpha migration must remain byte-for-byte unchanged",
);
const reconciliation = readFileSync(join(migrationsDirectory, reconciliationMigration), "utf8");
assert.match(reconciliation, /has_dependent_rows/);
assert.match(reconciliation, /raise exception/);
assert.match(reconciliation, /real-building human gate/);
assert.match(reconciliation, /delete from public\.committees/);
assert.match(reconciliation, /delete from public\.legislation_chunks/);
assert.match(reconciliation, /delete from public\.legislation_sources/);
const capability = readFileSync(join(migrationsDirectory, capabilityMigration), "utf8");
assert.match(capability, /app_private\.has_capability/);
assert.match(capability, /access_level <> 'read_only'/);
assert.match(capability, /enforce_audit_identity/);
assert.match(capability, /enforce_invoice_confirmation_capability/);
assert.match(capability, /members read visible incident evidence/);
assert.match(capability, /members read visible linked ai outputs/);

const seedPath = join(root, "supabase/seed.sql");
assert.ok(existsSync(seedPath), "Missing explicit Supabase development/test seed file");
const seed = readFileSync(seedPath, "utf8");
assert.match(seed, /Synthetic development\/test seed only/);
assert.match(seed, /Synthetic Strata Test Committee/);
assert.match(seed, /Never include this file in a Production push/);
assert.doesNotMatch(seed, /SP 6430|33 Malvern|Placeholder chunk/i);
assert.match(seed, /77e87242-362d-4de6-a444-7174616a70b5/);

const guardedSeed = readFileSync(join(root, "scripts/seed-live-workspace.mjs"), "utf8");
const fixtureIdentifiers = readFileSync(join(root, "scripts/fixture-identifiers.mjs"), "utf8");
assert.match(guardedSeed, /assertSafeMutationTarget/);
assert.match(guardedSeed, /fixture_namespace/);
assert.match(guardedSeed, /existing\.app_metadata\?\.fixture_namespace/);
assert.doesNotMatch(guardedSeed, /existing\.user_metadata\?\.fixture_namespace/);
assert.match(guardedSeed, /mutationTarget\.targetEnvironment === "staging"/);
assert.match(guardedSeed, /Refusing to overwrite non-fixture Auth user/);
assert.match(guardedSeed, /assertFixtureCommitteeNamespace/);
assert.match(guardedSeed, /Remote staging fixtures require explicit \.invalid emails and non-default/);
assert.match(guardedSeed, /Synthetic Strata Test Committee/);
assert.doesNotMatch(guardedSeed, /SP 6430|33 Malvern/);
assert.match(fixtureIdentifiers, /strata-synthetic-v2/);
assert.match(fixtureIdentifiers, /77e87242-362d-4de6-a444-7174616a70b5/);
assert.doesNotMatch(fixtureIdentifiers, /11111111-1111-1111-1111-111111111111/);

const replay = readFileSync(join(root, "scripts/verify-migrations-replay.mjs"), "utf8");
assert.match(replay, /node_modules\/\.bin\/supabase/);
assert.doesNotMatch(replay, /PATH/);
assert.match(replay, /Expected Supabase CLI 2\.111\.0/);
assert.match(replay, /DOCKER_HOST and DOCKER_CONTEXT overrides are forbidden/);
assert.match(replay, /Local migration ledger does not match the manifest/);
assert.match(replay, /fixture tables empty/);

const safePush = readFileSync(join(root, "scripts/safe-supabase-push.mjs"), "utf8");
assert.match(safePush, /Seed inclusion is forbidden/);
assert.match(safePush, /Distinct staging and Production Supabase project refs are required/);
assert.match(safePush, /action-time GO token/);
assert.match(safePush, /verify-migrations\.mjs/);
assert.match(packageJson.scripts?.["supabase:push:dry-run"] ?? "", /safe-supabase-push/);
assert.match(packageJson.scripts?.["supabase:push:schema"] ?? "", /safe-supabase-push/);

const rejectedSeedPush = spawnSync(
  process.execPath,
  [join(root, "scripts/safe-supabase-push.mjs"), "--include-seed"],
  { encoding: "utf8", env: {} },
);
assert.notEqual(rejectedSeedPush.status, 0);
assert.match(rejectedSeedPush.stderr, /Seed inclusion is forbidden/);

console.log(
  `Static migration integrity passed (${migrationFiles.length} historical/current checksums; forward fixture reconciliation; pinned local replay/push policy).`,
);
console.log("Behavioural schema-push policy passed (seed inclusion rejected before environment or network access). ");

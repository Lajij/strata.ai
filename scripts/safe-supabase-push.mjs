import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const environment = process.env.STRATA_ENVIRONMENT;
const dryRun = args.includes("--dry-run");
const forbiddenSeedFlag = args.some(
  (argument) => argument === "--include-seed" || argument.startsWith("--include-seed="),
);

if (forbiddenSeedFlag) {
  throw new Error("Seed inclusion is forbidden by the Strata schema-push wrapper.");
}

if (args.some((argument) => argument !== "--dry-run")) {
  throw new Error("Only the optional --dry-run argument is supported.");
}

if (environment !== "staging" && environment !== "production") {
  throw new Error("Schema push requires STRATA_ENVIRONMENT=staging or production.");
}

if (process.env.STRATA_ALLOW_SCHEMA_PUSH !== "1") {
  throw new Error("Schema push requires STRATA_ALLOW_SCHEMA_PUSH=1.");
}

if (!dryRun) {
  const approval = environment === "production"
    ? process.env.STRATA_PRODUCTION_MIGRATION_GO
    : process.env.STRATA_STAGING_MIGRATION_GO;

  if (approval !== "GO") {
    throw new Error(`Applying ${environment} migrations requires its action-time GO token.`);
  }
}

const integrity = spawnSync(
  process.execPath,
  [join(process.cwd(), "scripts/verify-migrations.mjs")],
  { stdio: "inherit", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" } },
);

if (integrity.status !== 0) {
  throw new Error("Migration integrity verification failed before schema push.");
}

const expectedRef = environment === "production"
  ? process.env.STRATA_PRODUCTION_SUPABASE_PROJECT_REF
  : process.env.STRATA_STAGING_SUPABASE_PROJECT_REF;
const otherRef = environment === "production"
  ? process.env.STRATA_STAGING_SUPABASE_PROJECT_REF
  : process.env.STRATA_PRODUCTION_SUPABASE_PROJECT_REF;
const linkedRefPath = join(process.cwd(), "supabase/.temp/project-ref");

if (!expectedRef || !otherRef || expectedRef === otherRef) {
  throw new Error("Distinct staging and Production Supabase project refs are required.");
}

if (!existsSync(linkedRefPath)) {
  throw new Error("No linked Supabase project ref is available.");
}

const linkedRef = readFileSync(linkedRefPath, "utf8").trim();
assert.equal(linkedRef, expectedRef, `Linked project does not match ${environment}`);

const cli = join(process.cwd(), "node_modules/.bin/supabase");
if (!existsSync(cli)) {
  throw new Error("Pinned Supabase CLI is not installed.");
}

const version = spawnSync(cli, ["--version"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
});
assert.equal(version.status, 0, "Could not resolve Supabase CLI version");
assert.equal(version.stdout.trim(), "2.111.0", "Supabase CLI version mismatch");

const result = spawnSync(cli, ["db", "push", "--linked", ...(dryRun ? ["--dry-run"] : [])], {
  stdio: "inherit",
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

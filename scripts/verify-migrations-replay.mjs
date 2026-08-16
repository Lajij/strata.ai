import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`Migration replay prerequisite failed: ${message}`);
  process.exit(2);
}

if (process.env.STRATA_ALLOW_LOCAL_DB_RESET !== "1") {
  fail("set STRATA_ALLOW_LOCAL_DB_RESET=1 to approve destruction of the isolated local Supabase database");
}

if (!existsSync(join(process.cwd(), "supabase/config.toml"))) {
  fail("supabase/config.toml is missing; generate it with the pinned Supabase CLI before replay");
}

const localCli = join(process.cwd(), "node_modules/.bin/supabase");
if (!existsSync(localCli)) {
  fail("the pinned Supabase CLI is not installed");
}

if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
  fail("DOCKER_HOST and DOCKER_CONTEXT overrides are forbidden for isolated local replay");
}

const dockerContext = spawnSync("docker", ["context", "show"], { encoding: "utf8" });
const dockerEndpoint = spawnSync(
  "docker",
  ["context", "inspect", "--format", "{{(index .Endpoints \"docker\").Host}}"],
  { encoding: "utf8" },
);
const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
  encoding: "utf8",
});

if (
  dockerContext.status !== 0 ||
  dockerEndpoint.status !== 0 ||
  docker.status !== 0 ||
  !dockerEndpoint.stdout.trim().startsWith("unix://")
) {
  fail("a Docker-compatible local runtime is not available");
}

function run(args, label, options = {}) {
  const result = spawnSync(localCli, args, {
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? undefined : "inherit",
    env: {
      ...process.env,
      SUPABASE_TELEMETRY_DISABLED: "1",
    },
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }

  return result.stdout ?? "";
}

const cliVersion = run(["--version"], "Supabase CLI version", { capture: true }).trim();
assert.equal(cliVersion, "2.111.0", `Expected Supabase CLI 2.111.0, received ${cliVersion}`);

// Discover the installed version's flags before relying on them. This guards
// against silent CLI drift while keeping the target explicitly local/no-seed.
run(["db", "reset", "--help"], "Supabase db reset help");
run(["migration", "list", "--help"], "Supabase migration list help");
run(["db", "reset", "--local", "--no-seed"], "clean local migration replay");
const ledger = run(["migration", "list", "--local"], "local migration ledger verification", {
  capture: true,
});
const expectedVersions = Object.keys(
  JSON.parse(readFileSync(join(process.cwd(), "supabase/migrations.sha256.json"), "utf8")),
).map((file) => file.split("_")[0]);
const appliedVersions = [...new Set(ledger.match(/\b\d{12,14}\b/g) ?? [])].sort();
assert.deepEqual(appliedVersions, expectedVersions, "Local migration ledger does not match the manifest");

const fixtureCounts = spawnSync(
  "psql",
  [
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "-Atqc",
    "select (select count(*) from public.committees), (select count(*) from public.legislation_sources), (select count(*) from public.legislation_chunks);",
  ],
  { encoding: "utf8" },
);
assert.equal(fixtureCounts.status, 0, fixtureCounts.stderr || "Could not inspect replayed local database");
assert.equal(
  fixtureCounts.stdout.trim(),
  "0|0|0",
  "Seed-free replay must leave committees and legislation fixture tables empty",
);

console.log(
  `Behavioural migration replay passed (${expectedVersions.length} migrations, pinned CLI, local Docker, seed skipped, fixture tables empty).`,
);

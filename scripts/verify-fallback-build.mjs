import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const tempPath = resolve(process.cwd(), `.env.local.live-verification-${process.pid}`);

let moved = false;

try {
  if (existsSync(envPath)) {
    renameSync(envPath, tempPath);
    moved = true;
  }

  const result = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} finally {
  if (moved) {
    renameSync(tempPath, envPath);
  }
}

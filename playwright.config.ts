import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright harness for Strata governance behavioural e2e proof.
 *
 * The N1a/N1b production-target guard is enforced in `globalSetup` BEFORE any
 * persona provisioning, so persona fixtures can never target Production. The
 * six personas, the seeded committee they live in, and the marker-scoped
 * cleanup are all coordinated through `e2e/.persona-state.json`.
 *
 * Journeys assert real DOM locators, HTTP status, and RLS-derived emptiness.
 * There are no `source.includes(...)` presence checks anywhere in `e2e/`.
 */

const baseURL = process.env.STRATA_BROWSER_URL ?? "http://127.0.0.1:3000";

// Reuse an externally-provided target (e.g. a Vercel preview with a protection
// bypass secret) when set, and reuse a locally-started `next dev` when not in
// CI so a developer-run server is not restarted.
const reuseExistingServer = Boolean(process.env.STRATA_BROWSER_URL) || !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // Personas share one local Supabase workspace and marker-scoped rows, so the
  // suite must run serially in a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".eve/**",
    ".output/**",
    "out/**",
    "build/**",
    "building-management-platform/**",
    "next-env.d.ts",
    // Playwright e2e artefacts (reports, traces, captured screenshots/videos).
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "e2e/.storage/**",
  ]),
]);

export default eslintConfig;

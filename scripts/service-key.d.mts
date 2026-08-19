// Type declarations for the N1a/N1b service-key resolver primitive.
//
// Runtime logic lives in `service-key.mjs` (a plain `.mjs` script outside the
// root `include`). These declarations let the Playwright e2e harness reuse the
// resolver from TypeScript without duplicating it. Keep in sync with the `.mjs`.

export function resolveServiceKey(env?: Record<string, string | undefined>): string | undefined;

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { resolveServiceKey } from "../scripts/service-key.mjs";
import {
  assertBrowserMutationTargetAttestation,
  assertSafeBrowserMutationTarget,
} from "../scripts/target-environment-guard.mjs";
import { APP_URL, gotoApp, loadEnv, signIn } from "./lib/app";
import { cleanupE2eRecords, MARKER_PREFIX } from "./lib/cleanup";
import {
  PERSONA_DEFINITIONS,
  storageStatePath,
  type PersonaState,
  type PersonaStateEntry,
} from "./fixtures/personas";

/**
 * Playwright globalSetup.
 *
 * Enforces the N1a/N1b production-target guard BEFORE any provisioning so persona
 * fixtures can never target Production, then provisions the non-seeded personas
 * (financial confirmer, read-only, suspended, managed, cross-committee admin) and
 * the second fixture committee, captures a storageState per signing persona via a
 * real form sign-in, and writes the marker + ids + storageState paths to
 * `e2e/.persona-state.json` for the specs and teardown.
 */

const PROVISIONED_PASSWORD = "PersonaFixture123!";
const PERSONA_STATE_PATH = resolve(process.cwd(), "e2e", ".persona-state.json");
const STORAGE_DIR = resolve(process.cwd(), "e2e", ".storage");
const OPERATION = "playwright:e2e";

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = resolveServiceKey();
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.fixture.admin@example.invalid";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "LocalFixtureAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.fixture.member@example.invalid";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "LocalFixtureMember123!";

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) for Playwright e2e globalSetup.",
  );
}

// CRITICAL: the production-target guard runs before ANY database write. Under
// STRATA_ENVIRONMENT=production (or a production Supabase project ref / origin)
// this throws PRODUCTION_MUTATION_FORBIDDEN and provisioning never happens.
const mutationTarget = assertSafeBrowserMutationTarget({
  appUrl: APP_URL,
  supabaseUrl,
  operation: OPERATION,
});

// The webServer is up before globalSetup runs, so attest the deployment is
// bound to the asserted live target (mirrors verify-auth-browser.mjs).
await assertBrowserMutationTargetAttestation({
  target: mutationTarget,
  operation: OPERATION,
});

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Sweep any rows left by a previous interrupted run before provisioning.
await cleanupE2eRecords(service, MARKER_PREFIX);

const marker = `${MARKER_PREFIX}${Date.now()}`;

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const user = (data.users ?? []).find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if ((data.users ?? []).length < 1000) {
      return null;
    }
  }

  return null;
}

// Resolve the seeded Committee A from the seeded admin member (the seeded
// workspace is created by supabase db reset + supabase:seed-live).
const { data: adminMember, error: adminMemberError } = await service
  .from("members")
  .select("committee_id")
  .eq("email", adminEmail.toLowerCase())
  .eq("status", "active")
  .maybeSingle();

if (adminMemberError || !adminMember) {
  throw new Error(
    adminMemberError?.message ??
      "Seeded admin member was not found. Run `supabase db reset` and `npm run supabase:seed-live` first.",
  );
}

const committeeAId = adminMember.committee_id;
const crossCommitteeName = `${marker} Committee B`;
const committeeBId = crypto.randomUUID();

const { error: committeeError } = await service.from("committees").insert({
  id: committeeBId,
  name: crossCommitteeName,
  jurisdiction: "NSW Australia",
});

if (committeeError) {
  throw committeeError;
}

const personaEntries: Record<string, PersonaStateEntry> = {};

async function provisionPersona(definition: (typeof PERSONA_DEFINITIONS)[number]): Promise<void> {
  const email = definition.seeded
    ? definition.name === "admin"
      ? adminEmail
      : memberEmail
    : `${marker}-${definition.emailSuffix}@example.com`;
  const password = definition.seeded
    ? definition.name === "admin"
      ? adminPassword
      : memberPassword
    : PROVISIONED_PASSWORD;

  let userId: string | null = null;

  if (definition.seeded) {
    const existing = await findAuthUserByEmail(email);
    userId = existing?.id ?? null;
  } else {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { verification_marker: marker },
    });

    if (error) {
      throw error;
    }

    userId = data.user.id;
  }

  if (!definition.seeded) {
    const committeeId = definition.crossCommittee ? committeeBId : committeeAId;
    const { error: memberError } = await service.from("members").insert({
      committee_id: committeeId,
      user_id: userId,
      email,
      full_name: definition.fullName,
      role: definition.role,
      status: definition.status,
      access_level: definition.accessLevel,
      accepted_at: definition.status === "active" ? new Date().toISOString() : null,
    });

    if (memberError) {
      throw memberError;
    }
  }

  personaEntries[definition.name] = {
    email,
    password,
    userId,
    storageState: null,
    expectLocked: definition.expectLocked,
  };
}

for (const definition of PERSONA_DEFINITIONS) {
  await provisionPersona(definition);
}

// Capture a storageState per signing persona through the real sign-in form. The
// suspended persona signs in at the auth level but stays locked (no active
// member row); its storageState still carries the auth session used to prove
// the Data API rejects it with 401.
mkdirSync(STORAGE_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const definition of PERSONA_DEFINITIONS) {
    if (!definition.capturesStorageState) {
      continue;
    }

    const entry = personaEntries[definition.name];
    const path = storageStatePath(definition.name);
    const context = await browser.newContext({ baseURL: APP_URL });
    const page = await context.newPage();

    try {
      await gotoApp(page);
      await page.getByRole("heading", { name: "Sign in with an active committee account" }).waitFor({
        timeout: 20_000,
      });
      await signIn(page, entry.email, entry.password as string, {
        expectLocked: definition.expectLocked,
      });
      await context.storageState({ path });
      entry.storageState = path;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const personaState: PersonaState = {
  marker,
  committeeAId,
  committeeBId,
  crossCommitteeName,
  personas: personaEntries,
};

writeFileSync(PERSONA_STATE_PATH, JSON.stringify(personaState, null, 2), "utf8");

console.log(
  `[e2e globalSetup] provisioned ${Object.keys(personaEntries).length} personas under marker ${marker}`,
);

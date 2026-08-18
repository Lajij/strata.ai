import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { request as playwrightRequest, test as base, expect } from "@playwright/test";
import { APP_URL } from "../lib/app";

/**
 * Six behavioural personas mirroring the principals in
 * `scripts/verify-capabilities.mjs` (admin, financial confirmer, member,
 * read-only, suspended, outsider) plus a marker-scoped managed member (admin
 * journey edit target) and a cross-committee admin (Committee B).
 *
 * Admin + member reuse the seeded STRATA_ADMIN_EMAIL / STRATA_MEMBER_EMAIL auth
 * users. The remaining personas are provisioned marker-scoped by `globalSetup`
 * (auth user + members row) and torn down by `globalTeardown`. The runtime
 * credentials + storageState paths are written to `e2e/.persona-state.json` by
 * globalSetup and read here at test time.
 */

export type PersonaName =
  | "admin"
  | "financialConfirmer"
  | "member"
  | "readOnly"
  | "suspended"
  | "outsider";

/** Personas usable for an authenticated Data-API request context. */
export type ApiPersonaName = PersonaName | "crossCommitteeAdmin";

export type ProvisionedPersonaName = PersonaName | "managed" | "crossCommitteeAdmin";

export interface PersonaDefinition {
  name: ProvisionedPersonaName;
  role: "admin" | "chair" | "secretary" | "treasurer" | "strata_manager" | "member";
  status: "active" | "invited" | "suspended";
  accessLevel: "admin" | "member" | "limited_admin" | "read_only";
  fullName: string;
  emailSuffix: string;
  /** Reuses the seeded auth user instead of creating a marker-scoped one. */
  seeded: boolean;
  /** Signs in through the real form and captures a storageState. */
  capturesStorageState: boolean;
  /** Sign-in is expected to leave the dashboard locked (suspended). */
  expectLocked: boolean;
  /** Cross-committee: lives in the second fixture committee. */
  crossCommittee: boolean;
}

export const PERSONA_DEFINITIONS: PersonaDefinition[] = [
  {
    name: "admin",
    role: "admin",
    status: "active",
    accessLevel: "admin",
    fullName: "Strata Admin",
    emailSuffix: "admin",
    seeded: true,
    capturesStorageState: true,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "financialConfirmer",
    role: "treasurer",
    status: "active",
    accessLevel: "limited_admin",
    fullName: "E2E Financial Confirmer",
    emailSuffix: "fin",
    seeded: false,
    capturesStorageState: true,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "member",
    role: "member",
    status: "active",
    accessLevel: "member",
    fullName: "Strata Member",
    emailSuffix: "member",
    seeded: true,
    capturesStorageState: true,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "readOnly",
    role: "treasurer",
    status: "active",
    accessLevel: "read_only",
    fullName: "E2E Read Only",
    emailSuffix: "readonly",
    seeded: false,
    capturesStorageState: true,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "suspended",
    role: "admin",
    status: "suspended",
    accessLevel: "admin",
    fullName: "E2E Suspended",
    emailSuffix: "suspended",
    seeded: false,
    capturesStorageState: true,
    expectLocked: true,
    crossCommittee: false,
  },
  {
    name: "outsider",
    role: "member",
    status: "active",
    accessLevel: "member",
    fullName: "E2E Outsider",
    emailSuffix: "outsider",
    seeded: false,
    capturesStorageState: false,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "managed",
    role: "member",
    status: "active",
    accessLevel: "member",
    fullName: "E2E Managed Member",
    emailSuffix: "managed",
    seeded: false,
    capturesStorageState: false,
    expectLocked: false,
    crossCommittee: false,
  },
  {
    name: "crossCommitteeAdmin",
    role: "admin",
    status: "active",
    accessLevel: "admin",
    fullName: "E2E Cross Committee Admin",
    emailSuffix: "cross",
    seeded: false,
    capturesStorageState: true,
    expectLocked: false,
    crossCommittee: true,
  },
];

export interface PersonaStateEntry {
  email: string;
  password: string | null;
  userId: string | null;
  storageState: string | null;
  expectLocked: boolean;
}

export interface PersonaState {
  marker: string;
  committeeAId: string;
  committeeBId: string;
  crossCommitteeName: string;
  personas: Record<string, PersonaStateEntry>;
}

const PERSONA_STATE_PATH = resolve(process.cwd(), "e2e", ".persona-state.json");
const STORAGE_DIR = resolve(process.cwd(), "e2e", ".storage");

export function storageStatePath(name: string): string {
  return resolve(STORAGE_DIR, `${name}.json`);
}

export function readPersonaState(): PersonaState {
  if (!existsSync(PERSONA_STATE_PATH)) {
    throw new Error(
      `Persona state not found at ${PERSONA_STATE_PATH}. Run the Playwright globalSetup (npm run verify:e2e) against a seeded local Supabase first.`,
    );
  }

  return JSON.parse(readFileSync(PERSONA_STATE_PATH, "utf8")) as PersonaState;
}

export function personaCredentials(name: PersonaName): { email: string; password: string | null } {
  const state = readPersonaState();
  const entry = state.personas[name];

  if (!entry) {
    throw new Error(`Persona "${name}" was not provisioned by globalSetup.`);
  }

  return { email: entry.email, password: entry.password };
}

/**
 * A Playwright `APIRequestContext` authenticated as the persona (captured
 * storageState after a real form sign-in), or an anonymous context for the
 * outsider. Callers must `dispose()` the returned context.
 */
export async function authenticatedRequest(
  name: ApiPersonaName,
): Promise<import("@playwright/test").APIRequestContext> {
  const state = readPersonaState();
  const entry = state.personas[name];

  if (!entry) {
    throw new Error(`Persona "${name}" was not provisioned by globalSetup.`);
  }

  if (name === "outsider" || !entry.storageState) {
    return playwrightRequest.newContext({ baseURL: APP_URL });
  }

  return playwrightRequest.newContext({ baseURL: APP_URL, storageState: entry.storageState });
}

export { base as test, expect };

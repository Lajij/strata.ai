import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  const absolute = join(root, path);

  if (!existsSync(absolute)) {
    throw new Error(`Missing frontend contract source: ${path}`);
  }

  return readFileSync(absolute, "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const contract = read("FRONTEND-CONTRACT.md");
const packageJson = JSON.parse(read("package.json"));
const appData = read("src/lib/strata-app-data.ts");
const memberAuthorization = read("src/lib/member-authorization.ts");
const appShell = read("src/components/app-shell.tsx");
const authBrowser = read("scripts/verify-auth-browser.mjs");

const routeContracts = [
  ["GET /api/app-data", "src/app/api/app-data/route.ts", ["getStrataAppData", "Cache-Control"]],
  ["POST /api/members/accept", "src/app/api/members/accept/route.ts", ["No pending committee invite matches"]],
  ["POST /api/members/invite", "src/app/api/members/invite/route.ts", ["assertInviteCanBePrepared", "canManageMembers"]],
  ["POST /api/members/update", "src/app/api/members/update/route.ts", ["assertMemberLifecycleTransition", "canManageMembers"]],
  ["POST /api/documents/create", "src/app/api/documents/create/route.ts", ["strata-documents", "needs_extraction"]],
  ["POST /api/workflow/{action}", "src/app/api/workflow/[action]/route.ts", ["create-card", "add-message", "create-proposal", "cast-vote", "add-approval-condition"]],
  ["POST /api/finance/{action}", "src/app/api/finance/[action]/route.ts", ["create-vendor", "create-invoice", "create-quote-review"]],
  ["POST /api/ai/{task}", "src/app/api/ai/[task]/route.ts", ["card-brief", "thread-summary", "document-qa", "nsw-law-lookup", "budget-insights", "quote-risk", "project-status"]],
];

for (const [contractLabel, path, sourceNeedles] of routeContracts) {
  assertContains(contract, contractLabel, `${contractLabel} contract entry`);
  const source = read(path);

  for (const needle of sourceNeedles) {
    assertContains(source, needle, `${path} source contract`);
  }
}

for (const field of [
  "source: DataSource",
  'mode: "fallback" | "signed-out" | "active"',
  "cards: GovernanceCard[]",
  "documents: DocumentRecord[]",
  "projects: Project[]",
  "members: Member[]",
  "activity: AuditEvent[]",
  "budgetLines: BudgetLine[]",
]) {
  assertContains(appData, field, "StrataAppData field");
}

for (const roleLine of [
  "admin: { manageMembers: true }",
  "chair: { manageMembers: true }",
  "secretary: { manageMembers: true }",
  "treasurer: { manageMembers: false }",
  "member: { manageMembers: false }",
  "strata_manager: { manageMembers: false }",
]) {
  assertContains(memberAuthorization, roleLine, "member capability matrix");
}

for (const view of ["dashboard", "cards", "votes", "updates", "documents", "people", "settings"]) {
  assertContains(appShell, `${view}:`, `${view} page metadata`);
  assertContains(contract, `\`${view}\``, `${view} frozen view key`);
}

for (const command of [
  "npm run lint",
  "npm run build",
  "npm run verify:security",
  "npm run verify:auth-flow",
  "npm run verify:member-management",
  "npm run verify:auth-browser",
  "npm run verify:workflow-ui",
  "npm run verify:browser-workflow",
  "npm run verify:documents",
  "npm run verify:documents-ui",
  "npm run verify:ai",
  "npm run verify:ai-browser",
  "npm run verify:projects",
  "npm run verify:admin",
  "npm run verify:frontend-qa-browser",
]) {
  assertContains(contract, command, "acceptance command");
}

assertContains(authBrowser, "backwardsInviteRejected", "hardened lifecycle browser observation");
assertContains(authBrowser, "Active or suspended members cannot be moved back to invited", "backwards invite rejection assertion");
assertContains(contract, "decision #4", "frontend implementation router boundary");
assertContains(contract, "Not bound now", "current UI gap boundary");
assertContains(contract, "must not be “fixed” by deleting assertions", "verifier anti-weakening rule");
assertContains(packageJson.scripts["verify:frontend-contract"] ?? "", "verify-frontend-contract", "package script");

console.log("Frontend contract verification passed.");

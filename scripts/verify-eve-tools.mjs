import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const agentRoot = join(root, "agent");
const toolRoot = join(agentRoot, "tools");
const read = (path) => readFileSync(join(root, path), "utf8");

const readOnlyTools = [
  "get_card_evidence.ts",
  "get_document_evidence.ts",
  "get_project_evidence.ts",
  "search_records.ts",
];
const draftTools = ["save_approval_condition_draft.ts", "save_proposal_draft.ts"];
const disabledBuiltIns = [
  "agent.ts",
  "bash.ts",
  "glob.ts",
  "grep.ts",
  "read_file.ts",
  "todo.ts",
  "web_fetch.ts",
  "web_search.ts",
  "write_file.ts",
];

assert(existsSync(agentRoot), "agent/ scaffold must exist");
assert(existsSync(join(agentRoot, "instructions.md")), "agent instructions must exist");
assert(existsSync(join(agentRoot, "agent.ts")), "agent config must exist");

const packageJson = JSON.parse(read("package.json"));
assert.match(packageJson.dependencies.eve, /^\^0\.29\./, "eve 0.29 must be installed");
assert.match(packageJson.dependencies.ai, /^\^7\./, "AI SDK 7 must be installed");
assert.match(packageJson.dependencies["@ai-sdk/react"], /^\^4\./, "AI SDK React 4 must be installed");
assert.equal(packageJson.engines.node, ">=24", "Eve requires Node 24+");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /import \{ withEve \} from "eve\/next"/);
assert.match(nextConfig, /export default withEve\(nextConfig\)/);

const toolFiles = readdirSync(toolRoot).filter((name) => statSync(join(toolRoot, name)).isFile()).sort();
assert.deepEqual(toolFiles, [...readOnlyTools, ...draftTools, ...disabledBuiltIns].sort(), "tool directory must contain four read tools, two operator-approved draft tools, and explicit built-in disables");

for (const file of readOnlyTools) {
  const source = read(`agent/tools/${file}`);
  assert.match(source, /defineTool\(\{/);
  assert.match(source, /inputSchema:/);
  assert.match(source, /requireActiveScope\(ctx\)/);
  assert.match(source, /evidenceMissing\(/);
  assert.match(source, /citation\(/);
  assert.doesNotMatch(source, /\b(userId|committeeId|memberId|role)\s*:/, `${file} must not accept caller-supplied scope`);
}

for (const file of draftTools) {
  const source = read(`agent/tools/${file}`);
  assert.match(source, /defineTool\(\{/);
  assert.match(source, /inputSchema:/);
  assert.match(source, /approval: requireOperatorApproval/);
  assert.match(source, /requireOperatorApprover\(ctx\)/);
  assert.match(source, /never (?:publishes|activates) or sends/);
  assert.doesNotMatch(source, /\b(userId|committeeId|memberId|role)\s*:/, `${file} must not accept caller-supplied scope`);
}

for (const file of disabledBuiltIns) {
  assert.match(read(`agent/tools/${file}`), /export default disableTool\(\)/, `${file} must disable its built-in`);
}

for (const forbiddenDirectory of ["connections", "schedules", "skills", "subagents"]) {
  assert(!existsSync(join(agentRoot, forbiddenDirectory)), `${forbiddenDirectory}/ is outside eve-tools scope`);
}

const channel = read("agent/channels/eve.ts");
assert.match(channel, /extractBearerToken/);
assert.match(channel, /supabase\.auth\.getUser\(token\)/);
assert.match(channel, /\.eq\("status", "active"\)/);
assert.match(channel, /x-strata-committee-id/);
assert.match(channel, /withAuthChallenges/);
assert.match(channel, /isEvalFixtureEnabled\(\)/);
assert.match(channel, /isLoopbackRequest\(request\)/);
assert.doesNotMatch(channel, /\b(none|localDev|placeholderAuth)\s*\(/, "Eve route auth must fail closed");

const evalFixture = read("agent/lib/eval-fixtures.ts");
assert.match(evalFixture, /STRATA_EVE_EVAL_FIXTURE === "1"/);
assert.match(evalFixture, /process\.env\.NODE_ENV !== "production"/);

const operatorApproval = read("agent/lib/operator-approval.ts");
assert.match(operatorApproval, /STRATA_EVE_APPROVER_USER_ID/);
assert.match(operatorApproval, /UUID_PATTERN/);
assert.match(operatorApproval, /requireActiveSessionScope\(ctx\.session\)/);
assert.match(operatorApproval, /return "user-approval"/);
assert.match(operatorApproval, /type: "denied"/);
assert.match(operatorApproval, /requireActiveScope\(ctx\)/);

const draftWrites = read("agent/lib/draft-writes.ts");
assert.match(draftWrites, /stableUuid\("eve-proposal-draft"/);
assert.match(draftWrites, /stableUuid\("eve-condition-draft"/);
assert.match(draftWrites, /findVisibleCard\(input\.scope, input\.cardId\)/g);
assert.match(draftWrites, /\.from\("proposals"\)[\s\S]*?\.upsert\(/);
assert.match(draftWrites, /\.from\("approval_conditions"\)[\s\S]*?\.upsert\(/);
assert.match(draftWrites, /\.from\("audit_log"\)\.upsert\(/);
assert.match(draftWrites, /status: "draft"/g);
assert.doesNotMatch(draftWrites, /\.delete\s*\(|\.update\s*\(\s*\{/, "Eve draft tools must not publish, update, or delete existing workflow records");

const scope = read("agent/lib/scoped-data.ts");
assert.match(scope, /session\.auth\.current/);
assert.match(scope, /requireActiveSessionScope\(ctx\.session\)/);
assert.match(scope, /caller\.principalId/);
assert.match(scope, /\.eq\("status", "active"\)/);
assert.match(scope, /\.eq\("committee_id", committeeId\)/);
assert.match(scope, /\.eq\("user_id", caller\.principalId\)/);
assert.match(scope, /card\.visibility === "custom" && custom\.has\(card\.id\)/);
assert.match(scope, /document\.visibility === "all"/);
assert.match(scope, /Evidence missing:/);

const agentSources = [
  "agent/channels/eve.ts",
  "agent/lib/scoped-data.ts",
  "agent/lib/eval-fixtures.ts",
  "agent/lib/supabase.ts",
  ...readOnlyTools.map((file) => `agent/tools/${file}`),
].map(read).join("\n");

assert.doesNotMatch(agentSources, /\.(?:insert|update|upsert|delete)\s*\(/, "Eve tools must not mutate Supabase");
assert.doesNotMatch(agentSources, /auth\.admin\./, "Eve tools must not mutate Auth");
assert.doesNotMatch(agentSources, /NEXT_PUBLIC_SUPABASE_(?:SECRET|SERVICE_ROLE)/, "server keys must never use NEXT_PUBLIC names");

const instructions = read("agent/instructions.md");
assert.match(instructions, /Cite every factual claim/);
assert.match(instructions, /Evidence missing:/);
assert.match(instructions, /only writes are operator-approved proposal and approval-condition drafts/);
assert.match(instructions, /cannot publish, send, schedule, activate, approve, update, or delete/);

const envExample = read(".env.example");
assert.match(envExample, /^STRATA_EVE_APPROVER_USER_ID=$/m);
assert.doesNotMatch(envExample, /^NEXT_PUBLIC_STRATA_EVE_APPROVER/m);

console.log("Eve scoped tool and operator-approval verification passed.");
console.log(JSON.stringify({
  aiSdk: packageJson.dependencies.ai,
  eve: packageJson.dependencies.eve,
  readOnlyTools: readOnlyTools.map((file) => file.replace(/\.ts$/, "")),
  draftTools: draftTools.map((file) => file.replace(/\.ts$/, "")),
  builtInsDisabled: disabledBuiltIns.length,
  routeAuth: "production Supabase bearer + active membership; eval fixture explicit-env + non-production + loopback",
  scope: "current principal revalidated before approval and again inside draft execution",
  mutations: "operator-approved status=draft upserts plus audit only",
}, null, 2));

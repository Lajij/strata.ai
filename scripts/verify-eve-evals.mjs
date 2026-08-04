import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const packageJson = JSON.parse(read("package.json"));
assert.match(packageJson.scripts["verify:eve-evals"], /STRATA_EVE_EVAL_FIXTURE=1 eve eval --strict --skip-report/);

const evalFiles = readdirSync(join(root, "evals")).filter((file) => file.endsWith(".eval.ts")).sort();
assert.deepEqual(evalFiles, [
  "citations.eval.ts",
  "cross-session.eval.ts",
  "draft-condition-approval.eval.ts",
  "draft-denial.eval.ts",
  "draft-proposal-approval.eval.ts",
  "draft-unauthorized.eval.ts",
  "evidence-missing.eval.ts",
  "scope.eval.ts",
]);

const config = read("evals/evals.config.ts");
assert.match(config, /maxConcurrency: 1/);
assert.match(config, /timeoutMs: 30_000/);

const agent = read("agent/agent.ts");
assert.match(agent, /isEvalFixtureEnabled\(\)/);
assert.match(agent, /mockModel\(/);
assert.match(agent, /modelContextWindowTokens: 100_000/);
assert.match(agent, /toolCalls: \[\{ name: "search_records"/);
assert.match(agent, /toolCalls: \[\{ name: "get_card_evidence"/);
assert.match(agent, /toolCalls: \[\{ name: "save_proposal_draft"/);
assert.match(agent, /toolCalls: \[\{ name: "save_approval_condition_draft"/);

const fixture = read("agent/lib/eval-fixtures.ts");
assert.match(fixture, /STRATA_EVE_EVAL_FIXTURE === "1"/);
assert.match(fixture, /process\.env\.NODE_ENV !== "production"/);
assert.doesNotMatch(fixture, /.(?:insert|update|upsert|delete)\s*\(/);

const channel = read("agent/channels/eve.ts");
assert.match(channel, /isLoopbackRequest\(request\)/);
assert.match(channel, /x-strata-eval-principal/);
assert.match(channel, /\?\? "member"/);
assert.match(channel, /auth: \[evalFixture, supabaseBearer\]/);
assert.match(channel, /supabase\.auth\.getUser\(token\)/);

const scope = read("evals/scope.eval.ts");
assert.match(scope, /fixtureHeaders\("admin"\)/);
assert.match(scope, /fixtureHeaders\("member"\)/);
assert.match(scope, /Evidence missing:/);

const citations = read("evals/citations.eval.ts");
assert.match(citations, /calledTool\("get_card_evidence"/);
assert.match(citations, /card:\$\{EVAL_FIXTURE_IDS\.publicCard\}/);

const fallback = read("evals/evidence-missing.eval.ts");
assert.match(fallback, /Evidence missing:/);
assert.match(fallback, /UNKNOWN_CARD/);

const isolation = read("evals/cross-session.eval.ts");
assert.match(isolation, /t\.newSession\(\)/g);
assert.match(isolation, /adminSessionId !== memberSessionId/);
assert.match(isolation, /does not leak admin evidence/);

const proposalApproval = read("evals/draft-proposal-approval.eval.ts");
assert.match(proposalApproval, /parked\.parked\(\)/);
assert.match(proposalApproval, /optionId: "approve"/);
assert.match(proposalApproval, /headers: fixtureHeaders\("admin"\)/g);
assert.match(proposalApproval, /status: "completed"/);
assert.match(proposalApproval, /audit:/);

const conditionApproval = read("evals/draft-condition-approval.eval.ts");
assert.match(conditionApproval, /save_approval_condition_draft/);
assert.match(conditionApproval, /optionId: "approve"/);
assert.match(conditionApproval, /headers: fixtureHeaders\("admin"\)/g);
assert.match(conditionApproval, /"status":"draft"/);

const denial = read("evals/draft-denial.eval.ts");
assert.match(denial, /optionId: "deny"/);
assert.match(denial, /status: "rejected"/);
assert.match(denial, /denied draft is not persisted/);

const unauthorized = read("evals/draft-unauthorized.eval.ts");
assert.match(unauthorized, /fixtureHeaders\("member"\)/);
assert.match(unauthorized, /status: "failed"/);
assert.match(unauthorized, /notEvent\("input\.requested"\)/);
assert.match(unauthorized, /Only the configured repository operator/);

console.log("Eve eval source verification passed.");
console.log(JSON.stringify({
  evals: evalFiles.map((file) => file.replace(/\.eval\.ts$/, "")),
  fixture: "explicit env + non-production + loopback only",
  principals: ["admin", "member"],
  liveSupabaseCalls: false,
}, null, 2));

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import acorn from "next/dist/compiled/acorn/acorn.js";

const root = process.cwd();
const scriptsDirectory = join(root, "scripts");
const databaseMutators = [
  "export-ai-audit-pack.mjs",
  "seed-live-workspace.mjs",
  "seed-nsw-law-sources.mjs",
  "test-supabase-connection.mjs",
  "verify-ai-layer.mjs",
  "verify-ai-observability.mjs",
  "verify-auth-flow.mjs",
  "verify-budget-workflow.mjs",
  "verify-document-workflow.mjs",
  "verify-law-sources.mjs",
  "verify-live-dashboard-data.mjs",
  "verify-member-management.mjs",
  "verify-production-ready.mjs",
  "verify-quote-invoice-workflow.mjs",
];
const browserMutators = [
  "verify-ai-browser.mjs",
  "verify-auth-browser.mjs",
  "verify-browser-workflow.mjs",
  "verify-frontend-qa-browser.mjs",
  "verify-recovery-browser.mjs",
];
const expectedRuntimeMutators = [...databaseMutators, ...browserMutators].sort();
const supabaseMethods = new Set([
  "copy",
  "createUser",
  "delete",
  "deleteUser",
  "exchangeCodeForSession",
  "generateLink",
  "insert",
  "inviteUserByEmail",
  "invoke",
  "move",
  "remove",
  "resetPasswordForEmail",
  "rpc",
  "setSession",
  "signInWithOtp",
  "signInWithPassword",
  "signOut",
  "signUp",
  "update",
  "updateUser",
  "updateUserById",
  "upload",
  "upsert",
  "verifyOtp",
]);
const browserMethods = new Set([
  "check",
  "click",
  "dblclick",
  "dispatchEvent",
  "fill",
  "press",
  "selectOption",
  "setInputFiles",
  "submit",
  "tap",
  "type",
  "uncheck",
]);

function parse(source) {
  return acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowAwaitOutsideFunction: true,
  });
}

function walk(node, visit, { skipFunctions = false } = {}) {
  if (!node || typeof node !== "object") return;
  visit(node);

  if (
    skipFunctions &&
    ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)
  ) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (["start", "end", "loc", "type"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, { skipFunctions });
    } else if (value && typeof value === "object") {
      walk(value, visit, { skipFunctions });
    }
  }
}

function propertyName(memberExpression) {
  if (memberExpression?.type !== "MemberExpression") return null;
  if (!memberExpression.computed && memberExpression.property.type === "Identifier") {
    return memberExpression.property.name;
  }
  return memberExpression.property.type === "Literal"
    ? String(memberExpression.property.value)
    : null;
}

function identifierCallName(call) {
  return call?.callee?.type === "Identifier" ? call.callee.name : null;
}

function isMutatingFetch(call) {
  if (identifierCallName(call) !== "fetch") return false;
  const options = call.arguments[1];
  if (options?.type !== "ObjectExpression") return false;
  const method = options.properties.find(
    (property) =>
      property.type === "Property" &&
      ((property.key.type === "Identifier" && property.key.name === "method") ||
        (property.key.type === "Literal" && property.key.value === "method")),
  );
  return (
    method?.value?.type === "Literal" &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(String(method.value.value).toUpperCase())
  );
}

function sourceContext(ast) {
  const imports = ast.body
    .filter((node) => node.type === "ImportDeclaration")
    .map((node) => String(node.source.value));
  return {
    usesSupabase: imports.some((source) => source.includes("supabase")),
    usesPlaywright: imports.some((source) => source.includes("playwright")),
  };
}

function isPrimitiveEffect(call, context) {
  const directName = identifierCallName(call);
  const method = propertyName(call.callee);

  if (isMutatingFetch(call)) return true;
  if (context.usesSupabase && ["createClient", "createBrowserClient"].includes(directName)) return true;
  if (context.usesSupabase && supabaseMethods.has(method)) return true;
  if (context.usesPlaywright && browserMethods.has(method)) return true;
  return (
    context.usesPlaywright &&
    method === "launch" &&
    call.callee.object?.type === "Identifier" &&
    call.callee.object.name === "chromium"
  );
}

function functionDefinitions(ast) {
  const definitions = new Map();

  for (const node of ast.body) {
    if (node.type === "FunctionDeclaration" && node.id) {
      definitions.set(node.id.name, node);
    }

    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        if (
          declaration.id.type === "Identifier" &&
          ["FunctionExpression", "ArrowFunctionExpression"].includes(declaration.init?.type)
        ) {
          definitions.set(declaration.id.name, declaration.init);
        }
      }
    }
  }

  return definitions;
}

function mutatingFunctions(ast, context) {
  const definitions = functionDefinitions(ast);
  const direct = new Set();
  const calls = new Map();

  for (const [name, definition] of definitions) {
    const dependencies = new Set();
    walk(definition.body, (node) => {
      if (node.type !== "CallExpression") return;
      if (isPrimitiveEffect(node, context)) direct.add(name);
      const called = identifierCallName(node);
      if (called && definitions.has(called)) dependencies.add(called);
    });
    calls.set(name, dependencies);
  }

  const result = new Set(direct);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, dependencies] of calls) {
      if (!result.has(name) && [...dependencies].some((dependency) => result.has(dependency))) {
        result.add(name);
        changed = true;
      }
    }
  }
  return result;
}

function analyze(source) {
  const ast = parse(source);
  const context = sourceContext(ast);
  const mutating = mutatingFunctions(ast, context);
  const effects = [];
  const guardCalls = [];
  const attestations = [];

  for (const statement of ast.body) {
    if (statement.type === "FunctionDeclaration") continue;
    walk(statement, (node) => {
      if (node.type !== "CallExpression") return;
      const name = identifierCallName(node);
      if (name === "assertSafeMutationTarget" || name === "assertSafeBrowserMutationTarget") {
        guardCalls.push(node.start);
        return;
      }
      if (name === "assertBrowserMutationTargetAttestation") {
        attestations.push(node.start);
        return;
      }
      if (isPrimitiveEffect(node, context) || (name && mutating.has(name))) {
        effects.push(node.start);
      }
    }, { skipFunctions: true });
  }

  effects.sort((left, right) => left - right);
  return { effects, guardCalls, attestations };
}

function assertOrdered(source, file, browser) {
  const { effects, guardCalls, attestations } = analyze(source);
  assert.ok(effects.length > 0, `${file} has no executable effect despite its classification`);
  assert.equal(guardCalls.length, 1, `${file} must have exactly one executable target guard`);
  assert.ok(guardCalls[0] < effects[0], `${file} target guard must precede its earliest executable effect`);

  if (browser) {
    assert.equal(attestations.length, 1, `${file} must have exactly one deployment/database attestation`);
    assert.ok(guardCalls[0] < attestations[0], `${file} guard must precede attestation`);
    assert.ok(attestations[0] < effects[0], `${file} attestation must precede its earliest executable effect`);
  }
}

const detectedRuntimeMutators = readdirSync(scriptsDirectory)
  .filter((file) => file.endsWith(".mjs"))
  .filter((file) => file !== "verify-mutation-targets.mjs")
  .filter((file) => analyze(readFileSync(join(scriptsDirectory, file), "utf8")).effects.length > 0)
  .sort();

assert.deepEqual(
  detectedRuntimeMutators,
  expectedRuntimeMutators,
  "Runtime effect inventory changed; classify the script and add the correct pre-effect target guard",
);

for (const file of databaseMutators) {
  assertOrdered(readFileSync(join(scriptsDirectory, file), "utf8"), file, false);
}
for (const file of browserMutators) {
  assertOrdered(readFileSync(join(scriptsDirectory, file), "utf8"), file, true);
}

const lateDatabaseFixture = `
  import { createClient } from "@supabase/supabase-js";
  const client = createClient("https://unsafe.example", "key");
  assertSafeMutationTarget({ url: "https://unsafe.example", operation: "late" });
`;
assert.throws(
  () => assertOrdered(lateDatabaseFixture, "negative-database-fixture.mjs", false),
  /target guard must precede/,
);
const hiddenEarlierEffectFixture = `
  import { createClient } from "@supabase/supabase-js";
  const early = createClient("https://unsafe.example", "key");
  assertSafeMutationTarget({ url: "https://unsafe.example", operation: "guard" });
  const oldDeclaredAnchor = createClient("https://unsafe.example", "key");
`;
assert.throws(
  () => assertOrdered(hiddenEarlierEffectFixture, "negative-earlier-effect-fixture.mjs", false),
  /target guard must precede/,
);
const rawFetchFixture = `
  await fetch("https://unsafe.example/write", { method: "POST", body: "{}" });
`;
assert.equal(analyze(rawFetchFixture).effects.length, 1, "Raw mutating fetch must be inventoried without imports");
const authFixture = `
  import { createClient } from "@supabase/supabase-js";
  async function authenticate(client) {
    await client.auth.signUp({ email: "x@example.invalid", password: "x" });
    await client.auth.updateUser({ password: "y" });
    await client.auth.resetPasswordForEmail("x@example.invalid");
  }
  assertSafeMutationTarget({ url: "http://127.0.0.1:54321", operation: "auth" });
  const client = createClient("http://127.0.0.1:54321", "key");
  await authenticate(client);
`;
assert.equal(analyze(authFixture).effects.length >= 2, true, "Auth session/account writes must be inventoried");

const replay = readFileSync(join(scriptsDirectory, "verify-migrations-replay.mjs"), "utf8");
assert.match(replay, /STRATA_ALLOW_LOCAL_DB_RESET/);
assert.match(replay, /db", "reset", "--local", "--no-seed"/);
const push = readFileSync(join(scriptsDirectory, "safe-supabase-push.mjs"), "utf8");
assert.match(push, /Seed inclusion is forbidden/);
assert.match(push, /verify-migrations\.mjs/);

console.log(
  `AST mutation-target inventory and ordering passed (${databaseMutators.length} database/service/auth mutators; ${browserMutators.length} browser mutators; replay/push special guards).`,
);

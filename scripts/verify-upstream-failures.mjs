import assert from "node:assert/strict";

Object.assign(process.env, {
  STRATA_ENVIRONMENT: "test",
  STRATA_DATA_MODE: "live",
  STRATA_AI_RELEASE_MODE: "live",
  NEXT_PUBLIC_SUPABASE_URL: "https://isolated-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  AI_GATEWAY_API_KEY: "test-gateway-credential",
});

const { GET: getAppData } = await import("../src/app/api/app-data/route.ts");
const { POST: postAiTask } = await import("../src/app/api/ai/[task]/route.ts");

const appDataResponse = await getAppData(
  new Request("http://strata.test/api/app-data"),
);
const appDataBody = await appDataResponse.json();

assert.equal(appDataResponse.status, 503);
assert.deepEqual(appDataBody, {
  error: "Strata is temporarily unavailable. No demo data was substituted.",
  code: "RUNTIME_BOUNDARY_FAILURE",
});
assert.equal("cards" in appDataBody, false);
assert.equal(JSON.stringify(appDataBody).includes("sb_secret_"), false);

const aiResponse = await postAiTask(
  new Request("http://strata.test/api/ai/card-brief", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Summarise the visible record." }),
  }),
  { params: Promise.resolve({ task: "card-brief" }) },
);
const aiBody = await aiResponse.json();

assert.equal(aiResponse.status, 502);
assert.equal(aiBody.code, "AI_PROVIDER_UNAVAILABLE");
assert.equal(aiBody.mode, "error");
assert.equal(aiBody.error, "The AI provider request failed. No mock answer was substituted.");
assert.equal("text" in aiBody, false);
assert.equal("output" in aiBody, false);
assert.equal(JSON.stringify(aiBody).includes("sb_secret_"), false);
assert.notEqual(aiBody.mode, "mock");
assert.notEqual(aiBody.mode, "fallback");

console.log("Behavioural upstream-failure assertions passed (Supabase read and AI provider). ");

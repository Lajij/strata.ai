import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const app = read("src/components/strata-app.tsx");
const page = read("src/app/recover/page.tsx");
const recovery = read("src/components/recovery-workspace.tsx");
const client = read("src/lib/supabase/client.ts");
const browserVerifier = read("scripts/verify-recovery-browser.mjs");
const proxy = read("src/proxy.ts");

assert.match(app, /href="\/recover"/);
assert.match(app, /Forgot password\?/);
assert.match(page, /isRecoveryCallback=\{isRecoveryCallback\}/);
assert.match(page, /supabaseConfigured=\{supabaseConfigured\}/);
assert.match(recovery, /resetPasswordForEmail\(email\.trim\(\), \{ redirectTo \}\)/);
assert.match(recovery, /new URL\("\/recover", window\.location\.origin\)\.toString\(\)/);
assert.match(recovery, /event === "PASSWORD_RECOVERY"/);
assert.match(recovery, /getSupabaseImplicitRecoveryClient\(\)/);
assert.match(recovery, /hash\.get\("type"\) === "recovery" && hash\.has\("access_token"\)/);
assert.match(recovery, /recoveryClient\.current = supabase/);
assert.match(recovery, /supabase\.auth\.getUser\(\)/);
assert.match(recovery, /window\.history\.replaceState\(null, "", "\/recover"\)/);
assert.match(recovery, /updateUser\(\{ password \}\)/);
assert.match(recovery, /signOut\(\{ scope: "local" \}\)/);
assert.match(recovery, /password\.length < 12/);
assert.match(recovery, /password !== confirmation/);
assert.match(recovery, /If that address is eligible/);
assert.doesNotMatch(recovery, /NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/);
assert.doesNotMatch(recovery, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/);
assert.match(client, /flowType: "implicit"/);
assert.match(client, /persistSession: false/);
assert.match(client, /autoRefreshToken: false/);
assert.match(client, /createBrowserClient<Database>/);
assert.doesNotMatch(client, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/);
assert.match(proxy, /updateSession\(request\)/);
assert.match(browserVerifier, /auth\.admin\.generateLink/);
assert.match(browserVerifier, /type: "recovery"/);
assert.match(browserVerifier, /STRATA_BROWSER_URL/);
assert.match(browserVerifier, /new URL\("\/recover", appUrl\)/);
assert.match(browserVerifier, /newPasswordSignsIn/);
assert.match(browserVerifier, /AggregateError/);
assert.doesNotMatch(browserVerifier, /console\.(?:log|error)\([^\n]*(?:actionLink|serviceKey|bypassSecret)/);

console.log("Password recovery source verification passed.");
console.log(JSON.stringify({
  route: "/recover",
  flow: "Supabase PKCE recovery -> verified session -> password update -> local sign-out",
  redirect: "fixed same-origin path",
  memberAuthorization: "unchanged; normal active-member gate remains authoritative",
  previewGate: "verify:recovery-browser uses a disposable active member and admin-generated link; no mailbox access",
}, null, 2));

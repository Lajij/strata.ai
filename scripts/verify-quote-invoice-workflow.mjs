import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const componentSource = readFileSync(join(root, "src/components/strata-app.tsx"), "utf8");
const dataSource = readFileSync(join(root, "src/lib/strata-app-data.ts"), "utf8");
const financeRoute = readFileSync(join(root, "src/app/api/finance/[action]/route.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "55555555-5555-5555-5555-555555555551";
const PUBLIC_CARD_ID = "44444444-4444-4444-4444-444444444441";
const DOCUMENT_ID = "77777777-7777-7777-7777-777777777701";
const VENDOR_ID = "99999999-9999-9999-9999-999999999981";
const INVOICE_ID = "78787878-7878-7878-7878-787878787981";
const QUOTE_REVIEW_ID = "89898989-8989-8989-8989-898989898981";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadEnv(file) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function signInClient(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

assert(packageJson.scripts["verify:quote-invoice"]?.includes("verify-quote-invoice-workflow"), "Missing verify:quote-invoice script");
for (const action of ["create-vendor", "create-invoice", "create-quote-review"]) {
  assert(financeRoute.includes(action), `Finance route missing ${action}`);
}
assert(financeRoute.includes("getSupabaseServerClient"), "Finance route must use the shared Supabase server client");
assert(!financeRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Finance route must not use service-role key");
assert(!financeRoute.includes("SUPABASE_SECRET_KEY"), "Finance route must not use secret key");
// Track E finance-workflow creation UI is deferred post-v1 by signed decision
// #8 = "defer-track-e-post-v1" (DECISIONS-REQUIRED.md row 8): the
// FinanceWorkflowTools component (the "Create invoice" / "Create quote review"
// actions, and the project.invoices / project.quoteReviews displays) is
// intentionally not shipped. Per GO-NO-GO.md, "none of their deferred
// capabilities may be represented as shipped," and GRAPH-PLAN.md classifies this
// script as a "predecessor pattern, not coverage" for the deferred Track E UI.
// The prior positive assertions that required this UI to ship in strata-app.tsx
// are deliberately dropped, not forgotten. The guard below enforces the
// deferral for the one Track E-specific identifier this shell reads.
assert(!componentSource.includes("FinanceWorkflowTools"), "Track E finance-workflow creation UI must not be represented as shipped in v1 (deferred post-v1 by signed decision #8)");
assert(dataSource.includes("mapInvoices"), "App data must map invoices");
assert(dataSource.includes("mapQuoteReviews"), "App data must map quote reviews");
assert(dataSource.includes('.from("vendors")'), "App data must read vendors");
assert(dataSource.includes('.from("invoices")'), "App data must read invoices");
assert(dataSource.includes('.from("quote_reviews")'), "App data must read quote reviews");

if (process.env.STRATA_SKIP_LIVE === "1") {
  console.log("Quote and invoice workflow static verification passed.");
  process.exit(0);
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  resolveServiceKey();

if (url && anonKey && serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = await signInClient(
    url,
    anonKey,
    process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com",
    process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!",
  );
  const memberClient = await signInClient(
    url,
    anonKey,
    process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com",
    process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!",
  );

  await service.from("quote_reviews").delete().eq("id", QUOTE_REVIEW_ID);
  await service.from("invoices").delete().eq("id", INVOICE_ID);
  await service.from("vendors").delete().eq("id", VENDOR_ID);

  await must(
    "admin vendor create",
    adminClient.from("vendors").insert({
      id: VENDOR_ID,
      committee_id: COMMITTEE_ID,
      name: "Verification Vendor",
      contact_email: "verify@example.com",
      insurance_status: "current",
    }),
  );

  const memberInvoiceInsert = await memberClient.from("invoices").insert({
    committee_id: COMMITTEE_ID,
    project_id: PROJECT_ID,
    card_id: PUBLIC_CARD_ID,
    invoice_number: "MEMBER-SHOULD-BLOCK",
    amount: 1,
  });
  assert(memberInvoiceInsert.error, "Ordinary member can mutate treasurer/admin invoice records");

  await must(
    "admin invoice create",
    adminClient.from("invoices").insert({
      id: INVOICE_ID,
      committee_id: COMMITTEE_ID,
      project_id: PROJECT_ID,
      card_id: PUBLIC_CARD_ID,
      vendor_id: VENDOR_ID,
      document_id: DOCUMENT_ID,
      invoice_number: "QI-VERIFY",
      amount: 2400,
      approval_status: "reviewed",
    }),
  );

  await must(
    "member quote review create",
    memberClient.from("quote_reviews").insert({
      id: QUOTE_REVIEW_ID,
      committee_id: COMMITTEE_ID,
      card_id: PUBLIC_CARD_ID,
      document_id: DOCUMENT_ID,
      overall_risk: "medium",
      missing_inclusions: ["make-good"],
      risky_exclusions: ["out of hours"],
      clarification_questions: ["Who certifies completion?"],
      approval_conditions: ["Pay after inspection"],
    }),
  );

  const [memberInvoices, memberReviews] = await Promise.all([
    must("member invoice read", memberClient.from("invoices").select("id,invoice_number,amount").eq("id", INVOICE_ID)),
    must("member quote review read", memberClient.from("quote_reviews").select("id,approval_conditions").eq("id", QUOTE_REVIEW_ID)),
  ]);

  assert(memberInvoices.length === 1, "Ordinary member cannot read visible invoice");
  assert(memberReviews.length === 1, "Ordinary member cannot read visible quote review");

  await service.from("quote_reviews").delete().eq("id", QUOTE_REVIEW_ID);
  await service.from("invoices").delete().eq("id", INVOICE_ID);
  await service.from("vendors").delete().eq("id", VENDOR_ID);
}

console.log("Quote and invoice workflow verification passed.");

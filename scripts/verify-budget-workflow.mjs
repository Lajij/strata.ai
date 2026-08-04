import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "55555555-5555-5555-5555-555555555551";
const PUBLIC_CARD_ID = "44444444-4444-4444-4444-444444444441";
const ADMIN_INVOICE_ID = "78787878-7878-7878-7878-787878787991";
const MEMBER_BLOCKED_INVOICE_ID = "78787878-7878-7878-7878-787878787992";

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  resolveServiceKey();
const adminEmail = process.env.STRATA_ADMIN_EMAIL ?? "strata.admin@example.com";
const adminPassword = process.env.STRATA_ADMIN_PASSWORD ?? "StrataAdmin123!";
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

if (!url || !anonKey || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.");
}

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function signInClient(email, password) {
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await must(
  "budget verification cleanup",
  service.from("invoices").delete().in("id", [ADMIN_INVOICE_ID, MEMBER_BLOCKED_INVOICE_ID]),
);

const adminClient = await signInClient(adminEmail, adminPassword);
const memberClient = await signInClient(memberEmail, memberPassword);

const [memberProjects, memberBudgetLines, memberAllowances, memberInvoices, memberExpenses, memberVendors, memberQuoteReviews] =
  await Promise.all([
  must("member project read", memberClient.from("projects").select("id,budget_allowance_id").eq("committee_id", COMMITTEE_ID)),
  must("member budget line read", memberClient.from("budget_lines").select("id,approved_amount").eq("committee_id", COMMITTEE_ID)),
  must("member allowance read", memberClient.from("budget_allowances").select("id,committed_amount,invoiced_amount").eq("committee_id", COMMITTEE_ID)),
  must("member invoice read", memberClient.from("invoices").select("id,amount,approval_status").eq("committee_id", COMMITTEE_ID)),
  must("member expense read", memberClient.from("expenses").select("id,amount").eq("committee_id", COMMITTEE_ID)),
  must("member vendor read", memberClient.from("vendors").select("id,name,insurance_status").eq("committee_id", COMMITTEE_ID)),
  must("member quote review read", memberClient.from("quote_reviews").select("id,overall_risk,approval_conditions").eq("committee_id", COMMITTEE_ID)),
]);

assert(memberProjects.some((project) => project.id === PROJECT_ID), "Member cannot read seeded project");
assert(memberBudgetLines.length > 0, "Member cannot read budget lines");
assert(memberAllowances.length > 0, "Member cannot read allowances");
assert(memberInvoices.length > 0, "Member cannot read invoices");
assert(memberExpenses.length > 0, "Member cannot read expenses");

const blockedInsert = await memberClient.from("invoices").insert({
  id: MEMBER_BLOCKED_INVOICE_ID,
  committee_id: COMMITTEE_ID,
  project_id: PROJECT_ID,
  card_id: PUBLIC_CARD_ID,
  invoice_number: "MEMBER-BLOCKED",
  amount: 1,
});

assert(blockedInsert.error, "Ordinary member can create a treasurer-only invoice");

await must(
  "admin invoice insert",
  adminClient.from("invoices").insert({
    id: ADMIN_INVOICE_ID,
    committee_id: COMMITTEE_ID,
    project_id: PROJECT_ID,
    card_id: PUBLIC_CARD_ID,
    invoice_number: "ADMIN-RLS-VERIFY",
    amount: 1100,
    approval_status: "pending",
  }),
);

await must(
  "admin invoice update",
  adminClient.from("invoices").update({ amount: 1200, approval_status: "reviewed" }).eq("id", ADMIN_INVOICE_ID),
);

const memberAfterAdminWrite = await must(
  "member invoice read after admin write",
  memberClient.from("invoices").select("id,amount,approval_status").eq("id", ADMIN_INVOICE_ID).maybeSingle(),
);

assert(memberAfterAdminWrite?.amount === 1200, "Member cannot read admin-created visible invoice");
assert(memberAfterAdminWrite?.approval_status === "reviewed", "Admin invoice update did not persist");

await must("budget verification cleanup", service.from("invoices").delete().eq("id", ADMIN_INVOICE_ID));

console.log(
  JSON.stringify(
    {
      ok: true,
      memberRead: {
        projects: memberProjects.length,
        budgetLines: memberBudgetLines.length,
        allowances: memberAllowances.length,
        invoices: memberInvoices.length,
        expenses: memberExpenses.length,
        vendors: memberVendors.length,
        quoteReviews: memberQuoteReviews.length,
      },
      memberWriteDenied: true,
      adminInvoiceMutated: true,
    },
    null,
    2,
  ),
);

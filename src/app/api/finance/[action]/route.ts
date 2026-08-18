import { NextRequest, NextResponse } from "next/server";
import { PublicRequestError, fixtureWriteDisabledResponse, isMissingAuthSession, operationFailureResponse, runtimeFailureResponse, upstreamUnavailable } from "@/lib/runtime-configuration";
import { getCurrentMember } from "@/lib/strata-app-data";
import { canManageFinance } from "@/lib/member-authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const financeActions = new Set(["create-vendor", "create-invoice", "create-quote-review"]);

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicRequestError("REQUEST_FIELD_REQUIRED", `${label} is required`);
  }

  return value.trim();
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function moneyValue(value: unknown, label: string) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new PublicRequestError("MONEY_VALUE_INVALID", `${label} must be a positive number`);
  }

  return number;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function listValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;

  if (!financeActions.has(action)) {
    return NextResponse.json({ error: "Unknown finance action" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let supabase;

  try {
    supabase = await getSupabaseServerClient();
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!supabase) {
    return fixtureWriteDisabledResponse();
  }

  const client = supabase;
  let member;
  let user;

  try {
    member = await getCurrentMember(client);
    const userResult = await client.auth.getUser();

    if (userResult.error && !isMissingAuthSession(userResult.error)) {
      throw upstreamUnavailable("SUPABASE_AUTH_UNAVAILABLE");
    }

    user = userResult.data.user;
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!member || !user) {
    return NextResponse.json({ error: "Sign in as an active committee member to use finance workflows" }, { status: 401 });
  }

  if (!canManageFinance(member.role, member.access_level)) {
    return NextResponse.json(
      { error: "Financial workflow capability is required", code: "FINANCE_CAPABILITY_REQUIRED" },
      { status: 403 },
    );
  }

  const activeMember = member;
  const activeUser = user;

  async function audit(cardId: string | null, eventAction: string, target: string, metadata: Json = {}) {
    const { error } = await client.from("audit_log").insert({
      committee_id: activeMember.committee_id,
      card_id: cardId,
      user_id: activeUser.id,
      action: eventAction,
      target,
      metadata,
    });

    if (error) {
      throw error;
    }
  }

  try {
    if (action === "create-vendor") {
      const id = crypto.randomUUID();
      const name = requiredText(payload.name, "Vendor name");
      const { error } = await client.from("vendors").insert({
        id,
        committee_id: activeMember.committee_id,
        name,
        contact_email: nullableText(payload.contactEmail),
        phone: nullableText(payload.phone),
        license_number: nullableText(payload.licenseNumber),
        insurance_status: nullableText(payload.insuranceStatus),
      });

      if (error) {
        throw error;
      }

      await audit(null, "Created vendor", name, { workflow: action, vendor_id: id });
      return NextResponse.json({ mode: "supabase", id, message: "Vendor created and audited" });
    }

    if (action === "create-invoice") {
      const id = crypto.randomUUID();
      const amount = moneyValue(payload.amount, "Invoice amount");
      const invoiceNumber = requiredText(payload.invoiceNumber, "Invoice number");
      const cardId = nullableText(payload.cardId);
      const { error } = await client.from("invoices").insert({
        id,
        committee_id: activeMember.committee_id,
        project_id: nullableText(payload.projectId),
        card_id: cardId,
        vendor_id: nullableText(payload.vendorId),
        document_id: nullableText(payload.documentId),
        invoice_number: invoiceNumber,
        amount,
        approval_status: enumValue(payload.approvalStatus, ["pending", "reviewed", "approved", "rejected"] as const, "pending"),
        due_on: nullableText(payload.dueOn),
      });

      if (error) {
        throw error;
      }

      await audit(cardId, "Created invoice", invoiceNumber, { workflow: action, invoice_id: id, amount });
      return NextResponse.json({ mode: "supabase", id, message: "Invoice created and audited" });
    }

    const id = crypto.randomUUID();
    const cardId = nullableText(payload.cardId);
    const { error } = await client.from("quote_reviews").insert({
      id,
      committee_id: activeMember.committee_id,
      card_id: cardId,
      document_id: nullableText(payload.documentId),
      overall_risk: enumValue(payload.overallRisk, ["low", "medium", "high"] as const, "medium"),
      missing_inclusions: listValue(payload.missingInclusions),
      risky_exclusions: listValue(payload.riskyExclusions),
      clarification_questions: listValue(payload.clarificationQuestions),
      approval_conditions: listValue(payload.approvalConditions),
    });

    if (error) {
      throw error;
    }

    await audit(cardId, "Created quote review", id, { workflow: action, quote_review_id: id });
    return NextResponse.json({ mode: "supabase", id, message: "Quote review created and audited" });
  } catch (error) {
    return operationFailureResponse(error, {
      code: "FINANCE_OPERATION_FAILED",
      message: "The finance operation could not be completed.",
    });
  }
}

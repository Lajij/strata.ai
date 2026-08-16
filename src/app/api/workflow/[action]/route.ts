import { NextRequest, NextResponse } from "next/server";
import { PublicRequestError, fixtureWriteDisabledResponse, isMissingAuthSession, operationFailureResponse, runtimeFailureResponse, upstreamUnavailable } from "@/lib/runtime-configuration";
import { getCurrentMember } from "@/lib/strata-app-data";
import { canWriteRecords } from "@/lib/member-authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CardTypeDb, Json, VisibilityLevel, VoteValue } from "@/lib/supabase/types";

const workflowActions = new Set([
  "create-card",
  "add-message",
  "create-proposal",
  "cast-vote",
  "add-approval-condition",
]);

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableTextValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicRequestError("REQUEST_FIELD_REQUIRED", `${label} is required`);
  }

  return value.trim();
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;

  if (!workflowActions.has(action)) {
    return NextResponse.json({ error: "Unknown workflow action" }, { status: 404 });
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
    return NextResponse.json({ error: "Sign in as an active committee member to use writable workflows" }, { status: 401 });
  }

  if (!canWriteRecords(member.role, member.access_level)) {
    return NextResponse.json(
      { error: "This committee membership is read-only", code: "WRITE_CAPABILITY_REQUIRED" },
      { status: 403 },
    );
  }

  const activeMember = member;
  const activeUser = user;

  async function audit(cardId: string | null, eventAction: string, target: string, metadata: Json = {}) {
    const id = crypto.randomUUID();
    const { error } = await client.from("audit_log").insert({
      id,
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

  async function proposalIdFromPayload() {
    const proposalId = textValue(payload.proposalId, "");

    if (proposalId) {
      return proposalId;
    }

    const cardId = textValue(payload.cardId, "");
    const { data, error } = await client
      .from("proposals")
      .select("id")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw new PublicRequestError(
        "PROPOSAL_REQUIRED",
        "Create a proposal before adding votes or approval conditions",
        409,
      );
    }

    return data.id;
  }

  try {
    if (action === "create-card") {
      const id = crypto.randomUUID();
      const title = requiredText(payload.title, "Card title");
      const description = requiredText(payload.description, "Card description");
      const type = enumValue<CardTypeDb>(
        payload.type,
        ["maintenance", "quote", "invoice", "compliance", "budget", "project", "variation", "incident", "dispute", "meeting", "general"],
        "general",
      );
      const visibility = enumValue<VisibilityLevel>(payload.visibility, ["all", "admins", "custom"], "all");
      const { error } = await client.from("cards").insert({
        id,
        committee_id: activeMember.committee_id,
        title,
        description,
        type,
        visibility,
        creator_member_id: activeMember.id,
      });

      if (error) {
        throw error;
      }

      await audit(id, "Created card", title, { workflow: action });
      return NextResponse.json({ mode: "supabase", id, message: "Card created and audited" });
    }

    if (action === "add-message") {
      const id = crypto.randomUUID();
      const cardId = requiredText(payload.cardId, "Card");
      const body = requiredText(payload.body, "Message");
      const { error } = await client.from("messages").insert({
        id,
        committee_id: activeMember.committee_id,
        card_id: cardId,
        author_member_id: activeMember.id,
        body,
      });

      if (error) {
        throw error;
      }

      await audit(cardId, "Posted message", "Card discussion", { workflow: action, message_id: id });
      return NextResponse.json({ mode: "supabase", id, message: "Message posted and audited" });
    }

    if (action === "create-proposal") {
      const id = crypto.randomUUID();
      const cardId = requiredText(payload.cardId, "Card");
      const title = requiredText(payload.title, "Proposal title");
      const { error } = await client.from("proposals").insert({
        id,
        committee_id: activeMember.committee_id,
        card_id: cardId,
        title,
        rationale: textValue(payload.rationale, "Created from the writable workflow."),
        created_by_member_id: activeMember.id,
      });

      if (error) {
        throw error;
      }

      await audit(cardId, "Created proposal", title, { workflow: action, proposal_id: id });
      return NextResponse.json({ mode: "supabase", id, message: "Proposal created and audited" });
    }

    if (action === "cast-vote") {
      const id = crypto.randomUUID();
      const proposalId = await proposalIdFromPayload();
      const vote = enumValue<VoteValue>(payload.vote, ["yes", "no", "abstain"], "yes");
      const { error } = await client.from("votes").insert({
        id,
        committee_id: activeMember.committee_id,
        proposal_id: proposalId,
        member_id: activeMember.id,
        vote,
        note: textValue(payload.note, ""),
      });

      if (error) {
        throw error;
      }

      await audit(nullableTextValue(payload.cardId), "Cast vote", proposalId, {
        workflow: action,
        vote_id: id,
        vote,
      });
      return NextResponse.json({ mode: "supabase", id, message: "Vote cast and audited" });
    }

    const id = crypto.randomUUID();
    const proposalId = await proposalIdFromPayload();
    const condition = requiredText(payload.condition, "Approval condition");
    const { error } = await client.from("approval_conditions").insert({
      id,
      committee_id: activeMember.committee_id,
      proposal_id: proposalId,
      condition_text: condition,
      created_by_member_id: activeMember.id,
    });

    if (error) {
      throw error;
    }

    await audit(nullableTextValue(payload.cardId), "Added approval condition", proposalId, {
      workflow: action,
      condition_id: id,
    });
    return NextResponse.json({ mode: "supabase", id, message: "Approval condition added and audited" });
  } catch (error) {
    return operationFailureResponse(error, {
      code: "WORKFLOW_OPERATION_FAILED",
      message: "The workflow operation could not be completed.",
    });
  }
}

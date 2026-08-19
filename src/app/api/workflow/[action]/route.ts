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
  "create-motion",
  "advance-motion",
  "update-motion",
  "request-approval",
  "respond-approval",
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

  async function audit(
    cardId: string | null,
    eventAction: string,
    target: string,
    metadata: Json = {},
    motionId?: string,
  ) {
    const id = crypto.randomUUID();
    const { error } = await client.from("audit_log").insert({
      id,
      committee_id: activeMember.committee_id,
      card_id: cardId,
      motion_id: motionId ?? null,
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

    if (action === "create-motion") {
      const id = crypto.randomUUID();
      const title = requiredText(payload.title, "Motion title");
      const context = textValue(payload.context, "");
      const { error } = await client.from("motions").insert({
        id,
        committee_id: activeMember.committee_id,
        title,
        context,
        creator_member_id: activeMember.id,
      });

      if (error) {
        throw error;
      }

      await audit(null, "Created motion", title, { workflow: action }, id);
      return NextResponse.json({ mode: "supabase", id, message: "Motion created and audited" });
    }

    if (action === "advance-motion") {
      const motionId = requiredText(payload.motionId, "Motion");
      const rawTo = typeof payload.to === "string" ? payload.to : "";
      if (rawTo !== "open" && rawTo !== "decided" && rawTo !== "withdrawn") {
        throw new PublicRequestError("REQUEST_FIELD_REQUIRED", "Target state is required");
      }
      const to = rawTo;

      const { data: current, error: fetchError } = await client
        .from("motions")
        .select("status")
        .eq("id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }
      if (!current) {
        throw new PublicRequestError(
          "MOTION_NOT_FOUND",
          "Motion was not found in your committee",
          404,
        );
      }

      const from = current.status;
      const legal =
        (from === "draft" && to === "open") ||
        (from === "open" && to === "decided") ||
        (from === "open" && to === "withdrawn");
      if (!legal) {
        throw new PublicRequestError(
          "ILLEGAL_MOTION_TRANSITION",
          `A ${from} motion cannot move to ${to}`,
          409,
        );
      }

      const { error: updateError } = await client
        .from("motions")
        .update({ status: to })
        .eq("id", motionId);

      if (updateError) {
        // guard_motion raises on illegal transitions or terminal-state edits.
        // (guard_motion_outcome no longer raises: it assigns passed/failed from
        // the votes cast for every open->decided transition. A bare decide with
        // no votes records 'failed'; no decided motion is left NULL.)
        throw new PublicRequestError(
          "ILLEGAL_MOTION_TRANSITION",
          "The motion cannot move to that state",
          409,
        );
      }

      await audit(
        null,
        "Advanced motion",
        `${from}->${to}`,
        { workflow: action, motion_id: motionId, from, to },
        motionId,
      );

      if (to === "decided") {
        const { data: decided, error: outcomeError } = await client
          .from("motions")
          .select("outcome")
          .eq("id", motionId)
          .maybeSingle();

        if (outcomeError) {
          throw outcomeError;
        }

        return NextResponse.json({
          mode: "supabase",
          id: motionId,
          message: `Motion advanced to ${to}`,
          status: to,
          outcome: decided?.outcome ?? null,
        });
      }

      return NextResponse.json({
        mode: "supabase",
        id: motionId,
        message: `Motion advanced to ${to}`,
        status: to,
      });
    }

    if (action === "update-motion") {
      const motionId = requiredText(payload.motionId, "Motion");
      const title = requiredText(payload.title, "Motion title");
      const context = textValue(payload.context, "");
      const { data: current, error: fetchError } = await client
        .from("motions")
        .select("status")
        .eq("id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }
      if (!current) {
        throw new PublicRequestError(
          "MOTION_NOT_FOUND",
          "Motion was not found in your committee",
          404,
        );
      }
      if (current.status !== "draft") {
        throw new PublicRequestError(
          "MOTION_NOT_EDITABLE",
          "Only draft motions can be edited",
          409,
        );
      }

      const { error } = await client
        .from("motions")
        .update({ title, context })
        .eq("id", motionId);

      if (error) {
        throw error;
      }

      await audit(null, "Updated motion draft", title, { workflow: action, motion_id: motionId }, motionId);
      return NextResponse.json({ mode: "supabase", id: motionId, message: "Motion updated and audited" });
    }

    if (action === "request-approval") {
      const motionId = requiredText(payload.motionId, "Motion");
      const { data: motion, error: motionError } = await client
        .from("motions")
        .select("status")
        .eq("id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (motionError) {
        throw motionError;
      }
      if (!motion) {
        throw new PublicRequestError(
          "MOTION_NOT_FOUND",
          "Motion was not found in your committee",
          404,
        );
      }
      if (motion.status !== "open") {
        throw new PublicRequestError(
          "MOTION_NOT_OPEN",
          "Approval can only be requested on an open motion",
          409,
        );
      }

      const { data: existing, error: existingError } = await client
        .from("approval_requests")
        .select("id")
        .eq("motion_id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }
      if (existing) {
        return NextResponse.json({
          mode: "supabase",
          id: existing.id,
          message: "Approval request already exists for this motion",
        });
      }

      const id = crypto.randomUUID();
      const { error } = await client.from("approval_requests").insert({
        id,
        committee_id: activeMember.committee_id,
        motion_id: motionId,
        opened_by_member_id: activeMember.id,
      });

      if (error) {
        throw error;
      }

      await audit(
        null,
        "Requested approval",
        "Approval request opened",
        { workflow: action, motion_id: motionId },
        motionId,
      );
      return NextResponse.json({
        mode: "supabase",
        id,
        message: "Approval request opened and audited",
      });
    }

    if (action === "respond-approval") {
      const motionId = requiredText(payload.motionId, "Motion");
      const rawResponse = typeof payload.response === "string" ? payload.response : "";
      if (rawResponse !== "approve" && rawResponse !== "reject") {
        throw new PublicRequestError("REQUEST_FIELD_REQUIRED", "Response must be approve or reject");
      }
      const response = rawResponse;

      const { data: motion, error: motionError } = await client
        .from("motions")
        .select("status")
        .eq("id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (motionError) {
        throw motionError;
      }
      if (!motion) {
        throw new PublicRequestError(
          "MOTION_NOT_FOUND",
          "Motion was not found in your committee",
          404,
        );
      }
      if (motion.status !== "open") {
        throw new PublicRequestError(
          "MOTION_NOT_OPEN",
          "Approval can only be recorded while the motion is open",
          409,
        );
      }

      const { data: request, error: requestError } = await client
        .from("approval_requests")
        .select("id")
        .eq("motion_id", motionId)
        .eq("committee_id", activeMember.committee_id)
        .maybeSingle();

      if (requestError) {
        throw requestError;
      }
      if (!request) {
        throw new PublicRequestError(
          "APPROVAL_REQUEST_NOT_FOUND",
          "No approval request exists for this motion",
          409,
        );
      }

      const { error: responseError } = await client
        .from("approval_responses")
        .upsert(
          {
            committee_id: activeMember.committee_id,
            approval_request_id: request.id,
            member_id: activeMember.id,
            response,
            responded_at: new Date().toISOString(),
          },
          { onConflict: "approval_request_id,member_id" },
        );

      if (responseError) {
        throw responseError;
      }

      await audit(
        null,
        "Responded to approval",
        response,
        { workflow: action, motion_id: motionId, response },
        motionId,
      );
      return NextResponse.json({
        mode: "supabase",
        message: "Approval response recorded and audited",
      });
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

import { createHash } from "node:crypto";

import type { Json } from "../../src/lib/supabase/types";
import {
  evalFixtureSaveConditionDraft,
  evalFixtureSaveProposalDraft,
  isEvalFixtureEnabled,
} from "./eval-fixtures";
import { findVisibleCard, type AgentScope } from "./scoped-data";
import { getAgentAdminClient } from "./supabase";

function stableUuid(namespace: string, callId: string) {
  const bytes = createHash("sha256").update(`${namespace}:${callId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function upsertAudit(input: {
  auditId: string;
  cardId: string;
  scope: AgentScope;
  target: string;
  metadata: Json;
}) {
  const { error } = await getAgentAdminClient().from("audit_log").upsert(
    {
      id: input.auditId,
      committee_id: input.scope.committeeId,
      card_id: input.cardId,
      user_id: input.scope.userId,
      action: "Saved operator-approved Eve draft",
      target: input.target,
      metadata: input.metadata,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error("The Eve draft audit record could not be persisted.");
}

export async function saveProposalDraft(input: {
  callId: string;
  cardId: string;
  deadline?: string;
  rationale: string;
  scope: AgentScope;
  title: string;
}) {
  const card = await findVisibleCard(input.scope, input.cardId);
  if (!card) throw new Error("The target card is not visible to the operator.");

  const draftId = stableUuid("eve-proposal-draft", input.callId);
  const auditId = stableUuid("eve-proposal-draft-audit", input.callId);
  if (isEvalFixtureEnabled()) {
    return evalFixtureSaveProposalDraft(input.scope, {
      auditId,
      cardId: card.id,
      deadline: input.deadline ?? null,
      draftId,
      rationale: input.rationale,
      title: input.title,
    });
  }

  const { data, error } = await getAgentAdminClient()
    .from("proposals")
    .upsert(
      {
        id: draftId,
        committee_id: input.scope.committeeId,
        card_id: card.id,
        title: input.title,
        rationale: input.rationale,
        status: "draft",
        deadline: input.deadline ?? null,
        created_by_member_id: input.scope.memberId,
      },
      { onConflict: "id" },
    )
    .select("id,card_id,title,rationale,status,deadline,created_at")
    .single();

  if (error || !data) throw new Error("The proposal draft could not be persisted.");
  await upsertAudit({
    auditId,
    cardId: card.id,
    scope: input.scope,
    target: input.title,
    metadata: { draft_kind: "proposal", draft_id: draftId, eve_call_id: input.callId },
  });

  return {
    status: "draft_saved" as const,
    persisted: true,
    draft: data,
    citations: [
      { ref: `proposal:${draftId}`, label: `proposal draft: ${input.title}` },
      { ref: `audit:${auditId}`, label: "operator approval audit" },
    ],
  };
}

export async function saveConditionDraft(input: {
  callId: string;
  cardId: string;
  condition: string;
  proposalId: string;
  scope: AgentScope;
}) {
  const card = await findVisibleCard(input.scope, input.cardId);
  if (!card) throw new Error("The target card is not visible to the operator.");

  const admin = isEvalFixtureEnabled() ? null : getAgentAdminClient();
  if (admin) {
    const { data: proposal, error } = await admin
      .from("proposals")
      .select("id")
      .eq("id", input.proposalId)
      .eq("card_id", card.id)
      .eq("committee_id", input.scope.committeeId)
      .maybeSingle();
    if (error || !proposal) throw new Error("The target proposal is not visible to the operator.");
  }

  const draftId = stableUuid("eve-condition-draft", input.callId);
  const auditId = stableUuid("eve-condition-draft-audit", input.callId);
  if (isEvalFixtureEnabled()) {
    return evalFixtureSaveConditionDraft(input.scope, {
      auditId,
      cardId: card.id,
      condition: input.condition,
      draftId,
      proposalId: input.proposalId,
    });
  }

  const { data, error } = await admin!
    .from("approval_conditions")
    .upsert(
      {
        id: draftId,
        committee_id: input.scope.committeeId,
        proposal_id: input.proposalId,
        condition_text: input.condition,
        status: "draft",
        created_by_member_id: input.scope.memberId,
      },
      { onConflict: "id" },
    )
    .select("id,proposal_id,condition_text,status,created_at")
    .single();

  if (error || !data) throw new Error("The approval-condition draft could not be persisted.");
  await upsertAudit({
    auditId,
    cardId: card.id,
    scope: input.scope,
    target: input.condition,
    metadata: { draft_kind: "approval_condition", draft_id: draftId, eve_call_id: input.callId },
  });

  return {
    status: "draft_saved" as const,
    persisted: true,
    draft: data,
    citations: [
      { ref: `condition:${draftId}`, label: "approval-condition draft" },
      { ref: `audit:${auditId}`, label: "operator approval audit" },
    ],
  };
}

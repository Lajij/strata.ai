import type { ApprovalContext, ApprovalStatus, ToolContext } from "eve/tools";

import { EVAL_FIXTURE_IDS, isEvalFixtureEnabled } from "./eval-fixtures";
import { type AgentScope, requireActiveScope, requireActiveSessionScope } from "./scoped-data";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configuredOperatorUserId() {
  const value = process.env.STRATA_EVE_APPROVER_USER_ID?.trim();
  return value && UUID_PATTERN.test(value) ? value : null;
}

function operatorIdentityIsConfigured() {
  return isEvalFixtureEnabled() || configuredOperatorUserId() !== null;
}

function operatorMatches(scope: AgentScope) {
  if (isEvalFixtureEnabled()) return scope.userId === EVAL_FIXTURE_IDS.adminUser;
  const configured = configuredOperatorUserId();
  return configured !== null && scope.userId === configured;
}

export async function requireOperatorApproval(ctx: ApprovalContext): Promise<ApprovalStatus> {
  try {
    const scope = await requireActiveSessionScope(ctx.session);
    if (!operatorMatches(scope)) {
      return {
        type: "denied",
        reason: operatorIdentityIsConfigured()
          ? "Only the configured repository operator may approve Eve drafts."
          : "The repository operator approver identity is not configured.",
      };
    }
    return "user-approval";
  } catch {
    return { type: "denied", reason: "An active operator membership is required to approve Eve drafts." };
  }
}

export async function requireOperatorApprover(ctx: ToolContext) {
  const scope = await requireActiveScope(ctx);
  if (!operatorMatches(scope)) {
    throw new Error(
      operatorIdentityIsConfigured()
        ? "Only the configured repository operator may persist Eve drafts."
        : "The repository operator approver identity is not configured.",
    );
  }
  return scope;
}

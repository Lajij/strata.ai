import "server-only";

import { PublicRequestError } from "@/lib/runtime-configuration";
import {
  hasMemberCapability,
  type MemberAccessLevel,
} from "@/lib/member-capabilities";
import type { MemberRole, MemberStatus } from "@/lib/supabase/types";

export type { MemberAccessLevel } from "@/lib/member-capabilities";

export const memberRoles = new Set<MemberRole>([
  "admin",
  "chair",
  "secretary",
  "treasurer",
  "member",
  "strata_manager",
]);
export const memberStatuses = new Set<MemberStatus>(["active", "invited", "suspended"]);
export const memberAccessLevels = new Set<MemberAccessLevel>([
  "admin",
  "member",
  "limited_admin",
  "read_only",
]);

export function canManageMembers(role: string, accessLevel: string): boolean {
  return hasMemberCapability(
    { role, accessLevel, status: "active" },
    "manage_members",
  );
}

export function canWriteRecords(role: string, accessLevel: string): boolean {
  return hasMemberCapability(
    { role, accessLevel, status: "active" },
    "write_records",
  );
}

export function canManageFinance(role: string, accessLevel: string): boolean {
  return hasMemberCapability(
    { role, accessLevel, status: "active" },
    "manage_finance",
  );
}

export function canConfirmFinancialFigures(role: string, accessLevel: string): boolean {
  return hasMemberCapability(
    { role, accessLevel, status: "active" },
    "confirm_financial_figures",
  );
}

export function assertMemberLifecycleTransition(
  previousStatus: MemberStatus,
  nextStatus: MemberStatus,
  hasAuthUser: boolean,
) {
  if (nextStatus === "active" && !hasAuthUser) {
    throw new PublicRequestError(
      "MEMBER_AUTH_REQUIRED",
      "Invited members must sign in before they can be marked active",
    );
  }

  if (previousStatus !== "invited" && nextStatus === "invited") {
    throw new PublicRequestError(
      "MEMBER_STATUS_TRANSITION_INVALID",
      "Active or suspended members cannot be moved back to invited",
    );
  }
}

export function assertInviteCanBePrepared(existingStatus: MemberStatus | undefined) {
  if (existingStatus === "active") {
    throw new PublicRequestError(
      "MEMBER_ALREADY_ACTIVE",
      "This email already belongs to an active member; use member management instead",
      409,
    );
  }

  if (existingStatus === "suspended") {
    throw new PublicRequestError(
      "MEMBER_SUSPENDED",
      "This email belongs to a suspended member; reactivate it through member management instead",
      409,
    );
  }
}

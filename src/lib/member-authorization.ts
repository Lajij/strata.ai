import "server-only";

import type { MemberRole, MemberStatus } from "@/lib/supabase/types";

export type MemberAccessLevel = "admin" | "member" | "limited_admin" | "read_only";

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

const memberCapabilities: Record<MemberRole, { manageMembers: boolean }> = {
  admin: { manageMembers: true },
  chair: { manageMembers: true },
  secretary: { manageMembers: true },
  treasurer: { manageMembers: false },
  member: { manageMembers: false },
  strata_manager: { manageMembers: false },
};

export function canManageMembers(role: string): boolean {
  return memberRoles.has(role as MemberRole) && memberCapabilities[role as MemberRole].manageMembers;
}

export function assertMemberLifecycleTransition(
  previousStatus: MemberStatus,
  nextStatus: MemberStatus,
  hasAuthUser: boolean,
) {
  if (nextStatus === "active" && !hasAuthUser) {
    throw new Error("Invited members must sign in before they can be marked active");
  }

  if (previousStatus !== "invited" && nextStatus === "invited") {
    throw new Error("Active or suspended members cannot be moved back to invited");
  }
}

export function assertInviteCanBePrepared(existingStatus: MemberStatus | undefined) {
  if (existingStatus === "active") {
    throw new Error("This email already belongs to an active member; use member management instead");
  }

  if (existingStatus === "suspended") {
    throw new Error("This email belongs to a suspended member; reactivate it through member management instead");
  }
}

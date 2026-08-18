import type { MemberRole, MemberStatus } from "@/lib/supabase/types";

export type MemberAccessLevel = "admin" | "member" | "limited_admin" | "read_only";
export type MemberCapability =
  | "read_committee"
  | "write_records"
  | "manage_members"
  | "manage_finance"
  | "confirm_financial_figures";

export type CapabilityPrincipal = {
  role: MemberRole | string;
  status: MemberStatus | string;
  accessLevel: MemberAccessLevel | string;
};

const memberManagementRoles = new Set(["admin", "chair", "secretary"]);
const financialRoles = new Set(["admin", "chair", "treasurer"]);

export function hasMemberCapability(
  principal: CapabilityPrincipal,
  capability: MemberCapability,
): boolean {
  if (principal.status !== "active") {
    return false;
  }

  if (capability === "read_committee") {
    return true;
  }

  if (principal.accessLevel === "read_only") {
    return false;
  }

  if (capability === "write_records") {
    return true;
  }

  if (capability === "manage_members") {
    return memberManagementRoles.has(principal.role);
  }

  // Provisional technical default pending the real-building human authority
  // decision: admin, chair, and treasurer. Access level can only restrict it.
  return financialRoles.has(principal.role);
}

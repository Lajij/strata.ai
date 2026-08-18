import { NextRequest, NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/strata-app-data";
import {
  assertMemberLifecycleTransition,
  canManageMembers,
  memberAccessLevels,
  memberRoles,
  memberStatuses,
  type MemberAccessLevel,
} from "@/lib/member-authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole, MemberStatus } from "@/lib/supabase/types";

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, label: string) {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${label} is invalid`);
  }

  return value as T;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "fallback",
      message: "Supabase env vars are not set, so the local fallback member update returned a mock success",
    });
  }

  const member = await getCurrentMember(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!member || !user) {
    return NextResponse.json({ error: "Sign in as an active admin member to manage committee users" }, { status: 401 });
  }

  if (!canManageMembers(member.role)) {
    return NextResponse.json({ error: "Only admin, chair, or secretary members can manage users" }, { status: 403 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const memberId = stringValue(payload.memberId, "Member ID");
    const fullName = stringValue(payload.fullName, "Name");
    const role = enumValue(payload.role, memberRoles, "Role") as MemberRole;
    const status = enumValue(payload.status, memberStatuses, "Status") as MemberStatus;
    const accessLevel = enumValue(payload.accessLevel, memberAccessLevels, "Access level") as MemberAccessLevel;

    const { data: target, error: targetError } = await supabase
      .from("members")
      .select("id,committee_id,user_id,email,full_name,role,status,access_level")
      .eq("id", memberId)
      .eq("committee_id", member.committee_id)
      .single();

    if (targetError || !target) {
      throw new Error(targetError?.message ?? "Member was not found");
    }

    if (target.id === member.id && (target.role !== role || target.status !== status || target.access_level !== accessLevel)) {
      throw new Error("You cannot change your own role, access level, or active status");
    }

    assertMemberLifecycleTransition(target.status, status, Boolean(target.user_id));

    const { data: updated, error: updateError } = await supabase
      .from("members")
      .update({
        full_name: fullName,
        role,
        status,
        access_level: accessLevel,
      })
      .eq("id", memberId)
      .eq("committee_id", member.committee_id)
      .select("id,email,full_name,role,status,access_level")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      mode: "supabase",
      member: updated,
      message: "Member access updated and audited",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Member update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

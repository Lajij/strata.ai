import { NextRequest, NextResponse } from "next/server";
import { PublicRequestError, fixtureWriteDisabledResponse, isMissingAuthSession, operationFailureResponse, runtimeFailureResponse, upstreamUnavailable } from "@/lib/runtime-configuration";
import { getCurrentMember } from "@/lib/strata-app-data";
import {
  assertInviteCanBePrepared,
  canManageMembers,
  memberAccessLevels,
  memberRoles,
  type MemberAccessLevel,
} from "@/lib/member-authorization";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole, MemberStatus } from "@/lib/supabase/types";

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicRequestError("REQUEST_FIELD_REQUIRED", `${label} is required`);
  }

  return value.trim();
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = await getSupabaseServerClient();
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!supabase) {
    return fixtureWriteDisabledResponse();
  }

  let member;
  let user;

  try {
    member = await getCurrentMember(supabase);
    const userResult = await supabase.auth.getUser();

    if (userResult.error && !isMissingAuthSession(userResult.error)) {
      throw upstreamUnavailable("SUPABASE_AUTH_UNAVAILABLE");
    }

    user = userResult.data.user;
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!member || !user) {
    return NextResponse.json({ error: "Sign in as an active admin member to invite committee users" }, { status: 401 });
  }

  if (!canManageMembers(member.role, member.access_level)) {
    return NextResponse.json({ error: "Only admin, chair, or secretary members can invite users" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Server invite configuration is missing" }, { status: 503 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = stringValue(payload.email, "Email").toLowerCase();
    const fullName = stringValue(payload.fullName, "Name");
    const role = optionalEnum(payload.role, memberRoles, "member") as MemberRole;
    const accessLevel = optionalEnum(
      payload.accessLevel,
      memberAccessLevels,
      role === "admin" ? "admin" : "member",
    ) as MemberAccessLevel;
    const now = new Date().toISOString();
    const redirectTo = new URL("/", request.url).toString();

    const { data: existing, error: existingError } = await admin
      .from("members")
      .select("id,status,user_id")
      .eq("committee_id", member.committee_id)
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    assertInviteCanBePrepared(existing?.status as MemberStatus | undefined);

    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        committee_id: member.committee_id,
      },
      redirectTo,
    });
    const authUserId = inviteResult.data.user?.id ?? existing?.user_id ?? null;

    const { data: savedMember, error: saveError } = await admin
      .from("members")
      .upsert(
        {
          id: existing?.id,
          committee_id: member.committee_id,
          user_id: authUserId,
          email,
          full_name: fullName,
          role,
          status: "invited",
          access_level: accessLevel,
          invited_by: user.id,
          invited_by_member_id: member.id,
          invited_at: now,
          accepted_at: null,
        },
        { onConflict: "committee_id,email" },
      )
      .select("id,status,email,full_name,role,access_level")
      .single();

    if (saveError) {
      throw saveError;
    }

    if (inviteResult.error) {
      return NextResponse.json(
        {
          error: "The member invite row was saved, but the invite email could not be sent.",
          code: "MEMBER_INVITE_EMAIL_FAILED",
          member: savedMember,
          inviteEmailSent: false,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      mode: "supabase",
      member: savedMember,
      inviteEmailSent: true,
      message: "Member invited and roster updated",
    });
  } catch (error) {
    return operationFailureResponse(error, {
      code: "MEMBER_INVITE_FAILED",
      message: "The member invite could not be completed.",
    });
  }
}

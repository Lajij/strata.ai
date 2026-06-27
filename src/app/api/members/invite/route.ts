import { NextRequest, NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/strata-app-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/supabase/types";

const adminRoles = new Set(["admin", "chair", "secretary"]);
const memberRoles = new Set(["admin", "chair", "secretary", "treasurer", "member", "strata_manager"]);
const accessLevels = new Set(["admin", "member", "limited_admin", "read_only"]);

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "fallback",
      message: "Supabase env vars are not set, so the local fallback invite returned a mock success",
    });
  }

  const member = await getCurrentMember(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!member || !user) {
    return NextResponse.json({ error: "Sign in as an active admin member to invite committee users" }, { status: 401 });
  }

  if (!adminRoles.has(member.role)) {
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
    const accessLevel = optionalEnum(payload.accessLevel, accessLevels, role === "admin" ? "admin" : "member");
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

    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        committee_id: member.committee_id,
      },
      redirectTo,
    });
    const authUserId = inviteResult.data.user?.id ?? existing?.user_id ?? null;
    const nextStatus = existing?.status === "active" ? "active" : "invited";

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
          status: nextStatus,
          access_level: accessLevel,
          invited_by: user.id,
          invited_by_member_id: member.id,
          invited_at: existing?.status === "active" ? null : now,
          accepted_at: existing?.status === "active" ? now : null,
        },
        { onConflict: "committee_id,email" },
      )
      .select("id,status,email,full_name,role,access_level")
      .single();

    if (saveError) {
      throw saveError;
    }

    await admin.from("audit_log").insert({
      committee_id: member.committee_id,
      user_id: user.id,
      action: "Invited member",
      target: email,
      metadata: {
        workflow: "member-invite",
        member_id: savedMember.id,
        status: savedMember.status,
        role,
        access_level: accessLevel,
        invite_email_sent: !inviteResult.error,
        invite_error: inviteResult.error ? "Invite email could not be sent; member row was still prepared" : null,
      },
    });

    return NextResponse.json({
      mode: "supabase",
      member: savedMember,
      inviteEmailSent: !inviteResult.error,
      message: inviteResult.error
        ? "Member invite row saved, but Supabase could not send the invite email"
        : "Member invited and roster updated",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

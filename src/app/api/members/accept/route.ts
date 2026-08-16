import { NextRequest, NextResponse } from "next/server";
import { fixtureWriteDisabledResponse, isMissingAuthSession, operationFailureResponse, runtimeFailureResponse, upstreamUnavailable } from "@/lib/runtime-configuration";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  return header.slice("bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = await getSupabaseServerClient(bearerToken(request));
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!supabase) {
    return fixtureWriteDisabledResponse();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isMissingAuthSession(userError)) {
    return runtimeFailureResponse(upstreamUnavailable("SUPABASE_AUTH_UNAVAILABLE"));
  }

  if (!user?.email) {
    return NextResponse.json({ error: "Sign in before accepting a committee invite" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Server invite configuration is missing" }, { status: 503 });
  }

  const email = user.email.toLowerCase();
  const now = new Date().toISOString();

  const { data: activeMember, error: activeError } = await admin
    .from("members")
    .select("id,committee_id,email,full_name,role,status,access_level")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeError) {
    return operationFailureResponse(activeError, {
      code: "MEMBER_LOOKUP_FAILED",
      message: "The active member lookup could not be completed.",
    });
  }

  if (activeMember) {
    return NextResponse.json({ mode: "supabase", member: activeMember, message: "Member session already active" });
  }

  const { data: invitedRows, error: invitedError } = await admin
    .from("members")
    .select("id,committee_id,email,full_name,role,status,access_level,user_id")
    .eq("email", email)
    .eq("status", "invited")
    .order("created_at", { ascending: true })
    .limit(10);

  if (invitedError) {
    return operationFailureResponse(invitedError, {
      code: "MEMBER_INVITE_LOOKUP_FAILED",
      message: "The pending invite lookup could not be completed.",
    });
  }

  const invite = invitedRows?.find((row) => !row.user_id || row.user_id === user.id);

  if (!invite) {
    return NextResponse.json({ error: "No pending committee invite matches this signed-in email" }, { status: 403 });
  }

  const { data: updatedMember, error: updateError } = await admin
    .from("members")
    .update({
      user_id: user.id,
      status: "active",
      accepted_at: now,
    })
    .eq("id", invite.id)
    .select("id,committee_id,email,full_name,role,status,access_level")
    .single();

  if (updateError) {
    return operationFailureResponse(updateError, {
      code: "MEMBER_ACCEPT_FAILED",
      message: "The member invite could not be accepted.",
    });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: invite.full_name,
  });

  if (profileError) {
    return operationFailureResponse(profileError, {
      code: "MEMBER_PROFILE_SYNC_FAILED",
      message: "The member was activated, but profile synchronisation did not complete.",
      status: 502,
    });
  }

  return NextResponse.json({
    mode: "supabase",
    member: updatedMember,
    message: "Invite accepted and member session activated",
  });
}

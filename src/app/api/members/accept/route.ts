import { NextRequest, NextResponse } from "next/server";
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
  const supabase = await getSupabaseServerClient(bearerToken(request));

  if (!supabase) {
    return NextResponse.json({
      mode: "fallback",
      message: "Supabase env vars are not set, so the local fallback accept flow returned a mock success",
    });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
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
    return NextResponse.json({ error: activeError.message }, { status: 400 });
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
    return NextResponse.json({ error: invitedError.message }, { status: 400 });
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
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: invite.full_name,
  });

  return NextResponse.json({
    mode: "supabase",
    member: updatedMember,
    message: "Invite accepted and member session activated",
  });
}

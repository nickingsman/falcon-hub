import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { hashInvitationCode, normalizeInvitationCode, normalizeInvitationEmail } from "@/lib/falcon-invitations";

const minimumPasswordLength = 8;

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeInvitationEmail(body.email);
    const password = getStringValue(body.password);
    const confirmPassword = getStringValue(body.confirmPassword);
    const inviteCode = normalizeInvitationCode(body.inviteCode);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < minimumPasswordLength) {
      return NextResponse.json(
        { error: `Password must be at least ${minimumPasswordLength} characters` },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const codeHash = hashInvitationCode(inviteCode);
    const { data: invitation, error: invitationError } = await supabase
      .from("falcon_invitations")
      .select("id, expires_at")
      .eq("email", email)
      .eq("code_hash", codeHash)
      .eq("status", "active")
      .is("used_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (
      invitationError ||
      !invitation ||
      (invitation.expires_at && new Date(invitation.expires_at) <= new Date())
    ) {
      return NextResponse.json(
        { error: "Invalid or expired invitation code." },
        { status: 400 },
      );
    }

    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: "Unable to register with this invitation." },
        { status: 400 },
      );
    }

    const { data: consumedInvitationId, error: consumeError } = await supabase.rpc(
      "consume_falcon_invitation",
      { p_email: email, p_code_hash: codeHash, p_auth_user_id: createdUser.user.id },
    );
    if (consumeError || !consumedInvitationId) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json(
        { error: "Invalid or expired invitation code." },
        { status: 400 },
      );
    }

    const { error: profileError } = await supabase.from("user_profiles").insert({
      auth_user_id: createdUser.user.id,
      member_id: null,
      role: "agent",
      status: "pending_approval",
    });

    if (profileError) {
      await supabase.rpc("release_falcon_invitation", {
        p_invitation_id: consumedInvitationId,
        p_auth_user_id: createdUser.user.id,
      });
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      throw profileError;
    }

    return NextResponse.json(
      { success: true, email },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to register account",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { generateInvitationCode, hashInvitationCode, normalizeInvitationEmail } from "@/lib/falcon-invitations";
import { requireAdminUserManagementAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isValidDateString } from "@/lib/malaysia-date";

export const dynamic = "force-dynamic";

const invitationFields = "id, email, status, expires_at, used_at, created_at, revoked_at";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invitationError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const authorization = await requireAdminUserManagementAccess();
  if (!authorization.authorized) return authorization.response;

  try {
    const supabase = createSupabaseAdminClient();
    const { error: expiryError } = await supabase.from("falcon_invitations").update({ status: "expired" })
      .eq("status", "active").lt("expires_at", new Date().toISOString());
    if (expiryError) throw expiryError;

    const { data, error } = await supabase.from("falcon_invitations")
      .select(invitationFields).order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ invitations: data ?? [] });
  } catch (error) {
    console.error("GET /api/admin/invitations error:", error);
    return invitationError("Unable to load invitations", 500);
  }
}

export async function POST(request: Request) {
  const authorization = await requireAdminUserManagementAccess();
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
    const email = normalizeInvitationEmail(body.email);
    const expiresOn = typeof body.expiresOn === "string" ? body.expiresOn : "";
    if (!emailPattern.test(email) || email.length > 320) return invitationError("Enter a valid email address");
    if (expiresOn && !isValidDateString(expiresOn)) return invitationError("Expiry date is invalid");

    const expiresAt = expiresOn ? new Date(`${expiresOn}T15:59:59.999Z`) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
      return invitationError("Expiry date must be in the future");
    }

    const supabase = createSupabaseAdminClient();
    const { error: expiryError } = await supabase.from("falcon_invitations").update({ status: "expired" })
      .eq("email", email).eq("status", "active").lt("expires_at", new Date().toISOString());
    if (expiryError) throw expiryError;

    const code = generateInvitationCode();
    const { data, error } = await supabase.from("falcon_invitations").insert({
      email,
      code_hash: hashInvitationCode(code),
      expires_at: expiresAt?.toISOString() ?? null,
      created_by: authorization.user.id,
    }).select(invitationFields).single();

    if (error?.code === "23505") return invitationError("An active invitation already exists for this email", 409);
    if (error) throw error;
    return NextResponse.json({ invitation: data, code }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/invitations error:", error);
    return invitationError("Unable to create invitation", 500);
  }
}

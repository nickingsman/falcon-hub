import { NextResponse } from "next/server";
import { requireAdminUserManagementAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await requireAdminUserManagementAccess();
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invitation is invalid" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("falcon_invitations").update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "active").select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Only an active invitation can be revoked" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/invitations/[id]/revoke error:", error);
    return NextResponse.json({ error: "Unable to revoke invitation" }, { status: 500 });
  }
}

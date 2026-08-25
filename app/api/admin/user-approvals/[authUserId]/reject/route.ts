import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireUserApprovalAccess } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ authUserId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await requireUserApprovalAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { authUserId } = await params;

    if (authUserId === authorization.user.id) {
      return NextResponse.json(
        { error: "You cannot reject your own account" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("user_profiles")
      .select("auth_user_id, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (targetProfileError) {
      throw targetProfileError;
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    if (targetProfile.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Registration is no longer pending approval" },
        { status: 409 }
      );
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_profiles")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: authorization.user.id,
      })
      .eq("auth_user_id", authUserId)
      .eq("status", "pending_approval")
      .select("auth_user_id, status")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Registration is no longer pending approval" },
        { status: 409 }
      );
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("POST /api/admin/user-approvals/[authUserId]/reject error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reject registration",
      },
      { status: 500 }
    );
  }
}

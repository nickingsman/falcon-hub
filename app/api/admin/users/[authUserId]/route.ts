import { NextResponse } from "next/server";
import { requireAdminUserManagementAccess } from "@/lib/permissions";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import { isMemberPosition } from "@/lib/member-options";

type RouteContext = {
  params: Promise<{ authUserId: string }>;
};

type UserManagementPayload = {
  role?: unknown;
  memberProfile?: Record<string, unknown>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireAdminUserManagementAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { authUserId } = await params;
    const body = (await request.json()) as UserManagementPayload;

    if (body.memberProfile !== undefined && (
      !body.memberProfile ||
      typeof body.memberProfile !== "object" ||
      Array.isArray(body.memberProfile)
    )) {
      return NextResponse.json(
        { error: "Member profile payload is invalid" },
        { status: 400 }
      );
    }

    const memberProfile = body.memberProfile;
    const displayName = typeof memberProfile?.display_name === "string"
      ? memberProfile.display_name.trim() || null
      : memberProfile?.display_name === null || memberProfile?.display_name === undefined
        ? null
        : undefined;
    if (displayName === undefined || (displayName && displayName.length > 80)) {
      return NextResponse.json(
        { error: "Display Name must be 80 characters or fewer" },
        { status: 400 },
      );
    }
    if (
      memberProfile &&
      (typeof memberProfile.position !== "string" || !isMemberPosition(memberProfile.position))
    ) {
      return NextResponse.json(
        { error: "Select a valid Falcon position" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseSsrClient();
    const { error } = await supabase.rpc("manage_falconhub_user_with_display_name", {
      p_target_auth_user_id: authUserId,
      p_role: typeof body.role === "string" ? body.role : null,
      p_update_member_profile: Boolean(memberProfile),
      p_display_name: displayName,
      p_position: memberProfile?.position ?? null,
      p_employment_type: memberProfile?.employment_type ?? null,
      p_leader_id: memberProfile?.leader_id || null,
      p_join_date: memberProfile?.join_date || null,
      p_member_status: memberProfile?.status ?? null,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update user";
    const status =
      "code" in Object(error) && Object(error).code === "P0002"
        ? 404
        : "code" in Object(error) && Object(error).code === "42501"
        ? 403
        : "code" in Object(error) &&
            ["22023", "22P02", "23502", "23503", "23514"].includes(
              String(Object(error).code),
            )
          ? 400
          : 500;

    return NextResponse.json(
      {
        error: status < 500 ? message : "Unable to update user",
      },
      { status }
    );
  }
}

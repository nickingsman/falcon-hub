import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getAssignableUserRoles,
  requireUserApprovalAccess,
} from "@/lib/permissions";

export async function GET() {
  const authorization = await requireUserApprovalAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("auth_user_id, status, created_at")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });

    if (profilesError) {
      throw profilesError;
    }

    const pendingRegistrations = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: authUserData } = await supabase.auth.admin.getUserById(
          profile.auth_user_id
        );

        return {
          auth_user_id: profile.auth_user_id,
          email: authUserData.user?.email ?? null,
          created_at: authUserData.user?.created_at ?? profile.created_at,
          status: profile.status,
        };
      })
    );

    const { data: leaderOptions, error: leaderOptionsError } = await supabase
      .from("users")
      .select("id, member_code, full_name, display_name, position, employment_type")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("full_name", { ascending: true });

    if (leaderOptionsError) {
      throw leaderOptionsError;
    }

    return NextResponse.json({
      pendingRegistrations,
      assignableRoles: getAssignableUserRoles(authorization.profile),
      leaderOptions: leaderOptions ?? [],
    });
  } catch (error) {
    console.error("GET /api/admin/user-approvals error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load user approvals",
      },
      { status: 500 }
    );
  }
}

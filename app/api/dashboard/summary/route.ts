import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  getActiveMemberCount,
  getScopedHierarchyMembers,
  type HierarchyMember,
} from "@/lib/member-hierarchy";
import {
  canManageMembers,
  canManageUserApprovals,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

async function getProfileStatusCount(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  status: string,
) {
  const { count, error } = await supabase
    .from("user_profiles")
    .select("auth_user_id", { count: "exact", head: true })
    .eq("status", status);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return NextResponse.json(
      { error: "Active user profile is required" },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: memberRows, error: memberError } = await supabase
      .from("users")
      .select("id, leader_id, status")
      .eq("is_deleted", false);

    if (memberError) {
      throw memberError;
    }

    const members = (memberRows ?? []) as HierarchyMember[];
    const falconHubActiveMembers = getActiveMemberCount(members);
    let myActiveTeam = falconHubActiveMembers;

    if (!canManageMembers(authContext.profile)) {
      if (!authContext.profile.member_id) {
        return NextResponse.json(
          { error: "Linked member profile is required" },
          { status: 403 }
        );
      }

      myActiveTeam = getActiveMemberCount(
        getScopedHierarchyMembers(members, authContext.profile.member_id)
      );
    }

    const { count: activeProjects, error: activeProjectsError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false)
      .eq("status", "Active");

    if (activeProjectsError) {
      throw activeProjectsError;
    }

    const response: {
      members: {
        falconHubActiveMembers: number;
        myActiveTeam: number;
      };
      projects: {
        activeProjects: number;
      };
      attention?: {
        pendingApprovals: number;
        pendingProfileCompletion: number;
      };
    } = {
      members: {
        falconHubActiveMembers,
        myActiveTeam,
      },
      projects: {
        activeProjects: activeProjects ?? 0,
      },
    };

    if (canManageUserApprovals(authContext.profile)) {
      const [pendingApprovals, pendingProfileCompletion] = await Promise.all([
        getProfileStatusCount(supabase, "pending_approval"),
        getProfileStatusCount(supabase, "pending_profile"),
      ]);

      response.attention = {
        pendingApprovals,
        pendingProfileCompletion,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/dashboard/summary error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load dashboard summary",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  adminUserManagementMemberFields,
  adminUserManagementProfileFields,
  type AdminManagedMember,
  type AdminManagedProfile,
} from "@/lib/admin-user-management";
import { getAssignableUserRoles, requireAdminUserManagementAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type AuthUserListItem = {
  id: string;
  email?: string;
  created_at?: string;
};

export async function GET() {
  const authorization = await requireAdminUserManagementAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: profileRows, error: profileError } = await supabase
      .from("user_profiles")
      .select(adminUserManagementProfileFields)
      .order("created_at", { ascending: false });

    if (profileError) {
      throw profileError;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("users")
      .select(adminUserManagementMemberFields)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true });

    if (memberError) {
      throw memberError;
    }

    const { data: authUsersData, error: authUsersError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authUsersError) {
      throw authUsersError;
    }

    const profiles = (profileRows ?? []) as AdminManagedProfile[];
    const members = (memberRows ?? []) as AdminManagedMember[];
    const membersById = new Map(members.map((member) => [member.id, member]));
    const linkedMemberIds = new Set(
      profiles
        .map((profile) => profile.member_id)
        .filter((memberId): memberId is string => Boolean(memberId)),
    );
    const authUsersById = new Map(
      ((authUsersData.users ?? []) as AuthUserListItem[]).map((user) => [
        user.id,
        user,
      ]),
    );
    const actorRole = authorization.profile.role;

    const accounts = profiles.map((profile) => {
      const authUser = authUsersById.get(profile.auth_user_id);
      const isSelf = profile.auth_user_id === authorization.user.id;
      const targetIsSuperAdmin = profile.role === "super_admin";
      const actorIsSuperAdmin = actorRole === "super_admin";
      const canManageTarget = actorIsSuperAdmin || !targetIsSuperAdmin;
      const canEditRole = canManageTarget && !isSelf;
      const canEditMemberProfile = canManageTarget && Boolean(profile.member_id);
      const canDeactivateAccess =
        canManageTarget && !isSelf && profile.status === "active";
      const canReactivateAccess =
        canManageTarget && profile.status === "inactive" && Boolean(profile.member_id);

      return {
        authUserId: profile.auth_user_id,
        authEmail: authUser?.email ?? null,
        authCreatedAt: authUser?.created_at ?? profile.created_at,
        role: profile.role,
        accountStatus: profile.status,
        member: profile.member_id ? membersById.get(profile.member_id) ?? null : null,
        actionPermissions: {
          canEditRole,
          canEditMemberProfile,
          canDeactivateAccess,
          canReactivateAccess,
        },
      };
    });

    const membersWithoutAccounts = members
      .filter((member) => !linkedMemberIds.has(member.id))
      .map((member) => ({
        member,
        falconHubAccess: "No Account",
      }));

    const leaderOptions = members
      .filter((member) => member.status === "Active")
      .map((member) => ({
        id: member.id,
        member_code: member.member_code,
        full_name: member.full_name,
        display_name: member.display_name,
        position: member.position,
        employment_type: member.employment_type,
      }));

    return NextResponse.json({
      accounts,
      membersWithoutAccounts,
      assignableRoles: getAssignableUserRoles(authorization.profile),
      leaderOptions,
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load user management",
      },
      { status: 500 }
    );
  }
}

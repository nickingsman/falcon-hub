import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getRouteForProfileStatus, type UserProfile } from "@/lib/auth";
import {
  canManageProjects,
  canManageUserApprovals,
  canManageUsers,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import { getMemberDisplayName } from "@/lib/member-display";

function getMetadataValue(user: User, key: string) {
  const value = user.user_metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFallbackDisplayName(user: User) {
  return (
    getMetadataValue(user, "full_name") ||
    getMetadataValue(user, "name") ||
    user.email ||
    "User"
  );
}

function parseMemberCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function GET() {
  try {
    const supabase = await createSupabaseSsrClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("auth_user_id, member_id, role, status, created_at, updated_at")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    let memberDisplayName: string | null = null;
    let memberCode: number | null = null;
    let memberPhone: string | null = null;

    if (profile?.member_id) {
      const adminSupabase = createSupabaseAdminClient();
      const { data: member } = await adminSupabase
        .from("users")
        .select("full_name, display_name, member_code, phone")
        .eq("id", profile.member_id)
        .maybeSingle();

      memberDisplayName = member ? getMemberDisplayName(member) : null;
      memberCode = parseMemberCode(member?.member_code);
      memberPhone =
        typeof member?.phone === "string" && member.phone.trim()
          ? member.phone.trim()
          : null;
    }

    const displayName = memberDisplayName || getFallbackDisplayName(userData.user);
    const userProfile = profile ? (profile as UserProfile) : null;

    return NextResponse.json({
      displayName,
      memberCode,
      phone: memberPhone,
      email: userData.user.email ?? null,
      role: userProfile?.role ?? null,
      status: userProfile?.status ?? null,
      statusRoute: getRouteForProfileStatus(userProfile?.status ?? null),
      isActive: userProfile?.status === "active",
      canManageProjects: canManageProjects(userProfile),
      canManageUserApprovals: canManageUserApprovals(userProfile),
      canManageUsers: canManageUsers(userProfile),
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);

    return NextResponse.json({
      displayName: "User",
      memberCode: null,
      phone: null,
      email: null,
      role: null,
      status: null,
      statusRoute: "/account-disabled",
      isActive: false,
      canManageProjects: false,
      canManageUserApprovals: false,
      canManageUsers: false,
    });
  }
}

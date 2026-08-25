import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getRouteForProfileStatus, type UserProfile } from "@/lib/auth";
import { canManageProjects } from "@/lib/permissions";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

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

    if (profile?.member_id) {
      const { data: member } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", profile.member_id)
        .maybeSingle();

      memberDisplayName =
        typeof member?.full_name === "string" && member.full_name.trim()
          ? member.full_name.trim()
          : null;
    }

    const displayName = memberDisplayName || getFallbackDisplayName(userData.user);
    const userProfile = profile ? (profile as UserProfile) : null;

    return NextResponse.json({
      displayName,
      email: userData.user.email ?? null,
      role: userProfile?.role ?? null,
      status: userProfile?.status ?? null,
      statusRoute: getRouteForProfileStatus(userProfile?.status ?? null),
      isActive: userProfile?.status === "active",
      canManageProjects: canManageProjects(userProfile),
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);

    return NextResponse.json({
      displayName: "User",
      email: null,
      role: null,
      status: null,
      statusRoute: "/account-disabled",
      isActive: false,
      canManageProjects: false,
    });
  }
}

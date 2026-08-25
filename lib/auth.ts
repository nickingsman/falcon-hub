import type { User } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

export type UserRole = "super_admin" | "admin" | "leader" | "agent";
export type UserProfileStatus =
  | "pending_approval"
  | "pending_profile"
  | "active"
  | "inactive"
  | "rejected";

export type UserProfile = {
  auth_user_id: string;
  member_id: string | null;
  role: UserRole;
  status: UserProfileStatus;
  created_at: string;
  updated_at: string;
};

export type AuthContext = {
  user: User;
  profile: UserProfile | null;
};

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseSsrClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function getAuthenticatedUserProfile() {
  const supabase = await createSupabaseSsrClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("auth_user_id, member_id, role, status, created_at, updated_at")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (profileError) {
    return {
      user: userData.user,
      profile: null,
    };
  }

  return {
    user: userData.user,
    profile: profile as UserProfile,
  };
}

export function isActiveProfile(profile: UserProfile | null) {
  return profile?.status === "active";
}

export function getUserRole(profile: UserProfile | null) {
  return profile?.role ?? null;
}

export function getRouteForProfileStatus(status: UserProfileStatus | null) {
  if (status === "active") return "/";
  if (status === "pending_approval") return "/pending-approval";
  if (status === "pending_profile") return "/complete-profile";
  if (status === "rejected") return "/account-rejected";

  return "/account-disabled";
}

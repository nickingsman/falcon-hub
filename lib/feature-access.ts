type FeatureAccessProfile = {
  role: "super_admin" | "admin" | "leader" | "agent";
  status: string;
};

export const leaderMeetingsFeatureKey = "leader_meetings" as const;

export function isFeatureGrantActive(
  profile: FeatureAccessProfile | null,
  grant: { is_enabled: boolean } | null,
) {
  return profile?.status === "active" && grant?.is_enabled === true;
}

export function canManageFeatureAccess(profile: FeatureAccessProfile | null) {
  return profile?.status === "active" && profile.role === "super_admin";
}

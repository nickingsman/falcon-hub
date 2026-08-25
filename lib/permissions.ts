import type { UserProfile, UserRole } from "@/lib/auth";

const roleRank: Record<UserRole, number> = {
  agent: 1,
  leader: 2,
  admin: 3,
  super_admin: 4,
};

export function hasRole(profile: UserProfile | null, roles: UserRole[]) {
  if (!profile || profile.status !== "active") {
    return false;
  }

  return roles.includes(profile.role);
}

export function hasMinimumRole(profile: UserProfile | null, role: UserRole) {
  if (!profile || profile.status !== "active") {
    return false;
  }

  return roleRank[profile.role] >= roleRank[role];
}

export function canManageProjects(profile: UserProfile | null) {
  return hasRole(profile, ["super_admin", "admin"]);
}

export function canManageUsers(profile: UserProfile | null) {
  return hasRole(profile, ["super_admin"]);
}

export function canAccessAgentView(profile: UserProfile | null) {
  return hasRole(profile, ["super_admin", "admin", "leader", "agent"]);
}

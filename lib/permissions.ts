import type { UserProfile, UserRole } from "@/lib/auth";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { NextResponse } from "next/server";

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

export function canManageUserApprovals(profile: UserProfile | null) {
  return hasRole(profile, ["super_admin", "admin"]);
}

export function getAssignableUserRoles(profile: UserProfile | null): UserRole[] {
  if (!profile || profile.status !== "active") {
    return [];
  }

  if (profile.role === "super_admin") {
    return ["super_admin", "admin", "leader", "agent"];
  }

  if (profile.role === "admin") {
    return ["admin", "leader", "agent"];
  }

  return [];
}

export function canAssignUserRole(profile: UserProfile | null, role: string) {
  return getAssignableUserRoles(profile).includes(role as UserRole);
}

export function canAccessAgentView(profile: UserProfile | null) {
  return hasRole(profile, ["super_admin", "admin", "leader", "agent"]);
}

function unauthorizedJson() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 }
  );
}

function forbiddenJson(message = "You do not have permission to access this resource") {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

export async function requireProjectApiReadAccess() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorizedJson() } as const;
  }

  if (!authContext.profile) {
    return {
      authorized: false,
      response: forbiddenJson("User profile is required"),
    } as const;
  }

  if (authContext.profile.status !== "active") {
    return {
      authorized: false,
      response: forbiddenJson("User profile is inactive"),
    } as const;
  }

  if (!canAccessAgentView(authContext.profile)) {
    return { authorized: false, response: forbiddenJson() } as const;
  }

  return { authorized: true, ...authContext } as const;
}

export async function requireProjectApiWriteAccess() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorizedJson() } as const;
  }

  if (!authContext.profile) {
    return {
      authorized: false,
      response: forbiddenJson("User profile is required"),
    } as const;
  }

  if (authContext.profile.status !== "active") {
    return {
      authorized: false,
      response: forbiddenJson("User profile is inactive"),
    } as const;
  }

  if (!canManageProjects(authContext.profile)) {
    return { authorized: false, response: forbiddenJson() } as const;
  }

  return { authorized: true, ...authContext } as const;
}

export async function requireUserApprovalAccess() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorizedJson() } as const;
  }

  if (!authContext.profile) {
    return {
      authorized: false,
      response: forbiddenJson("User profile is required"),
    } as const;
  }

  if (!canManageUserApprovals(authContext.profile)) {
    return { authorized: false, response: forbiddenJson() } as const;
  }

  return { authorized: true, ...authContext } as const;
}

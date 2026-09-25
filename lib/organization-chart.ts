import {
  getDirectReports,
  getHierarchyDescendants,
  getHierarchyMembers,
  type HierarchyMember,
} from "./member-hierarchy";

type OrganizationChartRole = "super_admin" | "admin" | "leader" | "agent";

export type OrganizationChartMember = HierarchyMember & {
  member_code: number | null;
  full_name: string | null;
  display_name: string | null;
  position: string | null;
};

export function getAuthorizedOrganizationMembers<T extends HierarchyMember>(
  members: T[],
  viewer: { role: OrganizationChartRole; memberId: string | null },
) {
  if (viewer.role === "super_admin") {
    return members;
  }

  if (!viewer.memberId) {
    return [];
  }

  return getHierarchyMembers(members, viewer.memberId);
}

export function canViewOrganizationChart<T extends HierarchyMember>(
  authorizedMembers: T[],
  role: OrganizationChartRole,
) {
  return role === "super_admin" || authorizedMembers.length > 1;
}

export function getOrganizationRoots<T extends HierarchyMember>(members: T[]) {
  const memberIds = new Set(members.map((member) => member.id));
  return members.filter(
    (member) => !member.leader_id || !memberIds.has(member.leader_id),
  );
}

export function getOrganizationCounts<T extends HierarchyMember>(
  members: T[],
  memberId: string,
) {
  return {
    directReports: getDirectReports(members, memberId).length,
    totalDownline: getHierarchyDescendants(members, memberId).length,
  };
}

export function getOrganizationAncestorPath<T extends HierarchyMember>(
  members: T[],
  memberId: string,
) {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = membersById.get(memberId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.id);
    current = current.leader_id
      ? membersById.get(current.leader_id)
      : undefined;
  }

  return path;
}

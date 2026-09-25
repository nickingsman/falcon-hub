export type HierarchyMember = {
  id: string;
  leader_id: string | null;
  status: string | null;
};

export function getDirectReports<T extends HierarchyMember>(
  members: T[],
  leaderId: string,
) {
  return members.filter((member) => member.leader_id === leaderId);
}

export function getHierarchyMembers<T extends HierarchyMember>(
  members: T[],
  rootMemberId: string,
) {
  if (!members.some((member) => member.id === rootMemberId)) {
    return [];
  }

  const membersByLeader = new Map<string, T[]>();

  for (const member of members) {
    if (!member.leader_id) continue;

    const directReports = membersByLeader.get(member.leader_id) ?? [];
    directReports.push(member);
    membersByLeader.set(member.leader_id, directReports);
  }

  const allowedMemberIds = new Set<string>();
  const pendingMemberIds = [rootMemberId];

  while (pendingMemberIds.length > 0) {
    const memberId = pendingMemberIds.shift();

    if (!memberId || allowedMemberIds.has(memberId)) continue;

    allowedMemberIds.add(memberId);

    for (const directReport of membersByLeader.get(memberId) ?? []) {
      if (!allowedMemberIds.has(directReport.id)) {
        pendingMemberIds.push(directReport.id);
      }
    }
  }

  return members.filter((member) => allowedMemberIds.has(member.id));
}

export function getHierarchyDescendants<T extends HierarchyMember>(
  members: T[],
  rootMemberId: string,
) {
  return getHierarchyMembers(members, rootMemberId).filter(
    (member) => member.id !== rootMemberId,
  );
}

export function getScopedHierarchyMembers<T extends HierarchyMember>(
  members: T[],
  currentMemberId: string,
) {
  return getHierarchyMembers(members, currentMemberId);
}

export function getLeaderAssignmentError(
  members: HierarchyMember[],
  memberId: string,
  leaderId: string | null,
) {
  if (!leaderId) return null;

  if (leaderId === memberId) {
    return "A member cannot be their own leader";
  }

  const descendantIds = new Set(
    getHierarchyDescendants(members, memberId).map((member) => member.id),
  );

  if (descendantIds.has(leaderId)) {
    return "Leader change would create a reporting cycle";
  }

  return null;
}

export function getActiveMemberCount(members: HierarchyMember[]) {
  return members.filter((member) => member.status === "Active").length;
}

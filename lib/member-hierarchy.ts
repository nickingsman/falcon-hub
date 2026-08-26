export type HierarchyMember = {
  id: string;
  leader_id: string | null;
  status: string | null;
};

export function getScopedHierarchyMembers<T extends HierarchyMember>(
  members: T[],
  currentMemberId: string,
) {
  if (!members.some((member) => member.id === currentMemberId)) {
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
  const pendingMemberIds = [currentMemberId];

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

export function getActiveMemberCount(members: HierarchyMember[]) {
  return members.filter((member) => member.status === "Active").length;
}

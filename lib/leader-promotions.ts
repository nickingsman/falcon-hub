import { getHierarchyDescendants, type HierarchyMember } from "@/lib/member-hierarchy";

export type LeaderPromotionStatus = "pending" | "approved" | "rejected";

export type LeaderPromotionMember = HierarchyMember & {
  is_deleted?: boolean;
};

export type LeaderPromotionProfile = {
  auth_user_id: string;
  member_id: string | null;
  role: string;
  status: string;
};

export type ExistingLeaderPromotionRequest = {
  member_id: string;
  status: LeaderPromotionStatus;
  direct_downline_count: number;
  created_at: string;
};

export type LeaderPromotionCandidate = {
  authUserId: string;
  memberId: string;
  directDownlineCount: number;
  totalDownlineCount: number;
};

export function isLeaderPromotionManager(profile: { role: string; status: string } | null) {
  return profile?.role === "super_admin" && profile.status === "active";
}

/**
 * Read-only/idempotent backfill planning. A rejected request becomes eligible
 * again only after the member gains an additional direct report.
 */
export function getLeaderPromotionCandidates(
  members: LeaderPromotionMember[],
  profiles: LeaderPromotionProfile[],
  requests: ExistingLeaderPromotionRequest[],
): LeaderPromotionCandidate[] {
  const activeMembers = members.filter(
    (member) => member.is_deleted !== true && member.status === "Active",
  );

  return profiles.flatMap((profile) => {
    if (profile.role !== "agent" || profile.status !== "active" || !profile.member_id) return [];
    if (!activeMembers.some((member) => member.id === profile.member_id)) return [];

    const directDownlineCount = activeMembers.filter(
      (member) => member.leader_id === profile.member_id,
    ).length;
    if (directDownlineCount === 0) return [];

    const memberRequests = requests
      .filter((request) => request.member_id === profile.member_id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    if (memberRequests.some((request) => request.status === "pending")) return [];

    const lastRejected = memberRequests.find((request) => request.status === "rejected");
    if (lastRejected && directDownlineCount <= lastRejected.direct_downline_count) return [];

    return [{
      authUserId: profile.auth_user_id,
      memberId: profile.member_id,
      directDownlineCount,
      totalDownlineCount: getHierarchyDescendants(activeMembers, profile.member_id).length,
    }];
  });
}

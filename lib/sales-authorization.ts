import { getHierarchyMembers, type HierarchyMember } from "./member-hierarchy";

export type SalesAuthorizationRole = "super_admin" | "admin" | "leader" | "agent";
export type SalesAuthorizationProfile = {
  role: SalesAuthorizationRole;
  status: string;
  member_id: string | null;
};
export type SalesAccessScope = {
  canViewAll: boolean;
  memberIds: string[];
};

export type SalesCaseWithMappedContributors = {
  contributors: Array<{ memberId: string | null }>;
};

export function buildSalesAccessScope(
  profile: SalesAuthorizationProfile,
  members: HierarchyMember[],
): SalesAccessScope {
  if (profile.status !== "active") return { canViewAll: false, memberIds: [] };
  if (profile.role === "admin" || profile.role === "super_admin") {
    return { canViewAll: true, memberIds: [] };
  }
  if (!profile.member_id) return { canViewAll: false, memberIds: [] };
  if (profile.role === "agent") return { canViewAll: false, memberIds: [profile.member_id] };

  return {
    canViewAll: false,
    memberIds: getHierarchyMembers(members, profile.member_id).map((member) => member.id),
  };
}

export function filterSalesCasesForAccess<T extends SalesCaseWithMappedContributors>(
  cases: T[],
  scope: SalesAccessScope,
) {
  if (scope.canViewAll) return cases;
  const authorizedMemberIds = new Set(scope.memberIds);
  return cases.filter((salesCase) =>
    salesCase.contributors.some(
      (contributor) => contributor.memberId !== null && authorizedMemberIds.has(contributor.memberId),
    ),
  );
}

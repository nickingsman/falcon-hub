import { parseSalesPercentage, type SalesContributor } from "@/lib/sales";

type ActiveMemberOption = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  member_code?: number | null;
};

type ContributorMemberRecord = {
  id: string;
  status: string | null;
  is_deleted: boolean | null;
};

type ContributorAllocation = {
  memberId: string;
  portion: string | number;
};

export type SalesContributorOption = {
  id: string;
  label: string;
  description?: string;
  searchText?: string;
};

export function buildSalesContributorOptions(
  activeMembers: ActiveMemberOption[],
  existingContributor?: SalesContributor,
): SalesContributorOption[] {
  const options = activeMembers.flatMap((member) => member.full_name ? [{
    id: member.id,
    label: member.display_name?.trim() || member.full_name,
    searchText: [member.display_name, member.full_name, member.member_code].filter(Boolean).join(" "),
  }] : []);

  if (
    !existingContributor?.memberId ||
    options.some((option) => option.id === existingContributor.memberId)
  ) {
    return options;
  }

  const status = existingContributor.memberStatus?.trim() || "Inactive";
  return [{
    id: existingContributor.memberId,
    label: `${existingContributor.memberName} — ${status}`,
    description: "Existing contributor",
    searchText: `${existingContributor.memberName} ${status}`,
  }, ...options];
}

export function canSubmitSalesContributor(
  contributor: ContributorAllocation,
  member: ContributorMemberRecord | undefined,
  existingContributors: ContributorAllocation[],
) {
  if (member?.status === "Active" && member.is_deleted === false) return true;

  const submittedPortion = parseSalesPercentage(contributor.portion)?.normalized;
  if (!submittedPortion) return false;

  return existingContributors.some((existing) =>
    existing.memberId === contributor.memberId &&
    parseSalesPercentage(existing.portion)?.normalized === submittedPortion
  );
}

export function preservesUnavailableContributors(
  submittedContributors: ContributorAllocation[],
  existingContributors: ContributorAllocation[],
  members: Map<string, ContributorMemberRecord>,
) {
  return existingContributors.every((existing) => {
    const member = members.get(existing.memberId);
    if (member?.status === "Active" && member.is_deleted === false) return true;

    const existingPortion = parseSalesPercentage(existing.portion)?.normalized;
    return submittedContributors.some((submitted) =>
      submitted.memberId === existing.memberId &&
      parseSalesPercentage(submitted.portion)?.normalized === existingPortion
    );
  });
}

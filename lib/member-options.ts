export const employmentTypeOptions = ["Core Agent", "Part Time Agent"] as const;

export type EmploymentType = (typeof employmentTypeOptions)[number];

export function isEmploymentType(value: string): value is EmploymentType {
  return employmentTypeOptions.includes(value as EmploymentType);
}

export const falconPositionRankings = [
  { value: "REN 70", label: "REN 70", rank: 1 },
  { value: "REN 75", label: "REN 75", rank: 2 },
  { value: "Senior REN", label: "SENIOR REN", rank: 3 },
  { value: "Team Leader", label: "TEAM LEADER", rank: 4 },
  { value: "Senior Team Leader", label: "SENIOR TEAM LEADER", rank: 5 },
  { value: "Group Leader", label: "GROUP LEADER", rank: 6 },
  { value: "Project Manager", label: "PROJECT MANAGER", rank: 7 },
  { value: "Managing Partner", label: "MANAGING PARTNER", rank: 8 },
] as const;

export type MemberPosition = (typeof falconPositionRankings)[number]["value"];

export const memberPositionOptions: readonly MemberPosition[] = falconPositionRankings.map(
  ({ value }) => value,
);

export function isMemberPosition(value: string): value is MemberPosition {
  return memberPositionOptions.includes(value as MemberPosition);
}

export function getFalconPositionRank(value: string | null | undefined) {
  return falconPositionRankings.find((position) => position.value === value)?.rank ?? null;
}

export function compareFalconPositions(
  first: string | null | undefined,
  second: string | null | undefined,
) {
  const firstRank = getFalconPositionRank(first);
  const secondRank = getFalconPositionRank(second);
  return firstRank === null || secondRank === null ? null : firstRank - secondRank;
}

export const memberStatusOptions = ["Active", "Review", "Pending"] as const;

export type MemberStatus = (typeof memberStatusOptions)[number];

export function isMemberStatus(value: string): value is MemberStatus {
  return memberStatusOptions.includes(value as MemberStatus);
}

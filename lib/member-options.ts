export const employmentTypeOptions = ["Core Agent", "Part Time Agent"] as const;

export type EmploymentType = (typeof employmentTypeOptions)[number];

export function isEmploymentType(value: string): value is EmploymentType {
  return employmentTypeOptions.includes(value as EmploymentType);
}

export const memberPositionOptions = [
  "Managing Partner",
  "Project Manager",
  "Group Leader",
  "Senior Team Leader",
  "Team Leader",
  "Senior REN",
  "REN 75",
  "REN 70",
] as const;

export type MemberPosition = (typeof memberPositionOptions)[number];

export function isMemberPosition(value: string): value is MemberPosition {
  return memberPositionOptions.includes(value as MemberPosition);
}

export const memberStatusOptions = ["Active", "Review", "Pending"] as const;

export type MemberStatus = (typeof memberStatusOptions)[number];

export function isMemberStatus(value: string): value is MemberStatus {
  return memberStatusOptions.includes(value as MemberStatus);
}

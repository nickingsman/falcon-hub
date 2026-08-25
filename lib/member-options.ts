export const employmentTypeOptions = ["Core Agent", "Part Time Agent"] as const;

export type EmploymentType = (typeof employmentTypeOptions)[number];

export function isEmploymentType(value: string): value is EmploymentType {
  return employmentTypeOptions.includes(value as EmploymentType);
}

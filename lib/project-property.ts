export const projectCategories = ["high_rise", "landed"] as const;
export const ownershipTitleTypes = ["strata", "individual"] as const;
export const maintenanceFeeTypes = ["per_sqft", "fixed"] as const;
export const maintenanceCalculationBases = ["built_up", "land_size"] as const;

export type ProjectCategory = (typeof projectCategories)[number];
export type OwnershipTitleType = (typeof ownershipTitleTypes)[number];
export type MaintenanceFeeType = (typeof maintenanceFeeTypes)[number];
export type MaintenanceCalculationBasis =
  (typeof maintenanceCalculationBases)[number];

export type ProjectMaintenanceConfiguration = {
  maintenance_fee_type?: MaintenanceFeeType | null;
  maintenance_fee_per_sqft?: number | null;
  maintenance_fee_fixed_monthly?: number | null;
  maintenance_calculation_basis?: MaintenanceCalculationBasis | null;
};

export type UnitMaintenanceDimensions = {
  size_sqft?: number | null;
  land_size_sqft?: number | null;
};

function nonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function positive(value: number | null | undefined) {
  const normalized = nonNegative(value);
  return normalized !== null && normalized > 0 ? normalized : null;
}

/**
 * Resolves the Project's monthly maintenance without inferring one configured
 * basis from another. A null fee type is treated as a legacy per-sqft Project.
 */
export function resolveMonthlyMaintenance(
  project: ProjectMaintenanceConfiguration,
  unit: UnitMaintenanceDimensions,
): number | null {
  if (project.maintenance_fee_type === "fixed") {
    return nonNegative(project.maintenance_fee_fixed_monthly);
  }

  const rate = nonNegative(project.maintenance_fee_per_sqft);
  if (rate === null) return null;

  const basis = project.maintenance_calculation_basis ?? "built_up";
  const size =
    basis === "land_size"
      ? positive(unit.land_size_sqft)
      : positive(unit.size_sqft);

  return size === null ? null : rate * size;
}

export function formatMaintenanceConfiguration(
  project: ProjectMaintenanceConfiguration,
) {
  if (project.maintenance_fee_type === "fixed") {
    const amount = nonNegative(project.maintenance_fee_fixed_monthly);
    return amount === null
      ? null
      : `RM${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month`;
  }

  const rate = nonNegative(project.maintenance_fee_per_sqft);
  if (rate === null) return null;

  const basis = project.maintenance_calculation_basis ?? "built_up";
  return `RM${rate.toFixed(2)} psf · Based on ${basis === "land_size" ? "Land Size" : "Built-Up Size"}`;
}

export function isCanonicalValue<T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

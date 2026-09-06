export const projectComparisonSavedWorkSchemaVersion = 1;

export const projectComparisonSavedWorkExportSections = [
  "quick",
  "objective",
  "ownership",
  "investment",
  "overview",
  "unit",
  "connectivity",
] as const;

export type ProjectComparisonSavedWorkExportSection =
  (typeof projectComparisonSavedWorkExportSections)[number];

export type ProjectComparisonSavedMediaSnapshotV1 = {
  title: string;
  media_type: string;
  mime_type: string | null;
  description: string | null;
};

export type ProjectComparisonSavedFurnishingPackageV1 = {
  id: string;
  package_name: string;
  description: string | null;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number | null;
    description: string | null;
    sort_order: number | null;
  }>;
};

export type ProjectComparisonSavedProjectOptionsV1 = {
  project: {
    id: string;
    name: string;
    developer: string | null;
    location: string | null;
    property_type: string | null;
    tenure: string | null;
    title_type: string | null;
    total_units: number | null;
    estimated_vp_year: number | null;
    estimated_vp_quarter: number | null;
    maintenance_fee_per_sqft: number | null;
    cover_media: ProjectComparisonSavedMediaSnapshotV1 | null;
  };
  unit_types: Array<{
    id: string;
    type_code: string;
    type_name: string | null;
    bedrooms: number | null;
    additional_rooms: number;
    bathrooms: number | null;
    display_configuration: string | null;
    size_sqft: number | null;
    default_carparks: number | null;
    carpark_description: string | null;
    spa_price_from: number | null;
    spa_price_to: number | null;
    price_from: number | null;
    price_to: number | null;
    estimated_rental_from: number | null;
    estimated_rental_to: number | null;
    has_balcony: boolean | null;
    is_dual_key: boolean | null;
    layout: ProjectComparisonSavedMediaSnapshotV1 | null;
    furnishing_package: ProjectComparisonSavedFurnishingPackageV1 | null;
  }>;
  connectivity: Array<{
    id: string;
    project_id: string;
    category: string;
    name: string;
    distance_meters: number | null;
    connection_mode: string | null;
    customer_description: string | null;
    sort_order: number | null;
  }>;
  commercial_packages: Array<{
    id: string;
    package_name: string;
    customer_description: string | null;
    valid_from: string | null;
    valid_until: string | null;
    applies_to_all_unit_types: boolean;
    applicable_unit_type_ids: string[];
    furnishing_package: ProjectComparisonSavedFurnishingPackageV1 | null;
    items: Array<{
      id: string;
      item_type: string;
      description: string;
      discount_method: string | null;
      value: number | null;
      cash_benefit_treatment: string | null;
      receive_at: string | null;
      sort_order: number | null;
    }>;
    purchase_costs: Array<{
      id: string;
      cost_key: string;
      treatment: string;
      amount_override: number | null;
      sort_order: number | null;
    }>;
  }>;
};

export type ProjectComparisonSavedSlotV1 = {
  projectId: string;
  unitTypeId: string;
  layoutPlanId: string;
  packageId: string;
  spaPrice: string;
  comparisonPrice: string;
  snapshot: ProjectComparisonSavedProjectOptionsV1 | null;
};

export type ProjectComparisonSavedWorkPayloadV1 = {
  tool: "project_comparison";
  schemaVersion: 1;
  hasCompared: boolean;
  assumptions: {
    loanMarginPercent: string;
    annualInterestRatePercent: string;
    loanTenureYears: string;
  };
  selectedExportSections: ProjectComparisonSavedWorkExportSection[];
  agentInsights: string;
  slots: ProjectComparisonSavedSlotV1[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMedia(value: unknown): ProjectComparisonSavedMediaSnapshotV1 | null {
  if (!isRecord(value)) return null;

  return {
    title: stringValue(value.title),
    media_type: stringValue(value.media_type),
    mime_type: nullableString(value.mime_type),
    description: nullableString(value.description),
  };
}

function normalizeFurnishingPackage(
  value: unknown,
): ProjectComparisonSavedFurnishingPackageV1 | null {
  if (!isRecord(value)) return null;

  return {
    id: stringValue(value.id),
    package_name: stringValue(value.package_name),
    description: nullableString(value.description),
    items: Array.isArray(value.items)
      ? value.items.filter(isRecord).map((item) => ({
          id: stringValue(item.id),
          item_name: stringValue(item.item_name),
          quantity: nullableNumber(item.quantity),
          description: nullableString(item.description),
          sort_order: nullableNumber(item.sort_order),
        }))
      : [],
  };
}

function normalizeProjectOptions(
  value: unknown,
): ProjectComparisonSavedProjectOptionsV1 | null {
  if (!isRecord(value) || !isRecord(value.project)) return null;

  return {
    project: {
      id: stringValue(value.project.id),
      name: stringValue(value.project.name),
      developer: nullableString(value.project.developer),
      location: nullableString(value.project.location),
      property_type: nullableString(value.project.property_type),
      tenure: nullableString(value.project.tenure),
      title_type: nullableString(value.project.title_type),
      total_units: nullableNumber(value.project.total_units),
      estimated_vp_year: nullableNumber(value.project.estimated_vp_year),
      estimated_vp_quarter: nullableNumber(value.project.estimated_vp_quarter),
      maintenance_fee_per_sqft: nullableNumber(value.project.maintenance_fee_per_sqft),
      cover_media: normalizeMedia(value.project.cover_media),
    },
    unit_types: Array.isArray(value.unit_types)
      ? value.unit_types.filter(isRecord).map((unitType) => ({
          id: stringValue(unitType.id),
          type_code: stringValue(unitType.type_code),
          type_name: nullableString(unitType.type_name),
          bedrooms: nullableNumber(unitType.bedrooms),
          additional_rooms: numberValue(unitType.additional_rooms),
          bathrooms: nullableNumber(unitType.bathrooms),
          display_configuration: nullableString(unitType.display_configuration),
          size_sqft: nullableNumber(unitType.size_sqft),
          default_carparks: nullableNumber(unitType.default_carparks),
          carpark_description: nullableString(unitType.carpark_description),
          spa_price_from: nullableNumber(unitType.spa_price_from),
          spa_price_to: nullableNumber(unitType.spa_price_to),
          price_from: nullableNumber(unitType.price_from),
          price_to: nullableNumber(unitType.price_to),
          estimated_rental_from: nullableNumber(unitType.estimated_rental_from),
          estimated_rental_to: nullableNumber(unitType.estimated_rental_to),
          has_balcony: nullableBoolean(unitType.has_balcony),
          is_dual_key: nullableBoolean(unitType.is_dual_key),
          layout: normalizeMedia(unitType.layout),
          furnishing_package: normalizeFurnishingPackage(unitType.furnishing_package),
        }))
      : [],
    connectivity: Array.isArray(value.connectivity)
      ? value.connectivity.filter(isRecord).map((point) => ({
          id: stringValue(point.id),
          project_id: stringValue(point.project_id),
          category: stringValue(point.category),
          name: stringValue(point.name),
          distance_meters: nullableNumber(point.distance_meters),
          connection_mode: nullableString(point.connection_mode),
          customer_description: nullableString(point.customer_description),
          sort_order: nullableNumber(point.sort_order),
        }))
      : [],
    commercial_packages: Array.isArray(value.commercial_packages)
      ? value.commercial_packages.filter(isRecord).map((commercialPackage) => ({
          id: stringValue(commercialPackage.id),
          package_name: stringValue(commercialPackage.package_name),
          customer_description: nullableString(commercialPackage.customer_description),
          valid_from: nullableString(commercialPackage.valid_from),
          valid_until: nullableString(commercialPackage.valid_until),
          applies_to_all_unit_types: commercialPackage.applies_to_all_unit_types === true,
          applicable_unit_type_ids: stringArray(commercialPackage.applicable_unit_type_ids),
          furnishing_package: normalizeFurnishingPackage(commercialPackage.furnishing_package),
          items: Array.isArray(commercialPackage.items)
            ? commercialPackage.items.filter(isRecord).map((item) => ({
                id: stringValue(item.id),
                item_type: stringValue(item.item_type),
                description: stringValue(item.description),
                discount_method: nullableString(item.discount_method),
                value: nullableNumber(item.value),
                cash_benefit_treatment: nullableString(item.cash_benefit_treatment),
                receive_at: nullableString(item.receive_at),
                sort_order: nullableNumber(item.sort_order),
              }))
            : [],
          purchase_costs: Array.isArray(commercialPackage.purchase_costs)
            ? commercialPackage.purchase_costs.filter(isRecord).map((cost) => ({
                id: stringValue(cost.id),
                cost_key: stringValue(cost.cost_key),
                treatment: stringValue(cost.treatment),
                amount_override: nullableNumber(cost.amount_override),
                sort_order: nullableNumber(cost.sort_order),
              }))
            : [],
        }))
      : [],
  };
}

function isExportSection(value: unknown): value is ProjectComparisonSavedWorkExportSection {
  return (
    typeof value === "string" &&
    projectComparisonSavedWorkExportSections.includes(
      value as ProjectComparisonSavedWorkExportSection,
    )
  );
}

export function validateProjectComparisonSavedWorkPayload(value: unknown):
  | { valid: true; payload: ProjectComparisonSavedWorkPayloadV1 }
  | { valid: false; error: string } {
  if (!isRecord(value)) {
    return { valid: false, error: "This saved Project Comparison version cannot be opened." };
  }

  if (
    value.tool !== "project_comparison" ||
    value.schemaVersion !== projectComparisonSavedWorkSchemaVersion
  ) {
    return { valid: false, error: "This saved Project Comparison version cannot be opened." };
  }

  if (!isRecord(value.assumptions) || !Array.isArray(value.slots)) {
    return { valid: false, error: "This saved Project Comparison version cannot be opened." };
  }

  const slots = value.slots.filter(isRecord).map((slot) => ({
    projectId: stringValue(slot.projectId),
    unitTypeId: stringValue(slot.unitTypeId),
    layoutPlanId: stringValue(slot.layoutPlanId),
    packageId: stringValue(slot.packageId),
    spaPrice: stringValue(slot.spaPrice),
    comparisonPrice: stringValue(slot.comparisonPrice),
    snapshot: normalizeProjectOptions(slot.snapshot),
  }));

  if (slots.length < 2 || slots.length > 3) {
    return { valid: false, error: "This saved Project Comparison version cannot be opened." };
  }

  return {
    valid: true,
    payload: {
      tool: "project_comparison",
      schemaVersion: projectComparisonSavedWorkSchemaVersion,
      hasCompared: value.hasCompared === true,
      assumptions: {
        loanMarginPercent: stringValue(value.assumptions.loanMarginPercent) || "90",
        annualInterestRatePercent: stringValue(value.assumptions.annualInterestRatePercent) || "4.0",
        loanTenureYears: stringValue(value.assumptions.loanTenureYears) || "35",
      },
      selectedExportSections: Array.isArray(value.selectedExportSections)
        ? value.selectedExportSections.filter(isExportSection)
        : [...projectComparisonSavedWorkExportSections],
      agentInsights: stringValue(value.agentInsights),
      slots,
    },
  };
}

"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomerPdfBrandingStyles,
  renderCustomerPdfBranding,
  renderCustomerPdfWatermark,
  type CustomerPdfBranding,
} from "@/lib/customer-pdf-branding";
import {
  calculateProjectComparisonMetrics,
  type ComparisonAssumptions,
  type ComparisonRange,
  type ProjectComparisonMetrics,
} from "@/lib/project-comparison-engine";
import {
  generateProjectComparisonInsights,
  type ComparableRange,
  type ProjectComparisonInsight,
  type ProjectComparisonInsightCategory,
  type ProjectComparisonInsightType,
} from "@/lib/project-comparison-insights";
import {
  purchaseCostKeys,
  purchaseCostTreatments,
  type PurchaseCostKey,
  type PurchaseCostTreatment,
} from "@/lib/project-comparison-options";
import {
  projectComparisonSavedWorkSchemaVersion,
  validateProjectComparisonSavedWorkPayload,
  type ProjectComparisonSavedMediaSnapshotV1,
  type ProjectComparisonSavedProjectOptionsV1,
  type ProjectComparisonSavedWorkPayloadV1,
} from "@/lib/project-comparison-saved-work";
import { getPurchaseCostEstimates } from "@/lib/purchase-costs";
import { useAppPermissions } from "../../components/AppPermissionProvider";
import { SearchCombobox } from "../../components/SearchCombobox";
import { Button, PageHeader, StatusBadge } from "../../components/ui";

type ProjectOption = {
  id: string;
  name: string;
  developer: string | null;
  location: string | null;
};

type ProjectCoverMedia = {
  title: string;
  media_type: string;
  mime_type: string | null;
  description: string | null;
  signed_url: string | null;
};

type FurnishingPackage = {
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

type UnitTypeOption = {
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
  layout: UnitLayoutMedia | null;
  furnishing_package: FurnishingPackage | null;
};

type UnitLayoutMedia = {
  title: string;
  media_type: string;
  mime_type: string | null;
  description: string | null;
  signed_url: string | null;
};

type LayoutPlanOption = {
  id: string;
  name: string;
  media: UnitLayoutMedia;
};

type CommercialPackageOption = {
  id: string;
  package_name: string;
  customer_description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  applicable_unit_type_ids: string[];
  furnishing_package: FurnishingPackage | null;
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
    cost_key: PurchaseCostKey;
    treatment: PurchaseCostTreatment;
    amount_override: number | null;
    sort_order: number | null;
  }>;
};

type ConnectivityPoint = {
  id: string;
  project_id: string;
  category: string;
  name: string;
  distance_meters: number | null;
  connection_mode: string | null;
  customer_description: string | null;
  sort_order: number | null;
};

type ProjectOptions = {
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
    cover_media: ProjectCoverMedia | null;
  };
  unit_types: UnitTypeOption[];
  connectivity: ConnectivityPoint[];
  commercial_packages: CommercialPackageOption[];
};

type ComparisonSlot = {
  id: string;
  projectId: string;
  unitTypeId: string;
  layoutPlanId: string;
  packageId: string;
  spaPrice: string;
  comparisonPrice: string;
  isLoadingOptions: boolean;
  error: string;
};

type HandoffPair = {
  projectId: string;
  unitTypeId: string;
};

type ComparedOption = {
  slot: ComparisonSlot;
  project: ProjectOptions["project"];
  unitType: UnitTypeOption;
  layoutPlan: LayoutPlanOption | null;
  commercialPackage: CommercialPackageOption | null;
  connectivity: ConnectivityPoint[];
  unitMetrics: ProjectComparisonMetrics;
  effectiveSpaPrice: number | null;
  spaPriceSource: "manual" | "from_price" | "unavailable";
  effectiveComparisonPrice: number | null;
  comparisonPriceSource: "manual" | "from_price" | "unavailable";
  metrics: ProjectComparisonMetrics;
  ownershipCost: OwnershipCostSummary;
  investment: InvestmentComparisonSummary;
};

type OwnershipCostRow = {
  costKey: PurchaseCostKey;
  label: string;
  treatment: PurchaseCostTreatment | null;
  amount: number | null;
};

type OwnershipCostSummary = {
  cashDownpayment: number | null;
  purchaseCosts: OwnershipCostRow[];
  estimatedTotalCashRequired: number | null;
  totalSavings: number | null;
};

type InvestmentValueRange = {
  low: number;
  high: number;
};

type InvestmentComparisonSummary = {
  rentalRange: InvestmentValueRange | null;
  monthlyMaintenance: number | null;
  monthlyCashFlow: InvestmentValueRange | null;
  annualCashFlow: InvestmentValueRange | null;
  netRentalYieldPercent: InvestmentValueRange | null;
  cashOnCashReturnPercent: InvestmentValueRange | null;
};

type ExportSectionId =
  | "quick"
  | "objective"
  | "ownership"
  | "investment"
  | "overview"
  | "unit"
  | "connectivity";

type SaveModalMode = "new" | "save-as";

type SavedWorkDetailResponse = {
  savedWork?: {
    id: string;
    title: string;
    workType: string;
    schemaVersion: number;
    payload: unknown;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
};

type PdfTableRow = {
  label: string;
  values: string[];
};

type PdfTableSection = {
  id: ExportSectionId;
  title: string;
  description: string;
  rows: PdfTableRow[];
};

const exportSectionOptions: Array<{ id: ExportSectionId; label: string }> = [
  { id: "quick", label: "Quick Comparison" },
  { id: "objective", label: "Objective Insights" },
  { id: "ownership", label: "Ownership Cost" },
  { id: "investment", label: "Investment Comparison" },
  { id: "overview", label: "Project Overview" },
  { id: "unit", label: "Unit Comparison" },
  { id: "connectivity", label: "Connectivity" },
];

const allExportSectionIds = exportSectionOptions.map((section) => section.id);

const comparisonLetters = ["A", "B", "C"];

function createBlankSlot(index: number): ComparisonSlot {
  return {
    id: `slot-${index + 1}`,
    projectId: "",
    unitTypeId: "",
    layoutPlanId: "",
    packageId: "",
    spaPrice: "",
    comparisonPrice: "",
    isLoadingOptions: false,
    error: "",
  };
}

const initialSlots: ComparisonSlot[] = [createBlankSlot(0), createBlankSlot(1)];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string | null): value is string {
  return Boolean(value && uuidPattern.test(value));
}

function parseFinderHandoffPairs(searchParams: URLSearchParams) {
  const pairs: HandoffPair[] = [];
  const seenProjectIds = new Set<string>();

  for (const index of [1, 2, 3]) {
    const projectId = searchParams.get(`project${index}`);
    const unitTypeId = searchParams.get(`unit${index}`);

    if (!isUuidLike(projectId) || !isUuidLike(unitTypeId)) continue;
    if (seenProjectIds.has(projectId as string)) continue;

    pairs.push({
      projectId,
      unitTypeId,
    });
    seenProjectIds.add(projectId);
  }

  return pairs;
}

function getValidHandoffNumber({
  value,
  currentValue,
  isValid,
}: {
  value: string | null;
  currentValue: string;
  isValid: (parsed: number) => boolean;
}) {
  if (value === null || !value.trim()) return currentValue;

  const parsed = Number(value);

  return Number.isFinite(parsed) && isValid(parsed) ? String(parsed) : currentValue;
}

const currencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseNumber(value: string) {
  if (!value.trim()) return Number.NaN;

  return Number(value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace("MYR", "RM");
}

function formatMoneyRange(range: ComparisonRange, suffix = "") {
  if (range.kind === "unavailable") return "—";
  if (range.kind === "single") return `${formatCurrency(range.value)}${suffix}`;

  return `${formatCurrency(range.from)} – ${formatCurrency(range.to)}${suffix}`;
}

function comparisonRangeToComparable(
  range: ComparisonRange,
  suffix = "",
): ComparableRange | null {
  if (range.kind === "unavailable") return null;

  if (range.kind === "single") {
    return {
      min: range.value,
      max: range.value,
      label: `${formatCurrency(range.value)}${suffix}`,
    };
  }

  return {
    min: Math.min(range.from, range.to),
    max: Math.max(range.from, range.to),
    label: `${formatCurrency(range.from)} – ${formatCurrency(range.to)}${suffix}`,
  };
}

function formatOptionalMoney(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "—";
}

function formatOptionalMonthlyMoney(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${formatCurrency(value)} / month`
    : "—";
}

function formatStoredPriceRange(from: number | null, to: number | null) {
  if (typeof from !== "number" || !Number.isFinite(from)) {
    return "—";
  }

  if (
    typeof to !== "number" ||
    !Number.isFinite(to) ||
    to === from
  ) {
    return formatCurrency(from);
  }

  if (to < from) return "—";

  return `${formatCurrency(from)} – ${formatCurrency(to)}`;
}

function formatUnitTypeSpaPriceRange(unitType: UnitTypeOption) {
  return formatStoredPriceRange(unitType.spa_price_from, unitType.spa_price_to);
}

function formatUnitTypeFinalNetPriceRange(unitType: UnitTypeOption) {
  return formatStoredPriceRange(unitType.price_from, unitType.price_to);
}

function formatScenarioPrice(value: number | null, source: "manual" | "from_price" | "unavailable") {
  if (value === null) return "—";

  return source === "from_price" ? `${formatCurrency(value)} (from)` : formatCurrency(value);
}

function formatRentalDisplay(unitType: UnitTypeOption) {
  const rentalFrom =
    typeof unitType.estimated_rental_from === "number" &&
    Number.isFinite(unitType.estimated_rental_from) &&
    unitType.estimated_rental_from >= 0
      ? unitType.estimated_rental_from
      : null;
  const rentalTo =
    typeof unitType.estimated_rental_to === "number" &&
    Number.isFinite(unitType.estimated_rental_to) &&
    unitType.estimated_rental_to >= 0
      ? unitType.estimated_rental_to
      : null;

  if (rentalFrom !== null && rentalTo !== null && rentalTo !== rentalFrom) {
    return `${formatCurrency(rentalFrom)} – ${formatCurrency(rentalTo)}`;
  }

  if (rentalFrom !== null) return formatCurrency(rentalFrom);
  if (rentalTo !== null) return formatCurrency(rentalTo);

  return "—";
}

function getSingleRangeValue(range: ComparisonRange) {
  return range.kind === "single" ? range.value : null;
}

function getRentalRange(unitType: UnitTypeOption): InvestmentValueRange | null {
  const rentalFrom =
    typeof unitType.estimated_rental_from === "number" &&
    Number.isFinite(unitType.estimated_rental_from) &&
    unitType.estimated_rental_from >= 0
      ? unitType.estimated_rental_from
      : null;
  const rentalTo =
    typeof unitType.estimated_rental_to === "number" &&
    Number.isFinite(unitType.estimated_rental_to) &&
    unitType.estimated_rental_to >= 0
      ? unitType.estimated_rental_to
      : null;

  if (rentalFrom !== null && rentalTo !== null) {
    return {
      low: Math.min(rentalFrom, rentalTo),
      high: Math.max(rentalFrom, rentalTo),
    };
  }

  if (rentalFrom !== null) {
    return {
      low: rentalFrom,
      high: rentalFrom,
    };
  }

  if (rentalTo !== null) {
    return {
      low: rentalTo,
      high: rentalTo,
    };
  }

  return null;
}

function formatPercentRange(range: ComparisonRange) {
  if (range.kind === "unavailable") return "—";
  if (range.kind === "single") return `${percentageFormatter.format(range.value)}%`;

  return `${percentageFormatter.format(range.from)}% – ${percentageFormatter.format(range.to)}%`;
}

function formatPercentValueRange(range: InvestmentValueRange | null) {
  if (!range) return "—";

  if (range.low === range.high) {
    return `${percentageFormatter.format(range.low)}%`;
  }

  return `${percentageFormatter.format(range.low)}% – ${percentageFormatter.format(range.high)}%`;
}

function investmentRangeToComparable(
  range: InvestmentValueRange | null,
  formatter: (range: InvestmentValueRange) => string,
): ComparableRange | null {
  if (!range) return null;

  return {
    min: Math.min(range.low, range.high),
    max: Math.max(range.low, range.high),
    label: formatter(range),
  };
}

function numberToComparable(value: number | null, label: string): ComparableRange | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return {
    min: value,
    max: value,
    label,
  };
}

function formatPercentValue(value: number) {
  return Number.isFinite(value) ? `${percentageFormatter.format(value)}%` : "—";
}

function getUnitTypeLabel(unitType: UnitTypeOption) {
  const details = [
    unitType.display_configuration,
    unitType.size_sqft ? `${unitType.size_sqft.toLocaleString("en-MY")} sqft` : null,
  ].filter(Boolean);
  const name = [unitType.type_code, unitType.type_name].filter(Boolean).join(" - ");

  return details.length ? `${name} · ${details.join(" · ")}` : name;
}

function getLayoutPlanLabel(layoutPlan: LayoutPlanOption) {
  return layoutPlan.name;
}

function getEligibleLayoutPlans(
  projectOptions: ProjectOptions | undefined,
  unitTypeId: string,
) {
  if (!projectOptions || !unitTypeId) return [];

  const unitType = projectOptions.unit_types.find((item) => item.id === unitTypeId);

  if (!unitType?.layout) return [];

  return [
    {
      id: `${unitType.id}:unit-layout`,
      name: unitType.layout.title || `${getUnitTypeLabel(unitType)} Layout Plan`,
      media: unitType.layout,
    },
  ];
}

function getSelectedLayoutPlan(
  projectOptions: ProjectOptions | undefined,
  unitTypeId: string,
  layoutPlanId: string,
) {
  const eligibleLayoutPlans = getEligibleLayoutPlans(projectOptions, unitTypeId);

  return eligibleLayoutPlans.find((floorPlan) => floorPlan.id === layoutPlanId) ?? null;
}

function formatEstimatedCompletion(project: ProjectOptions["project"]) {
  if (!project.estimated_vp_year || !project.estimated_vp_quarter) return "—";

  return `${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function parseComparisonPrice(value: string) {
  if (!value.trim()) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
}

function getEffectiveSpaPrice(slot: ComparisonSlot, unitType: UnitTypeOption) {
  const parsedSpaPrice = parseComparisonPrice(slot.spaPrice);

  if (typeof parsedSpaPrice === "number" && Number.isFinite(parsedSpaPrice)) {
    return {
      value: parsedSpaPrice,
      source: "manual" as const,
    };
  }

  if (typeof unitType.spa_price_from === "number" && Number.isFinite(unitType.spa_price_from)) {
    return {
      value: unitType.spa_price_from,
      source: "from_price" as const,
    };
  }

  return {
    value: null,
    source: "unavailable" as const,
  };
}

function getEffectiveComparisonPrice(slot: ComparisonSlot, unitType: UnitTypeOption) {
  const parsedComparisonPrice = parseComparisonPrice(slot.comparisonPrice);

  if (typeof parsedComparisonPrice === "number" && Number.isFinite(parsedComparisonPrice)) {
    return {
      value: parsedComparisonPrice,
      source: "manual" as const,
    };
  }

  if (typeof unitType.price_from === "number" && Number.isFinite(unitType.price_from)) {
    return {
      value: unitType.price_from,
      source: "from_price" as const,
    };
  }

  return {
    value: null,
    source: "unavailable" as const,
  };
}

function getScenarioPriceWarning({
  value,
  label,
  from,
  to,
}: {
  value: string;
  label: string;
  from: number | null;
  to: number | null;
}) {
  if (!value.trim()) return "";

  const parsedPrice = parseComparisonPrice(value);

  if (typeof parsedPrice !== "number" || !Number.isFinite(parsedPrice)) {
    return `${label} must be more than 0.`;
  }

  if (
    typeof from === "number" &&
    Number.isFinite(from) &&
    typeof to === "number" &&
    Number.isFinite(to) &&
    (parsedPrice < from || parsedPrice > to)
  ) {
    return `Outside the current Unit Type range of ${formatCurrency(from)} – ${formatCurrency(to)}.`;
  }

  if (
    typeof from === "number" &&
    Number.isFinite(from) &&
    (to === null || to === undefined) &&
    parsedPrice < from
  ) {
    return `Below the current Unit Type starting price of ${formatCurrency(from)}.`;
  }

  return "";
}

function getSpaPriceWarning(slot: ComparisonSlot, unitType: UnitTypeOption | undefined) {
  if (!unitType) return "";

  return getScenarioPriceWarning({
    value: slot.spaPrice,
    label: "SPA Price",
    from: unitType.spa_price_from,
    to: unitType.spa_price_to,
  });
}

function getFinalNetPriceWarning(slot: ComparisonSlot, unitType: UnitTypeOption | undefined) {
  if (!unitType) return "";

  return getScenarioPriceWarning({
    value: slot.comparisonPrice,
    label: "Final Net Price",
    from: unitType.price_from,
    to: unitType.price_to,
  });
}

function getPurchaseCostEstimateAmount(
  costKey: PurchaseCostKey,
  effectiveSpaPrice: number | null,
  loanAmount: number | null,
) {
  if (costKey === "valuation_fee") return null;

  if (
    (costKey === "spa_legal_fee" || costKey === "mot_transfer_stamp_duty") &&
    effectiveSpaPrice === null
  ) {
    return null;
  }

  if (
    (costKey === "loan_legal_fee" || costKey === "loan_stamp_duty") &&
    loanAmount === null
  ) {
    return null;
  }

  const estimates = getPurchaseCostEstimates(
    effectiveSpaPrice ?? Number.NaN,
    loanAmount ?? Number.NaN,
  );

  return estimates[costKey]?.amount ?? null;
}

function normalizePackageAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isPurchaseCostTreatment(value: unknown): value is PurchaseCostTreatment {
  return typeof value === "string" && purchaseCostTreatments.includes(value as PurchaseCostTreatment);
}

function calculateOwnershipCost({
  commercialPackage,
  effectiveSpaPrice,
  effectiveFinalNetPrice,
  loanAmount,
}: {
  commercialPackage: CommercialPackageOption | null;
  effectiveSpaPrice: number | null;
  effectiveFinalNetPrice: number | null;
  loanAmount: number | null;
}): OwnershipCostSummary {
  const cashDownpayment =
    effectiveFinalNetPrice !== null && loanAmount !== null
      ? Math.max(effectiveFinalNetPrice - loanAmount, 0)
      : null;

  if (!commercialPackage) {
    return {
      cashDownpayment,
      purchaseCosts: purchaseCostKeys.map((costKey) => ({
        costKey,
        label: purchaseCostLabels[costKey],
        treatment: null,
        amount: null,
      })),
      estimatedTotalCashRequired: null,
      totalSavings: null,
    };
  }

  const hasCompletePurchaseCostConfiguration = purchaseCostKeys.every((costKey) =>
    commercialPackage.purchase_costs.some(
      (cost) => cost.cost_key === costKey && isPurchaseCostTreatment(cost.treatment),
    ),
  );
  const purchaseCosts = purchaseCostKeys.map((costKey) => {
    const packageCost = commercialPackage.purchase_costs.find(
      (item) => item.cost_key === costKey && isPurchaseCostTreatment(item.treatment),
    );
    const overrideAmount = normalizePackageAmount(packageCost?.amount_override);
    const estimateAmount = getPurchaseCostEstimateAmount(
      costKey,
      effectiveSpaPrice,
      loanAmount,
    );

    return {
      costKey,
      label: purchaseCostLabels[costKey],
      treatment: packageCost?.treatment ?? null,
      amount: overrideAmount ?? estimateAmount,
    };
  });

  let customerPayTotal = 0;
  let developerAbsorbedTotal = 0;
  let hasUnreliableCashRequired =
    cashDownpayment === null || !hasCompletePurchaseCostConfiguration;
  let hasUnreliableSavings = !hasCompletePurchaseCostConfiguration;

  for (const purchaseCost of purchaseCosts) {
    if (purchaseCost.treatment === "customer_pay") {
      if (purchaseCost.amount === null) {
        hasUnreliableCashRequired = true;
      } else {
        customerPayTotal += purchaseCost.amount;
      }
    }

    if (purchaseCost.treatment === "developer_absorbed") {
      if (purchaseCost.amount === null) {
        hasUnreliableSavings = true;
      } else {
        developerAbsorbedTotal += purchaseCost.amount;
      }
    }
  }

  return {
    cashDownpayment,
    purchaseCosts,
    estimatedTotalCashRequired: hasUnreliableCashRequired
      ? null
      : (cashDownpayment ?? 0) + customerPayTotal,
    totalSavings: hasUnreliableSavings ? null : developerAbsorbedTotal,
  };
}

function calculateInvestmentComparison({
  unitType,
  effectiveFinalNetPrice,
  estimatedMonthlyInstalment,
  monthlyMaintenance,
  estimatedTotalCashRequired,
}: {
  unitType: UnitTypeOption;
  effectiveFinalNetPrice: number | null;
  estimatedMonthlyInstalment: number | null;
  monthlyMaintenance: number | null;
  estimatedTotalCashRequired: number | null;
}): InvestmentComparisonSummary {
  const rentalRange = getRentalRange(unitType);
  const canCalculateCashFlow =
    rentalRange !== null &&
    estimatedMonthlyInstalment !== null &&
    monthlyMaintenance !== null;
  const monthlyCashFlow = canCalculateCashFlow
    ? {
        low: rentalRange.low - estimatedMonthlyInstalment - monthlyMaintenance,
        high: rentalRange.high - estimatedMonthlyInstalment - monthlyMaintenance,
      }
    : null;
  const annualCashFlow =
    monthlyCashFlow !== null
      ? {
          low: monthlyCashFlow.low * 12,
          high: monthlyCashFlow.high * 12,
        }
      : null;
  const netRentalYieldPercent =
    rentalRange !== null &&
    monthlyMaintenance !== null &&
    effectiveFinalNetPrice !== null &&
    effectiveFinalNetPrice > 0
      ? {
          low: (((rentalRange.low - monthlyMaintenance) * 12) / effectiveFinalNetPrice) * 100,
          high: (((rentalRange.high - monthlyMaintenance) * 12) / effectiveFinalNetPrice) * 100,
        }
      : null;
  const cashOnCashReturnPercent =
    annualCashFlow !== null &&
    estimatedTotalCashRequired !== null &&
    estimatedTotalCashRequired > 0
      ? {
          low: (annualCashFlow.low / estimatedTotalCashRequired) * 100,
          high: (annualCashFlow.high / estimatedTotalCashRequired) * 100,
        }
      : null;

  return {
    rentalRange,
    monthlyMaintenance,
    monthlyCashFlow,
    annualCashFlow,
    netRentalYieldPercent,
    cashOnCashReturnPercent,
  };
}

function formatPurchaseCostTreatment(treatment: PurchaseCostTreatment | null) {
  if (treatment === "customer_pay") return "Customer Pay";
  if (treatment === "developer_absorbed") return "FREE";
  if (treatment === "not_applicable") return "N/A";

  return "—";
}

function renderPurchaseCostValue(purchaseCost: OwnershipCostRow) {
  if (purchaseCost.treatment === null) return "—";
  if (purchaseCost.treatment === "not_applicable") return "N/A";

  const amount = formatOptionalMoney(purchaseCost.amount);

  if (purchaseCost.treatment === "developer_absorbed") {
    return (
      <span className="space-y-1">
        <span className="block text-zinc-900">{amount}</span>
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#087F6B]">
          FREE
        </span>
      </span>
    );
  }

  return (
    <span className="space-y-1">
      <span className="block text-zinc-900">{amount}</span>
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {formatPurchaseCostTreatment(purchaseCost.treatment)}
      </span>
    </span>
  );
}

function renderSignedMoney(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—";

  const colorClass =
    value > 0 ? "text-emerald-700" : value < 0 ? "text-[#8B3A3A]" : "text-zinc-900";

  return (
    <span className={`font-semibold ${colorClass}`}>
      {formatCurrency(value)}
      {suffix}
    </span>
  );
}

function renderSignedMoneyRange(range: InvestmentValueRange | null, suffix = "") {
  if (!range) return "—";
  if (range.low === range.high) return renderSignedMoney(range.low, suffix);

  const colorClass =
    range.low > 0 && range.high > 0
      ? "text-emerald-700"
      : range.low < 0 && range.high < 0
        ? "text-[#8B3A3A]"
        : "text-zinc-900";

  return (
    <span className={`font-semibold ${colorClass}`}>
      {formatCurrency(range.low)} – {formatCurrency(range.high)}
      {suffix}
    </span>
  );
}

function formatText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : "—";
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-MY")
    : "—";
}

function formatSize(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-MY")} sqft`
    : "—";
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return "—";
}

function formatCarParks(unitType: UnitTypeOption) {
  if (typeof unitType.default_carparks === "number" && Number.isFinite(unitType.default_carparks)) {
    return unitType.default_carparks.toLocaleString("en-MY");
  }

  return formatText(unitType.carpark_description);
}

function formatDistance(distanceMeters: number | null | undefined) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${distanceMeters.toLocaleString("en-MY")} m`;

  const kilometers = distanceMeters / 1000;

  return `${kilometers.toLocaleString("en-MY", {
    minimumFractionDigits: kilometers % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} km`;
}

function formatConnectionMode(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    walking: "Walking",
    direct_connected: "Direct Connected",
    sheltered_walking: "Sheltered Walking",
    shuttle: "Shuttle",
    driving: "Driving",
    nearby: "Nearby",
    other: "Other",
  };

  return mode ? labels[mode] ?? formatText(mode) : null;
}

function formatConnectivityMeta(point: ConnectivityPoint) {
  const parts = [
    formatDistance(point.distance_meters),
    formatConnectionMode(point.connection_mode),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "—";
}

function getConnectivityItemsForGroup(option: ComparedOption, categories: string[]) {
  return option.connectivity.filter((point) => categories.includes(point.category));
}

function renderConnectivityItems(items: ConnectivityPoint[]) {
  if (!items.length) return "—";

  return (
    <div className="space-y-3">
      {items.map((point) => (
        <div
          key={point.id}
          className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]/60 px-3 py-3"
        >
          <p className="font-semibold text-[var(--falcon-charcoal)]">{point.name}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--falcon-gold-dark)]">
            {formatConnectivityMeta(point)}
          </p>
          {point.customer_description ? (
            <p className="mt-2 text-xs font-normal leading-5 text-[var(--falcon-muted-text)]">
              {point.customer_description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const insightGroups: Array<{
  label: string;
  categories: ProjectComparisonInsightCategory[];
}> = [
  { label: "Price & Cost", categories: ["price"] },
  { label: "Investment", categories: ["investment"] },
  { label: "Property", categories: ["property"] },
  { label: "Timeline & Connectivity", categories: ["timeline", "connectivity"] },
];

function getInsightTypeLabel(type: ProjectComparisonInsightType) {
  if (type === "clear_advantage") return "Clear Advantage";
  if (type === "feature_highlight") return "Feature Highlight";

  return "Competitive";
}

function getInsightTypeClass(type: ProjectComparisonInsightType) {
  if (type === "clear_advantage") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "feature_highlight") return "border-teal-200 bg-teal-50 text-teal-700";

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getInsightProjectNames(insight: ProjectComparisonInsight) {
  const names = [
    ...new Set(
      insight.evidence
        .filter((item) => insight.project_ids.includes(item.project_id))
        .map((item) => item.project_name),
    ),
  ];

  return names.length ? names.join(", ") : "Comparable projects";
}

function renderInsightEvidence(insight: ProjectComparisonInsight) {
  return insight.evidence.slice(0, 4).map((item) => (
    <p key={`${insight.id}-${item.project_id}-${item.value_label}`} className="text-xs text-zinc-500">
      <span className="font-semibold text-zinc-700">{item.project_name}</span>
      {": "}
      {item.value_label}
    </p>
  ));
}

function renderPdfInsightEvidenceRows(insight: ProjectComparisonInsight) {
  return insight.evidence
    .slice(0, 4)
    .map(
      (item) => `
        <div class="pdf-insight-value-row">
          <span>${escapeHtml(item.project_name)}</span>
          <strong>${escapeHtml(item.value_label)}</strong>
        </div>
      `,
    )
    .join("");
}

function getFurnishingSummary(
  unitType: UnitTypeOption,
  commercialPackage: CommercialPackageOption | null,
) {
  const furnishingPackage = commercialPackage?.furnishing_package ?? unitType.furnishing_package;

  if (!furnishingPackage) return "—";

  return (
    <div>
      <p>{furnishingPackage.package_name}</p>
      {furnishingPackage.items.length ? (
        <p className="mt-1 text-xs font-normal leading-5 text-zinc-500">
          {furnishingPackage.items
            .slice(0, 4)
            .map((item) =>
              item.quantity ? `${item.item_name} x ${item.quantity}` : item.item_name,
            )
            .join(", ")}
          {furnishingPackage.items.length > 4 ? "..." : ""}
        </p>
      ) : null}
    </div>
  );
}

const connectivityGroups = [
  {
    label: "Public Transport",
    categories: ["lrt", "mrt", "ktm", "monorail", "brt"],
  },
  {
    label: "Lifestyle & Convenience",
    categories: ["mall", "grocery", "park"],
  },
  {
    label: "Education & Healthcare",
    categories: ["school", "university", "hospital"],
  },
  {
    label: "Road & Employment",
    categories: ["highway", "business_district"],
  },
  {
    label: "Other",
    categories: ["other"],
  },
];

const purchaseCostLabels: Record<PurchaseCostKey, string> = {
  spa_legal_fee: "SPA Legal Fee",
  loan_legal_fee: "Loan Legal Fee",
  spa_disbursement_fee: "SPA Disbursement Fee",
  loan_disbursement_fee: "Loan Disbursement Fee",
  loan_stamp_duty: "Loan Stamp Duty",
  mot_transfer_stamp_duty: "MOT / Transfer Stamp Duty",
  valuation_fee: "Valuation Fee",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatGeneratedDate() {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function formatPurchaseCostPdfValue(purchaseCost: OwnershipCostRow) {
  if (purchaseCost.treatment === null) return "—";
  if (purchaseCost.treatment === "not_applicable") return "N/A";

  const amount = formatOptionalMoney(purchaseCost.amount);

  if (purchaseCost.treatment === "developer_absorbed") {
    return `${amount} · FREE`;
  }

  return `${amount} · ${formatPurchaseCostTreatment(purchaseCost.treatment)}`;
}

function formatSignedMoneyText(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—";

  return `${formatCurrency(value)}${suffix}`;
}

function formatSignedMoneyRangeText(range: InvestmentValueRange | null, suffix = "") {
  if (!range) return "—";
  if (range.low === range.high) return formatSignedMoneyText(range.low, suffix);

  return `${formatCurrency(range.low)} – ${formatCurrency(range.high)}${suffix}`;
}

function renderPdfTable(section: PdfTableSection, comparedOptions: ComparedOption[]) {
  return `
    <section class="pdf-section">
      <div class="section-heading">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.description)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Detail</th>
            ${comparedOptions
              .map((option) => `<th>${escapeHtml(option.project.name)}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${section.rows
            .map(
              (row) => `
                <tr>
                  <th>${escapeHtml(row.label)}</th>
                  ${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderPdfObjectiveInsights(insights: ProjectComparisonInsight[]) {
  if (!insights.length) return "";

  const groupsHtml = insightGroups
    .map((group) => {
      const groupInsights = insights.filter((insight) =>
        group.categories.includes(insight.category),
      );

      if (!groupInsights.length) return "";

      return `
        <div class="pdf-insight-group">
          <h3>${escapeHtml(group.label)}</h3>
          <div class="pdf-insight-grid">
            ${groupInsights
              .map(
                (insight) => `
                  <article class="pdf-insight-card">
                    <p class="pdf-insight-title">${escapeHtml(insight.title)}</p>
                    <div class="pdf-insight-values">
                      ${renderPdfInsightEvidenceRows(insight)}
                    </div>
                    <span class="pdf-insight-type">${escapeHtml(getInsightTypeLabel(insight.type))}</span>
                    ${
                      insight.explanation
                        ? `<p class="pdf-insight-explanation">${escapeHtml(insight.explanation)}</p>`
                        : ""
                    }
                  </article>
                `,
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  if (!groupsHtml.trim()) return "";

  return `
    <section class="pdf-section pdf-objective-insights">
      <div class="section-heading">
        <h2>Objective Insights</h2>
        <p>Data-driven highlights from the current comparison.</p>
      </div>
      ${groupsHtml}
    </section>
  `;
}

function renderPdfSectionGroup(
  sections: PdfTableSection[],
  comparedOptions: ComparedOption[],
  startsNewPage: boolean,
  leadingHtml = "",
) {
  if (sections.length === 0 && !leadingHtml.trim()) return "";

  return `
    <div class="pdf-section-group${startsNewPage ? " pdf-section-group-new-page" : ""}">
      ${leadingHtml}
      ${sections.map((section) => renderPdfTable(section, comparedOptions)).join("")}
    </div>
  `;
}

function buildComparisonPdfSections({
  comparedOptions,
  assumptions,
  activeConnectivityGroups,
}: {
  comparedOptions: ComparedOption[];
  assumptions: ComparisonAssumptions;
  activeConnectivityGroups: typeof connectivityGroups;
}): PdfTableSection[] {
  return [
    {
      id: "quick",
      title: "Quick Comparison",
      description:
        "Factual comparison using SPA Price for financing and Final Net Price for price/yield context.",
      rows: [
        {
          label: "Project",
          values: comparedOptions.map((option) => option.project.name),
        },
        {
          label: "Unit Type",
          values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
        },
        {
          label: "Final Net Price",
          values: comparedOptions.map((option) =>
            formatScenarioPrice(option.effectiveComparisonPrice, option.comparisonPriceSource),
          ),
        },
        {
          label: "Size",
          values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
        },
        {
          label: "PSF",
          values: comparedOptions.map((option) => formatMoneyRange(option.unitMetrics.psf, " psf")),
        },
        {
          label: "SPA Price",
          values: comparedOptions.map((option) =>
            formatScenarioPrice(option.effectiveSpaPrice, option.spaPriceSource),
          ),
        },
        {
          label: "Est. Monthly Instalment",
          values: comparedOptions.map((option) =>
            formatMoneyRange(option.metrics.estimatedMonthlyInstalment, " / month"),
          ),
        },
        {
          label: "Est. Rental",
          values: comparedOptions.map((option) => formatMoneyRange(option.metrics.estimatedRental)),
        },
        {
          label: "Est. Gross Yield",
          values: comparedOptions.map((option) =>
            formatPercentRange(option.metrics.estimatedGrossRentalYieldPercent),
          ),
        },
        {
          label: "Tenure",
          values: comparedOptions.map((option) => formatText(option.project.tenure)),
        },
        {
          label: "Estimated Completion",
          values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
        },
        {
          label: "Sales Package",
          values: comparedOptions.map((option) => option.commercialPackage?.package_name ?? "No Package"),
        },
      ],
    },
    {
      id: "ownership",
      title: "Ownership Cost",
      description: "Estimated financing and upfront purchase costs based on the selected scenario.",
      rows: [
        {
          label: "SPA Price",
          values: comparedOptions.map((option) =>
            formatScenarioPrice(option.effectiveSpaPrice, option.spaPriceSource),
          ),
        },
        {
          label: "Final Net Price",
          values: comparedOptions.map((option) =>
            formatScenarioPrice(option.effectiveComparisonPrice, option.comparisonPriceSource),
          ),
        },
        {
          label: "Loan Margin",
          values: comparedOptions.map(() => formatPercentValue(assumptions.loanMarginPercent)),
        },
        {
          label: "Estimated Loan Amount",
          values: comparedOptions.map((option) => formatMoneyRange(option.metrics.loanAmount)),
        },
        {
          label: "Cash Downpayment",
          values: comparedOptions.map((option) =>
            formatOptionalMoney(option.ownershipCost.cashDownpayment),
          ),
        },
        {
          label: "Est. Monthly Instalment",
          values: comparedOptions.map((option) =>
            formatMoneyRange(option.metrics.estimatedMonthlyInstalment, " / month"),
          ),
        },
        ...purchaseCostKeys.map((costKey) => ({
          label: purchaseCostLabels[costKey],
          values: comparedOptions.map((option) => {
            const purchaseCost = option.ownershipCost.purchaseCosts.find(
              (item) => item.costKey === costKey,
            );

            return purchaseCost ? formatPurchaseCostPdfValue(purchaseCost) : "—";
          }),
        })),
        {
          label: "Estimated Total Cash Required",
          values: comparedOptions.map((option) =>
            formatOptionalMoney(option.ownershipCost.estimatedTotalCashRequired),
          ),
        },
        {
          label: "Total Savings",
          values: comparedOptions.map((option) =>
            formatOptionalMoney(option.ownershipCost.totalSavings),
          ),
        },
      ],
    },
    {
      id: "investment",
      title: "Investment Comparison",
      description: "Estimated rental performance and cash returns based on the selected unit.",
      rows: [
        {
          label: "Estimated Monthly Rental",
          values: comparedOptions.map((option) => formatRentalDisplay(option.unitType)),
        },
        {
          label: "Monthly Maintenance",
          values: comparedOptions.map((option) =>
            formatOptionalMonthlyMoney(option.investment.monthlyMaintenance),
          ),
        },
        {
          label: "Estimated Monthly Cash Flow",
          values: comparedOptions.map((option) =>
            formatSignedMoneyRangeText(option.investment.monthlyCashFlow, " / month"),
          ),
        },
        {
          label: "Estimated Annual Cash Flow",
          values: comparedOptions.map((option) =>
            formatSignedMoneyRangeText(option.investment.annualCashFlow),
          ),
        },
        {
          label: "Net Rental Yield",
          values: comparedOptions.map((option) =>
            formatPercentValueRange(option.investment.netRentalYieldPercent),
          ),
        },
        {
          label: "Cash-on-Cash Return (CoC)",
          values: comparedOptions.map((option) =>
            formatPercentValueRange(option.investment.cashOnCashReturnPercent),
          ),
        },
      ],
    },
    {
      id: "overview",
      title: "Project Overview",
      description: "High-level project facts from the customer-safe comparison data.",
      rows: [
        {
          label: "Developer",
          values: comparedOptions.map((option) => formatText(option.project.developer)),
        },
        {
          label: "Location",
          values: comparedOptions.map((option) => formatText(option.project.location)),
        },
        {
          label: "Tenure",
          values: comparedOptions.map((option) => formatText(option.project.tenure)),
        },
        {
          label: "Property Type",
          values: comparedOptions.map((option) => formatText(option.project.property_type)),
        },
        {
          label: "Title Type",
          values: comparedOptions.map((option) => formatText(option.project.title_type)),
        },
        {
          label: "Total Units",
          values: comparedOptions.map((option) => formatNumber(option.project.total_units)),
        },
        {
          label: "Estimated Completion",
          values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
        },
      ],
    },
    {
      id: "unit",
      title: "Unit Comparison",
      description: "Selected Unit Type facts and calculated metrics using the shared assumptions.",
      rows: [
        {
          label: "Unit Type",
          values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
        },
        {
          label: "SPA Price Range",
          values: comparedOptions.map((option) =>
            formatStoredPriceRange(option.unitType.spa_price_from, option.unitType.spa_price_to),
          ),
        },
        {
          label: "Final Net Price Range",
          values: comparedOptions.map((option) => formatMoneyRange(option.unitMetrics.finalNetPrice)),
        },
        {
          label: "Size",
          values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
        },
        {
          label: "Bedrooms",
          values: comparedOptions.map((option) => formatNumber(option.unitType.bedrooms)),
        },
        {
          label: "Bathrooms",
          values: comparedOptions.map((option) => formatNumber(option.unitType.bathrooms)),
        },
        {
          label: "Car Parks",
          values: comparedOptions.map((option) => formatCarParks(option.unitType)),
        },
        {
          label: "PSF",
          values: comparedOptions.map((option) => formatMoneyRange(option.unitMetrics.psf, " psf")),
        },
        {
          label: "Balcony",
          values: comparedOptions.map((option) => formatBoolean(option.unitType.has_balcony)),
        },
        {
          label: "Dual Key",
          values: comparedOptions.map((option) => formatBoolean(option.unitType.is_dual_key)),
        },
        {
          label: "Furnishing",
          values: comparedOptions.map((option) =>
            getFurnishingSummaryText(option.unitType, option.commercialPackage),
          ),
        },
      ],
    },
    {
      id: "connectivity",
      title: "Connectivity",
      description: "Customer-facing connectivity facts grouped by category.",
      rows: activeConnectivityGroups.length
        ? activeConnectivityGroups.map((group) => ({
            label: group.label,
            values: comparedOptions.map((option) =>
              formatConnectivityItemsText(
                getConnectivityItemsForGroup(option, group.categories),
              ),
            ),
          }))
        : [
            {
              label: "Connectivity",
              values: comparedOptions.map(() => "No connectivity information added yet."),
            },
          ],
    },
  ];
}

function getFurnishingSummaryText(
  unitType: UnitTypeOption,
  commercialPackage: CommercialPackageOption | null,
) {
  const furnishingPackage = commercialPackage?.furnishing_package ?? unitType.furnishing_package;

  if (!furnishingPackage) return "—";

  const items = furnishingPackage.items
    .slice(0, 4)
    .map((item) => (item.quantity ? `${item.item_name} x ${item.quantity}` : item.item_name));
  const suffix =
    furnishingPackage.items.length > 4 ? ` + ${furnishingPackage.items.length - 4} more` : "";

  return items.length
    ? `${furnishingPackage.package_name}: ${items.join(", ")}${suffix}`
    : furnishingPackage.package_name;
}

function formatConnectivityItemsText(items: ConnectivityPoint[]) {
  if (!items.length) return "—";

  return items
    .map((point) => {
      const description = point.customer_description?.trim();
      const meta = formatConnectivityMeta(point);

      return description ? `${point.name} (${meta}) - ${description}` : `${point.name} (${meta})`;
    })
    .join("; ");
}

function buildComparisonProposalHtml({
  comparedOptions,
  assumptions,
  activeConnectivityGroups,
  selectedSectionIds,
  agentInsights,
  objectiveInsights,
  branding,
}: {
  comparedOptions: ComparedOption[];
  assumptions: ComparisonAssumptions;
  activeConnectivityGroups: typeof connectivityGroups;
  selectedSectionIds: ExportSectionId[];
  agentInsights: string;
  objectiveInsights: ProjectComparisonInsight[];
  branding: CustomerPdfBranding;
}) {
  const sections = buildComparisonPdfSections({
    comparedOptions,
    assumptions,
    activeConnectivityGroups,
  }).filter((section) => selectedSectionIds.includes(section.id));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const objectiveInsightsHtml = selectedSectionIds.includes("objective")
    ? renderPdfObjectiveInsights(objectiveInsights)
    : "";
  const sectionGroups = [
    {
      leadingHtml: objectiveInsightsHtml,
      sections: ["quick", "investment"]
        .map((sectionId) => sectionById.get(sectionId as ExportSectionId))
        .filter((section): section is PdfTableSection => Boolean(section)),
    },
    {
      leadingHtml: "",
      sections: ["ownership"]
        .map((sectionId) => sectionById.get(sectionId as ExportSectionId))
        .filter((section): section is PdfTableSection => Boolean(section)),
    },
    {
      leadingHtml: "",
      sections: ["overview", "unit"]
        .map((sectionId) => sectionById.get(sectionId as ExportSectionId))
        .filter((section): section is PdfTableSection => Boolean(section)),
    },
    {
      leadingHtml: "",
      sections: ["connectivity"]
        .map((sectionId) => sectionById.get(sectionId as ExportSectionId))
        .filter((section): section is PdfTableSection => Boolean(section)),
    },
  ].filter((group) => group.leadingHtml.trim() || group.sections.length > 0);
  const generatedDate = formatGeneratedDate();
  const trimmedAgentInsights = agentInsights.trim();

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Project Comparison Proposal</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 16mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #ffffff;
            color: #18181b;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .proposal {
            width: 100%;
          }

          .opening-page {
            break-after: page;
            min-height: 270mm;
          }

          .proposal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
          }

          .eyebrow {
            margin: 0 0 4px;
            color: #0f766e;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            font-size: 24px;
            letter-spacing: -0.02em;
          }

          .prepared-date {
            margin: 0;
            color: #52525b;
            font-size: 11px;
            line-height: 1.5;
            text-align: right;
          }

          .project-grid {
            display: grid;
            grid-template-columns: repeat(${Math.max(comparedOptions.length, 1)}, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
          }

          .project-card {
            border: 1px solid #e4e4e7;
            border-radius: 10px;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .project-cover {
            width: 100%;
            aspect-ratio: 16 / 8;
            background: #f4f4f5;
            object-fit: cover;
            display: block;
          }

          .project-cover-placeholder {
            align-items: center;
            color: #71717a;
            display: flex;
            font-size: 10px;
            font-weight: 700;
            justify-content: center;
            min-height: 86px;
            text-transform: uppercase;
          }

          .project-card-body {
            padding: 8px 10px 10px;
          }

          .project-name {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
          }

          .project-meta,
          .project-package {
            margin: 4px 0 0;
            color: #52525b;
            font-size: 10px;
            line-height: 1.4;
          }

          .layout-section {
            margin-top: 12px;
          }

          .layout-grid {
            display: grid;
            grid-template-columns: repeat(${Math.max(comparedOptions.length, 1)}, minmax(0, 1fr));
            gap: 8px;
            margin-top: 8px;
          }

          .layout-card {
            border: 1px solid #e4e4e7;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            padding: 8px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .layout-name {
            margin: 0 0 6px;
            color: #18181b;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.35;
          }

          .layout-image-frame {
            align-items: center;
            background: #fafafa;
            border: 1px solid #e4e4e7;
            border-radius: 8px;
            display: flex;
            flex: 1;
            justify-content: center;
            min-height: ${comparedOptions.length > 2 ? "104px" : "136px"};
            overflow: hidden;
          }

          .layout-image {
            display: block;
            max-height: ${comparedOptions.length > 2 ? "178px" : "230px"};
            max-width: 100%;
            object-fit: contain;
          }

          .layout-placeholder {
            color: #71717a;
            font-size: 10px;
            font-weight: 700;
            padding: 28px 10px;
            text-align: center;
            text-transform: uppercase;
          }

          .insights {
            border: 1px solid #e4e4e7;
            border-radius: 10px;
            margin-top: 14px;
            padding: 10px 12px;
            break-inside: auto;
            page-break-inside: auto;
          }

          .insights p {
            margin: 4px 0 0;
            color: #71717a;
            font-size: 10px;
            line-height: 1.5;
            white-space: pre-wrap;
          }

          .insights-page-one-body {
            max-height: 42mm;
            overflow: hidden;
          }

          .insights-continuation {
            break-after: page;
            page-break-after: always;
            padding-top: 0;
          }

          .insights-continuation[hidden] {
            display: none;
          }

          .insights-continuation h2 {
            border-bottom: 2px solid #0f766e;
            padding-bottom: 8px;
          }

          .insights-continuation h2 span {
            color: #71717a;
            display: block;
            font-size: 10px;
            letter-spacing: 0.16em;
            margin-top: 3px;
          }

          .insights-continuation p {
            color: #3f3f46;
            font-size: 11px;
            line-height: 1.7;
            margin-top: 12px;
            white-space: pre-wrap;
          }

          .pdf-section {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 12px;
          }

          .pdf-section-group {
            break-inside: auto;
            page-break-inside: auto;
          }

          .pdf-section-group-new-page {
            break-before: page;
            page-break-before: always;
          }

          .pdf-objective-insights {
            break-inside: auto;
            page-break-inside: auto;
          }

          .pdf-insight-group {
            margin-top: 9px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pdf-insight-group h3 {
            border-bottom: 1px solid #e4e4e7;
            color: #334155;
            font-size: 9px;
            letter-spacing: 0.08em;
            margin: 0 0 6px;
            padding-bottom: 4px;
            text-transform: uppercase;
          }

          .pdf-insight-grid {
            display: grid;
            align-items: stretch;
            gap: 7px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pdf-insight-card {
            background: #fafafa;
            border: 1px solid #e4e4e7;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            min-height: 66px;
            padding: 8px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pdf-insight-title {
            color: #18181b;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.3;
            margin: 0;
          }

          .pdf-insight-values {
            display: grid;
            gap: 3px;
            margin-top: 6px;
          }

          .pdf-insight-value-row {
            display: flex;
            gap: 8px;
            justify-content: space-between;
            line-height: 1.25;
          }

          .pdf-insight-value-row span {
            color: #334155;
            font-size: 9px;
            font-weight: 700;
          }

          .pdf-insight-value-row strong {
            color: #0f766e;
            font-size: 9px;
            font-weight: 700;
            text-align: right;
          }

          .pdf-insight-type {
            align-self: flex-start;
            border: 1px solid #d4d4d8;
            border-radius: 999px;
            color: #3f3f46;
            font-size: 7.5px;
            font-weight: 700;
            line-height: 1.2;
            margin-top: 6px;
            padding: 2px 5px;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .pdf-insight-explanation {
            color: #52525b;
            font-size: 8.5px;
            line-height: 1.4;
            margin: 5px 0 0;
          }

          .section-heading {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 6px;
          }

          h2 {
            margin: 0;
            color: #083f3a;
            font-size: 13px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .section-heading p {
            margin: 0;
            color: #71717a;
            font-size: 9px;
            text-align: right;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #e4e4e7;
            padding: 5px 7px;
            text-align: left;
            vertical-align: top;
          }

          thead th {
            background: #0f766e;
            color: #ffffff;
            font-size: 9px;
            text-transform: uppercase;
          }

          tbody th {
            width: 20%;
            background: #f8fafc;
            color: #3f3f46;
            font-size: 8.5px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          tbody td {
            color: #18181b;
            font-weight: 600;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          ${getCustomerPdfBrandingStyles()}

          @media screen {
            body {
              background: #f4f4f5;
              padding: 24px;
            }

            .proposal {
              background: #ffffff;
              box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14);
              margin: 0 auto;
              max-width: 794px;
              padding: 38px;
            }
          }
        </style>
      </head>
      <body>
        ${renderCustomerPdfWatermark(branding)}
        <template id="agent-insights-source">${escapeHtml(trimmedAgentInsights)}</template>
        <main class="proposal">
          <div class="opening-page">
            <header class="proposal-header">
              <div>
                <p class="eyebrow">Project Comparison</p>
                <h1>Property Comparison Proposal</h1>
              </div>
              <p class="prepared-date">
                Prepared on<br />
                <strong>${escapeHtml(generatedDate)}</strong>
              </p>
            </header>

            <section class="project-grid">
              ${comparedOptions
                .map(
                  (option) => `
                    <article class="project-card">
                      ${
                        option.project.cover_media?.signed_url
                          ? `<img class="project-cover" src="${escapeHtml(option.project.cover_media.signed_url)}" alt="${escapeHtml(option.project.name)} cover" />`
                          : `<div class="project-cover project-cover-placeholder">No Cover</div>`
                      }
                      <div class="project-card-body">
                        <p class="project-name">${escapeHtml(option.project.name)}</p>
                        <p class="project-meta">${escapeHtml(formatText(option.project.location))}</p>
                        <p class="project-meta">Unit Type: ${escapeHtml(getUnitTypeLabel(option.unitType))}</p>
                        <p class="project-package">Sales Package: ${escapeHtml(option.commercialPackage?.package_name ?? "No Package")}</p>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </section>

            <section class="layout-section">
              <div class="section-heading">
                <h2>Selected Layout Plan</h2>
                <p>Customer-visible layout selected for this comparison.</p>
              </div>
              <div class="layout-grid">
                ${comparedOptions
                  .map(
                    (option) => `
                      <article class="layout-card">
                        <p class="layout-name">${escapeHtml(option.project.name)}<br />${escapeHtml(option.layoutPlan ? getLayoutPlanLabel(option.layoutPlan) : "No Layout Plan available")}</p>
                        <div class="layout-image-frame">
                          ${
                            option.layoutPlan?.media.signed_url
                              ? `<img class="layout-image" src="${escapeHtml(option.layoutPlan.media.signed_url)}" alt="${escapeHtml(option.project.name)} selected layout plan" />`
                              : `<div class="layout-placeholder">No Layout Plan available</div>`
                          }
                        </div>
                      </article>
                    `,
                  )
                  .join("")}
              </div>
            </section>

            <section class="insights">
              <h2>Agent Insights &amp; Recommendation</h2>
              <p id="agent-insights-page-one" class="insights-page-one-body"></p>
            </section>
          </div>

          <section id="agent-insights-continuation" class="insights-continuation" hidden>
            <h2>Agent Insights &amp; Recommendation <span>Continued</span></h2>
            <p id="agent-insights-continuation-body"></p>
          </section>

          ${sectionGroups
            .map((group, index) =>
              renderPdfSectionGroup(
                group.sections,
                comparedOptions,
                index > 0,
                group.leadingHtml,
              ),
            )
            .join("")}

          ${renderCustomerPdfBranding(branding)}
        </main>
        <script>
          (() => {
            const source = document.getElementById("agent-insights-source");
            const pageOneBody = document.getElementById("agent-insights-page-one");
            const continuation = document.getElementById("agent-insights-continuation");
            const continuationBody = document.getElementById("agent-insights-continuation-body");

            if (!source || !pageOneBody || !continuation || !continuationBody) return;

            const fullText = source.content.textContent || "";

            if (!fullText.trim()) {
              pageOneBody.textContent = "No agent recommendation added.";
              continuation.hidden = true;
              return;
            }

            pageOneBody.textContent = fullText;

            if (pageOneBody.scrollHeight <= pageOneBody.clientHeight + 1) {
              continuation.hidden = true;
              return;
            }

            let low = 0;
            let high = fullText.length;
            let best = 0;

            while (low <= high) {
              const mid = Math.floor((low + high) / 2);

              pageOneBody.textContent = fullText.slice(0, mid).trimEnd();

              if (pageOneBody.scrollHeight <= pageOneBody.clientHeight + 1) {
                best = mid;
                low = mid + 1;
              } else {
                high = mid - 1;
              }
            }

            const firstCandidate = fullText.slice(0, best);
            const whitespaceSplit = Math.max(
              firstCandidate.lastIndexOf(" "),
              firstCandidate.lastIndexOf("\\n"),
              firstCandidate.lastIndexOf("\\t"),
            );
            const splitIndex =
              whitespaceSplit > Math.max(20, best - 120) ? whitespaceSplit : best;
            const pageOneText = fullText.slice(0, splitIndex).trimEnd();
            const continuationText = fullText.slice(splitIndex).trimStart();

            pageOneBody.textContent = pageOneText || fullText.slice(0, best).trimEnd();
            continuationBody.textContent = pageOneText
              ? continuationText
              : fullText.slice(best).trimStart();
            continuation.hidden = continuationBody.textContent.trim().length === 0;
          })();
        </script>
      </body>
    </html>`;
}

function printComparisonWhenImagesAreReady(proposalWindow: Window) {
  const images = Array.from(proposalWindow.document.images);

  if (images.length === 0) {
    proposalWindow.print();
    return;
  }

  let pendingImages = images.filter((image) => !image.complete).length;

  if (pendingImages === 0) {
    proposalWindow.print();
    return;
  }

  let hasPrinted = false;
  const printOnce = () => {
    if (hasPrinted) return;

    hasPrinted = true;
    proposalWindow.print();
  };
  const markImageDone = () => {
    pendingImages -= 1;

    if (pendingImages <= 0) {
      printOnce();
    }
  };

  for (const image of images) {
    if (image.complete) continue;

    image.addEventListener("load", markImageDone, { once: true });
    image.addEventListener("error", markImageDone, { once: true });
  }

  window.setTimeout(printOnce, 5000);
}

type ComparisonRow = {
  label: string;
  values: ReactNode[];
};

function ComparisonTable({
  title,
  description,
  comparedOptions,
  rows,
}: {
  title: string;
  description: string;
  comparedOptions: ComparedOption[];
  rows: ComparisonRow[];
}) {
  return (
    <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 border-b border-[var(--falcon-soft-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
            Compare
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--falcon-muted-text)]">
            {description}
          </p>
        </div>
        <div className="flex gap-1.5">
          {comparedOptions.map((option, index) => (
            <span
              key={`${title}-legend-${option.slot.id}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#d8c48e] bg-[#fbf8ef] text-xs font-semibold text-[var(--falcon-gold-dark)]"
            >
              {comparisonLetters[index] ?? index + 1}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-[var(--falcon-soft-border)] bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Detail
              </th>
              {comparedOptions.map((option, index) => (
                <th
                  key={`${title}-${option.slot.id}`}
                  className="border-b border-[var(--falcon-soft-border)] px-4 py-3"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--falcon-charcoal)] text-xs font-semibold text-white">
                      {comparisonLetters[index] ?? index + 1}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">
                      Project {comparisonLetters[index] ?? index + 1}
                    </span>
                  </div>
                  <div className="mb-3 aspect-video w-full max-w-[240px] overflow-hidden rounded-[18px] border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]">
                    {option.project.cover_media?.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={option.project.cover_media.signed_url}
                        alt={`${option.project.name} cover`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs font-medium normal-case tracking-normal text-zinc-400">
                        No cover
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold normal-case tracking-normal text-[var(--falcon-charcoal)]">
                    {option.project.name}
                  </p>
                  <p className="mt-1 text-xs font-medium normal-case tracking-normal text-zinc-500">
                    {formatText(option.project.location)}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="sticky left-0 z-10 border-b border-[var(--falcon-soft-border)] bg-white py-4 pr-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className="border-b border-[var(--falcon-soft-border)] px-4 py-4 font-medium leading-6 text-zinc-900"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getDefaultSavedWorkTitle(slots: ComparisonSlot[], projectOptionsById: Record<string, ProjectOptions>) {
  const names = slots
    .map((slot) => projectOptionsById[slot.projectId]?.project.name)
    .filter((name): name is string => Boolean(name?.trim()));

  return names.length ? `${names.join(" vs ")} Comparison` : "Project Comparison";
}

function sanitizeMediaSnapshot(
  media: ProjectCoverMedia | UnitLayoutMedia | null,
): ProjectComparisonSavedMediaSnapshotV1 | null {
  if (!media) return null;

  return {
    title: media.title,
    media_type: media.media_type,
    mime_type: media.mime_type,
    description: media.description,
  };
}

function sanitizeProjectOptionsSnapshot(
  options: ProjectOptions | undefined,
): ProjectComparisonSavedProjectOptionsV1 | null {
  if (!options) return null;

  return {
    project: {
      ...options.project,
      cover_media: sanitizeMediaSnapshot(options.project.cover_media),
    },
    unit_types: options.unit_types.map((unitType) => ({
      ...unitType,
      layout: sanitizeMediaSnapshot(unitType.layout),
      furnishing_package: unitType.furnishing_package,
    })),
    connectivity: options.connectivity.map((point) => ({ ...point })),
    commercial_packages: options.commercial_packages.map((commercialPackage) => ({
      ...commercialPackage,
      furnishing_package: commercialPackage.furnishing_package,
      items: commercialPackage.items.map((item) => ({ ...item })),
      purchase_costs: commercialPackage.purchase_costs.map((cost) => ({ ...cost })),
    })),
  };
}

function restoreMediaSnapshot(
  media: ProjectComparisonSavedMediaSnapshotV1 | null,
): ProjectCoverMedia | UnitLayoutMedia | null {
  if (!media) return null;

  return {
    title: media.title,
    media_type: media.media_type,
    mime_type: media.mime_type,
    description: media.description,
    signed_url: null,
  };
}

function restoreProjectOptionsSnapshot(
  snapshot: ProjectComparisonSavedProjectOptionsV1 | null,
): ProjectOptions | null {
  if (!snapshot) return null;

  return {
    project: {
      ...snapshot.project,
      cover_media: restoreMediaSnapshot(snapshot.project.cover_media),
    },
    unit_types: snapshot.unit_types.map((unitType) => ({
      ...unitType,
      layout: restoreMediaSnapshot(unitType.layout),
      furnishing_package: unitType.furnishing_package,
    })),
    connectivity: snapshot.connectivity.map((point) => ({ ...point })),
    commercial_packages: snapshot.commercial_packages.map((commercialPackage) => ({
      ...commercialPackage,
      purchase_costs: commercialPackage.purchase_costs.map((cost) => ({
        ...cost,
        cost_key: cost.cost_key as PurchaseCostKey,
        treatment: cost.treatment as PurchaseCostTreatment,
      })),
    })),
  };
}

function attachFreshCustomerSafeMedia(savedOptions: ProjectOptions, freshOptions: ProjectOptions) {
  const freshUnitTypesById = new Map(freshOptions.unit_types.map((unitType) => [unitType.id, unitType]));

  return {
    ...savedOptions,
    project: {
      ...savedOptions.project,
      cover_media: savedOptions.project.cover_media
        ? {
            ...savedOptions.project.cover_media,
            signed_url: freshOptions.project.cover_media?.signed_url ?? null,
          }
        : null,
    },
    unit_types: savedOptions.unit_types.map((unitType) => {
      const freshUnitType = freshUnitTypesById.get(unitType.id);

      return {
        ...unitType,
        layout: unitType.layout
          ? {
              ...unitType.layout,
              signed_url: freshUnitType?.layout?.signed_url ?? null,
            }
          : null,
      };
    }),
  } satisfies ProjectOptions;
}

async function fetchProjectOptions(projectId: string) {
  const response = await fetch(`/api/tools/project-comparison/projects/${projectId}/options`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load Project options");
  }

  return (await response.json()) as ProjectOptions;
}

function SaveWorkModal({
  mode,
  title,
  error,
  isSaving,
  onTitleChange,
  onCancel,
  onConfirm,
}: {
  mode: SaveModalMode;
  title: string;
  error: string;
  isSaving: boolean;
  onTitleChange: (title: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
            Saved Work
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">
            {mode === "save-as" ? "Save As" : "Save Project Comparison"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Name this comparison so you can reopen and continue it later.
          </p>
        </div>

        <label className="mt-5 block text-sm text-zinc-600">
          <span className="mb-1 block font-medium text-zinc-900">Saved Work Title</span>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={isSaving}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
            maxLength={120}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || !title.trim()}
            className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : mode === "save-as" ? "Save As" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectComparisonPage() {
  const { displayName, phone } = useAppPermissions();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectOptionsById, setProjectOptionsById] = useState<Record<string, ProjectOptions>>({});
  const [slots, setSlots] = useState<ComparisonSlot[]>(initialSlots);
  const [loanMarginPercent, setLoanMarginPercent] = useState("90");
  const [annualInterestRatePercent, setAnnualInterestRatePercent] = useState("4.0");
  const [loanTenureYears, setLoanTenureYears] = useState("35");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectListError, setProjectListError] = useState("");
  const [hasCompared, setHasCompared] = useState(false);
  const [comparisonConfigChanged, setComparisonConfigChanged] = useState(false);
  const [agentInsights, setAgentInsights] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportSections, setSelectedExportSections] =
    useState<ExportSectionId[]>(allExportSectionIds);
  const [currentSavedWorkId, setCurrentSavedWorkId] = useState<string | null>(null);
  const [currentSavedWorkTitle, setCurrentSavedWorkTitle] = useState("");
  const [saveModalMode, setSaveModalMode] = useState<SaveModalMode | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [reopenWarning, setReopenWarning] = useState("");
  const handoffHydratedRef = useRef(false);
  const savedWorkHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        const response = await fetch("/api/tools/project-comparison/projects");

        if (!response.ok) {
          throw new Error("Unable to load Projects");
        }

        const data = (await response.json()) as ProjectOption[];

        if (isMounted) {
          setProjects(data);
        }
      } catch (error) {
        if (isMounted) {
          setProjectListError(error instanceof Error ? error.message : "Unable to load Projects");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  function buildProjectComparisonSavedWorkPayload(): ProjectComparisonSavedWorkPayloadV1 {
    return {
      tool: "project_comparison",
      schemaVersion: projectComparisonSavedWorkSchemaVersion,
      hasCompared,
      assumptions: {
        loanMarginPercent,
        annualInterestRatePercent,
        loanTenureYears,
      },
      selectedExportSections,
      agentInsights,
      slots: selectedSlots.slice(0, 3).map((slot) => ({
        projectId: slot.projectId,
        unitTypeId: slot.unitTypeId,
        layoutPlanId: slot.layoutPlanId,
        packageId: slot.packageId,
        spaPrice: slot.spaPrice,
        comparisonPrice: slot.comparisonPrice,
        snapshot: sanitizeProjectOptionsSnapshot(projectOptionsById[slot.projectId]),
      })),
    };
  }

  async function saveProjectComparisonWork(title: string, savedWorkId: string | null) {
    const trimmedTitle = title.trim();

    if (!canSaveComparisonWork) {
      setSaveStatus("error");
      setSaveMessage("Select at least two Projects and Unit Types before saving.");
      return;
    }

    if (!trimmedTitle) {
      setSaveStatus("error");
      setSaveMessage("Saved Work title is required.");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const response = await fetch(
        savedWorkId ? `/api/saved-work/${savedWorkId}` : "/api/saved-work",
        {
          method: savedWorkId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            savedWorkId
              ? {
                  title: trimmedTitle,
                  payload: buildProjectComparisonSavedWorkPayload(),
                  schemaVersion: projectComparisonSavedWorkSchemaVersion,
                }
              : {
                  title: trimmedTitle,
                  workType: "project_comparison",
                  payload: buildProjectComparisonSavedWorkPayload(),
                  schemaVersion: projectComparisonSavedWorkSchemaVersion,
                },
          ),
        },
      );
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "Unable to save Project Comparison");
      }

      setCurrentSavedWorkId(data.savedWork.id);
      setCurrentSavedWorkTitle(data.savedWork.title);
      setSaveStatus("saved");
      setSaveMessage("Saved");
      setSaveModalMode(null);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  function openSaveModal(mode: SaveModalMode) {
    setSaveModalMode(mode);
    setSaveTitle(
      mode === "save-as"
        ? `${getDefaultSavedWorkTitle(selectedSlots, projectOptionsById)} Copy`
        : getDefaultSavedWorkTitle(selectedSlots, projectOptionsById),
    );
    setSaveMessage("");
    setSaveStatus("idle");
  }

  function handleSaveClick() {
    if (currentSavedWorkId) {
      void saveProjectComparisonWork(
        currentSavedWorkTitle || getDefaultSavedWorkTitle(selectedSlots, projectOptionsById),
        currentSavedWorkId,
      );
      return;
    }

    openSaveModal("new");
  }

  function hydrateSavedProjectComparisonPayload(payload: ProjectComparisonSavedWorkPayloadV1) {
    const restoredOptions: Record<string, ProjectOptions> = {};
    const restoredSlots = payload.slots.slice(0, 3).map((slot, index) => {
      const restoredSnapshot = restoreProjectOptionsSnapshot(slot.snapshot);

      if (restoredSnapshot && slot.projectId) {
        restoredOptions[slot.projectId] = restoredSnapshot;
      }

      return {
        ...createBlankSlot(index),
        projectId: slot.projectId,
        unitTypeId: slot.unitTypeId,
        layoutPlanId: slot.layoutPlanId,
        packageId: slot.packageId,
        spaPrice: slot.spaPrice,
        comparisonPrice: slot.comparisonPrice,
      };
    });

    while (restoredSlots.length < 2) {
      restoredSlots.push(createBlankSlot(restoredSlots.length));
    }

    setLoanMarginPercent(payload.assumptions.loanMarginPercent);
    setAnnualInterestRatePercent(payload.assumptions.annualInterestRatePercent);
    setLoanTenureYears(payload.assumptions.loanTenureYears);
    setSlots(restoredSlots);
    setProjectOptionsById((current) => ({ ...current, ...restoredOptions }));
    setProjects((current) => {
      const projectMap = new Map(current.map((project) => [project.id, project]));

      Object.values(restoredOptions).forEach((options) => {
        if (!projectMap.has(options.project.id)) {
          projectMap.set(options.project.id, {
            id: options.project.id,
            name: options.project.name,
            developer: options.project.developer,
            location: options.project.location,
          });
        }
      });

      return Array.from(projectMap.values());
    });
    setAgentInsights(payload.agentInsights);
    setSelectedExportSections(
      payload.selectedExportSections.length
        ? payload.selectedExportSections
        : allExportSectionIds,
    );
    setHasCompared(payload.hasCompared);
    setComparisonConfigChanged(false);
  }

  async function reconnectSavedProjectComparisonReferences(payload: ProjectComparisonSavedWorkPayloadV1) {
    const projectIds = [
      ...new Set(payload.slots.map((slot) => slot.projectId).filter(Boolean)),
    ];

    if (projectIds.length === 0) return;

    const settledOptions = await Promise.allSettled(
      projectIds.map(async (projectId) => ({
        projectId,
        options: await fetchProjectOptions(projectId),
      })),
    );
    const mediaUpdates: Record<string, ProjectOptions> = {};
    const unavailableProjects: string[] = [];

    for (const result of settledOptions) {
      if (result.status === "rejected") {
        unavailableProjects.push("one saved Project");
        continue;
      }

      const savedSnapshot = payload.slots.find(
        (slot) => slot.projectId === result.value.projectId,
      )?.snapshot ?? null;
      const restoredSnapshot = restoreProjectOptionsSnapshot(savedSnapshot);

      mediaUpdates[result.value.projectId] = restoredSnapshot
        ? attachFreshCustomerSafeMedia(restoredSnapshot, result.value.options)
        : result.value.options;
    }

    setProjectOptionsById((current) => ({ ...current, ...mediaUpdates }));

    if (unavailableProjects.length > 0) {
      setReopenWarning("Some current Project references could not be refreshed. Saved comparison details were preserved.");
    }
  }

  async function openSavedProjectComparison(savedWorkId: string) {
    setReopenWarning("");

    try {
      const response = await fetch(`/api/saved-work/${savedWorkId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "This saved work could not be opened.");
      }

      if (data.savedWork.workType !== "project_comparison") {
        throw new Error("This saved Project Comparison version cannot be opened.");
      }

      const validated = validateProjectComparisonSavedWorkPayload(data.savedWork.payload);

      if (!validated.valid) {
        throw new Error(validated.error);
      }

      hydrateSavedProjectComparisonPayload(validated.payload);
      setCurrentSavedWorkId(data.savedWork.id);
      setCurrentSavedWorkTitle(data.savedWork.title);
      setSaveStatus("saved");
      setSaveMessage("Saved Work opened");

      await reconnectSavedProjectComparisonReferences(validated.payload);
    } catch (error) {
      setReopenWarning(
        error instanceof Error ? error.message : "This saved work could not be opened.",
      );
      setCurrentSavedWorkId(null);
      setCurrentSavedWorkTitle("");
    }
  }

  useEffect(() => {
    if (savedWorkHydratedRef.current) return;

    const savedWorkId = new URL(window.location.href).searchParams.get("savedWork");

    if (!savedWorkId) {
      savedWorkHydratedRef.current = true;
      return;
    }

    savedWorkHydratedRef.current = true;
    handoffHydratedRef.current = true;
    void openSavedProjectComparison(savedWorkId);
    // Run only once so normal editing after reopen is never rehydrated over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (handoffHydratedRef.current || isLoadingProjects) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("savedWork")) {
      handoffHydratedRef.current = true;
      return;
    }
    const hasFinderHandoffParams = [
      "project1",
      "unit1",
      "project2",
      "unit2",
      "project3",
      "unit3",
      "loanMargin",
      "interestRate",
      "loanTenure",
    ].some((key) => searchParams.has(key));

    if (!hasFinderHandoffParams) {
      handoffHydratedRef.current = true;
      return;
    }

    handoffHydratedRef.current = true;

    const incomingPairs = parseFinderHandoffPairs(searchParams);
    const accessibleProjectIds = new Set(projects.map((project) => project.id));
    const pairsToHydrate = incomingPairs
      .filter((pair) => accessibleProjectIds.has(pair.projectId))
      .slice(0, 3);

    setLoanMarginPercent((currentValue) =>
      getValidHandoffNumber({
        value: searchParams.get("loanMargin"),
        currentValue,
        isValid: (value) => value > 0 && value <= 100,
      }),
    );
    setAnnualInterestRatePercent((currentValue) =>
      getValidHandoffNumber({
        value: searchParams.get("interestRate"),
        currentValue,
        isValid: (value) => value >= 0,
      }),
    );
    setLoanTenureYears((currentValue) =>
      getValidHandoffNumber({
        value: searchParams.get("loanTenure"),
        currentValue,
        isValid: (value) => value > 0,
      }),
    );

    function cleanFinderHandoffUrl() {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.hash}`,
      );
    }

    if (pairsToHydrate.length === 0) {
      cleanFinderHandoffUrl();
      return;
    }

    let isMounted = true;

    async function hydrateFinderSelections() {
      setSlots(() => {
        const loadingSlots = pairsToHydrate.map((pair, index) => ({
          ...createBlankSlot(index),
          projectId: pair.projectId,
          isLoadingOptions: true,
        }));

        while (loadingSlots.length < 2) {
          loadingSlots.push(createBlankSlot(loadingSlots.length));
        }

        return loadingSlots;
      });

      const loadedOptions = await Promise.all(
        pairsToHydrate.map(async (pair) => {
          const cachedOptions = projectOptionsById[pair.projectId];

          if (cachedOptions) {
            return {
              pair,
              options: cachedOptions,
              error: "",
            };
          }

          try {
            return {
              pair,
              options: await fetchProjectOptions(pair.projectId),
              error: "",
            };
          } catch {
            return {
              pair,
              options: null,
              error: "Unable to load this Project. Please select it again.",
            };
          }
        }),
      );

      if (!isMounted) return;

      const nextProjectOptionsById: Record<string, ProjectOptions> = {};
      const completeSlots: ComparisonSlot[] = [];
      const incompleteSlots: ComparisonSlot[] = [];

      loadedOptions.forEach((loadedItem, index) => {
        if (!loadedItem.options) {
          incompleteSlots.push({
            ...createBlankSlot(index),
            projectId: loadedItem.pair.projectId,
            error: loadedItem.error,
          });
          return;
        }

        nextProjectOptionsById[loadedItem.pair.projectId] = loadedItem.options;

        const unitType = loadedItem.options.unit_types.find(
          (item) => item.id === loadedItem.pair.unitTypeId,
        );

        if (!unitType) {
          incompleteSlots.push({
            ...createBlankSlot(index),
            projectId: loadedItem.pair.projectId,
            error: "Selected Unit Type is no longer available. Please choose another Unit Type.",
          });
          return;
        }

        const eligibleLayoutPlans = getEligibleLayoutPlans(
          loadedItem.options,
          loadedItem.pair.unitTypeId,
        );

        completeSlots.push({
          ...createBlankSlot(index),
          projectId: loadedItem.pair.projectId,
          unitTypeId: loadedItem.pair.unitTypeId,
          layoutPlanId: eligibleLayoutPlans.length === 1 ? eligibleLayoutPlans[0].id : "",
        });
      });

      const hydratedSlots =
        completeSlots.length >= 2 ? completeSlots : [...completeSlots, ...incompleteSlots];
      const nextSlots = hydratedSlots.slice(0, 3).map((slot, index) => ({
        ...slot,
        id: `slot-${index + 1}`,
        packageId: "",
        spaPrice: "",
        comparisonPrice: "",
        isLoadingOptions: false,
      }));

      while (nextSlots.length < 2) {
        nextSlots.push(createBlankSlot(nextSlots.length));
      }

      setProjectOptionsById((current) => ({
        ...current,
        ...nextProjectOptionsById,
      }));
      setSlots(nextSlots);
      setHasCompared(false);
      setComparisonConfigChanged(false);
      setAgentInsights("");
      cleanFinderHandoffUrl();
    }

    void hydrateFinderSelections();

    return () => {
      isMounted = false;
    };
  }, [
    isLoadingProjects,
    projectOptionsById,
    projects,
  ]);

  const assumptions: ComparisonAssumptions = useMemo(
    () => ({
      loanMarginPercent: parseNumber(loanMarginPercent),
      annualInterestRatePercent: parseNumber(annualInterestRatePercent),
      loanTenureYears: parseNumber(loanTenureYears),
    }),
    [annualInterestRatePercent, loanMarginPercent, loanTenureYears],
  );

  const assumptionsValid =
    Number.isFinite(assumptions.loanMarginPercent) &&
    assumptions.loanMarginPercent > 0 &&
    assumptions.loanMarginPercent <= 100 &&
    Number.isFinite(assumptions.annualInterestRatePercent) &&
    assumptions.annualInterestRatePercent >= 0 &&
    Number.isFinite(assumptions.loanTenureYears) &&
    assumptions.loanTenureYears > 0;
  const selectedSlots = useMemo(() => slots.filter((slot) => slot.projectId), [slots]);
  const comparisonPricesValid = selectedSlots.every((slot) => {
    const parsedSpaPrice = parseComparisonPrice(slot.spaPrice);
    const parsedComparisonPrice = parseComparisonPrice(slot.comparisonPrice);

    return (
      (parsedSpaPrice === null || Number.isFinite(parsedSpaPrice)) &&
      (parsedComparisonPrice === null || Number.isFinite(parsedComparisonPrice))
    );
  });
  const canCompare =
    selectedSlots.length >= 2 &&
    selectedSlots.every((slot) => slot.unitTypeId && !slot.isLoadingOptions && !slot.error) &&
    assumptionsValid &&
    comparisonPricesValid;
  const canSaveComparisonWork =
    selectedSlots.length >= 2 &&
    selectedSlots.every((slot) => slot.projectId && slot.unitTypeId && !slot.isLoadingOptions);
  const comparedOptions = useMemo<ComparedOption[]>(() => {
    if (!hasCompared || !canCompare) return [];

    return selectedSlots
      .map((slot) => {
        const options = projectOptionsById[slot.projectId];
        const unitType = options?.unit_types.find((item) => item.id === slot.unitTypeId);

        if (!options || !unitType) return null;

        const effectiveSpaPrice = getEffectiveSpaPrice(slot, unitType);
        const effectiveComparisonPrice = getEffectiveComparisonPrice(slot, unitType);
        const commercialPackage =
          options.commercial_packages.find((item) => item.id === slot.packageId) ?? null;
        const layoutPlan = getSelectedLayoutPlan(options, slot.unitTypeId, slot.layoutPlanId);
        const unitMetrics = calculateProjectComparisonMetrics(
          {
            price_from: unitType.price_from,
            price_to: unitType.price_to,
            size_sqft: unitType.size_sqft,
            maintenance_fee_per_sqft: options.project.maintenance_fee_per_sqft,
            estimated_rental_from: unitType.estimated_rental_from,
            estimated_rental_to: unitType.estimated_rental_to,
          },
          assumptions,
        );

        const finalNetScenarioMetrics = calculateProjectComparisonMetrics(
          {
            price_from: effectiveComparisonPrice.value,
            price_to: effectiveComparisonPrice.value,
            size_sqft: unitType.size_sqft,
            maintenance_fee_per_sqft: options.project.maintenance_fee_per_sqft,
            estimated_rental_from: unitType.estimated_rental_from,
            estimated_rental_to: unitType.estimated_rental_to,
          },
          assumptions,
        );
        const spaScenarioMetrics = calculateProjectComparisonMetrics(
          {
            price_from: effectiveSpaPrice.value,
            price_to: effectiveSpaPrice.value,
            size_sqft: unitType.size_sqft,
            maintenance_fee_per_sqft: options.project.maintenance_fee_per_sqft,
            estimated_rental_from: unitType.estimated_rental_from,
            estimated_rental_to: unitType.estimated_rental_to,
          },
          assumptions,
        );
        const loanAmount = getSingleRangeValue(spaScenarioMetrics.loanAmount);
        const estimatedMonthlyInstalment = getSingleRangeValue(
          spaScenarioMetrics.estimatedMonthlyInstalment,
        );
        const monthlyMaintenance = getSingleRangeValue(finalNetScenarioMetrics.monthlyMaintenance);
        const ownershipCost = calculateOwnershipCost({
          commercialPackage,
          effectiveSpaPrice: effectiveSpaPrice.value,
          effectiveFinalNetPrice: effectiveComparisonPrice.value,
          loanAmount,
        });

        return {
          slot,
          project: options.project,
          unitType,
          layoutPlan,
          commercialPackage,
          connectivity: options.connectivity ?? [],
          unitMetrics,
          effectiveSpaPrice: effectiveSpaPrice.value,
          spaPriceSource: effectiveSpaPrice.source,
          effectiveComparisonPrice: effectiveComparisonPrice.value,
          comparisonPriceSource: effectiveComparisonPrice.source,
          metrics: {
            ...finalNetScenarioMetrics,
            loanAmount: spaScenarioMetrics.loanAmount,
            estimatedMonthlyInstalment: spaScenarioMetrics.estimatedMonthlyInstalment,
          },
          ownershipCost,
          investment: calculateInvestmentComparison({
            unitType,
            effectiveFinalNetPrice: effectiveComparisonPrice.value,
            estimatedMonthlyInstalment,
            monthlyMaintenance,
            estimatedTotalCashRequired: ownershipCost.estimatedTotalCashRequired,
          }),
        };
      })
      .filter((item): item is ComparedOption => Boolean(item));
  }, [assumptions, canCompare, hasCompared, projectOptionsById, selectedSlots]);
  const objectiveInsights = useMemo(
    () =>
      generateProjectComparisonInsights(
        comparedOptions.map((option) => {
          const completion =
            option.project.estimated_vp_year && option.project.estimated_vp_quarter
              ? {
                  sortValue:
                    option.project.estimated_vp_year * 4 + option.project.estimated_vp_quarter,
                  label: formatEstimatedCompletion(option.project),
                }
              : null;

          return {
            projectId: option.project.id,
            projectName: option.project.name,
            finalNetPrice: numberToComparable(
              option.effectiveComparisonPrice,
              formatScenarioPrice(option.effectiveComparisonPrice, option.comparisonPriceSource),
            ),
            psf: comparisonRangeToComparable(option.unitMetrics.psf, " psf"),
            monthlyInstalment: comparisonRangeToComparable(
              option.metrics.estimatedMonthlyInstalment,
              " / month",
            ),
            estimatedCashRequired: numberToComparable(
              option.ownershipCost.estimatedTotalCashRequired,
              formatOptionalMoney(option.ownershipCost.estimatedTotalCashRequired),
            ),
            estimatedRental: investmentRangeToComparable(getRentalRange(option.unitType), (range) =>
              range.low === range.high
                ? formatCurrency(range.low)
                : `${formatCurrency(range.low)} – ${formatCurrency(range.high)}`,
            ),
            netRentalYield: investmentRangeToComparable(
              option.investment.netRentalYieldPercent,
              formatPercentValueRange,
            ),
            monthlyCashFlow: investmentRangeToComparable(
              option.investment.monthlyCashFlow,
              (range) => formatSignedMoneyRangeText(range, " / month"),
            ),
            cashOnCashReturn: investmentRangeToComparable(
              option.investment.cashOnCashReturnPercent,
              formatPercentValueRange,
            ),
            monthlyMaintenance: numberToComparable(
              option.investment.monthlyMaintenance,
              formatOptionalMonthlyMoney(option.investment.monthlyMaintenance),
            ),
            unitSizeSqft: option.unitType.size_sqft,
            unitSizeLabel: formatSize(option.unitType.size_sqft),
            tenure: option.project.tenure,
            isDualKey: option.unitType.is_dual_key,
            estimatedCompletion: completion,
            connectivity: option.connectivity.map((point) => ({
              category: point.category,
              name: point.name,
              distanceMeters: point.distance_meters,
              connectionMode: point.connection_mode,
              label: formatConnectivityMeta(point),
            })),
          };
        }),
      ),
    [comparedOptions],
  );

  async function loadProjectOptions(slotId: string, projectId: string) {
    if (projectOptionsById[projectId]) return;

    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, isLoadingOptions: true, error: "" } : slot,
      ),
    );

    try {
      const data = await fetchProjectOptions(projectId);
      setProjectOptionsById((current) => ({ ...current, [projectId]: data }));
    } catch (error) {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                error: error instanceof Error ? error.message : "Unable to load Project options",
              }
            : slot,
        ),
      );
    } finally {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === slotId ? { ...slot, isLoadingOptions: false } : slot,
        ),
      );
    }
  }

  function updateSlot(slotId: string, updates: Partial<ComparisonSlot>) {
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot)),
    );
    setComparisonConfigChanged(true);
    setHasCompared(false);
  }

  function handleProjectChange(slotId: string, projectId: string) {
    updateSlot(slotId, {
      projectId,
      unitTypeId: "",
      layoutPlanId: "",
      packageId: "",
      spaPrice: "",
      comparisonPrice: "",
      error: "",
    });

    if (projectId) {
      void loadProjectOptions(slotId, projectId);
    }
  }

  function handleUnitTypeChange(slotId: string, unitTypeId: string) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;

        const projectOptions = projectOptionsById[slot.projectId];
        const eligibleLayoutPlans = getEligibleLayoutPlans(projectOptions, unitTypeId);

        return {
          ...slot,
          unitTypeId,
          layoutPlanId: eligibleLayoutPlans.length === 1 ? eligibleLayoutPlans[0].id : "",
          packageId: "",
          spaPrice: "",
          comparisonPrice: "",
        };
      }),
    );
    setComparisonConfigChanged(true);
    setHasCompared(false);
  }

  function addSlot() {
    if (slots.length >= 3) return;

    setSlots((current) => [
      ...current,
      createBlankSlot(current.length),
    ]);
    setComparisonConfigChanged(true);
    setHasCompared(false);
  }

  function removeSlot(slotId: string) {
    if (slots.length <= 2) return;

    setSlots((current) => current.filter((slot) => slot.id !== slotId));
    setComparisonConfigChanged(true);
    setHasCompared(false);
  }

  function getApplicablePackages(projectOptions: ProjectOptions | undefined, unitTypeId: string) {
    if (!projectOptions || !unitTypeId) return [];

    return projectOptions.commercial_packages.filter((item) =>
      item.applicable_unit_type_ids.includes(unitTypeId),
    );
  }

  function handleCompare() {
    if (!canCompare) return;

    if (comparisonConfigChanged) {
      setAgentInsights("");
    }

    setComparisonConfigChanged(false);
    setHasCompared(true);
  }

  function openExportModal() {
    if (!hasCompared || comparedOptions.length === 0) return;

    setSelectedExportSections(allExportSectionIds);
    setIsExportModalOpen(true);
  }

  function toggleExportSection(sectionId: ExportSectionId) {
    setSelectedExportSections((current) =>
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId],
    );
  }

  function toggleSelectAllExportSections() {
    setSelectedExportSections((current) =>
      current.length === allExportSectionIds.length ? [] : allExportSectionIds,
    );
  }

  function handleGenerateComparisonPdf() {
    if (selectedExportSections.length === 0 || comparedOptions.length === 0) return;

    const proposalWindow = window.open("", "_blank");

    if (!proposalWindow) {
      window.alert("Please allow pop-ups to preview and export the PDF.");
      return;
    }

    proposalWindow.document.open();
    proposalWindow.document.write(
      buildComparisonProposalHtml({
        comparedOptions,
        assumptions,
        activeConnectivityGroups,
        selectedSectionIds: selectedExportSections,
        agentInsights,
        objectiveInsights,
        branding: {
          agentName: displayName,
          agentPhone: phone,
        },
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();
    setIsExportModalOpen(false);

    printComparisonWhenImagesAreReady(proposalWindow);
  }

  const activeConnectivityGroups = hasCompared
    ? connectivityGroups.filter((group) =>
        comparedOptions.some(
          (option) => getConnectivityItemsForGroup(option, group.categories).length > 0,
        ),
      )
    : [];

  return (
    <>
      <main className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            eyebrow="Comparison Desk"
            title="Project Comparison"
            description="Compare 2 to 3 projects using trusted project facts, selected Unit Types, Sales Packages, and shared financing assumptions."
            meta={
              <div className="flex flex-col gap-2 text-xs text-[var(--falcon-muted-text)] sm:flex-row sm:flex-wrap sm:items-center">
                <span className="font-medium text-zinc-700">Tools - Project Comparison</span>
                {currentSavedWorkTitle ? (
                  <span className="max-w-full truncate rounded-full border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 py-1 font-medium text-zinc-700">
                    Saved Work: {currentSavedWorkTitle}
                  </span>
                ) : null}
                {saveMessage ? (
                  <span
                    className={`rounded-full px-3 py-1 font-semibold ${
                      saveStatus === "error"
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : "border border-emerald-200 bg-emerald-50 text-[#087F6B]"
                    }`}
                  >
                    {saveMessage}
                  </span>
                ) : null}
              </div>
            }
            actions={
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saveStatus === "saving" || !canSaveComparisonWork}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save"}
                </Button>
                {currentSavedWorkId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openSaveModal("save-as")}
                    disabled={saveStatus === "saving"}
                  >
                    Save As
                  </Button>
                ) : null}
                {hasCompared && comparedOptions.length > 0 ? (
                  <Button type="button" variant="secondary" onClick={openExportModal}>
                    Export PDF
                  </Button>
                ) : null}
              </div>
            }
          />

        {reopenWarning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {reopenWarning}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                Setup
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--falcon-charcoal)]">
                Build the comparison
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--falcon-muted-text)]">
                Select equal project columns, then run the comparison when each side has a Project
                and Unit Type.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              className="w-full sm:w-auto"
            >
              Compare Projects
            </Button>
          </div>
        </section>

        {projectListError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {projectListError}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                Shared Assumptions
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                Financing basis
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                Applied equally to every selected project.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Loan Margin %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={loanMarginPercent}
                onChange={(event) => {
                  setLoanMarginPercent(event.target.value);
                  setComparisonConfigChanged(true);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Interest Rate %</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={annualInterestRatePercent}
                onChange={(event) => {
                  setAnnualInterestRatePercent(event.target.value);
                  setComparisonConfigChanged(true);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Loan Tenure Years</span>
              <input
                type="number"
                min="1"
                step="1"
                value={loanTenureYears}
                onChange={(event) => {
                  setLoanTenureYears(event.target.value);
                  setComparisonConfigChanged(true);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15"
              />
            </label>
          </div>

          {!assumptionsValid ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Loan margin must be more than 0 and up to 100. Interest cannot be negative.
              Tenure must be more than 0.
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot, index) => {
            const projectOptions = projectOptionsById[slot.projectId];
            const selectedUnitType = projectOptions?.unit_types.find(
              (unitType) => unitType.id === slot.unitTypeId,
            );
            const eligibleLayoutPlans = getEligibleLayoutPlans(projectOptions, slot.unitTypeId);
            const applicablePackages = getApplicablePackages(projectOptions, slot.unitTypeId);
            const spaPriceWarning = getSpaPriceWarning(slot, selectedUnitType);
            const finalNetPriceWarning = getFinalNetPriceWarning(slot, selectedUnitType);
            const comparisonLetter = comparisonLetters[index] ?? `${index + 1}`;

            return (
              <article
                key={slot.id}
                className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--falcon-charcoal)] text-sm font-semibold text-white">
                      {comparisonLetter}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">
                        Project {comparisonLetter}
                      </p>
                      <p className="mt-1 text-sm text-[var(--falcon-muted-text)]">
                        Project, Unit Type, layout and package.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge variant={slot.projectId && slot.unitTypeId ? "accent" : "neutral"}>
                      {slot.projectId && slot.unitTypeId ? "Ready" : "Setup"}
                    </StatusBadge>
                    {slots.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        className="rounded-full px-3 py-1 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">Project</span>
                    <SearchCombobox
                      value={slot.projectId}
                      disabled={isLoadingProjects}
                      options={[
                        {
                          id: "",
                          label: isLoadingProjects ? "Loading Projects..." : "Select Project",
                        },
                        ...projects.map((project) => ({
                          id: project.id,
                          label: project.name,
                          description: [project.developer, project.location].filter(Boolean).join(" · "),
                          searchText: [project.developer, project.location].filter(Boolean).join(" "),
                        })),
                      ]}
                      disabledIds={new Set(
                        slots
                          .filter((otherSlot) => otherSlot.id !== slot.id)
                          .map((otherSlot) => otherSlot.projectId)
                          .filter(Boolean),
                      )}
                      placeholder="Search project..."
                      emptyLabel="No projects found"
                      onChange={(projectId) => handleProjectChange(slot.id, projectId)}
                    />
                  </label>

                  {slot.error ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {slot.error}
                    </p>
                  ) : null}

                  {projectOptions ? (
                    <div className="overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]">
                      {projectOptions.project.cover_media?.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={projectOptions.project.cover_media.signed_url}
                          alt={`${projectOptions.project.name} cover`}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-[var(--falcon-muted-text)]">
                          No Project Cover added yet.
                        </div>
                      )}
                    </div>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">Unit Type</span>
                    <select
                      value={slot.unitTypeId}
                      disabled={!slot.projectId || slot.isLoadingOptions || !projectOptions}
                      onChange={(event) => handleUnitTypeChange(slot.id, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:bg-zinc-50"
                    >
                      <option value="">
                        {slot.isLoadingOptions
                          ? "Loading Unit Types..."
                          : !slot.projectId
                            ? "Select Project first"
                            : "Select Unit Type"}
                      </option>
                      {projectOptions?.unit_types.map((unitType) => (
                        <option key={unitType.id} value={unitType.id}>
                          {getUnitTypeLabel(unitType)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.projectId && projectOptions && projectOptions.unit_types.length === 0 ? (
                    <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm text-[var(--falcon-muted-text)]">
                      No Unit Types available for this Project.
                    </p>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">Layout Plan</span>
                    <select
                      value={slot.layoutPlanId}
                      disabled={!slot.unitTypeId || eligibleLayoutPlans.length <= 1}
                      onChange={(event) =>
                        updateSlot(slot.id, { layoutPlanId: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:bg-zinc-50"
                    >
                      {eligibleLayoutPlans.length === 0 ? (
                        <option value="">No Layout Plan available</option>
                      ) : eligibleLayoutPlans.length === 1 ? (
                        <option value={eligibleLayoutPlans[0].id}>
                          {getLayoutPlanLabel(eligibleLayoutPlans[0])}
                        </option>
                      ) : (
                        <>
                          <option value="">Select Layout Plan</option>
                          {eligibleLayoutPlans.map((layoutPlan) => (
                            <option key={layoutPlan.id} value={layoutPlan.id}>
                              {getLayoutPlanLabel(layoutPlan)}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">SPA Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.spaPrice}
                      disabled={!slot.unitTypeId}
                      onChange={(event) =>
                        updateSlot(slot.id, { spaPrice: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:bg-zinc-50"
                      placeholder={
                        selectedUnitType?.spa_price_from
                          ? `${selectedUnitType.spa_price_from}`
                          : "Optional SPA price"
                      }
                    />
                    {selectedUnitType ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        Unit Type SPA range: {formatUnitTypeSpaPriceRange(selectedUnitType)}
                      </span>
                    ) : null}
                    {spaPriceWarning ? (
                      <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {spaPriceWarning}
                      </span>
                    ) : null}
                  </label>

                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">Final Net Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.comparisonPrice}
                      disabled={!slot.unitTypeId}
                      onChange={(event) =>
                        updateSlot(slot.id, { comparisonPrice: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:bg-zinc-50"
                      placeholder={
                        selectedUnitType?.price_from
                          ? `${selectedUnitType.price_from}`
                          : "Optional final net price"
                      }
                    />
                    {selectedUnitType ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        Unit Type final net range: {formatUnitTypeFinalNetPriceRange(selectedUnitType)}
                      </span>
                    ) : null}
                    {finalNetPriceWarning ? (
                      <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {finalNetPriceWarning}
                      </span>
                    ) : null}
                  </label>

                  <label className="block text-sm">
                    <span className="font-semibold text-zinc-700">Sales Package</span>
                    <select
                      value={slot.packageId}
                      disabled={!slot.unitTypeId}
                      onChange={(event) => updateSlot(slot.id, { packageId: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:bg-zinc-50"
                    >
                      <option value="">No Package</option>
                      {applicablePackages.map((commercialPackage) => (
                        <option key={commercialPackage.id} value={commercialPackage.id}>
                          {commercialPackage.package_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.unitTypeId && applicablePackages.length === 0 ? (
                    <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm text-[var(--falcon-muted-text)]">
                      No applicable Sales Packages. No Package is allowed.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}

          {slots.length < 3 ? (
            <button
              type="button"
              onClick={addSlot}
              className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-[#d8c48e] bg-white/70 p-5 text-sm font-semibold text-[var(--falcon-gold-dark)] shadow-sm transition hover:bg-white hover:shadow"
            >
              + Add Project
            </button>
          ) : null}
        </section>

        {hasCompared && comparedOptions.length > 0 ? (
          <>
            <section className="flex flex-col gap-3 rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  Proposal
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  Customer Proposal Export
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Choose comparison sections and generate a customer-facing PDF.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={openExportModal}>
                Export PDF
              </Button>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--falcon-charcoal)]">
                      Agent Insights & Recommendation
                    </h2>
                    <span className="rounded-full border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--falcon-muted-text)]">
                      Optional
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                    Add your observations or recommendation before exporting the customer proposal.
                  </p>
                </div>
                <p className="text-xs font-medium text-zinc-400">
                  {agentInsights.length} / 1200
                </p>
              </div>
              <textarea
                value={agentInsights}
                maxLength={1200}
                onChange={(event) => setAgentInsights(event.target.value)}
                placeholder="Add your recommendation, key observations, or notes for the customer..."
                className="mt-4 min-h-40 w-full resize-y rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]/35 px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[var(--falcon-gold-dark)] focus:bg-white focus:ring-2 focus:ring-[#b8924a]/15"
              />
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  Deterministic Highlights
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  Objective Insights
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Data-driven highlights from the current comparison.
                </p>
              </div>

              {objectiveInsights.length ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  {insightGroups.map((group) => {
                    const groupInsights = objectiveInsights.filter((insight) =>
                      group.categories.includes(insight.category),
                    );

                    if (!groupInsights.length) return null;

                    return (
                      <div
                        key={group.label}
                        className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]/35 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">
                          {group.label}
                        </p>
                        <div className="mt-3 space-y-3">
                          {groupInsights.map((insight) => (
                            <article
                              key={insight.id}
                              className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {insight.title}
                                  </p>
                                  <p className="mt-1 text-xs font-medium text-zinc-500">
                                    {getInsightProjectNames(insight)}
                                  </p>
                                </div>
                                <span
                                  className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getInsightTypeClass(insight.type)}`}
                                >
                                  {getInsightTypeLabel(insight.type)}
                                </span>
                              </div>
                              <div className="mt-3 space-y-1">
                                {renderInsightEvidence(insight)}
                              </div>
                              {insight.explanation ? (
                                <p className="mt-3 text-xs leading-5 text-[var(--falcon-muted-text)]">
                                  {insight.explanation}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm text-[var(--falcon-muted-text)]">
                  No objective insights available from the current comparison yet.
                </p>
              )}
            </section>

            <ComparisonTable
              title="Quick Comparison"
              description="Factual comparison using SPA Price for financing and Final Net Price for price/yield context. Sales Package discounts are not deducted again."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Project",
                  values: comparedOptions.map((option) => option.project.name),
                },
                {
                  label: "Unit Type",
                  values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
                },
                {
                  label: "Final Net Price",
                  values: comparedOptions.map((option) =>
                    formatScenarioPrice(
                      option.effectiveComparisonPrice,
                      option.comparisonPriceSource,
                    ),
                  ),
                },
                {
                  label: "Size",
                  values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
                },
                {
                  label: "PSF",
                  values: comparedOptions.map((option) =>
                    formatMoneyRange(option.unitMetrics.psf, " psf"),
                  ),
                },
                {
                  label: "SPA Price",
                  values: comparedOptions.map((option) =>
                    formatScenarioPrice(option.effectiveSpaPrice, option.spaPriceSource),
                  ),
                },
                {
                  label: "Est. Monthly Instalment",
                  values: comparedOptions.map((option) =>
                    formatMoneyRange(option.metrics.estimatedMonthlyInstalment, " / month"),
                  ),
                },
                {
                  label: "Est. Rental",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.estimatedRental)),
                },
                {
                  label: "Est. Gross Yield",
                  values: comparedOptions.map((option) =>
                    formatPercentRange(option.metrics.estimatedGrossRentalYieldPercent),
                  ),
                },
                {
                  label: "Tenure",
                  values: comparedOptions.map((option) => formatText(option.project.tenure)),
                },
                {
                  label: "Estimated Completion",
                  values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
                },
                {
                  label: "Sales Package",
                  values: comparedOptions.map((option) =>
                    option.commercialPackage?.package_name ?? "No Package",
                  ),
                },
              ]}
            />

            <ComparisonTable
              title="Ownership Cost"
              description="Estimated financing and upfront purchase costs based on the selected scenario and Sales Package."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "SPA Price",
                  values: comparedOptions.map((option) =>
                    formatScenarioPrice(option.effectiveSpaPrice, option.spaPriceSource),
                  ),
                },
                {
                  label: "Final Net Price",
                  values: comparedOptions.map((option) =>
                    formatScenarioPrice(
                      option.effectiveComparisonPrice,
                      option.comparisonPriceSource,
                    ),
                  ),
                },
                {
                  label: "Loan Margin",
                  values: comparedOptions.map(() => formatPercentValue(assumptions.loanMarginPercent)),
                },
                {
                  label: "Estimated Loan Amount",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.loanAmount)),
                },
                {
                  label: "Cash Downpayment",
                  values: comparedOptions.map((option) =>
                    formatOptionalMoney(option.ownershipCost.cashDownpayment),
                  ),
                },
                {
                  label: "Est. Monthly Instalment",
                  values: comparedOptions.map((option) =>
                    formatMoneyRange(option.metrics.estimatedMonthlyInstalment, " / month"),
                  ),
                },
                ...purchaseCostKeys.map((costKey) => ({
                  label: purchaseCostLabels[costKey],
                  values: comparedOptions.map((option) => {
                    const purchaseCost = option.ownershipCost.purchaseCosts.find(
                      (item) => item.costKey === costKey,
                    );

                    return purchaseCost ? renderPurchaseCostValue(purchaseCost) : "—";
                  }),
                })),
                {
                  label: "Estimated Total Cash Required",
                  values: comparedOptions.map((option) => (
                    <span
                      key={`${option.slot.id}-estimated-total-cash-required`}
                      className="font-semibold text-[#8B3A3A]"
                    >
                      {formatOptionalMoney(option.ownershipCost.estimatedTotalCashRequired)}
                    </span>
                  )),
                },
                {
                  label: "Total Savings",
                  values: comparedOptions.map((option) => (
                    <span
                      key={`${option.slot.id}-total-savings`}
                      className="font-semibold text-[#087F6B]"
                    >
                      {formatOptionalMoney(option.ownershipCost.totalSavings)}
                    </span>
                  )),
                },
              ]}
            />

            <ComparisonTable
              title="Investment Comparison"
              description="Estimated rental performance and cash returns based on the selected unit and financing scenario."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Estimated Monthly Rental",
                  values: comparedOptions.map((option) => formatRentalDisplay(option.unitType)),
                },
                {
                  label: "Monthly Maintenance",
                  values: comparedOptions.map((option) =>
                    formatOptionalMonthlyMoney(option.investment.monthlyMaintenance),
                  ),
                },
                {
                  label: "Estimated Monthly Cash Flow",
                  values: comparedOptions.map((option) => (
                    <span key={`${option.slot.id}-monthly-cash-flow`}>
                      {renderSignedMoneyRange(option.investment.monthlyCashFlow, " / month")}
                    </span>
                  )),
                },
                {
                  label: "Estimated Annual Cash Flow",
                  values: comparedOptions.map((option) => (
                    <span key={`${option.slot.id}-annual-cash-flow`}>
                      {renderSignedMoneyRange(option.investment.annualCashFlow)}
                    </span>
                  )),
                },
                {
                  label: "Net Rental Yield",
                  values: comparedOptions.map((option) =>
                    formatPercentValueRange(option.investment.netRentalYieldPercent),
                  ),
                },
                {
                  label: "Cash-on-Cash Return (CoC)",
                  values: comparedOptions.map((option) =>
                    formatPercentValueRange(option.investment.cashOnCashReturnPercent),
                  ),
                },
              ]}
            />

            <ComparisonTable
              title="Project Overview"
              description="High-level project facts from the customer-safe comparison data."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Developer",
                  values: comparedOptions.map((option) => formatText(option.project.developer)),
                },
                {
                  label: "Location",
                  values: comparedOptions.map((option) => formatText(option.project.location)),
                },
                {
                  label: "Tenure",
                  values: comparedOptions.map((option) => formatText(option.project.tenure)),
                },
                {
                  label: "Property Type",
                  values: comparedOptions.map((option) => formatText(option.project.property_type)),
                },
                {
                  label: "Title Type",
                  values: comparedOptions.map((option) => formatText(option.project.title_type)),
                },
                {
                  label: "Total Units",
                  values: comparedOptions.map((option) => formatNumber(option.project.total_units)),
                },
                {
                  label: "Estimated Completion",
                  values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
                },
              ]}
            />

            <ComparisonTable
              title="Unit Comparison"
              description="Selected Unit Type facts and calculated metrics using the shared assumptions above."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Unit Type",
                  values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
                },
                {
                  label: "SPA Price Range",
                  values: comparedOptions.map((option) =>
                    formatStoredPriceRange(option.unitType.spa_price_from, option.unitType.spa_price_to),
                  ),
                },
                {
                  label: "Final Net Price Range",
                  values: comparedOptions.map((option) => formatMoneyRange(option.unitMetrics.finalNetPrice)),
                },
                {
                  label: "Size",
                  values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
                },
                {
                  label: "Bedrooms",
                  values: comparedOptions.map((option) => formatNumber(option.unitType.bedrooms)),
                },
                {
                  label: "Bathrooms",
                  values: comparedOptions.map((option) => formatNumber(option.unitType.bathrooms)),
                },
                {
                  label: "Car Parks",
                  values: comparedOptions.map((option) => formatCarParks(option.unitType)),
                },
                {
                  label: "PSF",
                  values: comparedOptions.map((option) => formatMoneyRange(option.unitMetrics.psf, " psf")),
                },
                {
                  label: "Balcony",
                  values: comparedOptions.map((option) => formatBoolean(option.unitType.has_balcony)),
                },
                {
                  label: "Dual Key",
                  values: comparedOptions.map((option) => formatBoolean(option.unitType.is_dual_key)),
                },
                {
                  label: "Furnishing",
                  values: comparedOptions.map((option) =>
                    getFurnishingSummary(option.unitType, option.commercialPackage),
                  ),
                },
              ]}
            />

            {activeConnectivityGroups.length ? (
              <ComparisonTable
                title="Connectivity & Convenience"
                description="Customer-facing connectivity facts grouped by category."
                comparedOptions={comparedOptions}
                rows={activeConnectivityGroups.map((group) => ({
                  label: group.label,
                  values: comparedOptions.map((option) =>
                    renderConnectivityItems(
                      getConnectivityItemsForGroup(option, group.categories),
                    ),
                  ),
                }))}
              />
            ) : (
              <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                    Location Context
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                    Connectivity & Convenience
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                    Customer-facing connectivity facts grouped by category.
                  </p>
                </div>
                <p className="mt-5 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm text-[var(--falcon-muted-text)]">
                  No connectivity information added yet.
                </p>
              </section>
            )}

            {isExportModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
                <div className="w-full max-w-lg rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                      Customer Proposal
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                      Export Comparison PDF
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                      Choose which sections to include in the customer proposal.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm font-semibold text-zinc-900">
                      <input
                        type="checkbox"
                        checked={selectedExportSections.length === allExportSectionIds.length}
                        onChange={toggleSelectAllExportSections}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      Select All
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {exportSectionOptions.map((section) => (
                        <label
                          key={section.id}
                            className="flex items-center gap-3 rounded-2xl border border-[var(--falcon-soft-border)] px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-[var(--falcon-warm-background)]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExportSections.includes(section.id)}
                            onChange={() => toggleExportSection(section.id)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                          {section.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <Button
                      type="button"
                      onClick={() => setIsExportModalOpen(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleGenerateComparisonPdf}
                      disabled={selectedExportSections.length === 0}
                    >
                      Generate PDF
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        </div>
      </main>

      {saveModalMode ? (
        <SaveWorkModal
          mode={saveModalMode}
          title={saveTitle}
          error={saveStatus === "error" ? saveMessage : ""}
          isSaving={saveStatus === "saving"}
          onTitleChange={(title) => {
            setSaveTitle(title);
            setSaveMessage("");
            setSaveStatus("idle");
          }}
          onCancel={() => {
            if (saveStatus === "saving") return;
            setSaveModalMode(null);
            setSaveMessage("");
            setSaveStatus("idle");
          }}
          onConfirm={() => void saveProjectComparisonWork(saveTitle, null)}
        />
      ) : null}
    </>
  );
}

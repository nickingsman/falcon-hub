"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  calculateProjectComparisonMetrics,
  type ComparisonAssumptions,
  type ComparisonRange,
  type ProjectComparisonMetrics,
} from "@/lib/project-comparison-engine";
import {
  purchaseCostKeys,
  purchaseCostTreatments,
  type PurchaseCostKey,
  type PurchaseCostTreatment,
} from "@/lib/project-comparison-options";
import { getPurchaseCostEstimates } from "@/lib/purchase-costs";

type ProjectOption = {
  id: string;
  name: string;
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
  | "ownership"
  | "investment"
  | "overview"
  | "unit"
  | "connectivity";

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
  { id: "ownership", label: "Ownership Cost" },
  { id: "investment", label: "Investment Comparison" },
  { id: "overview", label: "Project Overview" },
  { id: "unit", label: "Unit Comparison" },
  { id: "connectivity", label: "Connectivity" },
];

const allExportSectionIds = exportSectionOptions.map((section) => section.id);

const initialSlots: ComparisonSlot[] = [
  {
    id: "slot-1",
    projectId: "",
    unitTypeId: "",
    layoutPlanId: "",
    packageId: "",
    spaPrice: "",
    comparisonPrice: "",
    isLoadingOptions: false,
    error: "",
  },
  {
    id: "slot-2",
    projectId: "",
    unitTypeId: "",
    layoutPlanId: "",
    packageId: "",
    spaPrice: "",
    comparisonPrice: "",
    isLoadingOptions: false,
    error: "",
  },
];

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

function getSelectedProjectIds(slots: ComparisonSlot[]) {
  return slots.map((slot) => slot.projectId).filter(Boolean);
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
        <span className="block text-xs font-semibold uppercase tracking-wide text-emerald-700">
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
    <div className="space-y-4">
      {items.map((point) => (
        <div key={point.id}>
          <p className="font-semibold text-zinc-900">{point.name}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {formatConnectivityMeta(point)}
          </p>
          {point.customer_description ? (
            <p className="mt-2 text-xs font-normal leading-5 text-zinc-600">
              {point.customer_description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
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

function renderPdfSectionGroup(
  sections: PdfTableSection[],
  comparedOptions: ComparedOption[],
  startsNewPage: boolean,
) {
  if (sections.length === 0) return "";

  return `
    <div class="pdf-section-group${startsNewPage ? " pdf-section-group-new-page" : ""}">
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
}: {
  comparedOptions: ComparedOption[];
  assumptions: ComparisonAssumptions;
  activeConnectivityGroups: typeof connectivityGroups;
  selectedSectionIds: ExportSectionId[];
  agentInsights: string;
}) {
  const sections = buildComparisonPdfSections({
    comparedOptions,
    assumptions,
    activeConnectivityGroups,
  }).filter((section) => selectedSectionIds.includes(section.id));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const sectionGroups = [
    ["quick", "investment"],
    ["ownership"],
    ["overview", "unit"],
    ["connectivity"],
  ].map((group) =>
    group
      .map((sectionId) => sectionById.get(sectionId as ExportSectionId))
      .filter((section): section is PdfTableSection => Boolean(section)),
  );
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
            margin: 10mm;
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
            margin-top: 14px;
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
            justify-content: center;
            min-height: ${comparedOptions.length > 2 ? "88px" : "118px"};
            overflow: hidden;
          }

          .layout-image {
            display: block;
            max-height: ${comparedOptions.length > 2 ? "155px" : "205px"};
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
            width: 18%;
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
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .footer {
            border-top: 1px solid #e4e4e7;
            color: #71717a;
            display: flex;
            justify-content: space-between;
            margin-top: 14px;
            padding-top: 8px;
            font-size: 9px;
          }

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
              renderPdfSectionGroup(group, comparedOptions, index > 0),
            )
            .join("")}

          <footer class="footer">
            <span>Generated with Falcon Hub</span>
            <span>Figures are estimates and subject to final developer, bank, and documentation confirmation.</span>
          </footer>
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
    <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 border-b border-zinc-200 bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Detail
              </th>
              {comparedOptions.map((option) => (
                <th
                  key={`${title}-${option.slot.id}`}
                  className="border-b border-zinc-200 px-4 py-3"
                >
                  <div className="mb-3 aspect-video w-full max-w-[220px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-900">
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
                <th className="sticky left-0 border-b border-zinc-200 bg-white py-4 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className="border-b border-zinc-200 px-4 py-4 font-medium text-zinc-900"
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

export default function ProjectComparisonPage() {
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

  async function loadProjectOptions(slotId: string, projectId: string) {
    if (projectOptionsById[projectId]) return;

    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, isLoadingOptions: true, error: "" } : slot,
      ),
    );

    try {
      const response = await fetch(`/api/tools/project-comparison/projects/${projectId}/options`);

      if (!response.ok) {
        throw new Error("Unable to load Project options");
      }

      const data = (await response.json()) as ProjectOptions;
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
      {
        id: `slot-${current.length + 1}`,
        projectId: "",
        unitTypeId: "",
        layoutPlanId: "",
        packageId: "",
        spaPrice: "",
        comparisonPrice: "",
        isLoadingOptions: false,
        error: "",
      },
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

  function getAvailableProjects(slotId: string) {
    const selectedProjectIds = getSelectedProjectIds(slots);

    return projects.filter(
      (project) =>
        !selectedProjectIds.includes(project.id) ||
        slots.find((slot) => slot.id === slotId)?.projectId === project.id,
    );
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
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Tools - Project Comparison</p>
          <p className="text-base font-semibold text-zinc-900">Compare trusted project facts</p>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Express Comparison
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Project Comparison
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
                Compare 2 to 3 projects using final net selling price, Unit Type facts,
                rental estimates, and shared financing assumptions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Compare Projects
            </button>
          </div>
        </section>

        {projectListError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {projectListError}
          </div>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Shared Loan Assumptions</p>
              <p className="text-sm text-zinc-500">Applied equally to every selected project.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Loan Margin %</span>
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
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Interest Rate %</span>
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
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Loan Tenure Years</span>
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
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
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

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          {slots.map((slot, index) => {
            const projectOptions = projectOptionsById[slot.projectId];
            const selectedUnitType = projectOptions?.unit_types.find(
              (unitType) => unitType.id === slot.unitTypeId,
            );
            const eligibleLayoutPlans = getEligibleLayoutPlans(projectOptions, slot.unitTypeId);
            const applicablePackages = getApplicablePackages(projectOptions, slot.unitTypeId);
            const spaPriceWarning = getSpaPriceWarning(slot, selectedUnitType);
            const finalNetPriceWarning = getFinalNetPriceWarning(slot, selectedUnitType);

            return (
              <article key={slot.id} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Project {index + 1}</p>
                    <p className="text-sm text-zinc-500">Choose project, unit and package.</p>
                  </div>
                  {slots.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Project</span>
                    <select
                      value={slot.projectId}
                      disabled={isLoadingProjects}
                      onChange={(event) => handleProjectChange(slot.id, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400"
                    >
                      <option value="">{isLoadingProjects ? "Loading Projects..." : "Select Project"}</option>
                      {getAvailableProjects(slot.id).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.location ? `${project.name} - ${project.location}` : project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.error ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {slot.error}
                    </p>
                  ) : null}

                  {projectOptions ? (
                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                      {projectOptions.project.cover_media?.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={projectOptions.project.cover_media.signed_url}
                          alt={`${projectOptions.project.name} cover`}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-zinc-500">
                          No Project Cover added yet.
                        </div>
                      )}
                    </div>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Unit Type</span>
                    <select
                      value={slot.unitTypeId}
                      disabled={!slot.projectId || slot.isLoadingOptions || !projectOptions}
                      onChange={(event) => handleUnitTypeChange(slot.id, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
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
                    <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      No Unit Types available for this Project.
                    </p>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Layout Plan</span>
                    <select
                      value={slot.layoutPlanId}
                      disabled={!slot.unitTypeId || eligibleLayoutPlans.length <= 1}
                      onChange={(event) =>
                        updateSlot(slot.id, { layoutPlanId: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
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
                    <span className="font-medium text-zinc-700">SPA Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.spaPrice}
                      disabled={!slot.unitTypeId}
                      onChange={(event) =>
                        updateSlot(slot.id, { spaPrice: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
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
                    <span className="font-medium text-zinc-700">Final Net Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.comparisonPrice}
                      disabled={!slot.unitTypeId}
                      onChange={(event) =>
                        updateSlot(slot.id, { comparisonPrice: event.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
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
                    <span className="font-medium text-zinc-700">Sales Package</span>
                    <select
                      value={slot.packageId}
                      disabled={!slot.unitTypeId}
                      onChange={(event) => updateSlot(slot.id, { packageId: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
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
                    <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
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
              className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-white/70 p-5 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:bg-white"
            >
              + Add Project
            </button>
          ) : null}
        </section>

        {hasCompared && comparedOptions.length > 0 ? (
          <>
            <section className="mt-8 flex flex-col gap-3 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Customer Proposal Export</p>
                <p className="text-sm text-zinc-500">
                  Choose comparison sections and generate a customer-facing PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={openExportModal}
                className="rounded-2xl bg-[#087F6B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#066b5b]"
              >
                Export PDF
              </button>
            </section>

            <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      Agent Insights & Recommendation
                    </p>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Optional
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
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
                className="mt-4 min-h-44 w-full resize-y rounded-2xl border border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
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
              <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Connectivity & Convenience</p>
                  <p className="text-sm text-zinc-500">
                    Customer-facing connectivity facts grouped by category.
                  </p>
                </div>
                <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  No connectivity information added yet.
                </p>
              </section>
            )}

            {isExportModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
                <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
                  <div>
                    <p className="text-lg font-semibold text-zinc-950">Export Comparison PDF</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Choose which sections to include in the customer proposal.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
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
                          className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700"
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
                    <button
                      type="button"
                      onClick={() => setIsExportModalOpen(false)}
                      className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateComparisonPdf}
                      disabled={selectedExportSections.length === 0}
                      className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Generate PDF
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}

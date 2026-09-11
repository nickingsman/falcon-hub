"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCustomerPdfBrandingStyles,
  renderCustomerPdfBranding,
  renderCustomerPdfWatermark,
  type CustomerPdfBranding,
} from "@/lib/customer-pdf-branding";
import {
  calculateRoi,
  type CashBenefitTreatment,
  type DiscountMethod,
  type PackageItemType,
  type PurchasePackageItem,
  type RoiCalculatorResult,
} from "@/lib/property-finance";
import {
  getPurchaseCostEstimates,
  type PurchaseCostEstimate,
  type PurchaseCostEstimateKey,
} from "@/lib/purchase-costs";
import {
  roiSavedWorkSchemaVersion,
  validateRoiSavedWorkPayload,
  type RoiSavedFloorPlanPresentationSnapshotV1,
  type RoiSavedLayoutSnapshotV1,
  type RoiSavedUnitPresentationSnapshotV1,
  type RoiSavedWorkPayloadV1,
} from "@/lib/roi-saved-work";
import {
  normalizeTowerCode,
  parseUnitNumber,
  stackCodesMatch,
  type ParsedUnitNumber,
  type UnitNumberFormat,
} from "@/lib/unit-number-format";
import { useAppPermissions } from "../../components/AppPermissionProvider";
import { Button, PageHeader, SectionHeader, StatusBadge } from "../../components/ui";

type CalculatorForm = {
  projectName: string;
  unitNumber: string;
  unitType: string;
  unitConfiguration: string;
  unitSizeSqft: string;
  carpark: string;
  calculationDate: string;
  packageValidUntil: string;
  spaPrice: string;
  loanMarginPercent: string;
  annualInterestRatePercent: string;
  loanTenureYears: string;
  expectedMonthlyRental: string;
  maintenanceRatePerSqft: string;
  otherUpfrontCosts: string;
};

type EditablePackageItem = {
  id: string;
  type: PackageItemType;
  description: string;
  method: DiscountMethod;
  value: string;
  amount: string;
  treatment: CashBenefitTreatment;
  receiveAt: string;
};

type PurchaseCostTreatment = "customer_pay" | "developer_absorbed" | "not_applicable";
type PurchaseCostSource = "auto" | "estimate" | "manual";

type PurchaseCostItem = {
  id: string;
  name: string;
  treatment: PurchaseCostTreatment;
  amount: string;
  source: PurchaseCostSource;
  estimateKey: PurchaseCostEstimateKey | null;
};

type ResolvedPurchaseCostItem = PurchaseCostItem & {
  resolvedAmount: string;
  resolvedAmountNumber: number;
  estimate: PurchaseCostEstimate | null;
};

type ProjectOption = {
  id: string;
  project_name: string;
  maintenance_fee_per_sqft: number | null;
  unit_number_format: UnitNumberFormat | null;
};

type CommercialPackageItem = {
  id: string;
  item_type: PackageItemType;
  description: string;
  discount_method: DiscountMethod | null;
  value: number | null;
  cash_benefit_treatment: CashBenefitTreatment | null;
  receive_at: string | null;
};

type CommercialPackagePurchaseCost = {
  cost_key: string;
  treatment: PurchaseCostTreatment;
  amount_override: number | null;
};

type CommercialPackage = {
  id: string;
  package_name: string;
  customer_description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  applicable_unit_types: Array<{ id: string }>;
  items: CommercialPackageItem[];
  purchase_costs: CommercialPackagePurchaseCost[];
};

type ProjectLayout = {
  title: string;
  description: string | null;
  signed_url: string | null;
};

type ProjectFacing = {
  name: string;
  description: string | null;
  view_type: "actual" | "indicative" | "artist_impression" | null;
  disclaimer: string | null;
  media: ProjectLayout | null;
};

type FurnishingItem = {
  item_name: string;
  quantity: number | null;
  description: string | null;
};

type FurnishingPackage = {
  package_name: string;
  description: string | null;
  items: FurnishingItem[];
};

type ProjectUnitType = {
  id: string;
  type_code: string;
  type_name: string | null;
  display_configuration: string | null;
  size_sqft: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
  layout: ProjectLayout | null;
  furnishing_package: FurnishingPackage | null;
};

type FloorPlanStack = {
  id: string;
  stack_code: string;
  unit_type_id: string | null;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  unit_type?: {
    id: string;
    type_code: string;
    type_name: string | null;
    display_configuration: string | null;
  } | null;
  facing?: ProjectFacing | null;
};

type ProjectFloorPlan = {
  id: string;
  name: string;
  tower_code: string | null;
  media_id: string | null;
  floor_from: number;
  floor_to: number;
  media: ProjectLayout | null;
  stacks: FloorPlanStack[];
};

type FloorPlanPresentationSnapshot = {
  floorPlanName: string;
  towerCode: string | null;
  floorFrom: number;
  floorTo: number;
  media: ProjectLayout | null;
  stackCode: string;
  stack: {
    x_percent: number;
    y_percent: number;
    width_percent: number;
    height_percent: number;
  };
  facing: ProjectFacing | null;
};

type UnitPresentationSnapshot = {
  projectName: string;
  typeCode: string;
  typeName: string | null;
  configuration: string | null;
  sizeSqft: number | null;
  carpark: string;
  layout: ProjectLayout | null;
  furnishingPackage: FurnishingPackage | null;
};

type DetectionStatus = "manual" | "auto" | "partial" | "not_detected" | "conflict" | "mismatch";

type UnitDetectionState = {
  status: DetectionStatus;
  message: string;
  parsed: ParsedUnitNumber;
  floorPlan: ProjectFloorPlan | null;
  stack: FloorPlanStack | null;
  requiresConfirmation: boolean;
};

type SaveModalMode = "new" | "save-as";

type SavedWorkDetailResponse = {
  savedWork?: {
    id: string;
    title: string;
    workType: string;
    schemaVersion: number;
    payload: unknown;
  };
  error?: string;
};

const defaultPurchaseCosts: PurchaseCostItem[] = [
  {
    id: "spa-legal-fee",
    name: "SPA Legal Fee",
    treatment: "developer_absorbed",
    amount: "",
    source: "auto",
    estimateKey: "spa_legal_fee",
  },
  {
    id: "loan-legal-fee",
    name: "Loan Legal Fee",
    treatment: "developer_absorbed",
    amount: "",
    source: "auto",
    estimateKey: "loan_legal_fee",
  },
  {
    id: "spa-disbursement-fee",
    name: "SPA Disbursement Fee",
    treatment: "developer_absorbed",
    amount: "",
    source: "estimate",
    estimateKey: "spa_disbursement_fee",
  },
  {
    id: "loan-disbursement-fee",
    name: "Loan Disbursement Fee",
    treatment: "developer_absorbed",
    amount: "",
    source: "estimate",
    estimateKey: "loan_disbursement_fee",
  },
  {
    id: "loan-stamp-duty",
    name: "Loan Stamp Duty",
    treatment: "developer_absorbed",
    amount: "",
    source: "auto",
    estimateKey: "loan_stamp_duty",
  },
  {
    id: "mot-transfer-stamp-duty",
    name: "MOT / Transfer Stamp Duty",
    treatment: "customer_pay",
    amount: "",
    source: "auto",
    estimateKey: "mot_transfer_stamp_duty",
  },
  {
    id: "valuation-fee",
    name: "Valuation Fee",
    treatment: "not_applicable",
    amount: "",
    source: "manual",
    estimateKey: null,
  },
];

const currencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const detailedCurrencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getMalaysiaDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) return 0;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function hasEnteredValue(value: string) {
  return value.trim() !== "";
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return currencyFormatter.format(value).replace("MYR", "RM");
}

function formatCurrencyDetailed(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return detailedCurrencyFormatter.format(value).replace("MYR", "RM");
}

function formatAmountInputValue(value: number) {
  if (!Number.isFinite(value)) return "";

  return value.toFixed(2);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return `${percentageFormatter.format(value)}%`;
}

function formatDisplayDate(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function proposalRow(
  label: string,
  value: string,
  emphasis = false,
  supportingLines: string[] = [],
) {
  const supportingHtml = supportingLines.length
    ? `<p class="row-note">${supportingLines.map(escapeHtml).join("<br />")}</p>`
    : "";

  return `
    <div class="row ${emphasis ? "emphasis-row" : ""} ${supportingLines.length ? "with-note" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${supportingHtml}
    </div>
  `;
}

function proposalSummaryRow(label: string, value: string, className: string) {
  return `
    <div class="row summary-row ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function resolvePurchaseCosts(
  purchaseCosts: PurchaseCostItem[],
  estimates: Record<PurchaseCostEstimateKey, PurchaseCostEstimate>,
): ResolvedPurchaseCostItem[] {
  return purchaseCosts.map((item) => {
    const estimate = item.estimateKey ? estimates[item.estimateKey] : null;
    const resolvedAmount =
      (item.source === "auto" || item.source === "estimate") && estimate
        ? formatAmountInputValue(estimate.amount)
        : item.amount;
    const parsedAmount = parseMoney(resolvedAmount);

    return {
      ...item,
      resolvedAmount,
      resolvedAmountNumber:
        Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : Number.NaN,
      estimate,
    };
  });
}

function purchaseCostPdfRow(item: ResolvedPurchaseCostItem) {
  if (item.treatment === "not_applicable") return "";

  const amount = item.resolvedAmountNumber;
  const hasAmount =
    hasEnteredValue(item.resolvedAmount) && Number.isFinite(amount) && amount >= 0;
  const note =
    item.id === "mot-transfer-stamp-duty"
      ? `<small class="vp-timing-note">Only payable after VP</small>`
      : item.estimate?.requiresManualConfirmation && item.estimate.note
        ? `<small>${escapeHtml(item.estimate.note)}</small>`
        : "";

  if (item.treatment === "developer_absorbed") {
    return `
      <div class="purchase-cost-row absorbed">
        <span>${escapeHtml(item.name)}${note}</span>
        <strong>
          ${hasAmount ? `<s>${escapeHtml(formatCurrencyDetailed(amount))}</s>` : ""}
          <b>FREE</b>
        </strong>
      </div>
    `;
  }

  return `
    <div class="purchase-cost-row">
      <span>${escapeHtml(item.name)}${note}</span>
      <strong>${escapeHtml(formatCurrencyDetailed(hasAmount ? amount : 0))}</strong>
    </div>
  `;
}

function proposalCompactField(label: string, value: string) {
  return `
    <div class="compact-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function purchaseLine(
  label: string,
  value: string,
  note?: string,
  emphasis = false,
  className = "",
) {
  return `
    <div class="purchase-line ${emphasis ? "purchase-line-emphasis" : ""} ${className}">
      <div>
        <strong>${escapeHtml(label)}</strong>
        ${note ? `<span>${escapeHtml(note)}</span>` : ""}
      </div>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function formatCashBenefitTreatment(
  treatment: CashBenefitTreatment,
  receiveAt: string | undefined,
) {
  if (treatment === "immediate_offset") return "Immediate Offset";

  return receiveAt ? `Refund Later (${receiveAt})` : "Refund Later";
}

function getPackageGroupTitle(type: PackageItemType) {
  if (type === "discount") return "Discounts";
  if (type === "cash_benefit") return "Cashback";

  return "Freebies";
}

function getPackageAddLabel(type: PackageItemType) {
  if (type === "discount") return "+ Discount";
  if (type === "cash_benefit") return "+ Cashback";

  return "+ Freebie";
}

function getPackageDescriptionPlaceholder(type: PackageItemType) {
  if (type === "discount") return "Developer Rebate";
  if (type === "cash_benefit") return "Cashback";

  return "Free furniture package";
}

function getDiscountMethodLabel(method: DiscountMethod) {
  if (method === "percentage_spa") return "% of SPA";
  if (method === "percentage_previous_balance") return "% of Balance";

  return "Fixed RM";
}

function formatDiscountValue(method: DiscountMethod, value: string) {
  const amount = parseMoney(value);

  if (!hasEnteredValue(value) || !Number.isFinite(amount)) return "Not set";
  return method === "fixed" ? formatCurrency(amount) : `${amount}%`;
}

function isPackageApplicable(commercialPackage: CommercialPackage, unitTypeId: string) {
  return (
    commercialPackage.applies_to_all_unit_types ||
    commercialPackage.applicable_unit_types.some((unitType) => unitType.id === unitTypeId)
  );
}

function packageItemsFromCommercialPackage(
  commercialPackage: CommercialPackage,
): EditablePackageItem[] {
  return commercialPackage.items.map((item) => ({
    id: item.id,
    type: item.item_type,
    description: item.description,
    method: item.discount_method ?? "percentage_spa",
    value: item.item_type === "discount" && item.value !== null ? String(item.value) : "",
    amount: item.item_type !== "discount" && item.value !== null ? String(item.value) : "",
    treatment: item.cash_benefit_treatment ?? "refund_later",
    receiveAt: item.receive_at ?? "",
  }));
}

function purchaseCostsFromCommercialPackage(
  commercialPackage: CommercialPackage,
): PurchaseCostItem[] {
  const costsByKey = new Map(
    commercialPackage.purchase_costs.map((cost) => [cost.cost_key, cost]),
  );

  return defaultPurchaseCosts.map((item) => {
    const costKey = item.estimateKey ?? item.id.replaceAll("-", "_");
    const cost = costsByKey.get(costKey);

    if (!cost) return { ...item, treatment: "not_applicable" as const };

    return {
      ...item,
      treatment: cost.treatment,
      amount: cost.amount_override === null ? "" : String(cost.amount_override),
      source: cost.amount_override === null ? item.source : ("manual" as const),
    };
  });
}

function getPackageItemEffectLabel(
  item: EditablePackageItem,
  result: RoiCalculatorResult,
) {
  if (item.type === "discount") {
    const discount = result.processedDiscounts.find((processed) => processed.id === item.id);

    return discount ? `-${formatCurrency(discount.amount)}` : "-RM 0";
  }

  if (item.type === "cash_benefit") {
    const benefit = result.cashBenefits.find((processed) => processed.id === item.id);

    return benefit ? `-${formatCurrency(benefit.amount)}` : "-RM 0";
  }

  const amount = parseMoney(item.amount);

  if (!hasEnteredValue(item.amount) || !Number.isFinite(amount) || amount <= 0) {
    return "Included";
  }

  return formatCurrency(amount);
}

function formatCarpark(unitType: ProjectUnitType) {
  if (unitType.carpark_description?.trim()) return unitType.carpark_description.trim();
  if (unitType.default_carparks === null || unitType.default_carparks === undefined) return "";

  return `${unitType.default_carparks}`;
}

function getUnitTypeLabel(unitType: ProjectUnitType) {
  return [unitType.type_code, unitType.display_configuration, unitType.type_name]
    .filter(Boolean)
    .join(" - ");
}

function getUnitPresentationSnapshot(
  projectName: string,
  unitType: ProjectUnitType,
): UnitPresentationSnapshot {
  return {
    projectName,
    typeCode: unitType.type_code,
    typeName: unitType.type_name,
    configuration: unitType.display_configuration,
    sizeSqft: unitType.size_sqft,
    carpark: formatCarpark(unitType),
    layout: unitType.layout,
    furnishingPackage: unitType.furnishing_package,
  };
}

function getFacingViewTypeLabel(viewType: ProjectFacing["view_type"]) {
  if (viewType === "actual") return "Actual View";
  if (viewType === "indicative") return "Indicative View";
  if (viewType === "artist_impression") return "Artist Impression";

  return "";
}

function getFloorPlanPresentationSnapshot(
  floorPlan: ProjectFloorPlan | null,
  stack: FloorPlanStack | null,
): FloorPlanPresentationSnapshot | null {
  if (!floorPlan || !stack) return null;

  return {
    floorPlanName: floorPlan.name,
    towerCode: floorPlan.tower_code,
    floorFrom: floorPlan.floor_from,
    floorTo: floorPlan.floor_to,
    media: floorPlan.media,
    stackCode: stack.stack_code,
    stack: {
      x_percent: stack.x_percent,
      y_percent: stack.y_percent,
      width_percent: stack.width_percent,
      height_percent: stack.height_percent,
    },
    facing: stack.facing ?? null,
  };
}

function sanitizeLayoutSnapshot(layout: ProjectLayout | null): RoiSavedLayoutSnapshotV1 | null {
  if (!layout) return null;

  return {
    title: layout.title,
    description: layout.description,
  };
}

function restoreLayoutSnapshot(
  layout: RoiSavedLayoutSnapshotV1 | null,
  signedUrl: string | null = null,
): ProjectLayout | null {
  if (!layout) return null;

  return {
    title: layout.title,
    description: layout.description,
    signed_url: signedUrl,
  };
}

function sanitizeFacingSnapshot(facing: ProjectFacing | null) {
  if (!facing) return null;

  return {
    name: facing.name,
    description: facing.description,
    view_type: facing.view_type,
    disclaimer: facing.disclaimer,
    media: sanitizeLayoutSnapshot(facing.media),
  };
}

function restoreFacingSnapshot(
  facing: RoiSavedFloorPlanPresentationSnapshotV1["facing"],
): ProjectFacing | null {
  if (!facing) return null;

  return {
    name: facing.name,
    description: facing.description,
    view_type: facing.view_type,
    disclaimer: facing.disclaimer,
    media: restoreLayoutSnapshot(facing.media),
  };
}

function sanitizeUnitPresentationSnapshot(
  snapshot: UnitPresentationSnapshot | null,
): RoiSavedUnitPresentationSnapshotV1 | null {
  if (!snapshot) return null;

  return {
    projectName: snapshot.projectName,
    typeCode: snapshot.typeCode,
    typeName: snapshot.typeName,
    configuration: snapshot.configuration,
    sizeSqft: snapshot.sizeSqft,
    carpark: snapshot.carpark,
    layout: sanitizeLayoutSnapshot(snapshot.layout),
    furnishingPackage: snapshot.furnishingPackage,
  };
}

function restoreUnitPresentationSnapshot(
  snapshot: RoiSavedUnitPresentationSnapshotV1 | null,
  freshUnitType?: ProjectUnitType | null,
): UnitPresentationSnapshot | null {
  if (!snapshot) return null;

  return {
    projectName: snapshot.projectName,
    typeCode: snapshot.typeCode,
    typeName: snapshot.typeName,
    configuration: snapshot.configuration,
    sizeSqft: snapshot.sizeSqft,
    carpark: snapshot.carpark,
    layout: freshUnitType?.layout ?? restoreLayoutSnapshot(snapshot.layout),
    furnishingPackage: snapshot.furnishingPackage,
  };
}

function sanitizeFloorPlanPresentationSnapshot(
  snapshot: FloorPlanPresentationSnapshot | null,
): RoiSavedFloorPlanPresentationSnapshotV1 | null {
  if (!snapshot) return null;

  return {
    floorPlanName: snapshot.floorPlanName,
    towerCode: snapshot.towerCode,
    floorFrom: snapshot.floorFrom,
    floorTo: snapshot.floorTo,
    media: sanitizeLayoutSnapshot(snapshot.media),
    stackCode: snapshot.stackCode,
    stack: snapshot.stack,
    facing: sanitizeFacingSnapshot(snapshot.facing),
  };
}

function restoreFloorPlanPresentationSnapshot(
  snapshot: RoiSavedFloorPlanPresentationSnapshotV1 | null,
): FloorPlanPresentationSnapshot | null {
  if (!snapshot) return null;

  return {
    floorPlanName: snapshot.floorPlanName,
    towerCode: snapshot.towerCode,
    floorFrom: snapshot.floorFrom,
    floorTo: snapshot.floorTo,
    media: restoreLayoutSnapshot(snapshot.media),
    stackCode: snapshot.stackCode,
    stack: snapshot.stack,
    facing: restoreFacingSnapshot(snapshot.facing),
  };
}

function getFloorPlanUnitLabelPosition(stack: FloorPlanPresentationSnapshot["stack"]) {
  const x = Math.max(Math.min(stack.x_percent + stack.width_percent / 2, 89), 11);
  const y = Math.max(stack.y_percent - 1.2, 3.4);

  return {
    x,
    y,
    backgroundX: x - 10.5,
    backgroundY: Math.max(y - 3, 0.6),
  };
}

function shouldRenderUnitPresentation(
  snapshot: UnitPresentationSnapshot | null,
  floorPlanSnapshot: FloorPlanPresentationSnapshot | null,
) {
  return Boolean(
    snapshot?.layout?.signed_url ||
      floorPlanSnapshot?.media?.signed_url ||
      floorPlanSnapshot?.facing,
  );
}

function proposalUnitInfoField(label: string, value: string) {
  return `
    <div class="unit-info-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildFurnishingItem(item: FurnishingItem) {
  const quantity =
    item.quantity !== null && item.quantity !== undefined && item.quantity > 0
      ? ` × ${item.quantity}`
      : "";

  return `
    <li>
      <strong>${escapeHtml(`${item.item_name}${quantity}`)}</strong>
      ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ""}
    </li>
  `;
}

function getProjectUnitNumberFormat(project: ProjectOption | undefined) {
  return project?.unit_number_format ?? "manual";
}

function getDetectionLabel(status: DetectionStatus) {
  if (status === "auto") return "Auto-detected";
  if (status === "partial") return "Partially detected";
  if (status === "conflict") return "Conflict";
  if (status === "mismatch") return "Unit Type mismatch";
  if (status === "not_detected") return "Not detected";

  return "Manual";
}

function getFloorPlanLabel(floorPlan: ProjectFloorPlan) {
  const tower = floorPlan.tower_code ? `Tower ${floorPlan.tower_code}` : "No Tower";

  return `${tower} · Floors ${floorPlan.floor_from}-${floorPlan.floor_to}`;
}

function getMappedUnitTypeLabel(unitType: FloorPlanStack["unit_type"]) {
  if (!unitType) return "No Unit Type";

  return [unitType.type_code, unitType.display_configuration, unitType.type_name]
    .filter(Boolean)
    .join(" - ");
}

function getApplicableFloorPlans(
  floorPlans: ProjectFloorPlan[],
  parsed: ParsedUnitNumber,
) {
  if (!parsed.detected) return [];

  return floorPlans.filter(
    (floorPlan) =>
      normalizeTowerCode(floorPlan.tower_code) === parsed.towerCode &&
      floorPlan.floor_from <= parsed.floor &&
      floorPlan.floor_to >= parsed.floor,
  );
}

function findMatchingStack(floorPlan: ProjectFloorPlan, stackCode: string) {
  return floorPlan.stacks.filter((stack) => stackCodesMatch(stack.stack_code, stackCode));
}

function buildDetectionState({
  unitNumber,
  format,
  floorPlans,
  selectedUnitTypeId,
  manualFloorPlanId,
  manualStackId,
}: {
  unitNumber: string;
  format: UnitNumberFormat | null;
  floorPlans: ProjectFloorPlan[];
  selectedUnitTypeId: string;
  manualFloorPlanId: string;
  manualStackId: string;
}): UnitDetectionState {
  const parsed = parseUnitNumber(unitNumber, format);
  const manualFloorPlan = floorPlans.find((floorPlan) => floorPlan.id === manualFloorPlanId) ?? null;
  const manualStack =
    manualFloorPlan?.stacks.find((stack) => stack.id === manualStackId) ?? null;

  if (manualFloorPlan && manualStack) {
    return {
      status: "manual",
      message: "Manual Floor Plan and Stack selected.",
      parsed,
      floorPlan: manualFloorPlan,
      stack: manualStack,
      requiresConfirmation: false,
    };
  }

  if (format === "manual" || !format) {
    return {
      status: "manual",
      message: "Select a Floor Plan and Stack for proposal highlighting.",
      parsed,
      floorPlan: manualFloorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  if (!parsed.detected) {
    return {
      status: unitNumber.trim() ? "not_detected" : "manual",
      message: unitNumber.trim()
        ? "Unit Number does not match the configured Project format."
        : "Enter a Unit Number or select a Floor Plan and Stack manually.",
      parsed,
      floorPlan: manualFloorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  const applicableFloorPlans = getApplicableFloorPlans(floorPlans, parsed);

  if (applicableFloorPlans.length === 0) {
    return {
      status: "partial",
      message: "Unit Number was parsed, but no matching customer-visible Floor Plan was found.",
      parsed,
      floorPlan: manualFloorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  if (applicableFloorPlans.length > 1) {
    return {
      status: "conflict",
      message: "Multiple Floor Plans match this Unit Number. Select one manually.",
      parsed,
      floorPlan: manualFloorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  const [floorPlan] = applicableFloorPlans;
  const matchingStacks = findMatchingStack(floorPlan, parsed.stackCode);

  if (matchingStacks.length === 0) {
    return {
      status: "partial",
      message: "Floor Plan found, but no matching Stack Mapping was found.",
      parsed,
      floorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  if (matchingStacks.length > 1) {
    return {
      status: "conflict",
      message: "Multiple Stack Mappings match this Unit Number. Select one manually.",
      parsed,
      floorPlan,
      stack: null,
      requiresConfirmation: false,
    };
  }

  const [stack] = matchingStacks;

  if (stack.unit_type_id && selectedUnitTypeId && stack.unit_type_id !== selectedUnitTypeId) {
    return {
      status: "mismatch",
      message: `Detected Stack ${stack.stack_code} is mapped to ${getMappedUnitTypeLabel(stack.unit_type)}, while the selected Unit Type is different. Confirm manually before highlighting.`,
      parsed,
      floorPlan,
      stack,
      requiresConfirmation: true,
    };
  }

  return {
    status: "auto",
    message: `Stack ${stack.stack_code} matched from Unit Number.`,
    parsed,
    floorPlan,
    stack,
    requiresConfirmation: false,
  };
}

function calculateTotalCashback(result: RoiCalculatorResult) {
  const loanSurplus = Math.max(result.loanAmount - result.nettPrice, 0);
  const refundLaterCashBenefits = result.cashBenefits
    .filter((benefit) => benefit.treatment === "refund_later")
    .reduce((sum, benefit) => sum + benefit.amount, 0);

  return Math.max(loanSurplus + refundLaterCashBenefits, 0);
}

function calculatePurchaseCostSummary(purchaseCosts: ResolvedPurchaseCostItem[]) {
  return purchaseCosts.reduce(
    (summary, item) => {
      const amount = item.resolvedAmountNumber;

      if (!Number.isFinite(amount) || amount < 0) return summary;

      if (item.treatment === "customer_pay") {
        summary.customerPayPurchaseCosts += amount;
      }

      if (item.treatment === "developer_absorbed") {
        summary.developerAbsorbedPurchaseCosts += amount;
      }

      return summary;
    },
    {
      customerPayPurchaseCosts: 0,
      developerAbsorbedPurchaseCosts: 0,
    },
  );
}

function getPendingInputClass(isPending: boolean, hasError = false) {
  if (hasError) return "border-red-300 bg-red-50";
  if (isPending) return "border-amber-200 bg-[#FFF9E8]";

  return "border-zinc-200 bg-zinc-50";
}

function printWhenImagesAreReady(proposalWindow: Window) {
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

function buildRoiProposalHtml({
  form,
  numericInput,
  result,
  branding,
  unitPresentation,
  floorPlanPresentation,
  purchaseCosts,
  packageItems,
}: {
  form: CalculatorForm;
  numericInput: {
    loanMarginPercent: number;
    annualInterestRatePercent: number;
    loanTenureYears: number;
    expectedMonthlyRental: number;
    otherUpfrontCosts: number;
  };
  result: RoiCalculatorResult;
  branding: CustomerPdfBranding;
  unitPresentation: UnitPresentationSnapshot | null;
  floorPlanPresentation: FloorPlanPresentationSnapshot | null;
  purchaseCosts: ResolvedPurchaseCostItem[];
  packageItems: EditablePackageItem[];
}) {
  const projectName = form.projectName.trim() || "Unit Calculation Proposal";
  const renderUnitPresentation = shouldRenderUnitPresentation(
    unitPresentation,
    floorPlanPresentation,
  );
  const totalCashback = calculateTotalCashback(result);
  const monthlyCashFlow = result.monthlyCashFlow ?? 0;
  const purchaseCostRows = purchaseCosts.map(purchaseCostPdfRow).join("");
  const proposalPurchaseCostSummary = calculatePurchaseCostSummary(purchaseCosts);
  const monthlyCashFlowBreakdown = [
    `Rental ${formatCurrencyDetailed(numericInput.expectedMonthlyRental)}`,
    `− Loan Instalment ${formatCurrencyDetailed(result.estimatedMonthlyInstalment)}`,
    `− Maintenance ${formatCurrencyDetailed(result.monthlyMaintenance)}`,
    `= ${formatCurrencyDetailed(result.monthlyCashFlow)}`,
  ];
  const annualCashFlowExplanation =
    result.monthlyCashFlow !== null && result.annualCashFlow !== null
      ? `${formatCurrencyDetailed(result.monthlyCashFlow)} × 12 = ${formatCurrencyDetailed(result.annualCashFlow)}`
      : "Monthly Cash Flow × 12";
  const monthlyCashFlowLabel =
    monthlyCashFlow > 0
      ? "Positive Cash Flow"
      : monthlyCashFlow < 0
        ? "Negative Cash Flow"
        : "Break-even Cash Flow";
  const discountRows = result.processedDiscounts
    .map((discount) => {
      const source = packageItems.find((item) => item.id === discount.id);
      const methodNote = source
        ? `${formatDiscountValue(source.method, source.value)} · ${getDiscountMethodLabel(source.method)}`
        : undefined;

      return purchaseLine(
        discount.description,
        `- ${formatCurrency(discount.amount)}`,
        methodNote,
      );
    })
    .join("");
  const cashBenefitRows = result.cashBenefits
    .map((benefit) =>
      purchaseLine(
        benefit.description,
        `- ${formatCurrency(benefit.amount)}`,
        formatCashBenefitTreatment(benefit.treatment, benefit.receiveAt),
      ),
    )
    .join("");
  const nonCashBenefitRows = result.nonCashBenefits
    .map(
      (benefit) => `
        <div class="included-benefit">
          <div>
            <strong>${escapeHtml(benefit.description)}</strong>
            <span>Included non-cash benefit</span>
          </div>
          <b>Included</b>
        </div>
      `,
    )
    .join("");
  const purchasePackageRows = `
    ${purchaseLine("SPA Price", formatCurrency(result.spaPrice))}
    ${discountRows}
    <div class="calculation-divider"></div>
    ${purchaseLine("Nett Price", formatCurrency(result.nettPrice), undefined)}
    ${cashBenefitRows}
    <div class="calculation-divider strong"></div>
    ${purchaseLine("Final Price After Benefits", formatCurrency(result.finalPriceAfterBenefits), undefined, true)}
    ${purchaseLine("Total Cashback", formatCurrency(totalCashback), undefined, false, "cashback-line")}
  `;
  const proposalFurnishingPackage = unitPresentation?.furnishingPackage ?? null;
  const furnishingItems =
    proposalFurnishingPackage?.items
      ?.filter((item) => item.item_name)
      .map(buildFurnishingItem)
      .join("") ?? "";
  const selectedFacing = floorPlanPresentation?.facing ?? null;
  const facingViewTypeLabel = getFacingViewTypeLabel(selectedFacing?.view_type ?? null);
  const hasUnitLayout = Boolean(unitPresentation?.layout?.signed_url);
  const hasFloorPlanImage = Boolean(floorPlanPresentation?.media?.signed_url);
  const hasFacing = Boolean(selectedFacing);
  const unitLabelPosition = floorPlanPresentation
    ? getFloorPlanUnitLabelPosition(floorPlanPresentation.stack)
    : null;
  const visualCount = [hasUnitLayout, hasFloorPlanImage, hasFacing].filter(Boolean).length;
  const visualGridClass = [
    "visual-grid",
    visualCount <= 1 ? "single" : "",
    hasFacing ? "with-facing" : "",
    hasUnitLayout && hasFloorPlanImage && hasFacing ? "three-visuals" : "",
    hasUnitLayout && !hasFloorPlanImage && hasFacing ? "layout-facing" : "",
    !hasUnitLayout && hasFloorPlanImage && hasFacing ? "floor-facing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const layoutCardHtml =
    unitPresentation?.layout?.signed_url
      ? `<div class="section layout-section">
          <div class="section-heading-row">
            <h2>Layout Plan</h2>
            <span>${escapeHtml(unitPresentation.layout.title || "Unit Layout")}</span>
          </div>
          <div class="layout-frame">
            <img src="${escapeHtml(unitPresentation.layout.signed_url)}" alt="${escapeHtml(unitPresentation.layout.title || "Unit layout")}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="layout-unavailable">Layout plan unavailable</div>
          </div>
        </div>`
      : "";
  const floorPlanCardHtml =
    floorPlanPresentation?.media?.signed_url
      ? `<div class="section floor-plan-section">
          <div class="section-heading-row">
            <h2>Floor Plan</h2>
            <span>${escapeHtml(getFloorPlanLabel({
              id: "",
              name: floorPlanPresentation.floorPlanName,
              tower_code: floorPlanPresentation.towerCode,
              media_id: null,
              floor_from: floorPlanPresentation.floorFrom,
              floor_to: floorPlanPresentation.floorTo,
              media: null,
              stacks: [],
            }))}</span>
          </div>
          <div class="floor-plan-frame">
            <div class="floor-plan-image-wrap">
              <img src="${escapeHtml(floorPlanPresentation.media.signed_url)}" alt="${escapeHtml(floorPlanPresentation.media.title || "Floor plan")}" onerror="this.parentElement.style.display='none'; this.parentElement.nextElementSibling.style.display='flex';" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <rect
                  x="${floorPlanPresentation.stack.x_percent}"
                  y="${floorPlanPresentation.stack.y_percent}"
                  width="${floorPlanPresentation.stack.width_percent}"
                  height="${floorPlanPresentation.stack.height_percent}"
                  rx="0.8"
                ></rect>
                ${
                  unitLabelPosition
                    ? `<rect
                        class="unit-label-bg"
                        x="${unitLabelPosition.backgroundX}"
                        y="${unitLabelPosition.backgroundY}"
                        width="21"
                        height="4.4"
                        rx="1.1"
                      ></rect>`
                    : ""
                }
                <text
                  x="${unitLabelPosition?.x ?? 50}"
                  y="${unitLabelPosition?.y ?? 3.4}"
                  text-anchor="middle"
                >YOUR UNIT</text>
              </svg>
            </div>
            <div class="layout-unavailable">Floor plan unavailable</div>
          </div>
          <p class="floor-plan-caption">Highlighted Stack ${escapeHtml(floorPlanPresentation.stackCode)}</p>
        </div>`
      : "";
  const facingCardHtml = selectedFacing
    ? `<div class="section facing-section">
        <div class="section-heading-row">
          <h2>Facing / View</h2>
          ${facingViewTypeLabel ? `<span>${escapeHtml(facingViewTypeLabel)}</span>` : ""}
        </div>
        <div class="facing-content">
          <h3>${escapeHtml(selectedFacing.name)}</h3>
          ${
            selectedFacing.media?.signed_url
              ? `<div class="facing-image-wrap">
                  <img src="${escapeHtml(selectedFacing.media.signed_url)}" alt="${escapeHtml(selectedFacing.media.title || selectedFacing.name)}" onerror="this.parentElement.style.display='none';" />
                </div>`
              : ""
          }
          ${facingViewTypeLabel ? `<p class="facing-type">${escapeHtml(facingViewTypeLabel)}</p>` : ""}
          ${selectedFacing.description ? `<p class="facing-description">${escapeHtml(selectedFacing.description)}</p>` : ""}
          ${selectedFacing.disclaimer ? `<p class="facing-disclaimer">${escapeHtml(selectedFacing.disclaimer)}</p>` : ""}
        </div>
      </div>`
    : "";
  const proposalPage2 = renderUnitPresentation
    ? `
    <main class="page page-break">
      <section class="header">
        <div>
          <div class="eyebrow">Project / Unit Presentation</div>
          <h1>${escapeHtml(unitPresentation?.projectName || projectName)}</h1>
        </div>
        <div class="date">Calculation Date: ${escapeHtml(form.calculationDate || "-")}</div>
      </section>

      <section class="section wide unit-info-section" style="margin-top: 10px;">
        <h2>Unit Information</h2>
        <div class="unit-info-grid">
          ${proposalUnitInfoField("Unit", form.unitNumber || "-")}
          ${proposalUnitInfoField("Type", form.unitType || unitPresentation?.typeCode || "-")}
          ${proposalUnitInfoField("Configuration", form.unitConfiguration || unitPresentation?.configuration || "-")}
          ${proposalUnitInfoField("Size", form.unitSizeSqft ? `${form.unitSizeSqft} sqft` : unitPresentation?.sizeSqft ? `${unitPresentation.sizeSqft} sqft` : "-")}
          ${proposalUnitInfoField("Carpark", form.carpark || unitPresentation?.carpark || "-")}
          ${
            unitPresentation?.typeName
              ? proposalUnitInfoField("Type Name", unitPresentation.typeName)
              : ""
          }
        </div>
      </section>

      <section class="${visualGridClass}">
        ${layoutCardHtml}
        ${
          hasUnitLayout && hasFloorPlanImage && hasFacing
            ? `<div class="visual-side-stack">${floorPlanCardHtml}${facingCardHtml}</div>`
            : `${floorPlanCardHtml}${facingCardHtml}`
        }
      </section>

    </main>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(projectName)} - Unit Calculation Proposal</title>
    <style>
      @page { size: A4; margin: 10mm 10mm 16mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #18181b;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: #ffffff;
        padding: 10mm 10mm 15mm;
      }
      .page-break {
        break-before: page;
        page-break-before: always;
      }
      .eyebrow {
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 5px 0 0;
        color: #09090b;
        font-size: 23px;
        line-height: 1.12;
      }
      h2 {
        margin: 0 0 8px;
        color: #09090b;
        font-size: 12px;
      }
      .muted { color: #71717a; }
      .header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        border-bottom: 1px solid #e4e4e7;
        padding-bottom: 10px;
      }
      .date {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px 9px;
        color: #52525b;
        font-size: 10px;
        white-space: nowrap;
      }
      .sections {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 9px;
      }
      .section {
        break-inside: avoid;
        border: 1px solid #d4d4d8;
        border-radius: 12px;
        padding: 9px;
      }
      .section.wide { grid-column: 1 / -1; }
      .section.compact-list { padding-bottom: 5px; }
      .package-validity {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        margin: -2px 0 5px;
        color: #9A6B1F;
        font-size: 8.5px;
        font-weight: 800;
      }
      .package-validity strong {
        font-size: 10px;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 10px;
        border-top: 1px solid #f1f1f1;
        padding: 5px 0;
        font-size: 9.8px;
      }
      .row:first-of-type { border-top: 0; }
      .row span { color: #71717a; }
      .row strong { color: #18181b; text-align: right; }
      .row-note {
        flex-basis: 100%;
        margin: -2px 0 0;
        color: #71717a;
        font-size: 7.8px;
        font-weight: 600;
        line-height: 1.35;
      }
      .emphasis-row strong {
        color: #087F6B;
        font-size: 12px;
      }
      .savings-row span,
      .savings-row strong {
        color: #087F6B;
        font-weight: 800;
      }
      .summary-row {
        margin-top: 3px;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 5px 7px;
      }
      .summary-row strong {
        font-size: 10.8px;
      }
      .savings-row {
        border-color: #b7e6dc;
        background: #f1fbf8;
      }
      .cash-required-row span,
      .cash-required-row strong {
        color: #8B3A3A;
        font-weight: 700;
      }
      .cash-required-row {
        border-color: #f0dddd;
        background: #fffdfd;
      }
      .cash-required-row strong {
        font-size: 10px;
      }
      .compact-fields {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 7px;
        margin-top: 8px;
      }
      .compact-field {
        border: 1px solid #d4d4d8;
        border-radius: 10px;
        padding: 7px;
      }
      .compact-field span {
        display: block;
        color: #71717a;
        font-size: 8px;
      }
      .compact-field strong {
        display: block;
        margin-top: 3px;
        color: #18181b;
        font-size: 10px;
      }
      .purchase-line {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 0;
        font-size: 9.5px;
      }
      .purchase-line strong { display: block; color: #18181b; }
      .purchase-line span {
        display: block;
        margin-top: 2px;
        color: #71717a;
      }
      .purchase-line b { color: #18181b; text-align: right; white-space: nowrap; }
      .purchase-line-emphasis strong,
      .purchase-line-emphasis b {
        color: #087F6B;
        font-size: 11px;
      }
      .cashback-line strong,
      .cashback-line b {
        color: #1E4E79;
      }
      .cashback-line b {
        font-weight: 800;
      }
      .purchase-costs {
        margin-top: 5px;
        border-top: 1px solid #f1f1f1;
        padding-top: 4px;
      }
      .purchase-cost-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 3px 0;
        font-size: 9px;
      }
      .purchase-cost-row span {
        color: #71717a;
      }
      .purchase-cost-row small {
        display: block;
        margin-top: 1px;
        color: #71717a;
        font-size: 7.8px;
        font-weight: 700;
      }
      .purchase-cost-row small.vp-timing-note {
        display: inline-block;
        border: 1px solid #ead7a6;
        border-radius: 999px;
        background: #fff9e8;
        color: #9A6B1F;
        font-size: 7.4px;
        font-weight: 800;
        margin-top: 2px;
        padding: 1px 5px;
      }
      .purchase-cost-row strong {
        display: flex;
        gap: 7px;
        align-items: center;
        color: #18181b;
        text-align: right;
        white-space: nowrap;
      }
      .purchase-cost-row s {
        color: #71717a;
        text-decoration-thickness: 1.5px;
      }
      .purchase-cost-row b {
        color: #1E4E79;
        font-size: 9px;
      }
      .calculation-divider {
        margin: 4px 0;
        border-top: 1px solid #c9c9d1;
      }
      .calculation-divider.strong {
        border-top-color: #68c4b4;
      }
      .calculation-empty {
        padding: 2px 0 4px;
      }
      .included-benefits {
        margin-top: 7px;
        border-top: 1px solid #f1f1f1;
        padding-top: 6px;
      }
      .included-benefit {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 3px 0;
        font-size: 9.5px;
      }
      .included-benefit strong { display: block; color: #18181b; }
      .included-benefit span {
        display: block;
        margin-top: 2px;
        color: #71717a;
      }
      .included-benefit b { color: #18181b; text-align: right; white-space: nowrap; }
      .cash-flow-positive { color: #087F6B !important; }
      .cash-flow-negative { color: #be123c !important; }
      .empty { margin: 0; color: #71717a; font-size: 9.8px; }
      .summary {
        break-inside: avoid;
        margin-top: 9px;
        border: 1px solid #99d8cd;
        border-radius: 14px;
        background: #effaf7;
        padding: 10px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .summary-card {
        border-radius: 11px;
        background: #ffffff;
        padding: 9px;
      }
      .summary-card span {
        display: block;
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary-card strong {
        display: block;
        margin-top: 5px;
        color: #087F6B;
        font-size: 16px;
        line-height: 1.1;
      }
      .disclaimer {
        margin: 7px 0 0;
        color: #71717a;
        font-size: 8px;
        line-height: 1.35;
      }
      ${getCustomerPdfBrandingStyles()}
      .unit-info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .unit-info-field {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px;
      }
      .unit-info-field span {
        display: block;
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .unit-info-field strong {
        display: block;
        margin-top: 4px;
        color: #18181b;
        font-size: 12px;
      }
      .layout-section {
        margin-top: 10px;
      }
      .visual-grid {
        display: grid;
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        gap: 8px;
        margin-top: 10px;
      }
      .visual-grid.single {
        grid-template-columns: 1fr;
      }
      .visual-grid.single .layout-frame {
        height: 158mm;
      }
      .visual-grid.single .floor-plan-frame {
        min-height: 158mm;
      }
      .visual-side-stack {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
      }
      .section-heading-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .section-heading-row span {
        color: #71717a;
        font-size: 9px;
      }
      .layout-frame {
        margin-top: 8px;
        height: 152mm;
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        background: #fafafa;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .layout-frame img {
        display: block;
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .layout-unavailable {
        display: none;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        color: #71717a;
        font-size: 11px;
      }
      .floor-plan-frame {
        margin-top: 8px;
        min-height: 152mm;
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        background: #fafafa;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .floor-plan-image-wrap {
        position: relative;
        display: inline-block;
        max-width: 100%;
        max-height: 152mm;
      }
      .floor-plan-image-wrap img {
        display: block;
        max-width: 100%;
        max-height: 152mm;
        width: auto;
        height: auto;
      }
      .floor-plan-image-wrap svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .floor-plan-image-wrap rect {
        fill: rgba(139, 58, 58, 0.22);
        stroke: #8B3A3A;
        stroke-width: 0.9;
        vector-effect: non-scaling-stroke;
      }
      .floor-plan-image-wrap .unit-label-bg {
        fill: rgba(255, 255, 255, 0.92);
        stroke: rgba(139, 58, 58, 0.36);
        stroke-width: 0.35;
      }
      .floor-plan-image-wrap text {
        fill: #8B3A3A;
        font-size: 3px;
        font-weight: 800;
      }
      .floor-plan-caption {
        margin: 6px 0 0;
        color: #52525b;
        font-size: 9px;
        font-weight: 700;
      }
      .three-visuals .floor-plan-frame {
        min-height: 92mm;
      }
      .three-visuals .floor-plan-image-wrap,
      .three-visuals .floor-plan-image-wrap img {
        max-height: 92mm;
      }
      .facing-section {
        break-inside: avoid;
      }
      .facing-content h3 {
        margin: 2px 0 7px;
        color: #18181b;
        font-size: 14px;
        line-height: 1.15;
      }
      .facing-image-wrap {
        margin-bottom: 7px;
        max-height: 52mm;
        border: 1px solid #e4e4e7;
        border-radius: 11px;
        background: #fafafa;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .facing-image-wrap img {
        display: block;
        max-width: 100%;
        max-height: 52mm;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .visual-grid.single .facing-image-wrap {
        max-height: 126mm;
      }
      .visual-grid.single .facing-image-wrap img {
        max-height: 126mm;
      }
      .layout-facing .facing-image-wrap,
      .floor-facing .facing-image-wrap {
        max-height: 122mm;
      }
      .layout-facing .facing-image-wrap img,
      .floor-facing .facing-image-wrap img {
        max-height: 122mm;
      }
      .facing-type {
        margin: 0 0 5px;
        color: #087F6B;
        font-size: 9px;
        font-weight: 800;
      }
      .facing-description {
        margin: 0 0 6px;
        color: #3f3f46;
        font-size: 10px;
        line-height: 1.35;
      }
      .facing-disclaimer {
        margin: 0;
        color: #71717a;
        font-size: 8.5px;
        line-height: 1.35;
      }
      .furnishing-section {
        margin-top: 8px;
        border-top: 1px solid #f1f1f1;
        padding-top: 7px;
      }
      .furnishing-package-name {
        margin: -2px 0 5px;
        color: #18181b;
        font-size: 10px;
        font-weight: 700;
      }
      .furnishing-description {
        margin: -2px 0 7px;
        color: #71717a;
        font-size: 9px;
        line-height: 1.35;
      }
      .furnishing-list {
        margin: 0;
        padding-left: 16px;
        columns: 1;
      }
      .furnishing-list li {
        break-inside: avoid;
        margin: 0 0 4px;
        color: #18181b;
        font-size: 10px;
      }
      .furnishing-list span {
        display: block;
        margin-top: 1px;
        color: #71717a;
        font-size: 8.5px;
        line-height: 1.25;
      }
      .proposal-page-one .header {
        padding-bottom: 7px;
      }
      .proposal-page-one h1 {
        font-size: 21px;
      }
      .proposal-page-one h2 {
        margin-bottom: 5px;
        font-size: 11px;
      }
      .proposal-page-one .sections {
        gap: 6px;
        margin-top: 6px;
      }
      .proposal-page-one .section {
        border-radius: 10px;
        padding: 7px;
      }
      .proposal-page-one .compact-fields {
        gap: 5px;
        margin-top: 6px;
      }
      .proposal-page-one .compact-field {
        border-radius: 8px;
        padding: 5px 6px;
      }
      .proposal-page-one .row {
        padding: 3.5px 0;
        font-size: 9px;
      }
      .proposal-page-one .purchase-line {
        padding: 3px 0;
        font-size: 9px;
      }
      .proposal-page-one .purchase-costs {
        margin-top: 3px;
        padding-top: 3px;
      }
      .proposal-page-one .purchase-cost-row {
        padding: 2px 0;
        font-size: 8.6px;
      }
      .proposal-page-one .calculation-divider {
        margin: 3px 0;
      }
      .proposal-page-one .included-benefits {
        margin-top: 4px;
        padding-top: 4px;
      }
      .proposal-page-one .included-benefit {
        padding: 2px 0;
        font-size: 8.8px;
      }
      .proposal-page-one .summary {
        margin-top: 6px;
        border-radius: 11px;
        padding: 7px;
      }
      .proposal-page-one .summary-grid {
        gap: 6px;
      }
      .proposal-page-one .summary-card {
        border-radius: 9px;
        padding: 7px;
      }
      .proposal-page-one .summary-card strong {
        margin-top: 3px;
        font-size: 14px;
      }
      .proposal-page-one .disclaimer {
        margin-top: 4px;
        font-size: 7.4px;
        line-height: 1.25;
      }
      .proposal-page-one .furnishing-section {
        margin-top: 5px;
        padding-top: 5px;
      }
      .proposal-page-one .furnishing-package-name {
        margin-bottom: 3px;
        font-size: 9px;
      }
      .proposal-page-one .furnishing-description {
        margin-bottom: 4px;
        font-size: 8px;
        line-height: 1.2;
      }
      .proposal-page-one .furnishing-list li {
        margin-bottom: 2px;
        font-size: 8.8px;
      }
      .proposal-page-one .furnishing-list span {
        font-size: 7.8px;
      }
      @media print {
        body { background: #ffffff; }
        .page { width: auto; min-height: auto; margin: 0; padding: 0; }
      }
    </style>
  </head>
  <body>
    ${renderCustomerPdfWatermark(branding)}
    <main class="page proposal-page-one">
      <section class="header">
        <div>
          <div class="eyebrow">Falcon Hub Unit Calculation</div>
          <h1>${escapeHtml(projectName)}</h1>
        </div>
        <div class="date">Calculation Date: ${escapeHtml(form.calculationDate || "-")}</div>
      </section>

      <section class="section wide" style="margin-top: 9px;">
        <h2>Property Information</h2>
        <div class="compact-fields">
          ${proposalCompactField("Unit", form.unitNumber || "-")}
          ${proposalCompactField("Type", form.unitType || "-")}
          ${proposalCompactField("Configuration", form.unitConfiguration || "-")}
          ${proposalCompactField("Size", form.unitSizeSqft ? `${form.unitSizeSqft} sqft` : "-")}
          ${proposalCompactField("Carpark", form.carpark || "-")}
        </div>
      </section>

      <section class="sections">
        <div class="section wide compact-list">
          <h2>Purchase Package</h2>
          ${
            formatDisplayDate(form.packageValidUntil)
              ? `<div class="package-validity"><span>Package Valid Until:</span><strong>${escapeHtml(formatDisplayDate(form.packageValidUntil))}</strong></div>`
              : ""
          }
          ${purchasePackageRows}
          ${
            nonCashBenefitRows
              ? `<div class="included-benefits">
                  <h2>Included Benefits</h2>
                  ${nonCashBenefitRows}
                </div>`
              : ""
          }
        </div>
        <div class="section">
          <h2>Financing</h2>
          ${proposalRow("Loan Margin", formatPercent(numericInput.loanMarginPercent))}
          ${proposalRow("Interest Rate", formatPercent(numericInput.annualInterestRatePercent))}
          ${proposalRow("Loan Tenure", `${numericInput.loanTenureYears || 0} years`)}
          ${proposalRow("Loan Amount", formatCurrency(result.loanAmount))}
          ${proposalRow("Estimated Monthly Loan Instalment", formatCurrencyDetailed(result.estimatedMonthlyInstalment))}
        </div>
        <div class="section">
          <h2>Cash Required</h2>
          ${proposalRow("Upfront Cash Required", formatCurrency(result.upfrontCashBeforeOtherCosts))}
          ${proposalRow("Other Upfront Costs", formatCurrency(numericInput.otherUpfrontCosts))}
          ${purchaseCostRows ? `<div class="purchase-costs">${purchaseCostRows}</div>` : ""}
          ${proposalSummaryRow("Total Savings", formatCurrencyDetailed(proposalPurchaseCostSummary.developerAbsorbedPurchaseCosts), "savings-row")}
          ${proposalSummaryRow("Estimated Total Cash Required", formatCurrencyDetailed(result.estimatedTotalCashRequired), "cash-required-row")}
          ${
            proposalFurnishingPackage
              ? `<div class="furnishing-section">
                <h2>Included Furnishing</h2>
                <p class="furnishing-package-name">${escapeHtml(proposalFurnishingPackage.package_name)}</p>
                ${
                  proposalFurnishingPackage.description
                    ? `<p class="furnishing-description">${escapeHtml(proposalFurnishingPackage.description)}</p>`
                    : ""
                }
                ${furnishingItems ? `<ul class="furnishing-list">${furnishingItems}</ul>` : ""}
              </div>`
              : ""
          }
        </div>
        <div class="section">
          <h2>Rental / Operating Figures</h2>
          ${proposalRow("Expected Monthly Rental", formatCurrencyDetailed(numericInput.expectedMonthlyRental))}
          ${proposalRow("Estimated Monthly Loan Instalment", formatCurrencyDetailed(result.estimatedMonthlyInstalment))}
          ${proposalRow("Monthly Maintenance", formatCurrencyDetailed(result.monthlyMaintenance))}
          ${proposalRow("Estimated Monthly Cash Flow", formatCurrencyDetailed(result.monthlyCashFlow), false, monthlyCashFlowBreakdown)}
          ${proposalRow("Estimated Annual Cash Flow", formatCurrencyDetailed(result.annualCashFlow), false, [annualCashFlowExplanation])}
          ${proposalRow("Net Rental Yield", formatPercent(result.netRentalYieldPercent), false, ["Based on estimated annual net rental after maintenance."])}
        </div>
      </section>

      <section class="summary">
        <h2>Final Investment Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <span>Final Price After Benefits</span>
            <strong>${escapeHtml(formatCurrency(result.finalPriceAfterBenefits))}</strong>
          </div>
          <div class="summary-card">
            <span>Net Rental Yield</span>
            <strong>${escapeHtml(formatPercent(result.netRentalYieldPercent))}</strong>
          </div>
          <div class="summary-card">
            <span>${escapeHtml(monthlyCashFlowLabel)}</span>
            <strong class="${monthlyCashFlow < 0 ? "cash-flow-negative" : "cash-flow-positive"}">
              ${escapeHtml(formatCurrencyDetailed(result.monthlyCashFlow))}
            </strong>
          </div>
        </div>
      </section>

      <p class="disclaimer">
        Figures shown are estimates for discussion purposes only. Actual financing, rebates, benefits, package terms, legal costs, and final purchase documentation are subject to bank approval, developer approval, and the signed final documents.
      </p>
      ${renderCustomerPdfBranding(branding)}
    </main>
    ${proposalPage2}
  </body>
</html>`;
}

function createPackageItem(type: PackageItemType): EditablePackageItem {
  return {
    id: crypto.randomUUID(),
    type,
    description:
      type === "discount"
        ? "Developer Rebate"
        : type === "cash_benefit"
          ? "Cashback"
          : "Freebie",
    method: "percentage_spa",
    value: "",
    amount: "",
    treatment: "refund_later",
    receiveAt: "",
  };
}

function toPackageItem(item: EditablePackageItem): PurchasePackageItem {
  if (item.type === "discount") {
    return {
      id: item.id,
      type: "discount",
      description: item.description.trim() || "Discount",
      method: item.method,
      value: parseMoney(item.value),
    };
  }

  if (item.type === "cash_benefit") {
    return {
      id: item.id,
      type: "cash_benefit",
      description: item.description.trim() || "Cashback",
      amount: parseMoney(item.amount),
      treatment: item.treatment,
      receiveAt: item.receiveAt.trim() || undefined,
    };
  }

  return {
    id: item.id,
    type: "non_cash_benefit",
    description: item.description.trim() || "Freebie",
  };
}

function ResultRow({
  label,
  value,
  valueClassName = "text-zinc-900",
  rowClassName = "",
  children,
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
  rowClassName?: string;
  children?: React.ReactNode;
}>) {
  return (
    <div className={`border-b border-zinc-100 py-3 last:border-0 ${rowClassName}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className={`text-right text-sm font-semibold ${valueClassName}`}>{value}</p>
      </div>
      {children ? <div className="mt-1 text-xs leading-5 text-zinc-500">{children}</div> : null}
    </div>
  );
}

function getDefaultSavedWorkTitle(form: CalculatorForm) {
  return [form.projectName, form.unitNumber || form.unitType]
    .filter((value) => value.trim())
    .join(" - ") || "Unit Calculation";
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
            {mode === "save-as" ? "Save As" : "Save Unit Calculation"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Name this Unit Calculation so you can reopen and continue it later.
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

export default function RoiCalculatorPage() {
  const { displayName, phone } = useAppPermissions();
  const [form, setForm] = useState<CalculatorForm>({
    projectName: "",
    unitNumber: "",
    unitType: "",
    unitConfiguration: "",
    unitSizeSqft: "",
    carpark: "",
    calculationDate: getMalaysiaDateInputValue(),
    packageValidUntil: "",
    spaPrice: "",
    loanMarginPercent: "90",
    annualInterestRatePercent: "3.7",
    loanTenureYears: "35",
    expectedMonthlyRental: "",
    maintenanceRatePerSqft: "",
    otherUpfrontCosts: "0",
  });
  const [packageItems, setPackageItems] = useState<EditablePackageItem[]>([]);
  const [purchaseCosts, setPurchaseCosts] = useState<PurchaseCostItem[]>(defaultPurchaseCosts);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitTypes, setUnitTypes] = useState<ProjectUnitType[]>([]);
  const [unitTypesError, setUnitTypesError] = useState("");
  const [isLoadingUnitTypes, setIsLoadingUnitTypes] = useState(false);
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [commercialPackages, setCommercialPackages] = useState<CommercialPackage[]>([]);
  const [commercialPackagesError, setCommercialPackagesError] = useState("");
  const [isLoadingCommercialPackages, setIsLoadingCommercialPackages] = useState(false);
  const [selectedCommercialPackageId, setSelectedCommercialPackageId] = useState("");
  const [unitPresentation, setUnitPresentation] = useState<UnitPresentationSnapshot | null>(null);
  const [floorPlans, setFloorPlans] = useState<ProjectFloorPlan[]>([]);
  const [floorPlansError, setFloorPlansError] = useState("");
  const [isLoadingFloorPlans, setIsLoadingFloorPlans] = useState(false);
  const [manualFloorPlanId, setManualFloorPlanId] = useState("");
  const [manualStackId, setManualStackId] = useState("");
  const [savedFloorPlanPresentation, setSavedFloorPlanPresentation] =
    useState<FloorPlanPresentationSnapshot | null>(null);
  const [currentSavedWorkId, setCurrentSavedWorkId] = useState<string | null>(null);
  const [currentSavedWorkTitle, setCurrentSavedWorkTitle] = useState("");
  const [saveModalMode, setSaveModalMode] = useState<SaveModalMode | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [reopenWarning, setReopenWarning] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/projects", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load projects");

        return response.json() as Promise<ProjectOption[]>;
      })
      .then((data) => {
        setProjects(data);
        setProjectsError("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setProjectsError(error instanceof Error ? error.message : "Unable to load projects");
      });

    return () => controller.abort();
  }, []);

  const numericInput = useMemo(
    () => ({
      spaPrice: parseMoney(form.spaPrice),
      loanMarginPercent: parseMoney(form.loanMarginPercent),
      annualInterestRatePercent: parseMoney(form.annualInterestRatePercent),
      loanTenureYears: parseMoney(form.loanTenureYears),
      unitSizeSqft: parseMoney(form.unitSizeSqft),
      maintenanceRatePerSqft: parseMoney(form.maintenanceRatePerSqft),
      expectedMonthlyRental: parseMoney(form.expectedMonthlyRental),
      otherUpfrontCosts: parseMoney(form.otherUpfrontCosts),
    }),
    [form],
  );
  const baseResultForPurchaseCostEstimates = useMemo(
    () =>
      calculateRoi({
        ...numericInput,
        packageItems: packageItems.map(toPackageItem),
      }),
    [numericInput, packageItems],
  );
  const purchaseCostEstimates = useMemo(
    () =>
      getPurchaseCostEstimates(
        numericInput.spaPrice,
        baseResultForPurchaseCostEstimates.loanAmount,
      ),
    [numericInput.spaPrice, baseResultForPurchaseCostEstimates.loanAmount],
  );
  const resolvedPurchaseCosts = useMemo(
    () => resolvePurchaseCosts(purchaseCosts, purchaseCostEstimates),
    [purchaseCosts, purchaseCostEstimates],
  );
  const purchaseCostSummary = useMemo(
    () => calculatePurchaseCostSummary(resolvedPurchaseCosts),
    [resolvedPurchaseCosts],
  );
  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!Number.isFinite(numericInput.spaPrice) || numericInput.spaPrice <= 0) {
      messages.push("SPA Price must be more than RM 0.");
    }

    if (
      !Number.isFinite(numericInput.loanMarginPercent) ||
      numericInput.loanMarginPercent < 0 ||
      numericInput.loanMarginPercent > 100
    ) {
      messages.push("Loan Margin must be between 0% and 100%.");
    }

    if (
      !Number.isFinite(numericInput.annualInterestRatePercent) ||
      numericInput.annualInterestRatePercent < 0
    ) {
      messages.push("Interest Rate cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.loanTenureYears) ||
      numericInput.loanTenureYears <= 0
    ) {
      messages.push("Loan Tenure must be more than 0 years.");
    }

    if (!Number.isFinite(numericInput.unitSizeSqft) || numericInput.unitSizeSqft < 0) {
      messages.push("Unit Size cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.maintenanceRatePerSqft) ||
      numericInput.maintenanceRatePerSqft < 0
    ) {
      messages.push("Maintenance Rate cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.expectedMonthlyRental) ||
      numericInput.expectedMonthlyRental < 0
    ) {
      messages.push("Expected Monthly Rental cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.otherUpfrontCosts) ||
      numericInput.otherUpfrontCosts < 0
    ) {
      messages.push("Other Upfront Costs cannot be negative.");
    }

    for (const item of packageItems) {
      if (item.type === "discount") {
        const value = parseMoney(item.value);

        if (!Number.isFinite(value) || value < 0) {
          messages.push(`${item.description || "Discount"} must not be negative.`);
        }

        if (item.method !== "fixed" && value > 100) {
          messages.push(`${item.description || "Discount"} percentage cannot exceed 100%.`);
        }
      }

      if (item.type === "cash_benefit") {
        const amount = parseMoney(item.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          messages.push(`${item.description || "Cashback"} must not be negative.`);
        }
      }
    }

    for (const item of resolvedPurchaseCosts) {
      const amount = item.resolvedAmountNumber;

      if (item.treatment === "customer_pay" && !hasEnteredValue(item.resolvedAmount)) {
        messages.push(`${item.name} amount is required when Customer Pay is selected.`);
      }

      if (item.treatment !== "not_applicable" && hasEnteredValue(item.resolvedAmount)) {
        if (!Number.isFinite(amount) || amount < 0) {
          messages.push(`${item.name} amount must not be negative or invalid.`);
        }
      }

      if (
        item.treatment !== "not_applicable" &&
        item.source === "auto" &&
        item.estimate?.requiresManualConfirmation
      ) {
        messages.push(`${item.name} requires manual confirmation above RM 7,500,000.`);
      }
    }

    return messages;
  }, [numericInput, packageItems, resolvedPurchaseCosts]);
  const result = useMemo(
    () =>
      calculateRoi({
        ...numericInput,
        otherUpfrontCosts:
          numericInput.otherUpfrontCosts + purchaseCostSummary.customerPayPurchaseCosts,
        packageItems: packageItems.map(toPackageItem),
      }),
    [numericInput, packageItems, purchaseCostSummary.customerPayPurchaseCosts],
  );
  const hasBlockingValidation = validationMessages.length > 0;
  const cashFlowIsPositive = (result.monthlyCashFlow ?? 0) >= 0;
  const totalCashback = calculateTotalCashback(result);
  const monthlyCashFlowBreakdown = [
    `Rental ${formatCurrencyDetailed(numericInput.expectedMonthlyRental)}`,
    `− Loan Instalment ${formatCurrencyDetailed(result.estimatedMonthlyInstalment)}`,
    `− Maintenance ${formatCurrencyDetailed(result.monthlyMaintenance)}`,
    `= ${formatCurrencyDetailed(result.monthlyCashFlow)}`,
  ];
  const annualCashFlowExplanation =
    result.monthlyCashFlow !== null && result.annualCashFlow !== null
      ? `${formatCurrencyDetailed(result.monthlyCashFlow)} × 12 = ${formatCurrencyDetailed(result.annualCashFlow)}`
      : "Monthly Cash Flow × 12";

  function updateField(field: keyof CalculatorForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadUnitTypes(projectId: string) {
    setIsLoadingUnitTypes(true);
    setUnitTypesError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/unit-types?audience=customer`);

      if (!response.ok) {
        throw new Error("Unable to load Unit Types");
      }

      const data = (await response.json()) as ProjectUnitType[];
      setUnitTypes(data);
      return data;
    } catch (error) {
      setUnitTypes([]);
      setUnitTypesError(error instanceof Error ? error.message : "Unable to load Unit Types");
      return [];
    } finally {
      setIsLoadingUnitTypes(false);
    }
  }

  async function loadFloorPlans(projectId: string) {
    setIsLoadingFloorPlans(true);
    setFloorPlansError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/floor-plans?audience=customer`);

      if (!response.ok) {
        throw new Error("Unable to load Floor Plans");
      }

      const data = (await response.json()) as ProjectFloorPlan[];
      setFloorPlans(data);
      return data;
    } catch (error) {
      setFloorPlans([]);
      setFloorPlansError(error instanceof Error ? error.message : "Unable to load Floor Plans");
      return [];
    } finally {
      setIsLoadingFloorPlans(false);
    }
  }

  async function loadCommercialPackages(projectId: string) {
    setIsLoadingCommercialPackages(true);
    setCommercialPackagesError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/commercial-packages?audience=customer`,
      );

      if (!response.ok) throw new Error("Unable to load Sales Packages");

      const data = (await response.json()) as CommercialPackage[];
      setCommercialPackages(data);
      return data;
    } catch (error) {
      setCommercialPackages([]);
      setCommercialPackagesError(
        error instanceof Error ? error.message : "Unable to load Sales Packages",
      );
      return [];
    } finally {
      setIsLoadingCommercialPackages(false);
    }
  }

  function clearPackageConfiguration() {
    setSelectedCommercialPackageId("");
    setPackageItems([]);
    setPurchaseCosts(defaultPurchaseCosts.map((item) => ({ ...item })));
    updateField("packageValidUntil", "");
  }

  function applyCommercialPackage(commercialPackage: CommercialPackage) {
    setSelectedCommercialPackageId(commercialPackage.id);
    setPackageItems(packageItemsFromCommercialPackage(commercialPackage));
    setPurchaseCosts(purchaseCostsFromCommercialPackage(commercialPackage));
    updateField("packageValidUntil", commercialPackage.valid_until ?? "");
  }

  function resolveCommercialPackageForUnitType(
    unitTypeId: string,
    packages = commercialPackages,
  ) {
    const applicablePackages = packages.filter((commercialPackage) =>
      isPackageApplicable(commercialPackage, unitTypeId),
    );

    if (applicablePackages.length === 1) {
      applyCommercialPackage(applicablePackages[0]);
    } else {
      clearPackageConfiguration();
    }
  }

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedUnitTypeId("");
    setUnitTypes([]);
    setUnitTypesError("");
    setUnitPresentation(null);
    setFloorPlans([]);
    setFloorPlansError("");
    setManualFloorPlanId("");
    setManualStackId("");
    setSavedFloorPlanPresentation(null);
    setCommercialPackages([]);
    setCommercialPackagesError("");
    clearPackageConfiguration();

    const selectedProject = projects.find((project) => project.id === projectId);

    setForm((current) => ({
      ...current,
      projectName: selectedProject?.project_name ?? "",
      maintenanceRatePerSqft:
        selectedProject?.maintenance_fee_per_sqft === null ||
        selectedProject?.maintenance_fee_per_sqft === undefined
          ? ""
          : String(selectedProject.maintenance_fee_per_sqft),
      packageValidUntil: "",
    }));

    if (projectId) {
      void loadUnitTypes(projectId);
      void loadFloorPlans(projectId);
      void loadCommercialPackages(projectId);
    }
  }

  function applyUnitTypeSnapshot(unitType: ProjectUnitType) {
    const selectedProjectName =
      projects.find((project) => project.id === selectedProjectId)?.project_name ||
      form.projectName;
    const snapshot = getUnitPresentationSnapshot(selectedProjectName, unitType);

    setForm((current) => ({
      ...current,
      unitType: unitType.type_code || current.unitType,
      unitConfiguration: unitType.display_configuration || current.unitConfiguration,
      unitSizeSqft: unitType.size_sqft ? String(unitType.size_sqft) : current.unitSizeSqft,
      carpark: snapshot.carpark || current.carpark,
    }));
    setUnitPresentation(snapshot);
  }

  function handleUnitNumberChange(unitNumber: string) {
    updateField("unitNumber", unitNumber);
    setManualFloorPlanId("");
    setManualStackId("");
    setSavedFloorPlanPresentation(null);
  }

  function handleUnitTypeChange(unitTypeId: string) {
    setSelectedUnitTypeId(unitTypeId);
    setManualFloorPlanId("");
    setManualStackId("");
    setSavedFloorPlanPresentation(null);
    resolveCommercialPackageForUnitType(unitTypeId);

    const selectedUnitType = unitTypes.find((unitType) => unitType.id === unitTypeId);

    if (!selectedUnitType) {
      setUnitPresentation(null);
      return;
    }

    applyUnitTypeSnapshot(selectedUnitType);
  }

  const applicableCommercialPackages = useMemo(
    () =>
      selectedUnitTypeId
        ? commercialPackages.filter((commercialPackage) =>
            isPackageApplicable(commercialPackage, selectedUnitTypeId),
          )
        : [],
    [commercialPackages, selectedUnitTypeId],
  );

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const unitNumberFormat = getProjectUnitNumberFormat(selectedProject);
  const detectionState = useMemo(
    () =>
      buildDetectionState({
        unitNumber: form.unitNumber,
        format: unitNumberFormat,
        floorPlans,
        selectedUnitTypeId,
        manualFloorPlanId,
        manualStackId,
      }),
    [
      floorPlans,
      form.unitNumber,
      manualFloorPlanId,
      manualStackId,
      selectedUnitTypeId,
      unitNumberFormat,
    ],
  );
  const availableManualFloorPlans = useMemo(() => {
    if (!detectionState.parsed.detected) return floorPlans;

    const parsedMatches = getApplicableFloorPlans(floorPlans, detectionState.parsed);

    return parsedMatches.length > 0 ? parsedMatches : floorPlans;
  }, [detectionState.parsed, floorPlans]);
  const activeManualFloorPlan =
    availableManualFloorPlans.find((floorPlan) => floorPlan.id === manualFloorPlanId) ??
    detectionState.floorPlan ??
    null;
  const activeManualStacks = activeManualFloorPlan?.stacks ?? [];
  const confirmedFloorPlan =
    detectionState.requiresConfirmation && !manualStackId ? null : detectionState.floorPlan;
  const confirmedStack =
    detectionState.requiresConfirmation && !manualStackId ? null : detectionState.stack;
  const floorPlanPresentation = getFloorPlanPresentationSnapshot(
    confirmedFloorPlan,
    confirmedStack,
  ) ?? savedFloorPlanPresentation;
  const selectedFacing = floorPlanPresentation?.facing ?? null;
  const selectedFacingViewTypeLabel = getFacingViewTypeLabel(selectedFacing?.view_type ?? null);

  async function getFreshUnitPresentationForExport() {
    if (!selectedProjectId || !selectedUnitTypeId) return unitPresentation;

    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/unit-types?audience=customer`,
      );

      if (!response.ok) return unitPresentation;

      const data = (await response.json()) as ProjectUnitType[];
      const freshUnitType = data.find((unitType) => unitType.id === selectedUnitTypeId);

      if (!freshUnitType) return unitPresentation;

      const selectedProjectName =
        projects.find((project) => project.id === selectedProjectId)?.project_name ||
        form.projectName;

      if (unitPresentation) {
        return {
          ...unitPresentation,
          projectName: unitPresentation.projectName || selectedProjectName,
          layout: freshUnitType.layout,
        };
      }

      return getUnitPresentationSnapshot(selectedProjectName, freshUnitType);
    } catch {
      return unitPresentation;
    }
  }

  async function getFreshFloorPlanPresentationForExport() {
    if (!selectedProjectId) return floorPlanPresentation;

    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/floor-plans?audience=customer`,
      );

      if (!response.ok) return floorPlanPresentation;

      const freshFloorPlans = (await response.json()) as ProjectFloorPlan[];
      const freshDetectionState = buildDetectionState({
        unitNumber: form.unitNumber,
        format: unitNumberFormat,
        floorPlans: freshFloorPlans,
        selectedUnitTypeId,
        manualFloorPlanId,
        manualStackId,
      });
      const freshConfirmedFloorPlan =
        freshDetectionState.requiresConfirmation && !manualStackId
          ? null
          : freshDetectionState.floorPlan;
      const freshConfirmedStack =
        freshDetectionState.requiresConfirmation && !manualStackId
          ? null
          : freshDetectionState.stack;

      return getFloorPlanPresentationSnapshot(freshConfirmedFloorPlan, freshConfirmedStack);
    } catch {
      return floorPlanPresentation;
    }
  }

  function updatePackageItem(
    id: string,
    updates: Partial<EditablePackageItem>,
  ) {
    setPackageItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removePackageItem(id: string) {
    setPackageItems((current) => current.filter((item) => item.id !== id));
  }

  function addPackageItem(type: PackageItemType) {
    setPackageItems((current) => [...current, createPackageItem(type)]);
  }

  function updatePurchaseCost(
    id: string,
    updates: Partial<Pick<PurchaseCostItem, "treatment" | "amount" | "source">>,
  ) {
    setPurchaseCosts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function resetPurchaseCostToAuto(id: string) {
    setPurchaseCosts((current) =>
      current.map((item) =>
        item.id === id && item.estimateKey
          ? {
              ...item,
              amount: "",
              source:
                defaultPurchaseCosts.find((purchaseCost) => purchaseCost.id === item.id)
                  ?.source ?? "auto",
            }
          : item,
      ),
    );
  }

  function buildRoiSavedWorkPayload(): RoiSavedWorkPayloadV1 {
    return {
      tool: "roi",
      schemaVersion: roiSavedWorkSchemaVersion,
      form,
      packageItems,
      purchaseCosts,
      projectReference: {
        selectedProjectId,
        selectedUnitTypeId,
        manualFloorPlanId,
        manualStackId,
      },
      snapshots: {
        unitPresentation: sanitizeUnitPresentationSnapshot(unitPresentation),
        floorPlanPresentation: sanitizeFloorPlanPresentationSnapshot(floorPlanPresentation),
      },
    };
  }

  async function saveRoiWork(title: string, savedWorkId: string | null) {
    const trimmedTitle = title.trim();

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
                  payload: buildRoiSavedWorkPayload(),
                  schemaVersion: roiSavedWorkSchemaVersion,
                }
              : {
                  title: trimmedTitle,
                  workType: "roi",
                  payload: buildRoiSavedWorkPayload(),
                  schemaVersion: roiSavedWorkSchemaVersion,
                },
          ),
        },
      );
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "Unable to save Unit Calculation");
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
    setSaveTitle(mode === "save-as" ? `${getDefaultSavedWorkTitle(form)} Copy` : getDefaultSavedWorkTitle(form));
    setSaveMessage("");
    setSaveStatus("idle");
  }

  function handleSaveClick() {
    if (currentSavedWorkId) {
      void saveRoiWork(currentSavedWorkTitle || getDefaultSavedWorkTitle(form), currentSavedWorkId);
      return;
    }

    openSaveModal("new");
  }

  function hydrateSavedRoiPayload(payload: RoiSavedWorkPayloadV1) {
    setForm(payload.form);
    setPackageItems(payload.packageItems);
    setPurchaseCosts(payload.purchaseCosts.length ? payload.purchaseCosts : defaultPurchaseCosts);
    setSelectedProjectId(payload.projectReference.selectedProjectId);
    setSelectedUnitTypeId(payload.projectReference.selectedUnitTypeId);
    setManualFloorPlanId(payload.projectReference.manualFloorPlanId);
    setManualStackId(payload.projectReference.manualStackId);
    setUnitPresentation(restoreUnitPresentationSnapshot(payload.snapshots.unitPresentation));
    setSavedFloorPlanPresentation(
      restoreFloorPlanPresentationSnapshot(payload.snapshots.floorPlanPresentation),
    );
    setUnitTypes([]);
    setUnitTypesError("");
    setFloorPlans([]);
    setFloorPlansError("");
  }

  async function reconnectSavedRoiReferences(payload: RoiSavedWorkPayloadV1) {
    const { selectedProjectId: projectId, selectedUnitTypeId: unitTypeId } =
      payload.projectReference;

    if (!projectId) return;

    const [freshUnitTypes] = await Promise.all([
      loadUnitTypes(projectId),
      loadFloorPlans(projectId),
    ]);
    const freshUnitType = freshUnitTypes.find((unitType) => unitType.id === unitTypeId);

    if (freshUnitType && payload.snapshots.unitPresentation) {
      setUnitPresentation(
        restoreUnitPresentationSnapshot(payload.snapshots.unitPresentation, freshUnitType),
      );
      return;
    }

    if (unitTypeId) {
      setReopenWarning("Current Unit Type reference is unavailable. Saved Unit Calculation values were preserved.");
    }
  }

  async function openSavedRoi(savedWorkId: string) {
    setReopenWarning("");

    try {
      const response = await fetch(`/api/saved-work/${savedWorkId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "This saved work could not be opened.");
      }

      if (data.savedWork.workType !== "roi") {
        throw new Error("This saved Unit Calculation version cannot be opened.");
      }

      const validated = validateRoiSavedWorkPayload(data.savedWork.payload);

      if (!validated.valid) {
        throw new Error(validated.error);
      }

      hydrateSavedRoiPayload(validated.payload);
      setCurrentSavedWorkId(data.savedWork.id);
      setCurrentSavedWorkTitle(data.savedWork.title);
      setSaveStatus("saved");
      setSaveMessage("Saved Work opened");

      await reconnectSavedRoiReferences(validated.payload);
    } catch (error) {
      setReopenWarning(
        error instanceof Error ? error.message : "This saved work could not be opened.",
      );
      setCurrentSavedWorkId(null);
      setCurrentSavedWorkTitle("");
    }
  }

  useEffect(() => {
    const savedWorkId = new URL(window.location.href).searchParams.get("savedWork");

    if (savedWorkId) {
      const timeoutId = window.setTimeout(() => void openSavedRoi(savedWorkId), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
    // Run only once so normal editing after reopen is never rehydrated over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExportPdf() {
    if (hasBlockingValidation) return;

    const [freshUnitPresentation, freshFloorPlanPresentation] = await Promise.all([
      getFreshUnitPresentationForExport(),
      getFreshFloorPlanPresentationForExport(),
    ]);
    const proposalWindow = window.open("", "_blank");

    if (!proposalWindow) {
      window.alert("Please allow pop-ups to preview and export the PDF.");
      return;
    }

    proposalWindow.document.open();
    proposalWindow.document.write(
      buildRoiProposalHtml({
        form,
        numericInput,
        result,
        branding: {
          agentName: displayName,
          agentPhone: phone,
        },
        unitPresentation: freshUnitPresentation,
        floorPlanPresentation: freshFloorPlanPresentation,
        purchaseCosts: resolvedPurchaseCosts,
        packageItems,
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();

    printWhenImagesAreReady(proposalWindow);
  }

  return (
    <>
      <main className="bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader
          eyebrow="Unit Calculation"
          title="Unit Calculation"
          description="Build a clean purchase package, financing summary and investment view for a selected unit."
          className="p-5 sm:p-6 [&_h1]:text-3xl [&_h1]:sm:text-4xl"
          meta={
            <div className="flex flex-col gap-2 text-xs text-[var(--falcon-muted-text)]">
              {currentSavedWorkTitle ? (
                <p className="truncate">
                  Saved Work:{" "}
                  <span className="font-semibold text-[var(--falcon-charcoal)]">
                    {currentSavedWorkTitle}
                  </span>
                </p>
              ) : null}
              {saveMessage ? (
                <p
                  className={`font-semibold ${
                    saveStatus === "error" ? "text-amber-700" : "text-[#087F6B]"
                  }`}
                >
                  {saveMessage}
                </p>
              ) : null}
            </div>
          }
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                onClick={handleSaveClick}
                disabled={saveStatus === "saving"}
                className="w-full sm:w-auto"
              >
                {saveStatus === "saving" ? "Saving..." : "Save"}
              </Button>
              {currentSavedWorkId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => openSaveModal("save-as")}
                  disabled={saveStatus === "saving"}
                  className="w-full sm:w-auto"
                >
                  Save As
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={handleExportPdf}
                disabled={hasBlockingValidation}
                className="w-full sm:w-auto"
              >
                Export PDF
              </Button>
            </div>
          }
        />

        {reopenWarning ? (
          <section className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
            {reopenWarning}
          </section>
        ) : null}

        {hasBlockingValidation ? (
          <section className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
            <p className="font-semibold">Check these inputs before presenting:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.72fr)]">
          <div className="space-y-5">
            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="Project Defaults"
                description="Optional project data can prefill presentation fields. Manual entry remains available."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Project
                  </span>
                  <select
                    value={selectedProjectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                  >
                    <option value="">Manual entry</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_name}
                      </option>
                    ))}
                  </select>
                  {projectsError ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      {projectsError}. Manual entry is still available.
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Type
                  </span>
                  <select
                    value={selectedUnitTypeId}
                    onChange={(event) => handleUnitTypeChange(event.target.value)}
                    disabled={
                      !selectedProjectId || isLoadingUnitTypes || isLoadingCommercialPackages
                    }
                    className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {selectedProjectId
                        ? isLoadingUnitTypes
                          ? "Loading Unit Types..."
                          : "Select Unit Type"
                        : "Select Project first"}
                    </option>
                    {unitTypes.map((unitType) => (
                      <option key={unitType.id} value={unitType.id}>
                        {getUnitTypeLabel(unitType) || unitType.type_code}
                      </option>
                    ))}
                  </select>
                  {unitTypesError ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      {unitTypesError}. Manual entry is still available.
                    </span>
                  ) : null}
                  {selectedProjectId && !isLoadingUnitTypes && !unitTypesError && unitTypes.length === 0 ? (
                    <span className="mt-1 block text-xs text-zinc-500">
                      No Unit Types found for this project yet. Manual entry is still available.
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Sales Package
                  </span>
                  <select
                    value={selectedCommercialPackageId}
                    onChange={(event) => {
                      const commercialPackage = applicableCommercialPackages.find(
                        (item) => item.id === event.target.value,
                      );

                      if (commercialPackage) applyCommercialPackage(commercialPackage);
                      else clearPackageConfiguration();
                    }}
                    disabled={
                      !selectedUnitTypeId ||
                      isLoadingCommercialPackages ||
                      applicableCommercialPackages.length === 0
                    }
                    className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {!selectedUnitTypeId
                        ? "Select Unit Type first"
                        : isLoadingCommercialPackages
                          ? "Loading Sales Packages..."
                          : applicableCommercialPackages.length === 0
                            ? "No applicable package"
                            : "Select Sales Package"}
                    </option>
                    {applicableCommercialPackages.map((commercialPackage) => (
                      <option key={commercialPackage.id} value={commercialPackage.id}>
                        {commercialPackage.package_name}
                      </option>
                    ))}
                  </select>
                  {commercialPackagesError ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      {commercialPackagesError}. Manual package entry is still available.
                    </span>
                  ) : selectedUnitTypeId && applicableCommercialPackages.length > 1 ? (
                    <span className="mt-1 block text-xs text-zinc-500">
                      Choose the package to use for this calculation.
                    </span>
                  ) : selectedCommercialPackageId ? (
                    <span className="mt-1 block text-xs text-emerald-700">
                      Project package applied. Changes here remain local.
                      {applicableCommercialPackages.find(
                        (item) => item.id === selectedCommercialPackageId,
                      )?.customer_description
                        ? ` ${applicableCommercialPackages.find(
                            (item) => item.id === selectedCommercialPackageId,
                          )?.customer_description}`
                        : ""}
                    </span>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="Property & Unit"
                description="Keep the presentation details accurate for the customer proposal."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Project Name
                  </span>
                  <input
                    value={form.projectName}
                    onChange={(event) => updateField("projectName", event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.projectName.trim())}`}
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Number
                  </span>
                  <input
                    value={form.unitNumber}
                    onChange={(event) => handleUnitNumberChange(event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.unitNumber.trim())}`}
                    placeholder="Optional"
                  />
                </label>
                {selectedProjectId ? (
                  <div className="rounded-[22px] border border-[#e4d7b8] bg-[#fbf8ef] p-4 text-sm shadow-sm md:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-zinc-900">Floor Plan Detection</p>
                          <StatusBadge
                            variant={
                              detectionState.status === "auto" || detectionState.status === "manual"
                                ? "success"
                                : detectionState.status === "mismatch" || detectionState.status === "conflict"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {getDetectionLabel(detectionState.status)}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {detectionState.message}
                        </p>
                        {detectionState.parsed.detected ? (
                          <p className="mt-2 text-xs text-zinc-500">
                            Parsed:{" "}
                            {detectionState.parsed.towerCode
                              ? `Tower ${detectionState.parsed.towerCode} · `
                              : ""}
                            Floor {detectionState.parsed.floor} · Stack{" "}
                            {detectionState.parsed.stackCode}
                          </p>
                        ) : null}
                      </div>

                      {isLoadingFloorPlans ? (
                        <p className="text-xs text-zinc-500">Loading Floor Plans...</p>
                      ) : floorPlansError ? (
                        <p className="text-xs text-amber-700">
                          {floorPlansError}. Manual proposal entry still works.
                        </p>
                      ) : null}
                    </div>

                    {detectionState.floorPlan && detectionState.stack && !detectionState.requiresConfirmation ? (
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-white px-3 py-2">
                        <p className="text-xs font-medium text-zinc-500">Auto highlight</p>
                        <p className="mt-1 font-semibold text-zinc-900">
                          {getFloorPlanLabel(detectionState.floorPlan)} · Stack{" "}
                          {detectionState.stack.stack_code}
                        </p>
                      </div>
                    ) : null}

                    {selectedFacing ? (
                      <div className="mt-3 rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-3 py-2">
                        <p className="text-xs font-medium text-zinc-500">Facing / View</p>
                        <p className="mt-1 font-semibold text-zinc-900">
                          {selectedFacing.name}
                        </p>
                        {selectedFacingViewTypeLabel ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {selectedFacingViewTypeLabel}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {floorPlans.length > 0 ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block text-xs font-medium text-zinc-600">
                          <span className="mb-1 block">Manual Floor Plan</span>
                          <select
                            value={manualFloorPlanId}
                            onChange={(event) => {
                              setManualFloorPlanId(event.target.value);
                              setManualStackId("");
                              setSavedFloorPlanPresentation(null);
                            }}
                            className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--falcon-gold-dark)]"
                          >
                            <option value="">
                              {detectionState.floorPlan
                                ? "Use auto-detected Floor Plan"
                                : "Select Floor Plan"}
                            </option>
                            {availableManualFloorPlans.map((floorPlan) => (
                              <option key={floorPlan.id} value={floorPlan.id}>
                                {floorPlan.name} · {getFloorPlanLabel(floorPlan)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-medium text-zinc-600">
                          <span className="mb-1 block">Manual Stack</span>
                          <select
                            value={manualStackId}
                            onChange={(event) => {
                              setManualStackId(event.target.value);
                              setSavedFloorPlanPresentation(null);
                            }}
                            disabled={!activeManualFloorPlan}
                            className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--falcon-gold-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">
                              {detectionState.stack && !detectionState.requiresConfirmation
                                ? `Use auto-detected Stack ${detectionState.stack.stack_code}`
                                : "Select Stack"}
                            </option>
                            {activeManualStacks.map((stack) => (
                              <option key={stack.id} value={stack.id}>
                                {stack.stack_code}
                                {stack.unit_type ? ` · ${getMappedUnitTypeLabel(stack.unit_type)}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Type
                  </span>
                  <input
                    value={form.unitType}
                    onChange={(event) => updateField("unitType", event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.unitType.trim())}`}
                    placeholder="e.g. 3 Bedrooms"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Configuration
                  </span>
                  <input
                    value={form.unitConfiguration}
                    onChange={(event) => updateField("unitConfiguration", event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.unitConfiguration.trim())}`}
                    placeholder="e.g. 3R2B"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Calculation Date
                  </span>
                  <input
                    type="date"
                    value={form.calculationDate}
                    onChange={(event) =>
                      updateField("calculationDate", event.target.value)
                    }
                    className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Size
                  </span>
                  <div
                    className={`flex rounded-2xl border transition focus-within:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.unitSizeSqft.trim(), hasEnteredValue(form.unitSizeSqft) && (!Number.isFinite(numericInput.unitSizeSqft) || numericInput.unitSizeSqft < 0))}`}
                  >
                    <input
                      inputMode="decimal"
                      value={form.unitSizeSqft}
                      onChange={(event) => updateField("unitSizeSqft", event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
                      placeholder="950"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
                      sqft
                    </span>
                  </div>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Carpark
                  </span>
                  <input
                    value={form.carpark}
                    onChange={(event) => updateField("carpark", event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.carpark.trim())}`}
                    placeholder="e.g. 2 car parks"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[26px] border border-[#d8c48e] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="SPA Price"
                description="Main loan and statutory calculation basis."
              />
              <label className="mt-4 block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">
                  SPA Price
                </span>
                <input
                  inputMode="decimal"
                  value={form.spaPrice}
                  onChange={(event) => updateField("spaPrice", event.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-lg font-semibold outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.spaPrice.trim(), hasEnteredValue(form.spaPrice) && (!Number.isFinite(numericInput.spaPrice) || numericInput.spaPrice <= 0))}`}
                  placeholder="500000"
                />
              </label>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 xl:max-w-[520px]">
                  <h2 className="text-lg font-semibold text-zinc-950">
                    Discounts & Benefits
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                    Discounts are applied in order. Cashback affects final price, not Nett Price.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end xl:w-auto xl:justify-end">
                  <label className="block min-w-[180px] text-sm text-zinc-600">
                    <span className="mb-1 block text-xs font-semibold text-[#9A6B1F]">
                      Package Valid Until
                    </span>
                    <input
                      type="date"
                      value={form.packageValidUntil}
                      onChange={(event) =>
                        updateField("packageValidUntil", event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[#d8c18d] focus:bg-white"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {(["discount", "cash_benefit", "non_cash_benefit"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addPackageItem(type)}
                          className="rounded-full border border-[var(--falcon-soft-border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-[#d8c48e] hover:bg-[#fbf8ef]"
                        >
                          {getPackageAddLabel(type)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {(["discount", "cash_benefit", "non_cash_benefit"] as const).map(
                  (type) => {
                    const items = packageItems.filter((item) => item.type === type);

                    return (
                      <div key={type} className="rounded-[22px] border border-[var(--falcon-soft-border)] bg-[#fbfaf7] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {getPackageGroupTitle(type)}
                          </h3>
                          <span className="text-xs font-medium text-zinc-500">
                            {items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Optional"}
                          </span>
                        </div>

                        {items.length === 0 ? (
                          <p className="mt-3 text-sm text-zinc-500">
                            Add {type === "discount" ? "a discount" : type === "cash_benefit" ? "cashback" : "a freebie"} if this package includes one.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {items.map((item) => {
                              const discountValue = parseMoney(item.value);
                              const cashBenefitAmount = parseMoney(item.amount);
                              const discountValueIsInvalid =
                                hasEnteredValue(item.value) &&
                                (!Number.isFinite(discountValue) ||
                                  discountValue < 0 ||
                                  (item.method !== "fixed" && discountValue > 100));
                              const cashBenefitAmountIsInvalid =
                                hasEnteredValue(item.amount) &&
                                (!Number.isFinite(cashBenefitAmount) || cashBenefitAmount < 0);

                              return (
                                <div
                                  key={item.id}
                                  className="grid gap-3 rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-3 shadow-[0_8px_20px_rgba(23,23,23,0.03)] lg:grid-cols-[minmax(0,1fr)_minmax(170px,auto)] lg:items-end"
                                >
                                  <label className="block text-sm text-zinc-600 lg:col-span-2">
                                    <span className="mb-1 block font-medium text-zinc-900">
                                      Description
                                    </span>
                                    <input
                                      value={item.description}
                                      onChange={(event) =>
                                        updatePackageItem(item.id, {
                                          description: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                                      placeholder={getPackageDescriptionPlaceholder(item.type)}
                                    />
                                  </label>

                                  {item.type === "discount" ? (
                                    <div className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(110px,0.7fr)]">
                                      <label className="block text-sm text-zinc-600">
                                        <span className="mb-1 block font-medium text-zinc-900">
                                          Method
                                        </span>
                                        <select
                                          value={item.method}
                                          onChange={(event) =>
                                            updatePackageItem(item.id, {
                                              method: event.target.value as DiscountMethod,
                                            })
                                          }
                                          className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                                        >
                                          <option value="percentage_spa">% of SPA</option>
                                          <option value="percentage_previous_balance">% of Balance</option>
                                          <option value="fixed">Fixed RM</option>
                                        </select>
                                      </label>
                                      <label className="block text-sm text-zinc-600">
                                        <span className="mb-1 block font-medium text-zinc-900">
                                          {item.method === "fixed" ? "Value (RM)" : "Value (%)"}
                                        </span>
                                        <input
                                          inputMode="decimal"
                                          value={item.value}
                                          onChange={(event) =>
                                            updatePackageItem(item.id, {
                                              value: event.target.value,
                                            })
                                          }
                                          className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!hasEnteredValue(item.value), discountValueIsInvalid)}`}
                                          placeholder={item.method === "fixed" ? "30000" : "10"}
                                        />
                                      </label>
                                    </div>
                                  ) : null}

                                  {item.type === "cash_benefit" ? (
                                    <div className="grid gap-3 sm:grid-cols-[minmax(110px,0.75fr)_minmax(150px,1fr)]">
                                      <label className="block text-sm text-zinc-600">
                                        <span className="mb-1 block font-medium text-zinc-900">
                                          Amount
                                        </span>
                                        <input
                                          inputMode="decimal"
                                          value={item.amount}
                                          onChange={(event) =>
                                            updatePackageItem(item.id, {
                                              amount: event.target.value,
                                            })
                                          }
                                          className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!hasEnteredValue(item.amount), cashBenefitAmountIsInvalid)}`}
                                          placeholder="30000"
                                        />
                                      </label>
                                      <label className="block text-sm text-zinc-600">
                                        <span className="mb-1 block font-medium text-zinc-900">
                                          Timing
                                        </span>
                                        <select
                                          value={item.treatment}
                                          onChange={(event) =>
                                            updatePackageItem(item.id, {
                                              treatment: event.target.value as CashBenefitTreatment,
                                            })
                                          }
                                          className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                                        >
                                          <option value="immediate_offset">Immediate Offset</option>
                                          <option value="refund_later">Refund Later</option>
                                        </select>
                                      </label>
                                      {item.treatment === "refund_later" ? (
                                        <label className="block text-sm text-zinc-600 sm:col-span-2">
                                          <span className="mb-1 block font-medium text-zinc-900">
                                            Refund At
                                          </span>
                                          <input
                                            value={item.receiveAt}
                                            onChange={(event) =>
                                              updatePackageItem(item.id, {
                                                receiveAt: event.target.value,
                                              })
                                            }
                                            className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                                            placeholder="Stage 2B, VP, upon loan disbursement"
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {item.type === "non_cash_benefit" ? (
                                    <label className="block text-sm text-zinc-600">
                                      <span className="mb-1 block font-medium text-zinc-900">
                                        Value
                                      </span>
                                      <input
                                        inputMode="decimal"
                                        value={item.amount}
                                        onChange={(event) =>
                                          updatePackageItem(item.id, {
                                            amount: event.target.value,
                                          })
                                        }
                                        className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                                        placeholder="Optional RM value"
                                      />
                                    </label>
                                  ) : null}

                                  <div className="flex min-w-[150px] items-center justify-between gap-3 lg:justify-end">
                                    <div className="text-left lg:text-right">
                                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                                        Effect
                                      </p>
                                      <p className="mt-1 text-sm font-semibold text-zinc-900">
                                        {getPackageItemEffectLabel(item, result)}
                                      </p>
                                      {item.type === "discount" ? (
                                        <p className="mt-1 text-xs text-zinc-500">
                                          {formatDiscountValue(item.method, item.value)} · {getDiscountMethodLabel(item.method)}
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removePackageItem(item.id)}
                                      className="rounded-full border border-red-100 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-800"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="Purchase Costs"
                description="Enter confirmed package costs. Only Customer Pay rows affect total cash required."
              />

              <div className="mt-4 space-y-3">
                {resolvedPurchaseCosts.map((item) => {
                  const amount = item.resolvedAmountNumber;
                  const amountIsInvalid =
                    hasEnteredValue(item.resolvedAmount) &&
                    (!Number.isFinite(amount) || amount < 0);
                  const amountIsPending =
                    item.treatment === "customer_pay" && !hasEnteredValue(item.resolvedAmount);
                  const freeAmountNeedsConfirmation =
                    item.treatment === "developer_absorbed" &&
                    !hasEnteredValue(item.resolvedAmount);
                  const needsManualEstimateConfirmation =
                    item.source === "auto" &&
                    item.treatment !== "not_applicable" &&
                    item.estimate?.requiresManualConfirmation;

                  return (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] p-3 md:grid-cols-2"
                    >
                      <div className="min-w-0 md:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900">
                            {item.name}
                          </p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              item.source === "auto" || item.source === "estimate"
                                ? "border-[#d8c48e] bg-white text-[var(--falcon-gold-dark)]"
                                : "border-[var(--falcon-soft-border)] bg-white text-zinc-600"
                            }`}
                          >
                            {item.source === "auto"
                              ? "Auto"
                              : item.source === "estimate"
                                ? "Estimate"
                                : "Manual"}
                          </span>
                          {item.source === "manual" && item.estimateKey ? (
                            <button
                              type="button"
                              onClick={() => resetPurchaseCostToAuto(item.id)}
                              className="text-xs font-semibold text-[#087F6B] hover:text-[#066a59]"
                            >
                              Reset to{" "}
                              {defaultPurchaseCosts.find(
                                (purchaseCost) => purchaseCost.id === item.id,
                              )?.source === "estimate"
                                ? "Estimate"
                                : "Auto"}
                            </button>
                          ) : null}
                        </div>
                        {item.id === "mot-transfer-stamp-duty" ? (
                          <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-[#FFF9E8] px-2.5 py-1 text-xs font-bold text-[#9A6B1F]">
                            Only payable after VP
                          </p>
                        ) : null}
                        {item.estimate?.note &&
                        (item.source === "auto" || item.source === "estimate") ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {item.estimate.note}
                          </p>
                        ) : null}
                        {freeAmountNeedsConfirmation ? (
                          <p className="mt-1 text-xs text-amber-700">
                            Add amount if you want to show the absorbed value.
                          </p>
                        ) : null}
                      </div>

                      <label className="block text-sm text-zinc-600">
                        <span className="sr-only">Treatment</span>
                        <select
                          value={item.treatment}
                          onChange={(event) =>
                            updatePurchaseCost(item.id, {
                              treatment: event.target.value as PurchaseCostTreatment,
                            })
                          }
                          className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(false)}`}
                        >
                          <option value="customer_pay">Customer Pay</option>
                          <option value="developer_absorbed">FREE / Developer Absorbed</option>
                          <option value="not_applicable">N/A</option>
                        </select>
                      </label>

                      <label className="block text-sm text-zinc-600">
                        <span className="sr-only">Amount</span>
                        <div
                          className={`flex rounded-2xl border ${
                            item.treatment === "not_applicable"
                              ? "border-zinc-200 bg-zinc-100 opacity-60"
                              : getPendingInputClass(amountIsPending || freeAmountNeedsConfirmation, amountIsInvalid)
                          }`}
                        >
                          <span className="border-r border-zinc-200 px-3 py-2.5 text-zinc-500">
                            RM
                          </span>
                          <input
                            inputMode="decimal"
                            value={item.resolvedAmount}
                            disabled={item.treatment === "not_applicable"}
                            onChange={(event) =>
                              updatePurchaseCost(item.id, {
                                amount: event.target.value,
                                source: "manual",
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none disabled:cursor-not-allowed"
                            placeholder={item.treatment === "not_applicable" ? "N/A" : "0"}
                          />
                        </div>
                        {needsManualEstimateConfirmation ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            Edit the amount to confirm manually.
                          </span>
                        ) : null}
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="Financing & Rental"
                description="Assumptions for instalment, cash flow and yield."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Loan Margin %
                  </span>
                    <input
                      inputMode="decimal"
                      value={form.loanMarginPercent}
                      onChange={(event) =>
                        updateField("loanMarginPercent", event.target.value)
                      }
                      className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.loanMarginPercent.trim(), hasEnteredValue(form.loanMarginPercent) && (!Number.isFinite(numericInput.loanMarginPercent) || numericInput.loanMarginPercent < 0 || numericInput.loanMarginPercent > 100))}`}
                    />
                  </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Interest Rate %
                  </span>
                    <input
                      inputMode="decimal"
                      value={form.annualInterestRatePercent}
                      onChange={(event) =>
                        updateField("annualInterestRatePercent", event.target.value)
                      }
                      className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.annualInterestRatePercent.trim(), hasEnteredValue(form.annualInterestRatePercent) && (!Number.isFinite(numericInput.annualInterestRatePercent) || numericInput.annualInterestRatePercent < 0))}`}
                    />
                  </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Loan Tenure
                  </span>
                  <div className={`flex rounded-2xl border transition focus-within:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.loanTenureYears.trim(), hasEnteredValue(form.loanTenureYears) && (!Number.isFinite(numericInput.loanTenureYears) || numericInput.loanTenureYears <= 0))}`}>
                    <input
                      inputMode="decimal"
                      value={form.loanTenureYears}
                      onChange={(event) =>
                        updateField("loanTenureYears", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2.5 text-zinc-500">
                      years
                    </span>
                  </div>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Expected Monthly Rental
                  </span>
                    <input
                      inputMode="decimal"
                      value={form.expectedMonthlyRental}
                      onChange={(event) =>
                        updateField("expectedMonthlyRental", event.target.value)
                      }
                      className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.expectedMonthlyRental.trim(), hasEnteredValue(form.expectedMonthlyRental) && (!Number.isFinite(numericInput.expectedMonthlyRental) || numericInput.expectedMonthlyRental < 0))}`}
                      placeholder="2500"
                    />
                  </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Maintenance Rate
                  </span>
                  <div className={`flex rounded-2xl border transition focus-within:border-[var(--falcon-gold-dark)] ${getPendingInputClass(!form.maintenanceRatePerSqft.trim(), hasEnteredValue(form.maintenanceRatePerSqft) && (!Number.isFinite(numericInput.maintenanceRatePerSqft) || numericInput.maintenanceRatePerSqft < 0))}`}>
                    <span className="border-r border-zinc-200 px-3 py-2.5 text-zinc-500">
                      RM
                    </span>
                    <input
                      inputMode="decimal"
                      value={form.maintenanceRatePerSqft}
                      onChange={(event) =>
                        updateField("maintenanceRatePerSqft", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
                      placeholder="0.35"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2.5 text-zinc-500">
                      /psf
                    </span>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-500">
                    Including sinking fund
                  </span>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Other Upfront Costs
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.otherUpfrontCosts}
                    onChange={(event) =>
                      updateField("otherUpfrontCosts", event.target.value)
                    }
                    className={`w-full rounded-2xl border px-3 py-2.5 outline-none transition focus:border-[var(--falcon-gold-dark)] ${getPendingInputClass(false, hasEnteredValue(form.otherUpfrontCosts) && (!Number.isFinite(numericInput.otherUpfrontCosts) || numericInput.otherUpfrontCosts < 0))}`}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section
              className={`rounded-[26px] border p-5 shadow-sm sm:p-6 ${
                cashFlowIsPositive
                  ? "border-emerald-200 bg-[#f1fbf8]"
                  : "border-rose-200 bg-[#fff7f7]"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-muted-text)]">
                Estimated Monthly Cash Flow
              </p>
              <p className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${
                cashFlowIsPositive ? "text-[#087F6B]" : "text-[#8B3A3A]"
              }`}>
                {formatCurrencyDetailed(result.monthlyCashFlow)}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Rental minus maintenance and estimated instalment.
              </p>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Customer Summary" />
              <div className="mt-4 rounded-[22px] border border-[var(--falcon-soft-border)] bg-[#fbfaf7] p-4">
                <p className="font-semibold text-zinc-950">
                  {form.projectName || "Property Calculation"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {[
                    form.unitNumber,
                    form.unitType,
                    form.unitConfiguration,
                    form.unitSizeSqft ? `${form.unitSizeSqft} sqft` : "",
                  ]
                    .filter(Boolean)
                    .join(" - ") || "Unit details optional"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Calculation Date: {form.calculationDate || "-"}
                </p>
              </div>

              <div className="mt-4">
                <ResultRow label="SPA Price" value={formatCurrency(result.spaPrice)} />
                <ResultRow label="Nett Price" value={formatCurrency(result.nettPrice)} />
                <ResultRow
                  label="Final Price After Benefits"
                  value={formatCurrency(result.finalPriceAfterBenefits)}
                  valueClassName="text-xl font-bold text-[#087F6B]"
                />
                <ResultRow
                  label="Total Cashback"
                  value={formatCurrency(totalCashback)}
                  valueClassName="font-bold text-[#1E4E79]"
                />
                <ResultRow
                  label="Total Savings"
                  value={formatCurrencyDetailed(purchaseCostSummary.developerAbsorbedPurchaseCosts)}
                  valueClassName="text-xl font-bold text-[#087F6B]"
                  rowClassName="mt-3 rounded-2xl border border-[#b7e6dc] bg-[#f1fbf8] px-4 py-3"
                />
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Purchase Package" />
              <div className="mt-4 space-y-3">
                {result.processedDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {discount.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {(() => {
                        const source = packageItems.find((item) => item.id === discount.id);
                        return source
                          ? `${formatDiscountValue(source.method, source.value)} · -${formatCurrency(discount.amount)}`
                          : `-${formatCurrency(discount.amount)}`;
                      })()}
                    </p>
                  </div>
                ))}
                {result.cashBenefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {benefit.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatCurrency(benefit.amount)}
                      {benefit.treatment === "refund_later" && benefit.receiveAt
                        ? ` - Refund at ${benefit.receiveAt}`
                        : benefit.treatment === "refund_later"
                          ? " - Refund later"
                          : " - Immediate offset"}
                    </p>
                  </div>
                ))}
                {result.nonCashBenefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {benefit.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Included benefit
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Financing" />
              <div className="mt-4">
                <ResultRow
                  label="Loan Margin"
                  value={formatPercent(numericInput.loanMarginPercent)}
                />
                <ResultRow label="Loan Amount" value={formatCurrency(result.loanAmount)} />
                <ResultRow
                  label="Interest Rate"
                  value={formatPercent(numericInput.annualInterestRatePercent)}
                />
                <ResultRow label="Tenure" value={`${numericInput.loanTenureYears || 0} years`} />
                <ResultRow
                  label="Estimated Monthly Loan Instalment"
                  value={formatCurrencyDetailed(result.estimatedMonthlyInstalment)}
                />
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Cash Required" />
              <div className="mt-4">
                <ResultRow
                  label="Upfront Cash Required"
                  value={formatCurrency(result.upfrontCashBeforeOtherCosts)}
                />
                <ResultRow
                  label="Other Upfront Costs"
                  value={formatCurrency(numericInput.otherUpfrontCosts)}
                />
                <ResultRow
                  label="Customer-Paid Purchase Costs"
                  value={formatCurrency(purchaseCostSummary.customerPayPurchaseCosts)}
                />
                <ResultRow
                  label="Total Savings"
                  value={formatCurrencyDetailed(purchaseCostSummary.developerAbsorbedPurchaseCosts)}
                  valueClassName="text-xl font-bold text-[#087F6B]"
                  rowClassName="mt-3 rounded-2xl border border-[#b7e6dc] bg-[#f1fbf8] px-4 py-3"
                />
                <ResultRow
                  label="Estimated Total Cash Required"
                  value={formatCurrencyDetailed(result.estimatedTotalCashRequired)}
                  valueClassName="font-bold text-[#8B3A3A]"
                  rowClassName="mt-2 rounded-2xl border border-[#f0dddd] bg-white px-4 py-2"
                />
              </div>
            </section>

            <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Returns" />
              <div className="mt-4">
                <ResultRow
                  label="Expected Monthly Rental"
                  value={formatCurrencyDetailed(numericInput.expectedMonthlyRental)}
                />
                <ResultRow
                  label="Estimated Monthly Loan Instalment"
                  value={formatCurrencyDetailed(result.estimatedMonthlyInstalment)}
                />
                <ResultRow
                  label="Monthly Maintenance"
                  value={formatCurrencyDetailed(result.monthlyMaintenance)}
                />
                <ResultRow
                  label="Estimated Monthly Cash Flow"
                  value={formatCurrencyDetailed(result.monthlyCashFlow)}
                >
                  <div className="space-y-0.5 font-medium">
                    {monthlyCashFlowBreakdown.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </ResultRow>
                <ResultRow
                  label="Estimated Annual Cash Flow"
                  value={formatCurrencyDetailed(result.annualCashFlow)}
                >
                  {annualCashFlowExplanation}
                </ResultRow>
                <ResultRow
                  label="Net Rental Yield"
                  value={formatPercent(result.netRentalYieldPercent)}
                >
                  Based on estimated annual net rental after maintenance.
                </ResultRow>
              </div>
            </section>
          </div>
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
          onConfirm={() => void saveRoiWork(saveTitle, null)}
        />
      ) : null}
    </>
  );
}

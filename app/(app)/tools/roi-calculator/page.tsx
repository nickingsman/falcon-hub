"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateRoi,
  type CashBenefitTreatment,
  type DiscountMethod,
  type PackageItemType,
  type PurchasePackageItem,
  type RoiCalculatorResult,
} from "@/lib/property-finance";
import { formatMemberDisplayName } from "@/lib/member-display";
import {
  normalizeTowerCode,
  parseUnitNumber,
  stackCodesMatch,
  type ParsedUnitNumber,
  type UnitNumberFormat,
} from "@/lib/unit-number-format";
import { useAppPermissions } from "../../components/AppPermissionProvider";

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
type PurchaseCostEstimateKey =
  | "spa_legal_fee"
  | "loan_legal_fee"
  | "spa_disbursement_fee"
  | "loan_disbursement_fee"
  | "loan_stamp_duty"
  | "mot_transfer_stamp_duty";

type PurchaseCostItem = {
  id: string;
  name: string;
  treatment: PurchaseCostTreatment;
  amount: string;
  source: PurchaseCostSource;
  estimateKey: PurchaseCostEstimateKey | null;
};

type PurchaseCostEstimate = {
  amount: number;
  requiresManualConfirmation: boolean;
  note?: string;
};

type ResolvedPurchaseCostItem = PurchaseCostItem & {
  resolvedAmount: string;
  resolvedAmountNumber: number;
  estimate: PurchaseCostEstimate | null;
};

const falconSpaDisbursementEstimate = 1500;
const falconLoanDisbursementEstimate = 1200;

type ProjectOption = {
  id: string;
  project_name: string;
  unit_number_format: UnitNumberFormat | null;
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
    <div class="row ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function calculateSro2023TableAAmount(basis: number) {
  if (!Number.isFinite(basis) || basis <= 0) return 0;

  const firstBand = Math.min(basis, 500000);
  const nextBand = Math.min(Math.max(basis - 500000, 0), 7000000);
  const firstBandFee = Math.max(firstBand * 0.0125, 500);

  return firstBandFee + nextBand * 0.01;
}

function calculateHdaLegalFeeEstimate(basis: number): PurchaseCostEstimate {
  if (!Number.isFinite(basis) || basis <= 0) {
    return { amount: 0, requiresManualConfirmation: false };
  }

  const tableAAmount = calculateSro2023TableAAmount(basis);
  let amount = tableAAmount;

  if (basis <= 50000) {
    amount = 500;
  } else if (basis <= 250000) {
    amount = Math.max(tableAAmount * 0.75, 500);
  } else if (basis <= 500000) {
    amount = tableAAmount * 0.7;
  } else if (basis <= 1000000) {
    amount = tableAAmount * 0.65;
  } else {
    amount = tableAAmount * 0.5;
  }

  return {
    amount,
    requiresManualConfirmation: basis > 7500000,
    note:
      basis > 7500000
        ? "Above RM7,500,000. Confirm negotiated excess manually."
        : undefined,
  };
}

function calculateLoanStampDutyEstimate(loanAmount: number): PurchaseCostEstimate {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
    return { amount: 0, requiresManualConfirmation: false };
  }

  return {
    amount: Math.ceil(loanAmount / 1000) * 5,
    requiresManualConfirmation: false,
  };
}

function createFixedFalconEstimate(amount: number): PurchaseCostEstimate {
  return {
    amount,
    requiresManualConfirmation: false,
    note: "Falcon estimate. Confirm package details manually.",
  };
}

function calculateMotEstimate(spaPrice: number): PurchaseCostEstimate {
  if (!Number.isFinite(spaPrice) || spaPrice <= 0) {
    return { amount: 0, requiresManualConfirmation: false };
  }

  const firstBand = Math.min(spaPrice, 100000) * 0.01;
  const secondBand = Math.min(Math.max(spaPrice - 100000, 0), 400000) * 0.02;
  const thirdBand = Math.min(Math.max(spaPrice - 500000, 0), 500000) * 0.03;
  const fourthBand = Math.max(spaPrice - 1000000, 0) * 0.04;

  return {
    amount: firstBand + secondBand + thirdBand + fourthBand,
    requiresManualConfirmation: false,
    note: "Only payable after VP",
  };
}

function getPurchaseCostEstimates(
  spaPrice: number,
  loanAmount: number,
): Record<PurchaseCostEstimateKey, PurchaseCostEstimate> {
  return {
    spa_legal_fee: calculateHdaLegalFeeEstimate(spaPrice),
    loan_legal_fee: calculateHdaLegalFeeEstimate(loanAmount),
    spa_disbursement_fee: createFixedFalconEstimate(falconSpaDisbursementEstimate),
    loan_disbursement_fee: createFixedFalconEstimate(falconLoanDisbursementEstimate),
    loan_stamp_duty: calculateLoanStampDutyEstimate(loanAmount),
    mot_transfer_stamp_duty: calculateMotEstimate(spaPrice),
  };
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
      ? `<small>Only payable after VP</small>`
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
      message: `Detected Stack ${stack.stack_code} is mapped to ${getMappedUnitTypeLabel(stack.unit_type)}, while the selected ROI Unit Type is different. Confirm manually before highlighting.`,
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
  preparedBy,
  unitPresentation,
  floorPlanPresentation,
  purchaseCosts,
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
  preparedBy: string;
  unitPresentation: UnitPresentationSnapshot | null;
  floorPlanPresentation: FloorPlanPresentationSnapshot | null;
  purchaseCosts: ResolvedPurchaseCostItem[];
}) {
  const projectName = form.projectName.trim() || "Property ROI Proposal";
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
    .map((discount) =>
      purchaseLine(discount.description, `- ${formatCurrency(discount.amount)}`),
    )
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
    <title>${escapeHtml(projectName)} - ROI Proposal</title>
    <style>
      @page { size: A4; margin: 10mm; }
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
        padding: 10mm;
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
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        padding: 9px;
      }
      .section.wide { grid-column: 1 / -1; }
      .section.compact-list { padding-bottom: 5px; }
      .package-validity {
        display: inline-flex;
        margin: -2px 0 5px;
        color: #9A6B1F;
        font-size: 9px;
        font-weight: 800;
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
      .cash-required-row span,
      .cash-required-row strong {
        color: #8B3A3A;
        font-weight: 800;
      }
      .compact-fields {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 7px;
        margin-top: 8px;
      }
      .compact-field {
        border: 1px solid #e4e4e7;
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
        border-top: 1px solid #d4d4d8;
      }
      .calculation-divider.strong {
        border-top-color: #99d8cd;
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
      .prepared {
        break-inside: avoid;
        margin-top: 9px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #e4e4e7;
        padding-top: 8px;
        font-size: 10px;
      }
      .prepared span {
        display: block;
        color: #71717a;
        font-size: 8px;
      }
      .prepared strong {
        display: block;
        margin-top: 2px;
        color: #18181b;
        font-size: 11px;
      }
      .disclaimer {
        margin: 7px 0 0;
        color: #71717a;
        font-size: 8px;
        line-height: 1.35;
      }
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
      .proposal-page-one .prepared {
        margin-top: 6px;
        padding-top: 5px;
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
    <main class="page proposal-page-one">
      <section class="header">
        <div>
          <div class="eyebrow">Falcon Hub ROI Proposal</div>
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
              ? `<div class="package-validity">Package Valid Until: ${escapeHtml(formatDisplayDate(form.packageValidUntil))}</div>`
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
          ${proposalRow("Cash-on-Cash Return", formatPercent(result.cashOnCashReturnPercent), false, ["Based on estimated annual cash flow against estimated upfront cash invested."])}
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

      <section class="prepared">
        <div>
          <span>Prepared by</span>
          <strong>${escapeHtml(preparedBy)}</strong>
        </div>
        <div class="eyebrow">Customer Proposal</div>
      </section>

      <p class="disclaimer">
        Figures shown are estimates for discussion purposes only. Actual financing, rebates, benefits, package terms, legal costs, and final purchase documentation are subject to bank approval, developer approval, and the signed final documents.
      </p>
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
          : "Free Furniture Package",
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
      description: item.description.trim() || "Cash Benefit",
      amount: parseMoney(item.amount),
      treatment: item.treatment,
      receiveAt: item.receiveAt.trim() || undefined,
    };
  }

  return {
    id: item.id,
    type: "non_cash_benefit",
    description: item.description.trim() || "Non-Cash Benefit",
  };
}

function ResultRow({
  label,
  value,
  valueClassName = "text-zinc-900",
  children,
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
  children?: React.ReactNode;
}>) {
  return (
    <div className="border-b border-zinc-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className={`text-right text-sm font-semibold ${valueClassName}`}>{value}</p>
      </div>
      {children ? <div className="mt-1 text-xs leading-5 text-zinc-500">{children}</div> : null}
    </div>
  );
}

export default function RoiCalculatorPage() {
  const { displayName, memberCode } = useAppPermissions();
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
  const [packageItems, setPackageItems] = useState<EditablePackageItem[]>([
    createPackageItem("discount"),
  ]);
  const [purchaseCosts, setPurchaseCosts] = useState<PurchaseCostItem[]>(defaultPurchaseCosts);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitTypes, setUnitTypes] = useState<ProjectUnitType[]>([]);
  const [unitTypesError, setUnitTypesError] = useState("");
  const [isLoadingUnitTypes, setIsLoadingUnitTypes] = useState(false);
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [unitPresentation, setUnitPresentation] = useState<UnitPresentationSnapshot | null>(null);
  const [floorPlans, setFloorPlans] = useState<ProjectFloorPlan[]>([]);
  const [floorPlansError, setFloorPlansError] = useState("");
  const [isLoadingFloorPlans, setIsLoadingFloorPlans] = useState(false);
  const [manualFloorPlanId, setManualFloorPlanId] = useState("");
  const [manualStackId, setManualStackId] = useState("");

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
          messages.push(`${item.description || "Cash Benefit"} must not be negative.`);
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
    } catch (error) {
      setUnitTypes([]);
      setUnitTypesError(error instanceof Error ? error.message : "Unable to load Unit Types");
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
    } catch (error) {
      setFloorPlans([]);
      setFloorPlansError(error instanceof Error ? error.message : "Unable to load Floor Plans");
    } finally {
      setIsLoadingFloorPlans(false);
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

    const selectedProject = projects.find((project) => project.id === projectId);

    if (selectedProject?.project_name) {
      updateField("projectName", selectedProject.project_name);
    }

    if (projectId) {
      void loadUnitTypes(projectId);
      void loadFloorPlans(projectId);
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
  }

  function handleUnitTypeChange(unitTypeId: string) {
    setSelectedUnitTypeId(unitTypeId);
    setManualFloorPlanId("");
    setManualStackId("");

    const selectedUnitType = unitTypes.find((unitType) => unitType.id === unitTypeId);

    if (!selectedUnitType) {
      setUnitPresentation(null);
      return;
    }

    applyUnitTypeSnapshot(selectedUnitType);
  }

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
  );
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
        preparedBy: formatMemberDisplayName({
          full_name: displayName,
          member_code: memberCode,
        }),
        unitPresentation: freshUnitPresentation,
        floorPlanPresentation: freshFloorPlanPresentation,
        purchaseCosts: resolvedPurchaseCosts,
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();

    printWhenImagesAreReady(proposalWindow);
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Tools - ROI Calculator</p>
          <p className="text-base font-semibold text-zinc-900">
            Property Investment Calculator
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={hasBlockingValidation}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export PDF
        </button>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              ROI Calculator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Property ROI Calculator
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
              Build a Malaysia new-launch package, estimate financing, and present rental returns in a customer-friendly format.
            </p>
          </div>
        </section>

        {hasBlockingValidation ? (
          <section className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold">Check these inputs before presenting:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Project Defaults
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Optional project data can prefill presentation fields. You can still edit the calculator manually.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Project
                  </span>
                  <select
                    value={selectedProjectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
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
                    disabled={!selectedProjectId || isLoadingUnitTypes}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Property & Unit
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Project Name
                  </span>
                  <input
                    value={form.projectName}
                    onChange={(event) => updateField("projectName", event.target.value)}
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.projectName.trim())}`}
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
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.unitNumber.trim())}`}
                    placeholder="Optional"
                  />
                </label>
                {selectedProjectId ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm md:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-zinc-900">Floor Plan Detection</p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                              detectionState.status === "auto" || detectionState.status === "manual"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : detectionState.status === "mismatch" || detectionState.status === "conflict"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-zinc-200 bg-white text-zinc-600"
                            }`}
                          >
                            {getDetectionLabel(detectionState.status)}
                          </span>
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
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-white px-3 py-2">
                        <p className="text-xs font-medium text-zinc-500">Auto highlight</p>
                        <p className="mt-1 font-semibold text-zinc-900">
                          {getFloorPlanLabel(detectionState.floorPlan)} · Stack{" "}
                          {detectionState.stack.stack_code}
                        </p>
                      </div>
                    ) : null}

                    {selectedFacing ? (
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
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
                            }}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
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
                            onChange={(event) => setManualStackId(event.target.value)}
                            disabled={!activeManualFloorPlan}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.unitType.trim())}`}
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
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.unitConfiguration.trim())}`}
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
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Size
                  </span>
                  <div
                    className={`flex rounded-2xl border ${getPendingInputClass(!form.unitSizeSqft.trim(), hasEnteredValue(form.unitSizeSqft) && (!Number.isFinite(numericInput.unitSizeSqft) || numericInput.unitSizeSqft < 0))}`}
                  >
                    <input
                      inputMode="decimal"
                      value={form.unitSizeSqft}
                      onChange={(event) => updateField("unitSizeSqft", event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
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
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.carpark.trim())}`}
                    placeholder="e.g. 2 car parks"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                SPA Price
              </h2>
              <label className="mt-5 block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">
                  SPA Price
                </span>
                <input
                  inputMode="decimal"
                  value={form.spaPrice}
                  onChange={(event) => updateField("spaPrice", event.target.value)}
                  className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.spaPrice.trim(), hasEnteredValue(form.spaPrice) && (!Number.isFinite(numericInput.spaPrice) || numericInput.spaPrice <= 0))}`}
                  placeholder="500000"
                />
              </label>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    Discounts & Benefits
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Discounts are applied in order. Cash benefits affect final price, not Nett Price.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addPackageItem("discount")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Discount
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackageItem("cash_benefit")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Cash Benefit
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackageItem("non_cash_benefit")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Non-Cash
                  </button>
                </div>
              </div>

              <label className="mt-5 block max-w-xs text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">
                  Package Valid Until
                </span>
                <input
                  type="date"
                  value={form.packageValidUntil}
                  onChange={(event) =>
                    updateField("packageValidUntil", event.target.value)
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                />
              </label>

              <div className="mt-5 space-y-4">
                {packageItems.map((item, index) => {
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
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        Item {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removePackageItem(item.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block text-sm text-zinc-600">
                        <span className="mb-1 block font-medium text-zinc-900">
                          Category
                        </span>
                        <select
                          value={item.type}
                          onChange={(event) =>
                            updatePackageItem(item.id, {
                              type: event.target.value as PackageItemType,
                            })
                          }
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        >
                          <option value="discount">Discount</option>
                          <option value="cash_benefit">Cash Benefit</option>
                          <option value="non_cash_benefit">Non-Cash Benefit</option>
                        </select>
                      </label>
                      <label className="block text-sm text-zinc-600">
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
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                          placeholder="Developer Rebate"
                        />
                      </label>

                      {item.type === "discount" ? (
                        <>
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
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                            >
                              <option value="percentage_spa">% based on SPA Price</option>
                              <option value="percentage_previous_balance">
                                % based on Previous Balance
                              </option>
                              <option value="fixed">Fixed RM discount</option>
                            </select>
                          </label>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Value
                            </span>
                            <input
                              inputMode="decimal"
                              value={item.value}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  value: event.target.value,
                                })
                              }
                              className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!hasEnteredValue(item.value), discountValueIsInvalid)}`}
                              placeholder={item.method === "fixed" ? "30000" : "10"}
                            />
                          </label>
                        </>
                      ) : null}

                      {item.type === "cash_benefit" ? (
                        <>
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
                              className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!hasEnteredValue(item.amount), cashBenefitAmountIsInvalid)}`}
                              placeholder="30000"
                            />
                          </label>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Treatment
                            </span>
                            <select
                              value={item.treatment}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  treatment: event.target.value as CashBenefitTreatment,
                                })
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                            >
                              <option value="immediate_offset">Immediate Offset</option>
                              <option value="refund_later">Refund Later</option>
                            </select>
                          </label>
                          {item.treatment === "refund_later" ? (
                            <label className="block text-sm text-zinc-600 md:col-span-2">
                              <span className="mb-1 block font-medium text-zinc-900">
                                Refund / Receive At
                              </span>
                              <input
                                value={item.receiveAt}
                                onChange={(event) =>
                                  updatePackageItem(item.id, {
                                    receiveAt: event.target.value,
                                  })
                                }
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                                placeholder="Stage 2B, VP, upon loan disbursement"
                              />
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  Purchase Costs
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Enter confirmed package costs. Only Customer Pay rows affect total cash required.
                </p>
              </div>

              <div className="mt-5 space-y-3">
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
                      className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[1fr_220px_180px]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900">
                            {item.name}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              item.source === "auto" || item.source === "estimate"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-white text-zinc-600"
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
                              className="text-xs font-medium text-[#087F6B] hover:text-[#066a59]"
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
                          <p className="mt-1 text-xs text-zinc-500">
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
                          className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(false)}`}
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
                          <span className="border-r border-zinc-200 px-3 py-2 text-zinc-500">
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
                            className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none disabled:cursor-not-allowed"
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

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Financing & Rental
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                      className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.loanMarginPercent.trim(), hasEnteredValue(form.loanMarginPercent) && (!Number.isFinite(numericInput.loanMarginPercent) || numericInput.loanMarginPercent < 0 || numericInput.loanMarginPercent > 100))}`}
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
                      className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.annualInterestRatePercent.trim(), hasEnteredValue(form.annualInterestRatePercent) && (!Number.isFinite(numericInput.annualInterestRatePercent) || numericInput.annualInterestRatePercent < 0))}`}
                    />
                  </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Loan Tenure
                  </span>
                  <div className={`flex rounded-2xl border ${getPendingInputClass(!form.loanTenureYears.trim(), hasEnteredValue(form.loanTenureYears) && (!Number.isFinite(numericInput.loanTenureYears) || numericInput.loanTenureYears <= 0))}`}>
                    <input
                      inputMode="decimal"
                      value={form.loanTenureYears}
                      onChange={(event) =>
                        updateField("loanTenureYears", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
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
                      className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(!form.expectedMonthlyRental.trim(), hasEnteredValue(form.expectedMonthlyRental) && (!Number.isFinite(numericInput.expectedMonthlyRental) || numericInput.expectedMonthlyRental < 0))}`}
                      placeholder="2500"
                    />
                  </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Maintenance Rate
                  </span>
                  <div className={`flex rounded-2xl border ${getPendingInputClass(!form.maintenanceRatePerSqft.trim(), hasEnteredValue(form.maintenanceRatePerSqft) && (!Number.isFinite(numericInput.maintenanceRatePerSqft) || numericInput.maintenanceRatePerSqft < 0))}`}>
                    <span className="border-r border-zinc-200 px-3 py-2 text-zinc-500">
                      RM
                    </span>
                    <input
                      inputMode="decimal"
                      value={form.maintenanceRatePerSqft}
                      onChange={(event) =>
                        updateField("maintenanceRatePerSqft", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                      placeholder="0.35"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
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
                    className={`w-full rounded-2xl border px-3 py-2 outline-none ${getPendingInputClass(false, hasEnteredValue(form.otherUpfrontCosts) && (!Number.isFinite(numericInput.otherUpfrontCosts) || numericInput.otherUpfrontCosts < 0))}`}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section
              className={`rounded-[28px] border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${
                cashFlowIsPositive
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Estimated Monthly Cash Flow
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {formatCurrencyDetailed(result.monthlyCashFlow)}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Rental minus maintenance and estimated instalment.
              </p>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Customer Summary
              </h2>
              <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
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

              <div className="mt-5">
                <ResultRow label="SPA Price" value={formatCurrency(result.spaPrice)} />
                <ResultRow label="Nett Price" value={formatCurrency(result.nettPrice)} />
                <ResultRow
                  label="Final Price After Benefits"
                  value={formatCurrency(result.finalPriceAfterBenefits)}
                  valueClassName="text-lg font-bold text-[#087F6B]"
                />
                <ResultRow
                  label="Total Cashback"
                  value={formatCurrency(totalCashback)}
                  valueClassName="font-bold text-[#1E4E79]"
                />
                <ResultRow
                  label="Total Savings"
                  value={formatCurrencyDetailed(purchaseCostSummary.developerAbsorbedPurchaseCosts)}
                  valueClassName="font-bold text-[#087F6B]"
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Purchase Package
              </h2>
              <div className="mt-4 space-y-3">
                {result.processedDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {discount.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      -{formatCurrency(discount.amount)}
                    </p>
                  </div>
                ))}
                {result.cashBenefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
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
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
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

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">Financing</h2>
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

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Cash Required
              </h2>
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
                  valueClassName="font-bold text-[#087F6B]"
                />
                <ResultRow
                  label="Estimated Total Cash Required"
                  value={formatCurrencyDetailed(result.estimatedTotalCashRequired)}
                  valueClassName="font-bold text-[#8B3A3A]"
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">Returns</h2>
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
                <ResultRow
                  label="Cash-on-Cash Return"
                  value={formatPercent(result.cashOnCashReturnPercent)}
                >
                  Based on estimated annual cash flow against estimated upfront cash invested.
                </ResultRow>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

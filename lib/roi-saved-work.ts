import {
  type CashBenefitTreatment,
  type DiscountMethod,
  type PackageItemType,
} from "@/lib/property-finance";
import type { PurchaseCostEstimateKey } from "@/lib/purchase-costs";

export const roiSavedWorkSchemaVersion = 1;

const packageItemTypes = ["discount", "cash_benefit", "non_cash_benefit"] as const;
const discountMethods = ["percentage_spa", "percentage_previous_balance", "fixed"] as const;
const cashBenefitTreatments = ["immediate_offset", "refund_later"] as const;
const purchaseCostTreatments = ["customer_pay", "developer_absorbed", "not_applicable"] as const;
const purchaseCostSources = ["auto", "estimate", "manual"] as const;
const purchaseCostEstimateKeys = [
  "spa_legal_fee",
  "loan_legal_fee",
  "spa_disbursement_fee",
  "loan_disbursement_fee",
  "loan_stamp_duty",
  "mot_transfer_stamp_duty",
] as const;
const facingViewTypes = ["actual", "indicative", "artist_impression"] as const;

export type RoiSavedWorkFormV1 = {
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

export type RoiSavedPackageItemV1 = {
  id: string;
  type: PackageItemType;
  description: string;
  method: DiscountMethod;
  value: string;
  amount: string;
  treatment: CashBenefitTreatment;
  receiveAt: string;
};

export type RoiSavedPurchaseCostV1 = {
  id: string;
  name: string;
  treatment: (typeof purchaseCostTreatments)[number];
  amount: string;
  source: (typeof purchaseCostSources)[number];
  estimateKey: PurchaseCostEstimateKey | null;
};

export type RoiSavedLayoutSnapshotV1 = {
  title: string;
  description: string | null;
};

export type RoiSavedFacingSnapshotV1 = {
  name: string;
  description: string | null;
  view_type: (typeof facingViewTypes)[number] | null;
  disclaimer: string | null;
  media: RoiSavedLayoutSnapshotV1 | null;
};

export type RoiSavedUnitPresentationSnapshotV1 = {
  projectName: string;
  typeCode: string;
  typeName: string | null;
  configuration: string | null;
  sizeSqft: number | null;
  carpark: string;
  layout: RoiSavedLayoutSnapshotV1 | null;
  furnishingPackage: {
    package_name: string;
    description: string | null;
    items: {
      item_name: string;
      quantity: number | null;
      description: string | null;
    }[];
  } | null;
};

export type RoiSavedFloorPlanPresentationSnapshotV1 = {
  floorPlanName: string;
  towerCode: string | null;
  floorFrom: number;
  floorTo: number;
  media: RoiSavedLayoutSnapshotV1 | null;
  stackCode: string;
  stack: {
    x_percent: number;
    y_percent: number;
    width_percent: number;
    height_percent: number;
  };
  facing: RoiSavedFacingSnapshotV1 | null;
};

export type RoiSavedWorkPayloadV1 = {
  tool: "roi";
  schemaVersion: 1;
  form: RoiSavedWorkFormV1;
  packageItems: RoiSavedPackageItemV1[];
  purchaseCosts: RoiSavedPurchaseCostV1[];
  projectReference: {
    selectedProjectId: string;
    selectedUnitTypeId: string;
    manualFloorPlanId: string;
    manualStackId: string;
  };
  snapshots: {
    unitPresentation: RoiSavedUnitPresentationSnapshotV1 | null;
    floorPlanPresentation: RoiSavedFloorPlanPresentationSnapshotV1 | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function normalizeLayoutSnapshot(value: unknown): RoiSavedLayoutSnapshotV1 | null {
  if (!isRecord(value)) return null;

  return {
    title: stringValue(value.title),
    description: nullableString(value.description),
  };
}

function normalizeFacingSnapshot(value: unknown): RoiSavedFacingSnapshotV1 | null {
  if (!isRecord(value)) return null;

  return {
    name: stringValue(value.name),
    description: nullableString(value.description),
    view_type: isOneOf(value.view_type, facingViewTypes) ? value.view_type : null,
    disclaimer: nullableString(value.disclaimer),
    media: normalizeLayoutSnapshot(value.media),
  };
}

function normalizeUnitPresentationSnapshot(
  value: unknown,
): RoiSavedUnitPresentationSnapshotV1 | null {
  if (!isRecord(value)) return null;

  const furnishingPackage = isRecord(value.furnishingPackage)
    ? {
        package_name: stringValue(value.furnishingPackage.package_name),
        description: nullableString(value.furnishingPackage.description),
        items: Array.isArray(value.furnishingPackage.items)
          ? value.furnishingPackage.items.filter(isRecord).map((item) => ({
              item_name: stringValue(item.item_name),
              quantity: nullableNumber(item.quantity),
              description: nullableString(item.description),
            }))
          : [],
      }
    : null;

  return {
    projectName: stringValue(value.projectName),
    typeCode: stringValue(value.typeCode),
    typeName: nullableString(value.typeName),
    configuration: nullableString(value.configuration),
    sizeSqft: nullableNumber(value.sizeSqft),
    carpark: stringValue(value.carpark),
    layout: normalizeLayoutSnapshot(value.layout),
    furnishingPackage,
  };
}

function normalizeFloorPlanPresentationSnapshot(
  value: unknown,
): RoiSavedFloorPlanPresentationSnapshotV1 | null {
  if (!isRecord(value) || !isRecord(value.stack)) return null;

  return {
    floorPlanName: stringValue(value.floorPlanName),
    towerCode: nullableString(value.towerCode),
    floorFrom: nullableNumber(value.floorFrom) ?? 0,
    floorTo: nullableNumber(value.floorTo) ?? 0,
    media: normalizeLayoutSnapshot(value.media),
    stackCode: stringValue(value.stackCode),
    stack: {
      x_percent: nullableNumber(value.stack.x_percent) ?? 0,
      y_percent: nullableNumber(value.stack.y_percent) ?? 0,
      width_percent: nullableNumber(value.stack.width_percent) ?? 0,
      height_percent: nullableNumber(value.stack.height_percent) ?? 0,
    },
    facing: normalizeFacingSnapshot(value.facing),
  };
}

export function validateRoiSavedWorkPayload(value: unknown):
  | { valid: true; payload: RoiSavedWorkPayloadV1 }
  | { valid: false; error: string } {
  if (!isRecord(value)) {
    return { valid: false, error: "This saved ROI version cannot be opened." };
  }

  if (value.tool !== "roi" || value.schemaVersion !== roiSavedWorkSchemaVersion) {
    return { valid: false, error: "This saved ROI version cannot be opened." };
  }

  if (!isRecord(value.form) || !Array.isArray(value.packageItems) || !Array.isArray(value.purchaseCosts)) {
    return { valid: false, error: "This saved ROI version cannot be opened." };
  }

  const form: RoiSavedWorkFormV1 = {
    projectName: stringValue(value.form.projectName),
    unitNumber: stringValue(value.form.unitNumber),
    unitType: stringValue(value.form.unitType),
    unitConfiguration: stringValue(value.form.unitConfiguration),
    unitSizeSqft: stringValue(value.form.unitSizeSqft),
    carpark: stringValue(value.form.carpark),
    calculationDate: stringValue(value.form.calculationDate),
    packageValidUntil: stringValue(value.form.packageValidUntil),
    spaPrice: stringValue(value.form.spaPrice),
    loanMarginPercent: stringValue(value.form.loanMarginPercent),
    annualInterestRatePercent: stringValue(value.form.annualInterestRatePercent),
    loanTenureYears: stringValue(value.form.loanTenureYears),
    expectedMonthlyRental: stringValue(value.form.expectedMonthlyRental),
    maintenanceRatePerSqft: stringValue(value.form.maintenanceRatePerSqft),
    otherUpfrontCosts: stringValue(value.form.otherUpfrontCosts),
  };

  const packageItems = value.packageItems.filter(isRecord).map((item) => ({
    id: stringValue(item.id) || crypto.randomUUID(),
    type: isOneOf(item.type, packageItemTypes) ? item.type : "discount",
    description: stringValue(item.description),
    method: isOneOf(item.method, discountMethods) ? item.method : "percentage_spa",
    value: stringValue(item.value),
    amount: stringValue(item.amount),
    treatment: isOneOf(item.treatment, cashBenefitTreatments)
      ? item.treatment
      : "refund_later",
    receiveAt: stringValue(item.receiveAt),
  }));

  const purchaseCosts = value.purchaseCosts.filter(isRecord).map((item) => ({
    id: stringValue(item.id),
    name: stringValue(item.name),
    treatment: isOneOf(item.treatment, purchaseCostTreatments)
      ? item.treatment
      : "not_applicable",
    amount: stringValue(item.amount),
    source: isOneOf(item.source, purchaseCostSources) ? item.source : "manual",
    estimateKey: isOneOf(item.estimateKey, purchaseCostEstimateKeys)
      ? item.estimateKey
      : null,
  }));

  const projectReference = isRecord(value.projectReference)
    ? value.projectReference
    : {};
  const snapshots = isRecord(value.snapshots) ? value.snapshots : {};

  return {
    valid: true,
    payload: {
      tool: "roi",
      schemaVersion: roiSavedWorkSchemaVersion,
      form,
      packageItems,
      purchaseCosts,
      projectReference: {
        selectedProjectId: stringValue(projectReference.selectedProjectId),
        selectedUnitTypeId: stringValue(projectReference.selectedUnitTypeId),
        manualFloorPlanId: stringValue(projectReference.manualFloorPlanId),
        manualStackId: stringValue(projectReference.manualStackId),
      },
      snapshots: {
        unitPresentation: normalizeUnitPresentationSnapshot(snapshots.unitPresentation),
        floorPlanPresentation: normalizeFloorPlanPresentationSnapshot(
          snapshots.floorPlanPresentation,
        ),
      },
    },
  };
}

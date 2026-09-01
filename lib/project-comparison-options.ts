import type {
  CashBenefitTreatment,
  DiscountMethod,
  PackageItemType,
} from "@/lib/property-finance";

export const connectivityCategories = [
  "lrt",
  "mrt",
  "ktm",
  "monorail",
  "brt",
  "highway",
  "mall",
  "grocery",
  "school",
  "university",
  "hospital",
  "park",
  "business_district",
  "other",
] as const;

export const connectivityModes = [
  "walking",
  "direct_connected",
  "sheltered_walking",
  "shuttle",
  "driving",
  "nearby",
  "other",
] as const;

export const packageItemTypes = [
  "discount",
  "cash_benefit",
  "non_cash_benefit",
] as const satisfies readonly PackageItemType[];

export const discountMethods = [
  "percentage_spa",
  "percentage_previous_balance",
  "fixed",
] as const satisfies readonly DiscountMethod[];

export const cashBenefitTreatments = [
  "immediate_offset",
  "refund_later",
] as const satisfies readonly CashBenefitTreatment[];

export const purchaseCostKeys = [
  "spa_legal_fee",
  "loan_legal_fee",
  "spa_disbursement_fee",
  "loan_disbursement_fee",
  "loan_stamp_duty",
  "mot_transfer_stamp_duty",
  "valuation_fee",
] as const;

export const purchaseCostTreatments = [
  "customer_pay",
  "developer_absorbed",
  "not_applicable",
] as const;

export type ConnectivityCategory = (typeof connectivityCategories)[number];
export type ConnectivityMode = (typeof connectivityModes)[number];
export type PurchaseCostKey = (typeof purchaseCostKeys)[number];
export type PurchaseCostTreatment = (typeof purchaseCostTreatments)[number];

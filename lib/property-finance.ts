export type DiscountMethod = "percentage_spa" | "percentage_previous_balance" | "fixed";
export type CashBenefitTreatment = "immediate_offset" | "refund_later";
export type PackageItemType = "discount" | "cash_benefit" | "non_cash_benefit";

export type DiscountPackageItem = {
  id: string;
  type: "discount";
  description: string;
  method: DiscountMethod;
  value: number;
};

export type CashBenefitPackageItem = {
  id: string;
  type: "cash_benefit";
  description: string;
  amount: number;
  treatment: CashBenefitTreatment;
  receiveAt?: string;
};

export type NonCashBenefitPackageItem = {
  id: string;
  type: "non_cash_benefit";
  description: string;
};

export type PurchasePackageItem =
  | DiscountPackageItem
  | CashBenefitPackageItem
  | NonCashBenefitPackageItem;

export type RoiCalculatorInput = {
  spaPrice: number;
  packageItems: PurchasePackageItem[];
  loanMarginPercent: number;
  annualInterestRatePercent: number;
  loanTenureYears: number;
  unitSizeSqft: number;
  maintenanceRatePerSqft: number;
  expectedMonthlyRental: number;
  otherUpfrontCosts: number;
};

export type ProcessedDiscount = {
  id: string;
  description: string;
  amount: number;
  balanceAfter: number;
  method: DiscountMethod;
};

export type ProcessedCashBenefit = {
  id: string;
  description: string;
  amount: number;
  treatment: CashBenefitTreatment;
  receiveAt?: string;
};

export type ProcessedNonCashBenefit = {
  id: string;
  description: string;
};

export type RoiCalculatorResult = {
  spaPrice: number;
  nettPrice: number;
  finalPriceAfterBenefits: number;
  processedDiscounts: ProcessedDiscount[];
  cashBenefits: ProcessedCashBenefit[];
  nonCashBenefits: ProcessedNonCashBenefit[];
  totalDiscounts: number;
  totalCashBenefits: number;
  immediateOffsetBenefits: number;
  loanAmount: number;
  estimatedMonthlyInstalment: number | null;
  monthlyMaintenance: number;
  upfrontCashBeforeOtherCosts: number;
  estimatedTotalCashRequired: number;
  grossRentalYieldPercent: number | null;
  netRentalYieldPercent: number | null;
  monthlyCashFlow: number | null;
  annualCashFlow: number | null;
  cashOnCashReturnPercent: number | null;
};

export function clampMoney(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(value, 0);
}

export function calculateMonthlyInstalment(
  loanAmount: number,
  annualInterestRatePercent: number,
  tenureYears: number,
) {
  const principal = clampMoney(loanAmount);
  const numberOfPayments = tenureYears * 12;

  if (principal <= 0) return 0;
  if (!Number.isFinite(numberOfPayments) || numberOfPayments <= 0) return null;

  const monthlyRate = annualInterestRatePercent / 100 / 12;

  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) return null;
  if (monthlyRate === 0) return principal / numberOfPayments;

  const compoundFactor = (1 + monthlyRate) ** numberOfPayments;

  if (!Number.isFinite(compoundFactor) || compoundFactor <= 1) return null;

  return (principal * monthlyRate * compoundFactor) / (compoundFactor - 1);
}

export function calculateRoi(input: RoiCalculatorInput): RoiCalculatorResult {
  const spaPrice = clampMoney(input.spaPrice);
  let runningBalance = spaPrice;
  const processedDiscounts: ProcessedDiscount[] = [];
  const cashBenefits: ProcessedCashBenefit[] = [];
  const nonCashBenefits: ProcessedNonCashBenefit[] = [];

  for (const item of input.packageItems) {
    if (item.type === "discount") {
      const discountValue = clampMoney(item.value);
      const basis =
        item.method === "percentage_previous_balance" ? runningBalance : spaPrice;
      const rawDiscount =
        item.method === "fixed" ? discountValue : basis * (discountValue / 100);
      const amount = Math.min(clampMoney(rawDiscount), runningBalance);

      runningBalance = clampMoney(runningBalance - amount);
      processedDiscounts.push({
        id: item.id,
        description: item.description,
        amount,
        balanceAfter: runningBalance,
        method: item.method,
      });
      continue;
    }

    if (item.type === "cash_benefit") {
      cashBenefits.push({
        id: item.id,
        description: item.description,
        amount: clampMoney(item.amount),
        treatment: item.treatment,
        receiveAt: item.receiveAt,
      });
      continue;
    }

    nonCashBenefits.push({
      id: item.id,
      description: item.description,
    });
  }

  const nettPrice = runningBalance;
  const totalDiscounts = processedDiscounts.reduce(
    (sum, discount) => sum + discount.amount,
    0,
  );
  const totalCashBenefits = cashBenefits.reduce(
    (sum, benefit) => sum + benefit.amount,
    0,
  );
  const immediateOffsetBenefits = cashBenefits
    .filter((benefit) => benefit.treatment === "immediate_offset")
    .reduce((sum, benefit) => sum + benefit.amount, 0);
  const finalPriceAfterBenefits = clampMoney(nettPrice - totalCashBenefits);
  const loanMarginPercent = Number.isFinite(input.loanMarginPercent)
    ? input.loanMarginPercent
    : 0;
  const loanAmount = spaPrice * (loanMarginPercent / 100);
  const estimatedMonthlyInstalment = calculateMonthlyInstalment(
    loanAmount,
    input.annualInterestRatePercent,
    input.loanTenureYears,
  );
  const monthlyMaintenance = clampMoney(
    input.unitSizeSqft * input.maintenanceRatePerSqft,
  );
  const upfrontCashBeforeOtherCosts = clampMoney(
    nettPrice - loanAmount - immediateOffsetBenefits,
  );
  const estimatedTotalCashRequired =
    upfrontCashBeforeOtherCosts + clampMoney(input.otherUpfrontCosts);
  const grossRentalYieldPercent =
    finalPriceAfterBenefits > 0
      ? (clampMoney(input.expectedMonthlyRental) * 12 / finalPriceAfterBenefits) * 100
      : null;
  const netMonthlyRental =
    clampMoney(input.expectedMonthlyRental) - monthlyMaintenance;
  const netRentalYieldPercent =
    finalPriceAfterBenefits > 0
      ? (netMonthlyRental * 12 / finalPriceAfterBenefits) * 100
      : null;
  const monthlyCashFlow =
    estimatedMonthlyInstalment === null
      ? null
      : clampMoney(input.expectedMonthlyRental) -
        monthlyMaintenance -
        estimatedMonthlyInstalment;
  const annualCashFlow =
    monthlyCashFlow === null ? null : monthlyCashFlow * 12;
  const cashOnCashReturnPercent =
    annualCashFlow !== null && estimatedTotalCashRequired > 0
      ? (annualCashFlow / estimatedTotalCashRequired) * 100
      : null;

  return {
    spaPrice,
    nettPrice,
    finalPriceAfterBenefits,
    processedDiscounts,
    cashBenefits,
    nonCashBenefits,
    totalDiscounts,
    totalCashBenefits,
    immediateOffsetBenefits,
    loanAmount,
    estimatedMonthlyInstalment,
    monthlyMaintenance,
    upfrontCashBeforeOtherCosts,
    estimatedTotalCashRequired,
    grossRentalYieldPercent,
    netRentalYieldPercent,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashReturnPercent,
  };
}

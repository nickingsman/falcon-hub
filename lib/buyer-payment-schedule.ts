import {
  calculateProgressiveInterest,
  scheduleHStages,
  type ScheduleHStageDefinition,
  type ScheduleHStageId,
} from "./progressive-interest";

export type PurchaseMethod = "loan" | "cash";
export type BuyerPaymentIncentiveType = "rebate" | "cashback";

export type BuyerPaymentIncentiveInput = {
  id: string;
  type: BuyerPaymentIncentiveType;
  percentage: number;
  applicationStageId: ScheduleHStageId;
};

export type BuyerPaymentScheduleInput = {
  spaPrice: number;
  purchaseMethod: PurchaseMethod;
  loanMarginPercent: number;
  incentives: BuyerPaymentIncentiveInput[];
};

export type BuyerPaymentIncentiveResult = BuyerPaymentIncentiveInput & {
  amount: number;
  applicationStageLabel: string;
};

export type BuyerPaymentScheduleStage = {
  stage: ScheduleHStageDefinition;
  stagePercentage: number;
  stageAmount: number;
  baseBuyerPayment: number;
  requiredBuyerPayment: number;
  bankPayment: number;
  rebateAvailableAtStage: number;
  rebateApplied: number;
  rebateCarryForwardBalance: number;
  cashbackReceived: number;
  netBuyerCashMovement: number;
  cumulativeBuyerPayments: number;
  cumulativeCashbackReceived: number;
  cumulativeNetBuyerOutlay: number;
};

export type BuyerPaymentScheduleResult = {
  purchaseMethod: PurchaseMethod;
  spaPrice: number;
  loanMarginPercent: number;
  loanAmount: number;
  grossBuyerEquity: number;
  grossBuyerPaymentObligation: number;
  totalRebate: number;
  totalCashback: number;
  totalRebateApplied: number;
  unusedRebateCarryForward: number;
  netBuyerOwnFunds: number;
  netOwnFundsRequired: number;
  netOwnFundsPercent: number;
  buyerFundsToPrepare: number;
  grossBuyerPayments: number;
  totalBankPayments: number;
  totalCashbackReceived: number;
  finalNetBuyerOutlay: number;
  incentives: BuyerPaymentIncentiveResult[];
  isValid: boolean;
  validationErrors: string[];
  stages: BuyerPaymentScheduleStage[];
};

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

export function getBuyerPaymentStageLabel(stageId: ScheduleHStageId) {
  const stage = scheduleHStages.find((item) => item.id === stageId);
  if (!stage) return "Unknown Stage";
  return stage.id === "spa" ? "SPA Signing" : `${stage.code} ${stage.englishTitle}`;
}

function getValidationErrors(input: BuyerPaymentScheduleInput) {
  const validationErrors: string[] = [];

  if (!Number.isFinite(input.spaPrice) || input.spaPrice <= 0) {
    validationErrors.push("SPA Price must be greater than 0.");
  }

  if (
    input.purchaseMethod === "loan" &&
    (!Number.isFinite(input.loanMarginPercent) ||
      input.loanMarginPercent <= 0 ||
      input.loanMarginPercent > 100)
  ) {
    validationErrors.push("Loan margin must be greater than 0 and no more than 100.");
  }

  input.incentives.forEach((incentive, index) => {
    const label = `Incentive ${index + 1}`;
    if (incentive.type !== "rebate" && incentive.type !== "cashback") {
      validationErrors.push(`${label} type is invalid.`);
    }
    if (
      !Number.isFinite(incentive.percentage) ||
      incentive.percentage < 0 ||
      incentive.percentage > 100
    ) {
      validationErrors.push(`${label} percentage must be between 0% and 100%.`);
    }
    if (!scheduleHStages.some((stage) => stage.id === incentive.applicationStageId)) {
      validationErrors.push(`${label} application stage is invalid.`);
    }
  });

  return validationErrors;
}

export function calculateBuyerPaymentSchedule(
  input: BuyerPaymentScheduleInput,
): BuyerPaymentScheduleResult {
  const validationErrors = getValidationErrors(input);
  const isValid = validationErrors.length === 0;
  const spaPrice = isValid ? input.spaPrice : normalizeMoney(input.spaPrice);
  const loanResult =
    input.purchaseMethod === "loan"
      ? calculateProgressiveInterest({
          spaPrice: input.spaPrice,
          loanMarginPercent: input.loanMarginPercent,
          annualInterestRatePercent: 0,
        })
      : null;
  const loanMarginPercent = input.purchaseMethod === "loan" ? input.loanMarginPercent : 0;
  const loanAmount = isValid && loanResult ? loanResult.loanAmount : 0;
  const grossBuyerEquity = isValid
    ? input.purchaseMethod === "loan"
      ? loanResult?.buyerEquity ?? 0
      : spaPrice
    : 0;
  const grossBuyerPaymentObligation = grossBuyerEquity;
  const incentives: BuyerPaymentIncentiveResult[] = input.incentives.map((incentive) => ({
    ...incentive,
    amount: isValid ? spaPrice * (incentive.percentage / 100) : 0,
    applicationStageLabel: getBuyerPaymentStageLabel(incentive.applicationStageId),
  }));
  const totalRebate = incentives
    .filter((incentive) => incentive.type === "rebate")
    .reduce((sum, incentive) => sum + incentive.amount, 0);
  const totalCashback = incentives
    .filter((incentive) => incentive.type === "cashback")
    .reduce((sum, incentive) => sum + incentive.amount, 0);

  let remainingBuyerObligation = grossBuyerPaymentObligation;
  let remainingLoanAmount = loanAmount;
  let rebateCarryForwardBalance = 0;
  let cumulativeBuyerPayments = 0;
  let cumulativeCashbackReceived = 0;

  const stages = scheduleHStages.map((stage): BuyerPaymentScheduleStage => {
    const stageAmount = isValid ? spaPrice * (stage.percentage / 100) : 0;
    const baseBuyerPayment = isValid
      ? Math.min(stageAmount, remainingBuyerObligation)
      : 0;
    remainingBuyerObligation = normalizeMoney(
      remainingBuyerObligation - baseBuyerPayment,
    );
    const bankPayment = isValid
      ? Math.min(normalizeMoney(stageAmount - baseBuyerPayment), remainingLoanAmount)
      : 0;
    remainingLoanAmount = normalizeMoney(remainingLoanAmount - bankPayment);

    const stageIncentives = incentives.filter(
      (incentive) => incentive.applicationStageId === stage.id,
    );
    const rebateAvailableAtStage = stageIncentives
      .filter((incentive) => incentive.type === "rebate")
      .reduce((sum, incentive) => sum + incentive.amount, 0);
    rebateCarryForwardBalance += rebateAvailableAtStage;
    const rebateApplied = Math.min(baseBuyerPayment, rebateCarryForwardBalance);
    rebateCarryForwardBalance = normalizeMoney(
      rebateCarryForwardBalance - rebateApplied,
    );
    const requiredBuyerPayment = normalizeMoney(baseBuyerPayment - rebateApplied);
    const cashbackReceived = stageIncentives
      .filter((incentive) => incentive.type === "cashback")
      .reduce((sum, incentive) => sum + incentive.amount, 0);
    const netBuyerCashMovement = requiredBuyerPayment - cashbackReceived;
    cumulativeBuyerPayments += requiredBuyerPayment;
    cumulativeCashbackReceived += cashbackReceived;

    return {
      stage,
      stagePercentage: stage.percentage,
      stageAmount,
      baseBuyerPayment,
      requiredBuyerPayment,
      bankPayment,
      rebateAvailableAtStage,
      rebateApplied,
      rebateCarryForwardBalance,
      cashbackReceived,
      netBuyerCashMovement,
      cumulativeBuyerPayments,
      cumulativeCashbackReceived,
      cumulativeNetBuyerOutlay:
        cumulativeBuyerPayments - cumulativeCashbackReceived,
    };
  });

  const grossBuyerPayments = stages.reduce(
    (sum, stage) => sum + stage.requiredBuyerPayment,
    0,
  );
  const totalBankPayments = stages.reduce(
    (sum, stage) => sum + stage.bankPayment,
    0,
  );
  const totalRebateApplied = stages.reduce(
    (sum, stage) => sum + stage.rebateApplied,
    0,
  );
  const totalCashbackReceived = stages.reduce(
    (sum, stage) => sum + stage.cashbackReceived,
    0,
  );
  const netBuyerOwnFunds = grossBuyerPayments - totalCashbackReceived;

  return {
    purchaseMethod: input.purchaseMethod,
    spaPrice,
    loanMarginPercent,
    loanAmount,
    grossBuyerEquity,
    grossBuyerPaymentObligation,
    totalRebate,
    totalCashback,
    totalRebateApplied,
    unusedRebateCarryForward: rebateCarryForwardBalance,
    netBuyerOwnFunds,
    netOwnFundsRequired: netBuyerOwnFunds,
    netOwnFundsPercent: spaPrice > 0 ? (netBuyerOwnFunds / spaPrice) * 100 : 0,
    buyerFundsToPrepare: grossBuyerPayments,
    grossBuyerPayments,
    totalBankPayments,
    totalCashbackReceived,
    finalNetBuyerOutlay: netBuyerOwnFunds,
    incentives,
    isValid,
    validationErrors,
    stages,
  };
}

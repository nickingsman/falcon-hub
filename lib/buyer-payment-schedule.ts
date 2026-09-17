import {
  calculateProgressiveInterest,
  scheduleHStages,
  type ScheduleHStageDefinition,
  type ScheduleHStageId,
} from "./progressive-interest";

export type PurchaseMethod = "loan" | "cash";
export type RebateTreatment = "direct_offset" | "cashback_later";

export type BuyerPaymentScheduleInput = {
  spaPrice: number;
  purchaseMethod: PurchaseMethod;
  loanMarginPercent: number;
  developerRebatePercent: number;
  rebateTreatment: RebateTreatment;
  rebateStageId: ScheduleHStageId;
};

export type BuyerPaymentScheduleStage = {
  stage: ScheduleHStageDefinition;
  stagePercentage: number;
  stageAmount: number;
  requiredBuyerPayment: number;
  bankPayment: number;
  developerOffset: number;
  cashbackReceived: number;
  netBuyerCashMovement: number;
  cumulativeGrossBuyerPayments: number;
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
  developerRebatePercent: number;
  developerRebateAmount: number;
  effectiveDeveloperRebate: number;
  netOwnFundsRequired: number;
  netOwnFundsPercent: number;
  buyerFundsToPrepare: number;
  grossBuyerPayments: number;
  totalBankPayments: number;
  totalDeveloperOffset: number;
  totalCashbackReceived: number;
  finalNetBuyerOutlay: number;
  rebateTreatment: RebateTreatment;
  rebateStageId: ScheduleHStageId;
  rebateStageLabel: string;
  allocationError: string | null;
  isValid: boolean;
  validationErrors: string[];
  stages: BuyerPaymentScheduleStage[];
};

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

function getStageLabel(stageId: ScheduleHStageId) {
  const stage = scheduleHStages.find((item) => item.id === stageId);
  if (!stage) return "SPA Signing";
  return stage.id === "spa" ? "SPA Signing" : `${stage.code} ${stage.englishTitle}`;
}

export function calculateBuyerPaymentSchedule(
  input: BuyerPaymentScheduleInput,
): BuyerPaymentScheduleResult {
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

  const developerRebatePercentIsValid =
    Number.isFinite(input.developerRebatePercent) &&
    input.developerRebatePercent >= 0 &&
    input.developerRebatePercent <= 100;

  if (!developerRebatePercentIsValid) {
    validationErrors.push("Developer Rebate must be between 0% and 100%.");
  }

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
      : 0
    : 0;
  const grossBuyerPaymentObligation =
    input.purchaseMethod === "cash" && isValid ? spaPrice : grossBuyerEquity;
  const developerRebatePercent = developerRebatePercentIsValid
    ? input.developerRebatePercent
    : 0;
  const developerRebateAmount = isValid
    ? spaPrice * (developerRebatePercent / 100)
    : 0;
  const effectiveDeveloperRebate = Math.min(
    developerRebateAmount,
    grossBuyerPaymentObligation,
  );
  const netOwnFundsRequired = normalizeMoney(
    grossBuyerPaymentObligation - effectiveDeveloperRebate,
  );
  const buyerFundsToPrepare =
    input.rebateTreatment === "cashback_later"
      ? grossBuyerPaymentObligation
      : netOwnFundsRequired;
  const selectedStageIndex = Math.max(
    scheduleHStages.findIndex((stage) => stage.id === input.rebateStageId),
    0,
  );
  const availableOffsetCapacity = scheduleHStages
    .slice(selectedStageIndex)
    .reduce((sum, stage) => sum + spaPrice * (stage.percentage / 100), 0);
  const allocationError =
    isValid &&
    input.rebateTreatment === "direct_offset" &&
    effectiveDeveloperRebate > availableOffsetCapacity
      ? "This rebate timing cannot be fully applied as a direct payment offset with the current financing structure. Consider Cashback Later or review the rebate application stage."
      : null;

  let remainingBuyerFunds = buyerFundsToPrepare;
  let remainingLoanAmount = loanAmount;
  let remainingDeveloperOffset = effectiveDeveloperRebate;
  let cumulativeGrossBuyerPayments = 0;
  let cumulativeCashbackReceived = 0;

  const stages = scheduleHStages.map((stage, index): BuyerPaymentScheduleStage => {
    const stageAmount = spaPrice * (stage.percentage / 100);
    const canUseDeveloperOffset =
      isValid &&
      input.rebateTreatment === "direct_offset" &&
      index >= selectedStageIndex &&
      !allocationError;
    const developerOffset = canUseDeveloperOffset
      ? Math.min(stageAmount, remainingDeveloperOffset)
      : 0;
    remainingDeveloperOffset = normalizeMoney(remainingDeveloperOffset - developerOffset);

    const requiredBuyerPayment = isValid
      ? Math.min(normalizeMoney(stageAmount - developerOffset), remainingBuyerFunds)
      : 0;
    remainingBuyerFunds = normalizeMoney(remainingBuyerFunds - requiredBuyerPayment);

    const bankPayment = isValid
      ? Math.min(
          normalizeMoney(stageAmount - developerOffset - requiredBuyerPayment),
          remainingLoanAmount,
        )
      : 0;
    remainingLoanAmount = normalizeMoney(remainingLoanAmount - bankPayment);

    const cashbackReceived =
      isValid &&
      input.rebateTreatment === "cashback_later" &&
      stage.id === input.rebateStageId
        ? effectiveDeveloperRebate
        : 0;
    const netBuyerCashMovement = requiredBuyerPayment - cashbackReceived;
    cumulativeGrossBuyerPayments += requiredBuyerPayment;
    cumulativeCashbackReceived += cashbackReceived;

    return {
      stage,
      stagePercentage: stage.percentage,
      stageAmount,
      requiredBuyerPayment,
      bankPayment,
      developerOffset,
      cashbackReceived,
      netBuyerCashMovement,
      cumulativeGrossBuyerPayments,
      cumulativeCashbackReceived,
      cumulativeNetBuyerOutlay:
        cumulativeGrossBuyerPayments - cumulativeCashbackReceived,
    };
  });

  const grossBuyerPayments = stages.reduce(
    (sum, stage) => sum + stage.requiredBuyerPayment,
    0,
  );
  const totalBankPayments = stages.reduce((sum, stage) => sum + stage.bankPayment, 0);
  const totalDeveloperOffset = stages.reduce((sum, stage) => sum + stage.developerOffset, 0);
  const totalCashbackReceived = stages.reduce(
    (sum, stage) => sum + stage.cashbackReceived,
    0,
  );

  return {
    purchaseMethod: input.purchaseMethod,
    spaPrice,
    loanMarginPercent,
    loanAmount,
    grossBuyerEquity,
    grossBuyerPaymentObligation,
    developerRebatePercent,
    developerRebateAmount,
    effectiveDeveloperRebate,
    netOwnFundsRequired,
    netOwnFundsPercent: spaPrice > 0 ? (netOwnFundsRequired / spaPrice) * 100 : 0,
    buyerFundsToPrepare,
    grossBuyerPayments,
    totalBankPayments,
    totalDeveloperOffset,
    totalCashbackReceived,
    finalNetBuyerOutlay: grossBuyerPayments - totalCashbackReceived,
    rebateTreatment: input.rebateTreatment,
    rebateStageId: input.rebateStageId,
    rebateStageLabel: getStageLabel(input.rebateStageId),
    allocationError,
    isValid,
    validationErrors,
    stages,
  };
}

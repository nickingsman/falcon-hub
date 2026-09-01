export type PurchaseCostEstimateKey =
  | "spa_legal_fee"
  | "loan_legal_fee"
  | "spa_disbursement_fee"
  | "loan_disbursement_fee"
  | "loan_stamp_duty"
  | "mot_transfer_stamp_duty";

export type PurchaseCostEstimate = {
  amount: number;
  requiresManualConfirmation: boolean;
  note?: string;
};

export const falconSpaDisbursementEstimate = 1500;
export const falconLoanDisbursementEstimate = 1200;

export function calculateSro2023TableAAmount(basis: number) {
  if (!Number.isFinite(basis) || basis <= 0) return 0;

  const firstBand = Math.min(basis, 500000);
  const nextBand = Math.min(Math.max(basis - 500000, 0), 7000000);
  const firstBandFee = Math.max(firstBand * 0.0125, 500);

  return firstBandFee + nextBand * 0.01;
}

export function calculateHdaLegalFeeEstimate(basis: number): PurchaseCostEstimate {
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

export function calculateLoanStampDutyEstimate(loanAmount: number): PurchaseCostEstimate {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
    return { amount: 0, requiresManualConfirmation: false };
  }

  return {
    amount: Math.ceil(loanAmount / 1000) * 5,
    requiresManualConfirmation: false,
  };
}

export function createFixedFalconEstimate(amount: number): PurchaseCostEstimate {
  return {
    amount,
    requiresManualConfirmation: false,
    note: "Falcon estimate. Confirm package details manually.",
  };
}

export function calculateMotEstimate(spaPrice: number): PurchaseCostEstimate {
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

export function getPurchaseCostEstimates(
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBuyerPaymentSchedule,
  type BuyerPaymentIncentiveInput,
  type BuyerPaymentScheduleInput,
} from "./buyer-payment-schedule";
import { getScheduleHPercentageTotal } from "./progressive-interest";

const baseInput: BuyerPaymentScheduleInput = {
  spaPrice: 600_000,
  purchaseMethod: "loan",
  loanMarginPercent: 90,
  incentives: [],
};

function incentive(
  id: string,
  type: BuyerPaymentIncentiveInput["type"],
  percentage: number,
  applicationStageId: BuyerPaymentIncentiveInput["applicationStageId"],
): BuyerPaymentIncentiveInput {
  return { id, type, percentage, applicationStageId };
}

function calculate(overrides: Partial<BuyerPaymentScheduleInput> = {}) {
  const result = calculateBuyerPaymentSchedule({ ...baseInput, ...overrides });
  assert.equal(result.isValid, true);
  return result;
}

function stage(result: ReturnType<typeof calculate>, stageId: string) {
  const value = result.stages.find((item) => item.stage.id === stageId);
  assert.ok(value);
  return value;
}

test("single SPA rebate offsets only the SPA buyer payment", () => {
  const result = calculate({
    incentives: [incentive("rebate-1", "rebate", 5, "spa")],
  });

  assert.equal(result.totalRebate, 30_000);
  assert.equal(result.totalRebateApplied, 30_000);
  assert.equal(stage(result, "spa").requiredBuyerPayment, 30_000);
  assert.equal(stage(result, "spa").rebateApplied, 30_000);
  assert.equal(result.unusedRebateCarryForward, 0);
});

test("multiple rebates at different stages accumulate independently", () => {
  const result = calculate({
    purchaseMethod: "cash",
    incentives: [
      incentive("rebate-1", "rebate", 5, "spa"),
      incentive("rebate-2", "rebate", 10, "2b"),
    ],
  });

  assert.equal(stage(result, "spa").rebateApplied, 30_000);
  assert.equal(stage(result, "2a").rebateApplied, 0);
  assert.equal(stage(result, "2b").rebateApplied, 60_000);
  assert.equal(result.totalRebateApplied, 90_000);
  assert.equal(result.grossBuyerPayments, 510_000);
});

test("rebate exceeding a stage carries forward only to later stages", () => {
  const result = calculate({
    purchaseMethod: "cash",
    incentives: [incentive("rebate-1", "rebate", 15, "spa")],
  });

  assert.equal(stage(result, "spa").rebateApplied, 60_000);
  assert.equal(stage(result, "spa").rebateCarryForwardBalance, 30_000);
  assert.equal(stage(result, "2a").rebateApplied, 30_000);
  assert.equal(stage(result, "2a").requiredBuyerPayment, 30_000);
  assert.equal(stage(result, "2a").rebateCarryForwardBalance, 0);
});

test("cashback at VP is a separate cash inflow at VP", () => {
  const result = calculate({
    purchaseMethod: "cash",
    incentives: [incentive("cashback-1", "cashback", 10, "vp")],
  });
  const vp = stage(result, "vp");

  assert.equal(result.grossBuyerPayments, 600_000);
  assert.equal(vp.requiredBuyerPayment, 105_000);
  assert.equal(vp.cashbackReceived, 60_000);
  assert.equal(vp.netBuyerCashMovement, 45_000);
  assert.equal(result.netBuyerOwnFunds, 540_000);
});

test("rebate and cashback combine without double counting", () => {
  const result = calculate({
    incentives: [
      incentive("rebate-1", "rebate", 5, "spa"),
      incentive("cashback-1", "cashback", 5, "vp"),
    ],
  });

  assert.equal(result.grossBuyerPaymentObligation, 60_000);
  assert.equal(result.totalRebateApplied, 30_000);
  assert.equal(result.grossBuyerPayments, 30_000);
  assert.equal(result.totalCashbackReceived, 30_000);
  assert.equal(result.netBuyerOwnFunds, 0);
  assert.equal(
    result.grossBuyerPayments + result.totalBankPayments + result.totalRebateApplied,
    result.spaPrice,
  );
});

test("loan purchase preserves the existing buyer and bank allocation", () => {
  const result = calculate();

  assert.equal(result.loanAmount, 540_000);
  assert.equal(result.grossBuyerPaymentObligation, 60_000);
  assert.equal(stage(result, "spa").baseBuyerPayment, 60_000);
  assert.equal(stage(result, "2a").bankPayment, 60_000);
  assert.equal(result.grossBuyerPayments, 60_000);
  assert.equal(result.totalBankPayments, 540_000);
});

test("cash purchase funds every stage without bank financing", () => {
  const result = calculate({ purchaseMethod: "cash", loanMarginPercent: Number.NaN });

  assert.equal(result.loanAmount, 0);
  assert.equal(result.totalBankPayments, 0);
  assert.equal(result.grossBuyerPaymentObligation, 600_000);
  assert.equal(result.grossBuyerPayments, 600_000);
  assert.ok(result.stages.every((item) => item.bankPayment === 0));
});

test("zero incentives do not alter buyer cash flow", () => {
  const withoutIncentives = calculate();
  const withZeroIncentives = calculate({
    incentives: [
      incentive("rebate-0", "rebate", 0, "spa"),
      incentive("cashback-0", "cashback", 0, "vp"),
    ],
  });

  assert.equal(withZeroIncentives.totalRebate, 0);
  assert.equal(withZeroIncentives.totalCashback, 0);
  assert.deepEqual(withZeroIncentives.stages, withoutIncentives.stages);
});

test("rebates exceeding outstanding buyer payments remain unused without negatives", () => {
  const result = calculate({
    incentives: [incentive("rebate-1", "rebate", 100, "spa")],
  });

  assert.equal(result.totalRebate, 600_000);
  assert.equal(result.totalRebateApplied, 60_000);
  assert.equal(result.unusedRebateCarryForward, 540_000);
  assert.equal(result.grossBuyerPayments, 0);
  assert.ok(result.stages.every((item) => item.requiredBuyerPayment >= 0));
});

test("stage timing prevents future incentives from changing earlier payments", () => {
  const result = calculate({
    incentives: [
      incentive("rebate-1", "rebate", 10, "2a"),
      incentive("cashback-1", "cashback", 5, "vp"),
    ],
  });

  assert.equal(stage(result, "spa").requiredBuyerPayment, 60_000);
  assert.equal(stage(result, "spa").rebateApplied, 0);
  assert.equal(stage(result, "spa").cashbackReceived, 0);
  assert.equal(result.totalRebateApplied, 0);
  assert.equal(result.unusedRebateCarryForward, 60_000);
  assert.equal(stage(result, "vp").cashbackReceived, 30_000);
});

test("multiple incentives at the same stage are summed by type", () => {
  const result = calculate({
    purchaseMethod: "cash",
    incentives: [
      incentive("rebate-1", "rebate", 3, "2a"),
      incentive("rebate-2", "rebate", 2, "2a"),
      incentive("cashback-1", "cashback", 1, "2a"),
    ],
  });
  const foundation = stage(result, "2a");

  assert.equal(foundation.rebateAvailableAtStage, 30_000);
  assert.equal(foundation.rebateApplied, 30_000);
  assert.equal(foundation.cashbackReceived, 6_000);
  assert.equal(foundation.netBuyerCashMovement, 24_000);
});

test("invalid incentive percentages are rejected", () => {
  const negative = calculateBuyerPaymentSchedule({
    ...baseInput,
    incentives: [incentive("rebate-negative", "rebate", -1, "spa")],
  });
  const excessive = calculateBuyerPaymentSchedule({
    ...baseInput,
    incentives: [incentive("cashback-excessive", "cashback", 100.01, "vp")],
  });

  assert.equal(negative.isValid, false);
  assert.match(negative.validationErrors.join(" "), /between 0% and 100%/);
  assert.equal(excessive.isValid, false);
  assert.match(excessive.validationErrors.join(" "), /between 0% and 100%/);
});

test("canonical Schedule H stages remain at 100%", () => {
  assert.equal(getScheduleHPercentageTotal(), 100);
});

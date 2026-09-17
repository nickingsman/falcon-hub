import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBuyerPaymentSchedule,
  type BuyerPaymentScheduleInput,
} from "./buyer-payment-schedule";
import { getScheduleHPercentageTotal } from "./progressive-interest";

const baseInput: BuyerPaymentScheduleInput = {
  spaPrice: 600_000,
  purchaseMethod: "loan",
  loanMarginPercent: 90,
  developerRebatePercent: 0,
  rebateTreatment: "direct_offset",
  rebateStageId: "spa",
};

function calculate(overrides: Partial<BuyerPaymentScheduleInput> = {}) {
  const result = calculateBuyerPaymentSchedule({ ...baseInput, ...overrides });
  assert.equal(result.isValid, true);
  assert.equal(result.allocationError, null);
  return result;
}

function stage(result: ReturnType<typeof calculate>, stageId: string) {
  const value = result.stages.find((item) => item.stage.id === stageId);
  assert.ok(value);
  return value;
}

test("existing 90% loan allocation is preserved", () => {
  const result = calculate();

  assert.equal(result.loanAmount, 540_000);
  assert.equal(result.grossBuyerEquity, 60_000);
  assert.equal(stage(result, "spa").requiredBuyerPayment, 60_000);
  assert.equal(stage(result, "2a").bankPayment, 60_000);
  assert.equal(result.grossBuyerPayments, 60_000);
  assert.equal(result.totalBankPayments, 540_000);
});

test("cash purchase funds every stage without bank financing", () => {
  const result = calculate({ purchaseMethod: "cash", loanMarginPercent: Number.NaN });

  assert.equal(result.loanAmount, 0);
  assert.equal(result.totalBankPayments, 0);
  assert.equal(result.grossBuyerPayments, 600_000);
  assert.equal(result.finalNetBuyerOutlay, 600_000);
  assert.ok(result.stages.every((item) => item.bankPayment === 0));
});

test("cash direct offset begins only at the selected application stage", () => {
  const result = calculate({
    purchaseMethod: "cash",
    developerRebatePercent: 10,
    rebateTreatment: "direct_offset",
    rebateStageId: "2a",
  });

  assert.equal(stage(result, "spa").developerOffset, 0);
  assert.equal(stage(result, "spa").requiredBuyerPayment, 60_000);
  assert.equal(stage(result, "2a").developerOffset, 60_000);
  assert.equal(stage(result, "2a").requiredBuyerPayment, 0);
  assert.equal(result.totalBankPayments, 0);
  assert.equal(result.grossBuyerPayments, 540_000);
  assert.equal(result.totalDeveloperOffset, 60_000);
});

test("cash cashback later records the VP inflow and reconciles", () => {
  const result = calculate({
    purchaseMethod: "cash",
    developerRebatePercent: 10,
    rebateTreatment: "cashback_later",
    rebateStageId: "vp",
  });
  const vp = stage(result, "vp");

  assert.equal(result.loanAmount, 0);
  assert.equal(result.totalBankPayments, 0);
  assert.equal(result.grossBuyerPayments, 600_000);
  assert.equal(result.totalCashbackReceived, 60_000);
  assert.equal(result.finalNetBuyerOutlay, 540_000);
  assert.equal(vp.requiredBuyerPayment, 105_000);
  assert.equal(vp.cashbackReceived, 60_000);
  assert.equal(vp.netBuyerCashMovement, 45_000);
});

test("loan cashback later preserves loan and gross buyer payments", () => {
  const result = calculate({
    developerRebatePercent: 10,
    rebateTreatment: "cashback_later",
    rebateStageId: "vp",
  });

  assert.equal(result.loanAmount, 540_000);
  assert.equal(result.grossBuyerPayments, 60_000);
  assert.equal(result.totalBankPayments, 540_000);
  assert.equal(result.totalCashbackReceived, 60_000);
  assert.equal(result.finalNetBuyerOutlay, 0);
  assert.equal(stage(result, "vp").cashbackReceived, 60_000);
  assert.ok(result.stages.filter((item) => item.stage.id !== "vp").every((item) => item.cashbackReceived === 0));
});

test("cashback before buyer funds are exhausted does not reduce required payments", () => {
  const withoutCashback = calculate({ loanMarginPercent: 70 });
  const withCashback = calculate({
    loanMarginPercent: 70,
    developerRebatePercent: 5,
    rebateTreatment: "cashback_later",
    rebateStageId: "2a",
  });

  assert.deepEqual(
    withCashback.stages.map((item) => item.requiredBuyerPayment),
    withoutCashback.stages.map((item) => item.requiredBuyerPayment),
  );
});

test("cashback after buyer funds are exhausted can create a negative stage movement", () => {
  const result = calculate({
    developerRebatePercent: 10,
    rebateTreatment: "cashback_later",
    rebateStageId: "2a",
  });
  const release = stage(result, "2a");

  assert.equal(release.requiredBuyerPayment, 0);
  assert.equal(release.cashbackReceived, 60_000);
  assert.equal(release.netBuyerCashMovement, -60_000);
});

test("cashback larger than the selected-stage buyer payment is not clamped", () => {
  const result = calculate({
    loanMarginPercent: 85,
    developerRebatePercent: 15,
    rebateTreatment: "cashback_later",
    rebateStageId: "2a",
  });
  const release = stage(result, "2a");

  assert.equal(release.requiredBuyerPayment, 30_000);
  assert.equal(release.cashbackReceived, 90_000);
  assert.equal(release.netBuyerCashMovement, -60_000);
});

test("partial buyer and bank transition remains supported", () => {
  const result = calculate({ loanMarginPercent: 75 });
  const structure = stage(result, "2b");

  assert.equal(structure.requiredBuyerPayment, 30_000);
  assert.equal(structure.bankPayment, 60_000);
});

test("direct-offset capacity validation is preserved", () => {
  const result = calculateBuyerPaymentSchedule({
    ...baseInput,
    purchaseMethod: "cash",
    developerRebatePercent: 10,
    rebateStageId: "stakeholder",
  });

  assert.equal(result.isValid, true);
  assert.match(result.allocationError ?? "", /cannot be fully applied/);
});

test("direct-offset and cashback schedules reconcile", () => {
  const direct = calculate({ developerRebatePercent: 7, rebateStageId: "2a" });
  const cashback = calculate({
    developerRebatePercent: 7,
    rebateTreatment: "cashback_later",
    rebateStageId: "stakeholder",
  });

  assert.equal(
    direct.grossBuyerPayments + direct.totalBankPayments + direct.totalDeveloperOffset,
    direct.spaPrice,
  );
  assert.equal(
    cashback.grossBuyerPayments + cashback.totalBankPayments,
    cashback.spaPrice,
  );
  assert.equal(
    cashback.finalNetBuyerOutlay,
    cashback.grossBuyerPayments - cashback.totalCashbackReceived,
  );
});

test("rebate remains capped to the gross buyer obligation", () => {
  const loan = calculate({ developerRebatePercent: 50, rebateTreatment: "cashback_later" });
  const cash = calculate({
    purchaseMethod: "cash",
    developerRebatePercent: 100,
    rebateTreatment: "cashback_later",
  });

  assert.equal(loan.effectiveDeveloperRebate, 60_000);
  assert.equal(cash.effectiveDeveloperRebate, 600_000);
});

test("canonical Schedule H stages remain at 100%", () => {
  assert.equal(getScheduleHPercentageTotal(), 100);
});

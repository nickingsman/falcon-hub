import assert from "node:assert/strict";
import test from "node:test";

import {
  generateAmortizationSchedule,
  getLoanSavings,
  getOutstandingBalanceAtMonth,
} from "./loan-amortization";
import { calculateMonthlyInstalment } from "./property-finance";

const baseLoan = {
  loanAmount: 540_000,
  annualInterestRatePercent: 3.7,
  tenureYears: 35,
};

function requireResult(result: ReturnType<typeof generateAmortizationSchedule>) {
  assert.ok(result);
  return result;
}

test("Case A: standard 35-year loan matches Falcon's canonical instalment", () => {
  const result = requireResult(generateAmortizationSchedule(baseLoan));
  const canonicalInstalment = calculateMonthlyInstalment(540_000, 3.7, 35);

  assert.ok(canonicalInstalment !== null);
  assert.equal(result.monthlyInstalment, canonicalInstalment);
  assert.equal(result.monthlyInstalment.toFixed(2), "2294.79");
  assert.equal(result.payoffMonth, 420);
  assert.equal(result.schedule.at(-1)?.closingBalance, 0);
  assert.ok(Math.abs(result.totalPrincipal - 540_000) < 0.01);
  assert.ok(Math.abs(result.totalRepayment - result.totalPrincipal - result.totalInterest) < 0.01);
});

test("Case B: RM500 extra payment shortens the loan and reduces interest", () => {
  const normal = requireResult(generateAmortizationSchedule(baseLoan));
  const accelerated = requireResult(
    generateAmortizationSchedule({ ...baseLoan, extraMonthlyPayment: 500 }),
  );
  const savings = getLoanSavings(normal, accelerated);

  assert.ok(accelerated.payoffMonth < normal.payoffMonth);
  assert.ok(accelerated.totalInterest < normal.totalInterest);
  assert.ok(savings.monthsSaved > 0);
  assert.ok(savings.interestSaved > 0);
  assert.equal(accelerated.schedule.at(-1)?.closingBalance, 0);
});

test("Case C: zero-interest loan divides principal evenly without NaN", () => {
  const result = requireResult(
    generateAmortizationSchedule({
      loanAmount: 120_000,
      annualInterestRatePercent: 0,
      tenureYears: 10,
    }),
  );

  assert.equal(result.monthlyInstalment, 1_000);
  assert.equal(result.totalInterest, 0);
  assert.ok(result.schedule.every((row) => Number.isFinite(row.payment)));
});

test("Case D: a very large extra payment is capped at the amount due", () => {
  const result = requireResult(
    generateAmortizationSchedule({ ...baseLoan, extraMonthlyPayment: 10_000_000 }),
  );
  const finalPayment = result.schedule.at(-1);

  assert.equal(result.payoffMonth, 1);
  assert.ok(finalPayment);
  assert.ok(finalPayment.payment <= finalPayment.openingBalance + finalPayment.interest);
  assert.equal(finalPayment.closingBalance, 0);
});

test("Case E: outstanding balance lookup covers origination and payoff", () => {
  const result = requireResult(generateAmortizationSchedule(baseLoan));

  assert.equal(getOutstandingBalanceAtMonth(result, 0), 540_000);
  assert.equal(getOutstandingBalanceAtMonth(result, result.payoffMonth), 0);
  assert.ok(getOutstandingBalanceAtMonth(result, 60) < getOutstandingBalanceAtMonth(result, 12));
  assert.ok(getOutstandingBalanceAtMonth(result, 120) < getOutstandingBalanceAtMonth(result, 60));
});

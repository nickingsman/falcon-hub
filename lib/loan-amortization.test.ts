import assert from "node:assert/strict";
import test from "node:test";

import {
  generateAmortizationSchedule,
  getLoanSavings,
  getOutstandingBalanceAtMonth,
  summarizeAmortizationByYear,
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
  assert.equal(summarizeAmortizationByYear(result.schedule).length, 35);
  assert.equal(result.schedule.slice(34 * 12).length, 12);
  assert.equal(result.schedule.at(-1)?.month, 420);
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

test("Monthly rows expose actual payment components from the canonical engine", () => {
  const result = requireResult(generateAmortizationSchedule(baseLoan));
  const firstMonth = result.schedule[0];

  assert.ok(firstMonth);
  assert.ok(Math.abs(firstMonth.interest - 1_665) < 0.000001);
  assert.ok(Math.abs(firstMonth.payment - result.monthlyInstalment) < 0.000001);
  assert.ok(Math.abs(firstMonth.principal - (firstMonth.payment - firstMonth.interest)) < 0.000001);
  assert.ok(Math.abs(firstMonth.closingBalance - (firstMonth.openingBalance - firstMonth.principal)) < 0.000001);
  assert.equal(firstMonth.extraPayment, 0);
  assert.ok(result.schedule.every((row) => row.extraPayment === 0));
});

test("Extra-payment schedule groups into a partial final year with capped values", () => {
  const result = requireResult(
    generateAmortizationSchedule({ ...baseLoan, extraMonthlyPayment: 270 }),
  );
  const years = summarizeAmortizationByYear(result.schedule);
  const finalYearRows = result.schedule.slice(28 * 12);
  const firstMonth = result.schedule[0];
  const finalMonth = result.schedule.at(-1);

  assert.equal(result.payoffMonth, 341);
  assert.equal(years.length, 29);
  assert.equal(finalYearRows.length, 5);
  assert.equal(finalYearRows[0]?.month, 337);
  assert.equal(finalMonth?.month, 341);
  assert.equal(finalMonth?.closingBalance, 0);
  assert.ok(firstMonth);
  assert.ok(Math.abs(firstMonth.payment - (result.monthlyInstalment + 270)) < 0.000001);
  assert.equal(firstMonth.extraPayment, 270);
  assert.ok(finalMonth);
  assert.ok(finalMonth.payment <= result.monthlyInstalment + 270);
  assert.ok(finalMonth.extraPayment <= 270);
});

test("Every yearly summary reconciles with its monthly payment rows", () => {
  const result = requireResult(
    generateAmortizationSchedule({ ...baseLoan, extraMonthlyPayment: 270 }),
  );
  const years = summarizeAmortizationByYear(result.schedule);

  for (const year of years) {
    const rows = result.schedule.slice((year.year - 1) * 12, year.year * 12);
    const principal = rows.reduce((sum, row) => sum + row.principal, 0);
    const interest = rows.reduce((sum, row) => sum + row.interest, 0);
    const payment = rows.reduce((sum, row) => sum + row.payment, 0);

    assert.ok(Math.abs(principal - year.principalPaid) < 0.000001);
    assert.ok(Math.abs(interest - year.interestPaid) < 0.000001);
    assert.ok(Math.abs(payment - year.totalPayment) < 0.000001);
    assert.equal(rows[0]?.openingBalance, year.openingBalance);
    assert.equal(rows.at(-1)?.closingBalance, year.closingBalance);
  }
});

test("Zero-interest monthly rows remain finite with RM0 interest", () => {
  const result = requireResult(
    generateAmortizationSchedule({
      loanAmount: 120_000,
      annualInterestRatePercent: 0,
      tenureYears: 10,
      extraMonthlyPayment: 250,
    }),
  );

  assert.ok(result.schedule.every((row) => row.interest === 0));
  assert.ok(result.schedule.every((row) => Number.isFinite(row.closingBalance)));
  assert.equal(result.schedule.at(-1)?.closingBalance, 0);
});

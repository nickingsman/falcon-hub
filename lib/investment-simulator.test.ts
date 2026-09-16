import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInvestmentScenario,
  calculateInvestmentEntryCapital,
  calculateInvestmentFinancing,
  calculateInvestmentPricePosition,
  calculateInvestmentSimulation,
  getInvestmentYear,
  type InvestmentSimulatorInput,
} from "./investment-simulator";
import {
  generateAmortizationSchedule,
  getOutstandingBalanceAtMonth,
} from "./loan-amortization";

const baseInvestment: InvestmentSimulatorInput = {
  spaPrice: 600_000,
  nettPrice: 600_000,
  initialCashRequired: 72_000,
  loanMarginPercent: 90,
  annualInterestRatePercent: 3.7,
  loanTenureYears: 35,
  startingMonthlyRental: 2_300,
  rentalAppreciationPercent: 2,
  monthlyMaintenance: 300,
  otherMonthlyExpenses: 0,
  capitalAppreciationPercent: 3,
  estimatedSellingCostPercent: 3,
  holdingPeriodYears: 20,
};

function requireSimulation(input: InvestmentSimulatorInput = baseInvestment) {
  const result = calculateInvestmentSimulation(input);
  assert.ok(result);
  return result;
}

test("Case A: base investment uses canonical loan and explicit growth conventions", () => {
  const result = requireSimulation();
  const loan = generateAmortizationSchedule({
    loanAmount: 540_000,
    annualInterestRatePercent: 3.7,
    tenureYears: 35,
  });
  assert.ok(loan);

  assert.equal(result.loanAmount, 540_000);
  assert.equal(result.monthlyInstalment, loan.monthlyInstalment);
  assert.equal(result.monthlyInstalment.toFixed(2), "2294.79");

  for (const exitYear of [5, 10, 15, 20]) {
    const year = getInvestmentYear(result, exitYear);
    assert.ok(year);
    assert.ok(Math.abs(year.propertyValue - 600_000 * 1.03 ** exitYear) < 0.000001);
    assert.ok(Math.abs(year.monthlyRental - 2_300 * 1.02 ** (exitYear - 1)) < 0.000001);
    assert.equal(year.outstandingLoan, getOutstandingBalanceAtMonth(loan, exitYear * 12));
    assert.ok(Math.abs(year.equity - (year.propertyValue - year.outstandingLoan)) < 0.000001);
    assert.ok(Math.abs(year.netSaleProceedsBeforeTax - (year.propertyValue - year.estimatedSellingCost - year.outstandingLoan)) < 0.000001);
    assert.ok(Math.abs(year.estimatedInvestmentProfit - (year.netSaleProceedsBeforeTax + year.cumulativePositiveOperatingCashFlow - year.totalCashInvested)) < 0.000001);
  }
});

test("Case B: zero capital appreciation keeps property value constant", () => {
  const result = requireSimulation({ ...baseInvestment, capitalAppreciationPercent: 0 });
  assert.ok(result.years.every((year) => year.propertyValue === 600_000));
});

test("Case C: zero rental appreciation keeps rent constant", () => {
  const result = requireSimulation({ ...baseInvestment, rentalAppreciationPercent: 0 });
  assert.ok(result.years.every((year) => year.monthlyRental === 2_300));
});

test("Case D: negative operating cash flow increases total cash invested", () => {
  const result = requireSimulation({ ...baseInvestment, startingMonthlyRental: 0 });
  const yearFive = getInvestmentYear(result, 5);
  assert.ok(yearFive);
  assert.ok(yearFive.cumulativeNegativeOperatingCashFlow > 0);
  assert.equal(yearFive.totalCashInvested, 72_000 + yearFive.cumulativeNegativeOperatingCashFlow);
});

test("Case E: positive cash flow is tracked separately from cash invested", () => {
  const result = requireSimulation({
    ...baseInvestment,
    loanMarginPercent: 0,
    startingMonthlyRental: 5_000,
  });
  const yearFive = getInvestmentYear(result, 5);
  assert.ok(yearFive);
  assert.equal(yearFive.totalCashInvested, 72_000);
  assert.ok(yearFive.cumulativePositiveOperatingCashFlow > 0);
  assert.equal(yearFive.cumulativeNegativeOperatingCashFlow, 0);
});

test("Case F: loan payment and balance become zero after payoff", () => {
  const result = requireSimulation({ ...baseInvestment, loanTenureYears: 5 });
  const yearSix = getInvestmentYear(result, 6);
  assert.ok(yearSix);
  assert.equal(yearSix.outstandingLoan, 0);
  const expectedCashFlow = yearSix.monthlyRental - 300;
  assert.ok(Math.abs(yearSix.averageMonthlyCashFlow - expectedCashFlow) < 0.000001);
});

test("Case G: zero selling cost makes net proceeds equal value minus loan", () => {
  const result = requireSimulation({ ...baseInvestment, estimatedSellingCostPercent: 0 });
  const yearTen = getInvestmentYear(result, 10);
  assert.ok(yearTen);
  assert.equal(yearTen.estimatedSellingCost, 0);
  assert.ok(Math.abs(yearTen.netSaleProceedsBeforeTax - (yearTen.propertyValue - yearTen.outstandingLoan)) < 0.000001);
});

test("Case H: presets change only capital and rental growth assumptions", () => {
  const preservedKeys: Array<keyof InvestmentSimulatorInput> = [
    "spaPrice",
    "nettPrice",
    "initialCashRequired",
    "loanMarginPercent",
    "annualInterestRatePercent",
    "loanTenureYears",
    "startingMonthlyRental",
    "monthlyMaintenance",
    "otherMonthlyExpenses",
    "estimatedSellingCostPercent",
    "holdingPeriodYears",
  ];

  for (const scenario of ["conservative", "base", "optimistic"] as const) {
    const updated = applyInvestmentScenario(baseInvestment, scenario);
    for (const key of preservedKeys) assert.equal(updated[key], baseInvestment[key]);
  }

  assert.equal(applyInvestmentScenario(baseInvestment, "conservative").capitalAppreciationPercent, 2);
  assert.equal(applyInvestmentScenario(baseInvestment, "base").rentalAppreciationPercent, 2);
  assert.equal(applyInvestmentScenario(baseInvestment, "optimistic").capitalAppreciationPercent, 4);
});

test("financing remains available independently of entry capital and rental assumptions", () => {
  const financing = calculateInvestmentFinancing({
    spaPrice: 500_000,
    loanMarginPercent: 90,
    annualInterestRatePercent: 3.7,
    loanTenureYears: 35,
  });

  assert.ok(financing);
  assert.equal(financing.loanAmount, 450_000);
  assert.equal(financing.monthlyInstalment.toFixed(2), "1912.33");

  const zeroCapitalAndRental = calculateInvestmentSimulation({
    ...baseInvestment,
    spaPrice: 500_000,
    nettPrice: 500_000,
    initialCashRequired: 0,
    loanMarginPercent: 90,
    startingMonthlyRental: 0,
  });
  assert.ok(zeroCapitalAndRental);
  assert.equal(zeroCapitalAndRental.loanAmount, financing.loanAmount);
  assert.equal(zeroCapitalAndRental.monthlyInstalment, financing.monthlyInstalment);
});

test("financing uses SPA Price and loan margin rather than downpayment assumptions", () => {
  const financing = calculateInvestmentFinancing({
    spaPrice: 600_000,
    loanMarginPercent: 80,
    annualInterestRatePercent: 3.7,
    loanTenureYears: 35,
  });

  assert.ok(financing);
  assert.equal(financing.loanAmount, 480_000);
  assert.equal(financing.monthlyInstalment.toFixed(2), "2039.82");
});

test("SPA-based financing and Nett-based projections remain distinct", () => {
  const result = requireSimulation({
    ...baseInvestment,
    spaPrice: 600_000,
    nettPrice: 530_000,
    loanMarginPercent: 90,
  });

  assert.equal(result.loanAmount, 540_000);
  assert.equal(result.years[0]?.propertyValue, 530_000 * 1.03);
});

test("price position derives either downpayment or cashback without negatives", () => {
  assert.deepEqual(calculateInvestmentPricePosition(550_000, 525_600), {
    suggestedDownpayment: 24_400,
    cashback: 0,
  });
  assert.deepEqual(calculateInvestmentPricePosition(530_000, 540_000), {
    suggestedDownpayment: 0,
    cashback: 10_000,
  });
  assert.deepEqual(calculateInvestmentPricePosition(600_000, 540_000), {
    suggestedDownpayment: 60_000,
    cashback: 0,
  });
});

test("cashback reconciles gross costs to net initial capital and excess cashback", () => {
  const reconciled = calculateInvestmentEntryCapital({
    downpayment: 0,
    renovation: 20_000,
    otherCosts: 13_000 + 15_000,
    cashback: 10_000,
  });

  assert.deepEqual(reconciled, {
    grossEntryCosts: 48_000,
    netInitialCapital: 38_000,
    excessCashback: 0,
  });

  const result = requireSimulation({
    ...baseInvestment,
    spaPrice: 600_000,
    nettPrice: 530_000,
    initialCashRequired: reconciled.netInitialCapital,
    loanMarginPercent: 90,
  });
  assert.equal(result.input.initialCashRequired, 38_000);
  assert.equal(
    result.years[0]?.totalCashInvested,
    38_000 + (result.years[0]?.cumulativeNegativeOperatingCashFlow ?? 0),
  );

  assert.deepEqual(
    calculateInvestmentEntryCapital({
      downpayment: 0,
      renovation: 2_000,
      otherCosts: 0,
      cashback: 10_000,
    }),
    {
      grossEntryCosts: 2_000,
      netInitialCapital: 0,
      excessCashback: 8_000,
    },
  );
});

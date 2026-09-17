import assert from "node:assert/strict";
import test from "node:test";

import { calculateRoi } from "./property-finance";
import {
  calculateMotEstimate,
  calculateMotEstimateForBuyer,
  calculatePurchaseCostTreatmentSummary,
  getApplicableForeignerConsent,
  resolvePurchaseCostAmount,
} from "./purchase-costs";

test("Malaysian / PR MOT preserves the progressive calculation", () => {
  assert.equal(calculateMotEstimate(100_000).amount, 1_000);
  assert.equal(calculateMotEstimate(500_000).amount, 9_000);
  assert.equal(calculateMotEstimate(1_000_000).amount, 24_000);
  assert.equal(calculateMotEstimate(1_500_000).amount, 44_000);

  for (const price of [100_000, 500_000, 1_000_000, 1_500_000]) {
    assert.deepEqual(
      calculateMotEstimateForBuyer(price, "malaysian_pr"),
      calculateMotEstimate(price),
    );
  }
});

test("Foreigner MOT uses the flat 8% residential estimate", () => {
  assert.equal(calculateMotEstimateForBuyer(100_000, "foreigner").amount, 8_000);
  assert.equal(calculateMotEstimateForBuyer(500_000, "foreigner").amount, 40_000);
  assert.equal(calculateMotEstimateForBuyer(1_000_000, "foreigner").amount, 80_000);
  assert.equal(calculateMotEstimateForBuyer(1_500_000, "foreigner").amount, 120_000);
  assert.equal(calculateMotEstimateForBuyer(0, "foreigner").amount, 0);
  assert.equal(calculateMotEstimateForBuyer(-1, "foreigner").amount, 0);
  assert.equal(calculateMotEstimateForBuyer(Number.NaN, "foreigner").amount, 0);
});

test("manual MOT stays authoritative and reset-to-auto follows the current buyer", () => {
  const manualAmount = 70_000;
  const malaysianEstimate = calculateMotEstimateForBuyer(1_000_000, "malaysian_pr");
  const foreignEstimate = calculateMotEstimateForBuyer(1_000_000, "foreigner");

  assert.equal(resolvePurchaseCostAmount("manual", manualAmount, malaysianEstimate.amount), 70_000);
  assert.equal(resolvePurchaseCostAmount("manual", manualAmount, foreignEstimate.amount), 70_000);
  assert.equal(resolvePurchaseCostAmount("auto", 0, malaysianEstimate.amount), 24_000);
  assert.equal(resolvePurchaseCostAmount("auto", 0, foreignEstimate.amount), 80_000);
});

test("purchase-cost treatments include only customer-paid amounts in cash required", () => {
  const customerPay = calculatePurchaseCostTreatmentSummary([
    { treatment: "customer_pay", amount: 80_000 },
  ]);
  const absorbed = calculatePurchaseCostTreatmentSummary([
    { treatment: "developer_absorbed", amount: 80_000 },
  ]);
  const notApplicable = calculatePurchaseCostTreatmentSummary([
    { treatment: "not_applicable", amount: 80_000 },
  ]);

  assert.equal(customerPay.customerPayPurchaseCosts, 80_000);
  assert.equal(absorbed.customerPayPurchaseCosts, 0);
  assert.equal(absorbed.developerAbsorbedPurchaseCosts, 80_000);
  assert.equal(notApplicable.customerPayPurchaseCosts, 0);
  assert.equal(notApplicable.developerAbsorbedPurchaseCosts, 0);
});

test("Foreigner Consent is preserved across buyer switches and only increases cash required", () => {
  assert.equal(getApplicableForeignerConsent("foreigner", 0), 0);
  assert.equal(getApplicableForeignerConsent("foreigner", 5_000), 5_000);
  assert.equal(getApplicableForeignerConsent("malaysian_pr", 5_000), 0);
  assert.equal(getApplicableForeignerConsent("foreigner", -5_000), 0);

  const baseInput = {
    spaPrice: 1_000_000,
    packageItems: [],
    loanMarginPercent: 90,
    annualInterestRatePercent: 3.7,
    loanTenureYears: 35,
    unitSizeSqft: 1_000,
    maintenanceRatePerSqft: 0.3,
    expectedMonthlyRental: 4_000,
    otherUpfrontCosts: 80_000,
  };
  const withoutConsent = calculateRoi(baseInput);
  const withConsent = calculateRoi({ ...baseInput, otherUpfrontCosts: 85_000 });

  assert.equal(
    withConsent.estimatedTotalCashRequired - withoutConsent.estimatedTotalCashRequired,
    5_000,
  );
  assert.equal(withConsent.loanAmount, withoutConsent.loanAmount);
  assert.equal(withConsent.nettPrice, withoutConsent.nettPrice);
  assert.equal(withConsent.estimatedMonthlyInstalment, withoutConsent.estimatedMonthlyInstalment);
  assert.equal(withConsent.monthlyMaintenance, withoutConsent.monthlyMaintenance);
  assert.equal(withConsent.monthlyCashFlow, withoutConsent.monthlyCashFlow);
});

test("Own Stay and Investment use the same purchase-cost total", () => {
  const costs = [
    { treatment: "customer_pay" as const, amount: 80_000 },
    { treatment: "developer_absorbed" as const, amount: 10_000 },
  ];
  const ownStayTotal = calculatePurchaseCostTreatmentSummary(costs);
  const investmentTotal = calculatePurchaseCostTreatmentSummary(costs);

  assert.deepEqual(investmentTotal, ownStayTotal);
  assert.equal(ownStayTotal.customerPayPurchaseCosts, 80_000);
});

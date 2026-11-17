import assert from "node:assert/strict";
import test from "node:test";

import { buildInvestmentAnalysisPdfHtml } from "./investment-simulator-pdf";
import {
  calculateInvestmentSimulation,
  type InvestmentSimulatorInput,
} from "./investment-simulator";

const baseInput: InvestmentSimulatorInput = {
  spaPrice: 1_250_000,
  nettPrice: 1_100_000,
  initialCashRequired: 185_000,
  loanMarginPercent: 80,
  annualInterestRatePercent: 3.85,
  loanTenureYears: 30,
  startingMonthlyRental: 4_800,
  rentalAppreciationPercent: 2,
  monthlyMaintenance: 550,
  otherMonthlyExpenses: 250,
  capitalAppreciationPercent: 3,
  estimatedSellingCostPercent: 3,
  holdingPeriodYears: 10,
};

function buildReport(
  input: InvestmentSimulatorInput = baseInput,
  projectName = "A Very Long Falcon Residence Name That Must Wrap Safely & Clearly",
  includeComparison = false,
) {
  const result = calculateInvestmentSimulation(input);
  assert.ok(result);
  const exitComparison = includeComparison
    ? result.years.filter((year) => [5, 10, 15, 20].includes(year.year))
    : [];

  return {
    html: buildInvestmentAnalysisPdfHtml({
      branding: { agentName: "Nicholas Yap", agentPhone: "6010-279 0296" },
      generatedOn: "11 Oct 2026",
      projectName,
      unitType: "Type A · 3 Bedroom",
      result,
      exitComparison,
    }),
    result,
  };
}

test("investment report uses one fixed A4 portrait page and Falcon customer branding", () => {
  const { html } = buildReport();

  assert.match(html, /@page \{ size: A4 portrait; margin: 0; \}/);
  assert.match(html, /height: 297mm/);
  assert.match(html, /width: 210mm/);
  assert.equal((html.match(/<main class="report-page">/g) ?? []).length, 1);
  assert.match(html, /FALCON HUB/);
  assert.match(html, /Your Investment Exit Plan/);
  assert.match(html, /Prepared by Nicholas Yap/);
  assert.match(html, /Terms &amp; Conditions Apply\./);
  assert.equal(
    (html.match(/<div class="customer-pdf-watermark customer-pdf-watermark-enhanced"/g) ?? [])
      .length,
    1,
  );
  assert.doesNotMatch(html, /<div class="customer-pdf-watermark-grid"/);
});

test("investment report exports values from the canonical simulation result", () => {
  const { html, result } = buildReport();
  const selected = result.selectedYear;

  assert.ok(html.includes("RM\u00a01,250,000.00"));
  assert.ok(html.includes("RM\u00a01,100,000.00"));
  assert.ok(
    html.includes(
      `RM\u00a0${result.loanAmount.toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    ),
  );
  assert.ok(
    html.includes(
      `RM\u00a0${selected.propertyValue.toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    ),
  );
  assert.match(html, /Projected Property Value/);
  assert.match(html, /Outstanding Loan/);
  assert.match(html, /Estimated Selling Costs/);
  assert.match(html, /Total Cash Invested/);
  assert.match(html, /Estimated ROI/);
  assert.match(html, /Estimated Investment Profit/);
  assert.match(html, /Net Sale Proceeds/);
  assert.match(html, /Your Investment Journey/);
  assert.match(html, /Positive Operating Surplus/);
});

test("advanced export includes the existing exit-year comparison", () => {
  const { html, result } = buildReport(baseInput, "Arra Residence", true);

  assert.match(html, /Exit Comparison/);
  assert.match(html, /See how time could change the outcome/);
  for (const year of [5, 10, 15, 20]) {
    assert.match(html, new RegExp(`Year ${year}`));
    const scenario = result.years.find((item) => item.year === year);
    assert.ok(scenario);
    for (const value of [
      scenario.propertyValue,
      scenario.netSaleProceedsBeforeTax,
      scenario.totalCashInvested,
      scenario.estimatedInvestmentProfit,
    ]) {
      assert.ok(html.includes(formatExpectedMoney(Math.abs(value))));
    }
  }
  assert.match(html, /selected-row/);
});

test("simple export keeps the selected exit without the advanced comparison", () => {
  const { html } = buildReport();

  assert.doesNotMatch(html, /See how time could change the outcome/);
  assert.match(html, /Your Exit Profit/);
  assert.match(html, /Cash Flow At Your Exit/);
  assert.match(html, /Projected Monthly Rental/);
  assert.match(html, /05 \/ Assumptions/);
});

test("investment report safely handles long project names and HTML characters", () => {
  const { html } = buildReport();

  assert.match(
    html,
    /A Very Long Falcon Residence Name That Must Wrap Safely &amp; Clearly/,
  );
  assert.doesNotMatch(html, /Wrap Safely & Clearly/);
  assert.match(html, /overflow-wrap: anywhere/);
});

test("investment report keeps zero and large financial values readable", () => {
  const { html } = buildReport({
    ...baseInput,
    spaPrice: 10_000_000,
    nettPrice: 9_500_000,
    initialCashRequired: 0,
    loanMarginPercent: 100,
    startingMonthlyRental: 0,
    monthlyMaintenance: 0,
    otherMonthlyExpenses: 0,
  });

  assert.ok(html.includes("RM\u00a010,000,000.00"));
  assert.ok(html.includes("RM\u00a00.00"));
  assert.match(html, /white-space: nowrap/);
  assert.doesNotMatch(html, /text-overflow:\s*ellipsis/);
});

test("zero invested capital keeps ROI unavailable instead of infinite", () => {
  const { html, result } = buildReport({
    ...baseInput,
    initialCashRequired: 0,
    loanMarginPercent: 100,
    startingMonthlyRental: 10_000,
    monthlyMaintenance: 0,
    otherMonthlyExpenses: 0,
  });

  assert.equal(result.selectedYear.totalCashInvested, 0);
  assert.equal(result.selectedYear.estimatedRoiPercent, null);
  assert.match(html, /Estimated ROI<\/span><strong class="tone-neutral">N\/A/);
  assert.doesNotMatch(html, /Infinity/);
});

test("negative cash flow and investment loss remain visible", () => {
  const { html, result } = buildReport({
    ...baseInput,
    startingMonthlyRental: 0,
    capitalAppreciationPercent: -8,
    holdingPeriodYears: 5,
  });

  assert.ok(result.selectedYear.cumulativeOperatingCashFlow < 0);
  assert.ok(result.selectedYear.estimatedInvestmentProfit < 0);
  assert.match(html, /tone-negative/);
  assert.ok(html.includes(formatExpectedSigned(result.selectedYear.estimatedInvestmentProfit)));
});

function formatExpectedSigned(value: number) {
  return `${value > 0 ? "+" : "-"} ${formatExpectedMoney(Math.abs(value))}`;
}

function formatExpectedMoney(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

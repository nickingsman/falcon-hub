import {
  getCustomerPdfBrandingStyles,
  renderCustomerPdfBranding,
  renderCustomerPdfWatermark,
  type CustomerPdfBranding,
} from "./customer-pdf-branding";
import type { InvestmentSimulatorResult, InvestmentYearResult } from "./investment-simulator";

const moneyFormatter = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatSignedMoney(value: number) {
  if (!Number.isFinite(value) || value === 0) return formatMoney(0);
  return `${value > 0 ? "+" : "-"} ${formatMoney(Math.abs(value))}`;
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "N/A" : `${percentFormatter.format(value)}%`;
}

function getTone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export type InvestmentAnalysisPdfInput = {
  branding: CustomerPdfBranding;
  generatedOn: string;
  projectName?: string | null;
  unitType?: string | null;
  result: InvestmentSimulatorResult;
  exitComparison?: InvestmentYearResult[];
};

export function buildInvestmentAnalysisPdfHtml({ branding, generatedOn, projectName, unitType, result, exitComparison = [] }: InvestmentAnalysisPdfInput) {
  const selected = result.selectedYear;
  const propertyLine = [projectName?.trim(), unitType?.trim()].filter(Boolean).join(" · ");
  const hasComparison = exitComparison.length > 0;

  const renderExitComparison = () => {
    if (!hasComparison) return "";
    return `
      <section class="section comparison-section">
        <div class="section-heading-row">
          <div><p class="section-kicker">04 / Exit Comparison</p><h2>See how time could change the outcome</h2></div>
          <span class="comparison-note">Selected: Year ${selected.year}</span>
        </div>
        <div class="comparison-table-wrap"><table class="comparison-table">
          <thead><tr><th>Exit</th><th>Property Value</th><th>Net Sale Proceeds</th><th>Total Cash Invested</th><th>Investment Profit</th><th>ROI</th></tr></thead>
          <tbody>${exitComparison.map((year) => `
            <tr class="${year.year === selected.year ? "selected-row" : ""}">
              <td>Year ${year.year}</td><td>${escapeHtml(formatMoney(year.propertyValue))}</td><td>${escapeHtml(formatMoney(year.netSaleProceedsBeforeTax))}</td><td>${escapeHtml(formatMoney(year.totalCashInvested))}</td><td class="tone-${getTone(year.estimatedInvestmentProfit)}">${escapeHtml(formatSignedMoney(year.estimatedInvestmentProfit))}</td><td class="tone-${getTone(year.estimatedRoiPercent)}">${escapeHtml(formatPercent(year.estimatedRoiPercent))}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </section>`;
  };

  const renderSimpleExitDetails = () => {
    if (hasComparison) return "";
    return `
      <section class="section simple-exit-section">
        <p class="section-kicker">04 / Cash Flow At Your Exit</p>
        <div class="simple-exit-grid">
          <div><span>Projected Monthly Rental</span><strong>${escapeHtml(formatMoney(selected.monthlyRental))}</strong></div>
          <div><span>Average Monthly Cash Flow</span><strong class="tone-${getTone(selected.averageMonthlyCashFlow)}">${escapeHtml(formatSignedMoney(selected.averageMonthlyCashFlow))}</strong></div>
          <div><span>Annual Operating Cash Flow</span><strong class="tone-${getTone(selected.annualOperatingCashFlow)}">${escapeHtml(formatSignedMoney(selected.annualOperatingCashFlow))}</strong></div>
          <div><span>Cumulative Operating Cash Flow</span><strong class="tone-${getTone(selected.cumulativeOperatingCashFlow)}">${escapeHtml(formatSignedMoney(selected.cumulativeOperatingCashFlow))}</strong></div>
        </div>
      </section>`;
  };

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="format-detection" content="telephone=no" />
  <title>Falcon-Investment-Exit-${selected.year}Y</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { height: 297mm; margin: 0; width: 210mm; }
    body { background: #fff; color: #27272a; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-page { height: 297mm; margin: 0 auto; overflow: hidden; padding: 8.5mm 10mm 14mm; position: relative; width: 210mm; z-index: 2; }
    .report-header { align-items: flex-start; border-bottom: 1.5px solid #b8924a; display: flex; gap: 8mm; justify-content: space-between; padding-bottom: 3.2mm; }
    .brand { color: #171717; font-size: 8.5px; font-weight: 800; letter-spacing: .24em; }
    h1 { color: #18181b; font-size: 23px; letter-spacing: -.025em; line-height: 1.08; margin: 1.7mm 0 0; }
    .property { color: #52525b; font-size: 9.3px; font-weight: 600; line-height: 1.35; margin: 1.6mm 0 0; max-width: 138mm; overflow-wrap: anywhere; }
    .generated { color: #71717a; font-size: 7.8px; line-height: 1.4; margin: 0; text-align: right; white-space: nowrap; }
    .section { break-inside: avoid; margin-top: 3.5mm; page-break-inside: avoid; }
    .section-kicker { color: #8a6a2d; font-size: 7.5px; font-weight: 800; letter-spacing: .15em; margin: 0; text-transform: uppercase; }
    .section h2 { color: #18181b; font-size: 11.5px; line-height: 1.2; margin: .9mm 0 0; }
    .section-heading-row { align-items: flex-end; display: flex; gap: 5mm; justify-content: space-between; margin-bottom: 1.8mm; }
    .comparison-note { color: #71717a; font-size: 7.4px; white-space: nowrap; }
    .overview-grid { background: #faf8f3; border: 1px solid #e7e5e4; border-radius: 2.6mm; display: grid; gap: 2.2mm 4mm; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1.8mm; padding: 2.8mm 3.2mm; }
    .overview-grid span, .simple-exit-grid span { color: #71717a; display: block; font-size: 7.1px; line-height: 1.2; }
    .overview-grid strong, .simple-exit-grid strong { display: block; font-size: 10px; font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: .8mm; white-space: nowrap; }
    .journey { align-items: stretch; display: grid; grid-template-columns: 1fr 8mm 1fr 8mm 1fr 8mm 1fr; margin-top: 1.8mm; }
    .journey-step { background: #fff; border: 1px solid #e7e5e4; border-radius: 2.6mm; min-width: 0; padding: 2.7mm; }
    .journey-step.exit { background: #fbf8ef; border-color: #d5b96d; }
    .journey-number { color: #a17c35; display: block; font-size: 6.8px; font-weight: 800; letter-spacing: .12em; }
    .journey-step span:not(.journey-number) { color: #52525b; display: block; font-size: 7.3px; line-height: 1.25; margin-top: 1mm; }
    .journey-step strong { color: #18181b; display: block; font-size: 11px; font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: .9mm; overflow-wrap: anywhere; }
    .journey-arrow { align-items: center; color: #b8924a; display: flex; font-size: 14px; font-weight: 700; justify-content: center; }
    .profit-panel { background: #fbf8ef; border: 1px solid #d5b96d; border-radius: 3mm; margin-top: 1.8mm; overflow: hidden; }
    .profit-lead { align-items: stretch; display: grid; grid-template-columns: 1.7fr 1fr 1fr; }
    .profit-primary, .profit-secondary { padding: 3mm 3.4mm; }
    .profit-secondary { border-left: 1px solid #e5d7ad; }
    .profit-primary span, .profit-secondary span { color: #6b6253; display: block; font-size: 7.2px; line-height: 1.2; }
    .profit-primary strong { display: block; font-size: 20px; font-variant-numeric: tabular-nums; letter-spacing: -.025em; line-height: 1.05; margin-top: 1.2mm; white-space: nowrap; }
    .profit-secondary strong { display: block; font-size: 13px; font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: 1.2mm; white-space: nowrap; }
    .exit-support { border-top: 1px solid #e5d7ad; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .support-item { border-right: 1px solid #e5d7ad; padding: 2.4mm 2.7mm; }
    .support-item:last-child { border-right: 0; }
    .support-item span { color: #716956; display: block; font-size: 6.8px; line-height: 1.2; }
    .support-item strong { display: block; font-size: 9.1px; font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: .8mm; white-space: nowrap; }
    .calculation-line { align-items: center; background: #fff; border-top: 1px solid #e5d7ad; display: grid; grid-template-columns: 1.25fr 7mm 1fr 7mm 1.15fr 7mm 1.3fr; padding: 2.3mm 2.7mm; }
    .calc-item span { color: #71717a; display: block; font-size: 6.7px; line-height: 1.2; }
    .calc-item strong { display: block; font-size: 8.9px; font-variant-numeric: tabular-nums; margin-top: .7mm; white-space: nowrap; }
    .calc-operator { color: #8a6a2d; font-size: 12px; font-weight: 800; text-align: center; }
    .calculation-note { color: #71717a; font-size: 6.6px; line-height: 1.35; margin: 1.2mm 2.7mm 2.2mm; }
    .tone-positive { color: #047857 !important; }
    .tone-negative { color: #b91c1c !important; }
    .tone-neutral { color: #27272a !important; }
    .comparison-table-wrap { border: 1px solid #e7e5e4; border-radius: 2.4mm; overflow: hidden; }
    .comparison-table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    .comparison-table th { background: #faf8f3; color: #71717a; font-size: 6.9px; font-weight: 700; line-height: 1.2; padding: 2.2mm 1.5mm; text-align: right; }
    .comparison-table th:first-child, .comparison-table td:first-child { text-align: left; width: 10%; }
    .comparison-table th:nth-child(2), .comparison-table td:nth-child(2) { width: 19%; }
    .comparison-table th:nth-child(3), .comparison-table td:nth-child(3) { width: 19%; }
    .comparison-table th:nth-child(4), .comparison-table td:nth-child(4) { width: 18%; }
    .comparison-table th:nth-child(5), .comparison-table td:nth-child(5) { width: 20%; }
    .comparison-table th:nth-child(6), .comparison-table td:nth-child(6) { width: 14%; }
    .comparison-table td { border-top: 1px solid #eeeae2; color: #27272a; font-size: 7.4px; font-variant-numeric: tabular-nums; line-height: 1.2; padding: 2.4mm 1.5mm; text-align: right; white-space: nowrap; }
    .comparison-table td:first-child { font-weight: 700; }
    .comparison-table .selected-row td { background: #fbf8ef; font-weight: 700; }
    .simple-exit-grid { background: #faf8f3; border: 1px solid #e7e5e4; border-radius: 2.5mm; display: grid; gap: 2mm; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 1.8mm; padding: 2.8mm 3.2mm; }
    .assumptions { align-items: start; background: #faf8f3; border: 1px solid #e7e5e4; border-radius: 2.4mm; display: grid; gap: 2mm 4mm; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1.8mm; padding: 2.5mm 3mm; }
    .assumptions span { color: #71717a; display: block; font-size: 6.8px; }
    .assumptions strong { display: block; font-size: 9px; font-variant-numeric: tabular-nums; margin-top: .7mm; white-space: nowrap; }
    .disclaimer { border-top: 1px solid #e7e5e4; color: #71717a; font-size: 6.9px; line-height: 1.4; margin: 3.2mm 0 0; padding-top: 2.2mm; }
    .simple-report .section { margin-top: 4.3mm; }
    .simple-report .overview-grid, .simple-report .journey-step { padding-bottom: 3.5mm; padding-top: 3.5mm; }
    .simple-report .profit-primary, .simple-report .profit-secondary { padding-bottom: 4mm; padding-top: 4mm; }
    .simple-report .support-item, .simple-report .calculation-line { padding-bottom: 3mm; padding-top: 3mm; }
    .simple-report .simple-exit-grid, .simple-report .assumptions { padding-bottom: 3.5mm; padding-top: 3.5mm; }
    ${getCustomerPdfBrandingStyles()}
    .customer-pdf-watermark-enhanced { top: 44%; }
    @media print { html, body { background: #fff; height: 297mm; overflow: hidden; } .report-page { break-after: avoid; break-before: avoid; break-inside: avoid; margin: 0; page-break-after: avoid; page-break-before: avoid; page-break-inside: avoid; } }
  </style>
</head><body class="${hasComparison ? "advanced-report" : "simple-report"}">
  ${renderCustomerPdfWatermark(branding, { enhancedVisibility: true })}
  <main class="report-page">
    <header class="report-header"><div><div class="brand">FALCON HUB</div><h1>Your Investment Exit Plan</h1>${propertyLine ? `<p class="property">${escapeHtml(propertyLine)}</p>` : ""}</div><p class="generated">Prepared<br />${escapeHtml(generatedOn)}</p></header>

    <section class="section"><p class="section-kicker">01 / Investment Overview</p><div class="overview-grid">
      <div><span>SPA Price</span><strong>${escapeHtml(formatMoney(result.input.spaPrice))}</strong></div><div><span>Nett Price</span><strong>${escapeHtml(formatMoney(result.input.nettPrice))}</strong></div><div><span>Loan Amount</span><strong>${escapeHtml(formatMoney(result.loanAmount))}</strong></div>
      <div><span>Monthly Instalment</span><strong>${escapeHtml(formatMoney(result.monthlyInstalment))}</strong></div><div><span>Expected Monthly Rental</span><strong>${escapeHtml(formatMoney(result.input.startingMonthlyRental))}</strong></div><div><span>Initial Capital Required</span><strong>${escapeHtml(formatMoney(result.input.initialCashRequired))}</strong></div>
    </div></section>

    <section class="section"><p class="section-kicker">02 / Your Investment Journey</p><div class="journey">
      <div class="journey-step"><span class="journey-number">START</span><span>Purchase Today</span><strong>${escapeHtml(formatMoney(result.input.nettPrice))}</strong></div><div class="journey-arrow">→</div>
      <div class="journey-step"><span class="journey-number">HOLD</span><span>Investment Period</span><strong>${selected.year} Years</strong></div><div class="journey-arrow">→</div>
      <div class="journey-step"><span class="journey-number">GROW</span><span>Projected Property Value</span><strong>${escapeHtml(formatMoney(selected.propertyValue))}</strong></div><div class="journey-arrow">→</div>
      <div class="journey-step exit"><span class="journey-number">EXIT</span><span>Estimated Cash From Sale</span><strong>${escapeHtml(formatMoney(selected.netSaleProceedsBeforeTax))}</strong></div>
    </div></section>

    <section class="section"><p class="section-kicker">03 / Your Exit Profit</p><div class="profit-panel">
      <div class="profit-lead"><div class="profit-primary"><span>Estimated Investment Profit</span><strong class="tone-${getTone(selected.estimatedInvestmentProfit)}">${escapeHtml(formatSignedMoney(selected.estimatedInvestmentProfit))}</strong></div><div class="profit-secondary"><span>Estimated ROI</span><strong class="tone-${getTone(selected.estimatedRoiPercent)}">${escapeHtml(formatPercent(selected.estimatedRoiPercent))}</strong></div><div class="profit-secondary"><span>Holding Period</span><strong>Year ${selected.year}</strong></div></div>
      <div class="exit-support"><div class="support-item"><span>Property Equity</span><strong>${escapeHtml(formatMoney(selected.equity))}</strong></div><div class="support-item"><span>Outstanding Loan</span><strong>${escapeHtml(formatMoney(selected.outstandingLoan))}</strong></div><div class="support-item"><span>Estimated Selling Costs</span><strong>${escapeHtml(formatMoney(selected.estimatedSellingCost))}</strong></div><div class="support-item"><span>Net Sale Proceeds</span><strong>${escapeHtml(formatMoney(selected.netSaleProceedsBeforeTax))}</strong></div><div class="support-item"><span>Cumulative Operating Cash Flow</span><strong class="tone-${getTone(selected.cumulativeOperatingCashFlow)}">${escapeHtml(formatSignedMoney(selected.cumulativeOperatingCashFlow))}</strong></div></div>
      <div class="calculation-line"><div class="calc-item"><span>Net Sale Proceeds</span><strong>${escapeHtml(formatMoney(selected.netSaleProceedsBeforeTax))}</strong></div><div class="calc-operator">+</div><div class="calc-item"><span>Positive Operating Surplus</span><strong>${escapeHtml(formatMoney(selected.cumulativePositiveOperatingCashFlow))}</strong></div><div class="calc-operator">-</div><div class="calc-item"><span>Total Cash Invested</span><strong>${escapeHtml(formatMoney(selected.totalCashInvested))}</strong></div><div class="calc-operator">=</div><div class="calc-item"><span>Investment Profit</span><strong class="tone-${getTone(selected.estimatedInvestmentProfit)}">${escapeHtml(formatSignedMoney(selected.estimatedInvestmentProfit))}</strong></div></div>
      <p class="calculation-note">Operating shortfalls are already included in Total Cash Invested. Positive operating surplus is added separately. Property Equity, Net Sale Proceeds and Investment Profit are different measures.</p>
    </div></section>

    ${renderExitComparison()}${renderSimpleExitDetails()}

    <section class="section"><p class="section-kicker">05 / Assumptions</p><div class="assumptions">
      <div><span>Loan Margin / Interest</span><strong>${escapeHtml(`${formatPercent(result.input.loanMarginPercent)} / ${formatPercent(result.input.annualInterestRatePercent)} p.a.`)}</strong></div><div><span>Loan Tenure</span><strong>${escapeHtml(`${result.input.loanTenureYears} Years`)}</strong></div><div><span>Monthly Property Costs</span><strong>${escapeHtml(formatMoney(result.input.monthlyMaintenance + result.input.otherMonthlyExpenses))}</strong></div>
      <div><span>Capital Appreciation</span><strong>${escapeHtml(`${formatPercent(result.input.capitalAppreciationPercent)} p.a.`)}</strong></div><div><span>Rental Appreciation</span><strong>${escapeHtml(`${formatPercent(result.input.rentalAppreciationPercent)} p.a.`)}</strong></div><div><span>Estimated Selling Cost</span><strong>${escapeHtml(formatPercent(result.input.estimatedSellingCostPercent))}</strong></div>
    </div></section>

    <p class="disclaimer">Illustration only, based on the assumptions provided. Property values, financing, rental, costs, taxes and returns may vary. Estimated ROI is a simple, non-annualized return; it is shown as N/A when invested capital is zero. No return or profit is guaranteed.</p>
    ${renderCustomerPdfBranding(branding)}
  </main>
</body></html>`;
}

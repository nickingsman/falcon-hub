"use client";

import { useMemo, useState } from "react";
import {
  calculateRoi,
  type CashBenefitTreatment,
  type DiscountMethod,
  type PackageItemType,
  type PurchasePackageItem,
  type RoiCalculatorResult,
} from "@/lib/property-finance";
import { formatMemberDisplayName } from "@/lib/member-display";
import { useAppPermissions } from "../../components/AppPermissionProvider";

type CalculatorForm = {
  projectName: string;
  unitNumber: string;
  unitType: string;
  unitSizeSqft: string;
  carpark: string;
  calculationDate: string;
  spaPrice: string;
  loanMarginPercent: string;
  annualInterestRatePercent: string;
  loanTenureYears: string;
  expectedMonthlyRental: string;
  maintenanceRatePerSqft: string;
  otherUpfrontCosts: string;
};

type EditablePackageItem = {
  id: string;
  type: PackageItemType;
  description: string;
  method: DiscountMethod;
  value: string;
  amount: string;
  treatment: CashBenefitTreatment;
  receiveAt: string;
};

const currencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const detailedCurrencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getMalaysiaDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) return 0;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return currencyFormatter.format(value).replace("MYR", "RM");
}

function formatCurrencyDetailed(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return detailedCurrencyFormatter.format(value).replace("MYR", "RM");
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";

  return `${percentageFormatter.format(value)}%`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function proposalRow(label: string, value: string, emphasis = false) {
  return `
    <div class="row ${emphasis ? "emphasis-row" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function proposalCompactField(label: string, value: string) {
  return `
    <div class="compact-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function purchaseLine(label: string, value: string, note?: string, emphasis = false) {
  return `
    <div class="purchase-line ${emphasis ? "purchase-line-emphasis" : ""}">
      <div>
        <strong>${escapeHtml(label)}</strong>
        ${note ? `<span>${escapeHtml(note)}</span>` : ""}
      </div>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function formatCashBenefitTreatment(
  treatment: CashBenefitTreatment,
  receiveAt: string | undefined,
) {
  if (treatment === "immediate_offset") return "Immediate Offset";

  return receiveAt ? `Refund Later (${receiveAt})` : "Refund Later";
}

function buildRoiProposalHtml({
  form,
  numericInput,
  result,
  preparedBy,
}: {
  form: CalculatorForm;
  numericInput: {
    loanMarginPercent: number;
    annualInterestRatePercent: number;
    loanTenureYears: number;
    expectedMonthlyRental: number;
    otherUpfrontCosts: number;
  };
  result: RoiCalculatorResult;
  preparedBy: string;
}) {
  const projectName = form.projectName.trim() || "Property ROI Proposal";
  const monthlyCashFlow = result.monthlyCashFlow ?? 0;
  const monthlyCashFlowLabel =
    monthlyCashFlow > 0
      ? "Positive Cash Flow"
      : monthlyCashFlow < 0
        ? "Negative Cash Flow"
        : "Break-even Cash Flow";
  const discountRows = result.processedDiscounts
    .map((discount) =>
      purchaseLine(discount.description, `- ${formatCurrency(discount.amount)}`),
    )
    .join("");
  const cashBenefitRows = result.cashBenefits
    .map((benefit) =>
      purchaseLine(
        benefit.description,
        `- ${formatCurrency(benefit.amount)}`,
        formatCashBenefitTreatment(benefit.treatment, benefit.receiveAt),
      ),
    )
    .join("");
  const nonCashBenefitRows = result.nonCashBenefits
    .map(
      (benefit) => `
        <div class="included-benefit">
          <div>
            <strong>${escapeHtml(benefit.description)}</strong>
            <span>Included non-cash benefit</span>
          </div>
          <b>Included</b>
        </div>
      `,
    )
    .join("");
  const purchasePackageRows = `
    ${purchaseLine("SPA Price", formatCurrency(result.spaPrice))}
    ${discountRows || `<p class="empty calculation-empty">No discount items entered.</p>`}
    <div class="calculation-divider"></div>
    ${purchaseLine("Nett Price", formatCurrency(result.nettPrice), undefined)}
    ${cashBenefitRows || `<p class="empty calculation-empty">No cash benefits entered.</p>`}
    <div class="calculation-divider strong"></div>
    ${purchaseLine("Final Price After Benefits", formatCurrency(result.finalPriceAfterBenefits), undefined, true)}
  `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(projectName)} - ROI Proposal</title>
    <style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #18181b;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: #ffffff;
        padding: 10mm;
      }
      .eyebrow {
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 5px 0 0;
        color: #09090b;
        font-size: 23px;
        line-height: 1.12;
      }
      h2 {
        margin: 0 0 8px;
        color: #09090b;
        font-size: 12px;
      }
      .muted { color: #71717a; }
      .header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        border-bottom: 1px solid #e4e4e7;
        padding-bottom: 10px;
      }
      .date {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px 9px;
        color: #52525b;
        font-size: 10px;
        white-space: nowrap;
      }
      .sections {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 9px;
      }
      .section {
        break-inside: avoid;
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        padding: 9px;
      }
      .section.wide { grid-column: 1 / -1; }
      .section.compact-list { padding-bottom: 5px; }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        border-top: 1px solid #f1f1f1;
        padding: 5px 0;
        font-size: 9.8px;
      }
      .row:first-of-type { border-top: 0; }
      .row span { color: #71717a; }
      .row strong { color: #18181b; text-align: right; }
      .emphasis-row strong {
        color: #087F6B;
        font-size: 12px;
      }
      .compact-fields {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
        margin-top: 8px;
      }
      .compact-field {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px;
      }
      .compact-field span {
        display: block;
        color: #71717a;
        font-size: 8px;
      }
      .compact-field strong {
        display: block;
        margin-top: 3px;
        color: #18181b;
        font-size: 10px;
      }
      .purchase-line {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 0;
        font-size: 9.5px;
      }
      .purchase-line strong { display: block; color: #18181b; }
      .purchase-line span {
        display: block;
        margin-top: 2px;
        color: #71717a;
      }
      .purchase-line b { color: #18181b; text-align: right; white-space: nowrap; }
      .purchase-line-emphasis strong,
      .purchase-line-emphasis b {
        color: #087F6B;
        font-size: 11px;
      }
      .calculation-divider {
        margin: 4px 0;
        border-top: 1px solid #d4d4d8;
      }
      .calculation-divider.strong {
        border-top-color: #99d8cd;
      }
      .calculation-empty {
        padding: 2px 0 4px;
      }
      .included-benefits {
        margin-top: 7px;
        border-top: 1px solid #f1f1f1;
        padding-top: 6px;
      }
      .included-benefit {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 3px 0;
        font-size: 9.5px;
      }
      .included-benefit strong { display: block; color: #18181b; }
      .included-benefit span {
        display: block;
        margin-top: 2px;
        color: #71717a;
      }
      .included-benefit b { color: #18181b; text-align: right; white-space: nowrap; }
      .cash-flow-positive { color: #087F6B !important; }
      .cash-flow-negative { color: #be123c !important; }
      .empty { margin: 0; color: #71717a; font-size: 9.8px; }
      .summary {
        break-inside: avoid;
        margin-top: 9px;
        border: 1px solid #99d8cd;
        border-radius: 14px;
        background: #effaf7;
        padding: 10px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .summary-card {
        border-radius: 11px;
        background: #ffffff;
        padding: 9px;
      }
      .summary-card span {
        display: block;
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary-card strong {
        display: block;
        margin-top: 5px;
        color: #087F6B;
        font-size: 16px;
        line-height: 1.1;
      }
      .prepared {
        break-inside: avoid;
        margin-top: 9px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #e4e4e7;
        padding-top: 8px;
        font-size: 10px;
      }
      .prepared span {
        display: block;
        color: #71717a;
        font-size: 8px;
      }
      .prepared strong {
        display: block;
        margin-top: 2px;
        color: #18181b;
        font-size: 11px;
      }
      .disclaimer {
        margin: 7px 0 0;
        color: #71717a;
        font-size: 8px;
        line-height: 1.35;
      }
      @media print {
        body { background: #ffffff; }
        .page { width: auto; min-height: auto; margin: 0; padding: 0; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <div>
          <div class="eyebrow">Falcon Hub ROI Proposal</div>
          <h1>${escapeHtml(projectName)}</h1>
        </div>
        <div class="date">Calculation Date: ${escapeHtml(form.calculationDate || "-")}</div>
      </section>

      <section class="section wide" style="margin-top: 9px;">
        <h2>Property Information</h2>
        <div class="compact-fields">
          ${proposalCompactField("Unit", form.unitNumber || "-")}
          ${proposalCompactField("Type", form.unitType || "-")}
          ${proposalCompactField("Size", form.unitSizeSqft ? `${form.unitSizeSqft} sqft` : "-")}
          ${proposalCompactField("Carpark", form.carpark || "-")}
        </div>
      </section>

      <section class="sections">
        <div class="section wide compact-list">
          <h2>Purchase Package</h2>
          ${purchasePackageRows}
          ${
            nonCashBenefitRows
              ? `<div class="included-benefits">
                  <h2>Included Benefits</h2>
                  ${nonCashBenefitRows}
                </div>`
              : ""
          }
        </div>
        <div class="section">
          <h2>Financing</h2>
          ${proposalRow("Loan Margin", formatPercent(numericInput.loanMarginPercent))}
          ${proposalRow("Interest Rate", formatPercent(numericInput.annualInterestRatePercent))}
          ${proposalRow("Loan Tenure", `${numericInput.loanTenureYears || 0} years`)}
          ${proposalRow("Loan Amount", formatCurrency(result.loanAmount))}
          ${proposalRow("Estimated Monthly Instalment", formatCurrencyDetailed(result.estimatedMonthlyInstalment))}
        </div>
        <div class="section">
          <h2>Cash Required</h2>
          ${proposalRow("Upfront Cash Required", formatCurrency(result.upfrontCashBeforeOtherCosts))}
          ${proposalRow("Other Upfront Costs", formatCurrency(numericInput.otherUpfrontCosts))}
          ${proposalRow("Estimated Total Cash Required", formatCurrency(result.estimatedTotalCashRequired))}
        </div>
        <div class="section">
          <h2>Rental / Operating Figures</h2>
          ${proposalRow("Expected Monthly Rental", formatCurrencyDetailed(numericInput.expectedMonthlyRental))}
          ${proposalRow("Monthly Maintenance", formatCurrencyDetailed(result.monthlyMaintenance))}
          ${proposalRow("Net Rental Yield", formatPercent(result.netRentalYieldPercent))}
          ${proposalRow("Estimated Monthly Cash Flow", formatCurrencyDetailed(result.monthlyCashFlow))}
          ${proposalRow("Estimated Annual Cash Flow", formatCurrencyDetailed(result.annualCashFlow))}
          ${proposalRow("Cash-on-Cash Return", formatPercent(result.cashOnCashReturnPercent))}
        </div>
      </section>

      <section class="summary">
        <h2>Final Investment Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <span>Final Price After Benefits</span>
            <strong>${escapeHtml(formatCurrency(result.finalPriceAfterBenefits))}</strong>
          </div>
          <div class="summary-card">
            <span>Net Rental Yield</span>
            <strong>${escapeHtml(formatPercent(result.netRentalYieldPercent))}</strong>
          </div>
          <div class="summary-card">
            <span>${escapeHtml(monthlyCashFlowLabel)}</span>
            <strong class="${monthlyCashFlow < 0 ? "cash-flow-negative" : "cash-flow-positive"}">
              ${escapeHtml(formatCurrencyDetailed(result.monthlyCashFlow))}
            </strong>
          </div>
        </div>
      </section>

      <section class="prepared">
        <div>
          <span>Prepared by</span>
          <strong>${escapeHtml(preparedBy)}</strong>
        </div>
        <div class="eyebrow">Customer Proposal</div>
      </section>

      <p class="disclaimer">
        Figures shown are estimates for discussion purposes only. Actual financing, rebates, benefits, package terms, legal costs, and final purchase documentation are subject to bank approval, developer approval, and the signed final documents.
      </p>
    </main>
  </body>
</html>`;
}

function createPackageItem(type: PackageItemType): EditablePackageItem {
  return {
    id: crypto.randomUUID(),
    type,
    description:
      type === "discount"
        ? "Developer Rebate"
        : type === "cash_benefit"
          ? "Cashback"
          : "Free Furniture Package",
    method: "percentage_spa",
    value: "",
    amount: "",
    treatment: "refund_later",
    receiveAt: "",
  };
}

function toPackageItem(item: EditablePackageItem): PurchasePackageItem {
  if (item.type === "discount") {
    return {
      id: item.id,
      type: "discount",
      description: item.description.trim() || "Discount",
      method: item.method,
      value: parseMoney(item.value),
    };
  }

  if (item.type === "cash_benefit") {
    return {
      id: item.id,
      type: "cash_benefit",
      description: item.description.trim() || "Cash Benefit",
      amount: parseMoney(item.amount),
      treatment: item.treatment,
      receiveAt: item.receiveAt.trim() || undefined,
    };
  }

  return {
    id: item.id,
    type: "non_cash_benefit",
    description: item.description.trim() || "Non-Cash Benefit",
  };
}

function ResultRow({
  label,
  value,
  valueClassName = "text-zinc-900",
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
}>) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-3 last:border-0">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`text-right text-sm font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function RoiCalculatorPage() {
  const { displayName, memberCode } = useAppPermissions();
  const [form, setForm] = useState<CalculatorForm>({
    projectName: "",
    unitNumber: "",
    unitType: "",
    unitSizeSqft: "",
    carpark: "",
    calculationDate: getMalaysiaDateInputValue(),
    spaPrice: "",
    loanMarginPercent: "90",
    annualInterestRatePercent: "3.7",
    loanTenureYears: "35",
    expectedMonthlyRental: "",
    maintenanceRatePerSqft: "",
    otherUpfrontCosts: "0",
  });
  const [packageItems, setPackageItems] = useState<EditablePackageItem[]>([
    createPackageItem("discount"),
  ]);

  const numericInput = useMemo(
    () => ({
      spaPrice: parseMoney(form.spaPrice),
      loanMarginPercent: parseMoney(form.loanMarginPercent),
      annualInterestRatePercent: parseMoney(form.annualInterestRatePercent),
      loanTenureYears: parseMoney(form.loanTenureYears),
      unitSizeSqft: parseMoney(form.unitSizeSqft),
      maintenanceRatePerSqft: parseMoney(form.maintenanceRatePerSqft),
      expectedMonthlyRental: parseMoney(form.expectedMonthlyRental),
      otherUpfrontCosts: parseMoney(form.otherUpfrontCosts),
    }),
    [form],
  );
  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!Number.isFinite(numericInput.spaPrice) || numericInput.spaPrice <= 0) {
      messages.push("SPA Price must be more than RM 0.");
    }

    if (
      !Number.isFinite(numericInput.loanMarginPercent) ||
      numericInput.loanMarginPercent < 0 ||
      numericInput.loanMarginPercent > 100
    ) {
      messages.push("Loan Margin must be between 0% and 100%.");
    }

    if (
      !Number.isFinite(numericInput.annualInterestRatePercent) ||
      numericInput.annualInterestRatePercent < 0
    ) {
      messages.push("Interest Rate cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.loanTenureYears) ||
      numericInput.loanTenureYears <= 0
    ) {
      messages.push("Loan Tenure must be more than 0 years.");
    }

    if (!Number.isFinite(numericInput.unitSizeSqft) || numericInput.unitSizeSqft < 0) {
      messages.push("Unit Size cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.maintenanceRatePerSqft) ||
      numericInput.maintenanceRatePerSqft < 0
    ) {
      messages.push("Maintenance Rate cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.expectedMonthlyRental) ||
      numericInput.expectedMonthlyRental < 0
    ) {
      messages.push("Expected Monthly Rental cannot be negative.");
    }

    if (
      !Number.isFinite(numericInput.otherUpfrontCosts) ||
      numericInput.otherUpfrontCosts < 0
    ) {
      messages.push("Other Upfront Costs cannot be negative.");
    }

    for (const item of packageItems) {
      if (item.type === "discount") {
        const value = parseMoney(item.value);

        if (!Number.isFinite(value) || value < 0) {
          messages.push(`${item.description || "Discount"} must not be negative.`);
        }

        if (item.method !== "fixed" && value > 100) {
          messages.push(`${item.description || "Discount"} percentage cannot exceed 100%.`);
        }
      }

      if (item.type === "cash_benefit") {
        const amount = parseMoney(item.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          messages.push(`${item.description || "Cash Benefit"} must not be negative.`);
        }
      }
    }

    return messages;
  }, [numericInput, packageItems]);
  const result = useMemo(
    () =>
      calculateRoi({
        ...numericInput,
        packageItems: packageItems.map(toPackageItem),
      }),
    [numericInput, packageItems],
  );
  const hasBlockingValidation = validationMessages.length > 0;
  const cashFlowIsPositive = (result.monthlyCashFlow ?? 0) >= 0;

  function updateField(field: keyof CalculatorForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePackageItem(
    id: string,
    updates: Partial<EditablePackageItem>,
  ) {
    setPackageItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removePackageItem(id: string) {
    setPackageItems((current) => current.filter((item) => item.id !== id));
  }

  function addPackageItem(type: PackageItemType) {
    setPackageItems((current) => [...current, createPackageItem(type)]);
  }

  function handleExportPdf() {
    if (hasBlockingValidation) return;

    const proposalWindow = window.open("", "_blank");

    if (!proposalWindow) {
      window.alert("Please allow pop-ups to preview and export the PDF.");
      return;
    }

    proposalWindow.document.open();
    proposalWindow.document.write(
      buildRoiProposalHtml({
        form,
        numericInput,
        result,
        preparedBy: formatMemberDisplayName({
          full_name: displayName,
          member_code: memberCode,
        }),
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();

    window.setTimeout(() => {
      proposalWindow.print();
    }, 300);
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Tools - ROI Calculator</p>
          <p className="text-base font-semibold text-zinc-900">
            Property Investment Calculator
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={hasBlockingValidation}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export PDF
        </button>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              ROI Calculator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Property ROI Calculator
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
              Build a Malaysia new-launch package, estimate financing, and present rental returns in a customer-friendly format.
            </p>
          </div>
        </section>

        {hasBlockingValidation ? (
          <section className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold">Check these inputs before presenting:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Property & Unit
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Project Name
                  </span>
                  <input
                    value={form.projectName}
                    onChange={(event) => updateField("projectName", event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Number
                  </span>
                  <input
                    value={form.unitNumber}
                    onChange={(event) => updateField("unitNumber", event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Type
                  </span>
                  <input
                    value={form.unitType}
                    onChange={(event) => updateField("unitType", event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                    placeholder="e.g. 3 Bedrooms"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Calculation Date
                  </span>
                  <input
                    type="date"
                    value={form.calculationDate}
                    onChange={(event) =>
                      updateField("calculationDate", event.target.value)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Unit Size
                  </span>
                  <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50">
                    <input
                      inputMode="decimal"
                      value={form.unitSizeSqft}
                      onChange={(event) => updateField("unitSizeSqft", event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                      placeholder="950"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
                      sqft
                    </span>
                  </div>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Carpark
                  </span>
                  <input
                    value={form.carpark}
                    onChange={(event) => updateField("carpark", event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                    placeholder="e.g. 2 car parks"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                SPA Price
              </h2>
              <label className="mt-5 block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">
                  SPA Price
                </span>
                <input
                  inputMode="decimal"
                  value={form.spaPrice}
                  onChange={(event) => updateField("spaPrice", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  placeholder="500000"
                />
              </label>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    Discounts & Benefits
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Discounts are applied in order. Cash benefits affect final price, not Nett Price.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addPackageItem("discount")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Discount
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackageItem("cash_benefit")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Cash Benefit
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackageItem("non_cash_benefit")}
                    className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    + Non-Cash
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {packageItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        Item {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removePackageItem(item.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block text-sm text-zinc-600">
                        <span className="mb-1 block font-medium text-zinc-900">
                          Category
                        </span>
                        <select
                          value={item.type}
                          onChange={(event) =>
                            updatePackageItem(item.id, {
                              type: event.target.value as PackageItemType,
                            })
                          }
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        >
                          <option value="discount">Discount</option>
                          <option value="cash_benefit">Cash Benefit</option>
                          <option value="non_cash_benefit">Non-Cash Benefit</option>
                        </select>
                      </label>
                      <label className="block text-sm text-zinc-600">
                        <span className="mb-1 block font-medium text-zinc-900">
                          Description
                        </span>
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updatePackageItem(item.id, {
                              description: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                          placeholder="Developer Rebate"
                        />
                      </label>

                      {item.type === "discount" ? (
                        <>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Method
                            </span>
                            <select
                              value={item.method}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  method: event.target.value as DiscountMethod,
                                })
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                            >
                              <option value="percentage_spa">% based on SPA Price</option>
                              <option value="percentage_previous_balance">
                                % based on Previous Balance
                              </option>
                              <option value="fixed">Fixed RM discount</option>
                            </select>
                          </label>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Value
                            </span>
                            <input
                              inputMode="decimal"
                              value={item.value}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  value: event.target.value,
                                })
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                              placeholder={item.method === "fixed" ? "30000" : "10"}
                            />
                          </label>
                        </>
                      ) : null}

                      {item.type === "cash_benefit" ? (
                        <>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Amount
                            </span>
                            <input
                              inputMode="decimal"
                              value={item.amount}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  amount: event.target.value,
                                })
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                              placeholder="30000"
                            />
                          </label>
                          <label className="block text-sm text-zinc-600">
                            <span className="mb-1 block font-medium text-zinc-900">
                              Treatment
                            </span>
                            <select
                              value={item.treatment}
                              onChange={(event) =>
                                updatePackageItem(item.id, {
                                  treatment: event.target.value as CashBenefitTreatment,
                                })
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                            >
                              <option value="immediate_offset">Immediate Offset</option>
                              <option value="refund_later">Refund Later</option>
                            </select>
                          </label>
                          {item.treatment === "refund_later" ? (
                            <label className="block text-sm text-zinc-600 md:col-span-2">
                              <span className="mb-1 block font-medium text-zinc-900">
                                Refund / Receive At
                              </span>
                              <input
                                value={item.receiveAt}
                                onChange={(event) =>
                                  updatePackageItem(item.id, {
                                    receiveAt: event.target.value,
                                  })
                                }
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                                placeholder="Stage 2B, VP, upon loan disbursement"
                              />
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Financing & Rental
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Loan Margin %
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.loanMarginPercent}
                    onChange={(event) =>
                      updateField("loanMarginPercent", event.target.value)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Interest Rate %
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.annualInterestRatePercent}
                    onChange={(event) =>
                      updateField("annualInterestRatePercent", event.target.value)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Loan Tenure
                  </span>
                  <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50">
                    <input
                      inputMode="decimal"
                      value={form.loanTenureYears}
                      onChange={(event) =>
                        updateField("loanTenureYears", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
                      years
                    </span>
                  </div>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Expected Monthly Rental
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.expectedMonthlyRental}
                    onChange={(event) =>
                      updateField("expectedMonthlyRental", event.target.value)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                    placeholder="2500"
                  />
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Maintenance Rate
                  </span>
                  <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50">
                    <span className="border-r border-zinc-200 px-3 py-2 text-zinc-500">
                      RM
                    </span>
                    <input
                      inputMode="decimal"
                      value={form.maintenanceRatePerSqft}
                      onChange={(event) =>
                        updateField("maintenanceRatePerSqft", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                      placeholder="0.35"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">
                      /psf
                    </span>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-500">
                    Including sinking fund
                  </span>
                </label>
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Other Upfront Costs
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.otherUpfrontCosts}
                    onChange={(event) =>
                      updateField("otherUpfrontCosts", event.target.value)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section
              className={`rounded-[28px] border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${
                cashFlowIsPositive
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Estimated Monthly Cash Flow
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {formatCurrencyDetailed(result.monthlyCashFlow)}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Rental minus maintenance and estimated instalment.
              </p>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Customer Summary
              </h2>
              <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                <p className="font-semibold text-zinc-950">
                  {form.projectName || "Property Calculation"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {[form.unitNumber, form.unitType, form.unitSizeSqft ? `${form.unitSizeSqft} sqft` : ""]
                    .filter(Boolean)
                    .join(" - ") || "Unit details optional"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Calculation Date: {form.calculationDate || "-"}
                </p>
              </div>

              <div className="mt-5">
                <ResultRow label="SPA Price" value={formatCurrency(result.spaPrice)} />
                <ResultRow label="Nett Price" value={formatCurrency(result.nettPrice)} />
                <ResultRow
                  label="Final Price After Benefits"
                  value={formatCurrency(result.finalPriceAfterBenefits)}
                  valueClassName="text-lg font-bold text-[#087F6B]"
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Purchase Package
              </h2>
              <div className="mt-4 space-y-3">
                {result.processedDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {discount.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      -{formatCurrency(discount.amount)}
                    </p>
                  </div>
                ))}
                {result.cashBenefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {benefit.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatCurrency(benefit.amount)}
                      {benefit.treatment === "refund_later" && benefit.receiveAt
                        ? ` - Refund at ${benefit.receiveAt}`
                        : benefit.treatment === "refund_later"
                          ? " - Refund later"
                          : " - Immediate offset"}
                    </p>
                  </div>
                ))}
                {result.nonCashBenefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {benefit.description}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Included benefit
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">Financing</h2>
              <div className="mt-4">
                <ResultRow
                  label="Loan Margin"
                  value={formatPercent(numericInput.loanMarginPercent)}
                />
                <ResultRow label="Loan Amount" value={formatCurrency(result.loanAmount)} />
                <ResultRow
                  label="Interest Rate"
                  value={formatPercent(numericInput.annualInterestRatePercent)}
                />
                <ResultRow label="Tenure" value={`${numericInput.loanTenureYears || 0} years`} />
                <ResultRow
                  label="Estimated Monthly Instalment"
                  value={formatCurrencyDetailed(result.estimatedMonthlyInstalment)}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">
                Cash Required
              </h2>
              <div className="mt-4">
                <ResultRow
                  label="Upfront Cash Required"
                  value={formatCurrency(result.upfrontCashBeforeOtherCosts)}
                />
                <ResultRow
                  label="Other Upfront Costs"
                  value={formatCurrency(numericInput.otherUpfrontCosts)}
                />
                <ResultRow
                  label="Estimated Total Cash Required"
                  value={formatCurrency(result.estimatedTotalCashRequired)}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-semibold text-zinc-950">Returns</h2>
              <div className="mt-4">
                <ResultRow
                  label="Expected Monthly Rental"
                  value={formatCurrencyDetailed(numericInput.expectedMonthlyRental)}
                />
                <ResultRow
                  label="Monthly Maintenance"
                  value={formatCurrencyDetailed(result.monthlyMaintenance)}
                />
                <ResultRow
                  label="Estimated Monthly Instalment"
                  value={formatCurrencyDetailed(result.estimatedMonthlyInstalment)}
                />
                <ResultRow
                  label="Net Rental Yield"
                  value={formatPercent(result.netRentalYieldPercent)}
                />
                <ResultRow
                  label="Estimated Monthly Cash Flow"
                  value={formatCurrencyDetailed(result.monthlyCashFlow)}
                />
                <ResultRow
                  label="Estimated Annual Cash Flow"
                  value={formatCurrencyDetailed(result.annualCashFlow)}
                />
                <ResultRow
                  label="Cash-on-Cash Return"
                  value={formatPercent(result.cashOnCashReturnPercent)}
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

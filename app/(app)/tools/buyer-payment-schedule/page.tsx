"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCustomerPdfBrandingStyles,
  renderCustomerPdfBranding,
  renderCustomerPdfWatermark,
  type CustomerPdfBranding,
} from "@/lib/customer-pdf-branding";
import {
  calculateBuyerPaymentSchedule,
  type BuyerPaymentScheduleResult,
  type BuyerPaymentScheduleStage,
  type PurchaseMethod,
  type RebateTreatment,
} from "@/lib/buyer-payment-schedule";
import { scheduleHStages, type ScheduleHStageId } from "@/lib/progressive-interest";
import { useAppPermissions } from "../../components/AppPermissionProvider";
import { SearchCombobox } from "../../components/SearchCombobox";

type ProjectOption = {
  id: string;
  project_name: string | null;
  developer?: string | null;
  location?: string | null;
};

type TimelineStageId = Extract<
  ScheduleHStageId,
  "2a" | "2b" | "2c" | "2d" | "2e" | "2f" | "2g" | "2h" | "vp"
>;

type StageTiming = {
  year: string;
  quarter: string;
};

const timelineStageIds: TimelineStageId[] = [
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "2g",
  "2h",
  "vp",
];

const quarterOptions = ["Q1", "Q2", "Q3", "Q4"];

const rebateTreatmentOptions: Array<{ value: RebateTreatment; label: string }> = [
  { value: "direct_offset", label: "Direct Payment Offset" },
  { value: "cashback_later", label: "Cashback Later" },
];

const shortStageLabels: Record<TimelineStageId, { english: string; chinese: string }> = {
  "2a": { english: "Foundation", chinese: "地基" },
  "2b": { english: "Structure", chinese: "主体" },
  "2c": { english: "Walls", chinese: "墙体" },
  "2d": { english: "M&E", chinese: "水电" },
  "2e": { english: "Finishes", chinese: "饰面" },
  "2f": { english: "Sewerage", chinese: "排污" },
  "2g": { english: "Drainage", chinese: "排水" },
  "2h": { english: "Roads", chinese: "道路" },
  vp: { english: "VP", chinese: "交屋" },
};

function createInitialStageTimings() {
  return timelineStageIds.reduce(
    (timings, stageId) => ({
      ...timings,
      [stageId]: { year: "", quarter: "" },
    }),
    {} as Record<TimelineStageId, StageTiming>,
  );
}

function parseNumberInput(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getInputStateClass(isInvalid: boolean) {
  return isInvalid ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50";
}

function getStageTimingLabel(
  stageId: ScheduleHStageId,
  timings: Record<TimelineStageId, StageTiming>,
) {
  if (stageId === "spa") return "Upon Signing";
  if (!timelineStageIds.includes(stageId as TimelineStageId)) return "Timing TBC";

  const timing = timings[stageId as TimelineStageId];

  return timing?.year && timing?.quarter ? `${timing.year} ${timing.quarter}` : "Timing TBC";
}

function getStageDisplayTitle(result: BuyerPaymentScheduleStage) {
  return `${result.stage.code} ${result.stage.englishTitle}`;
}

function getShortStageTitle(result: BuyerPaymentScheduleStage) {
  if (result.stage.id === "spa") return "SPA Signing";
  if (!timelineStageIds.includes(result.stage.id as TimelineStageId)) {
    return result.stage.englishTitle;
  }

  const shortLabel = shortStageLabels[result.stage.id as TimelineStageId];

  return `${result.stage.code} ${shortLabel.english}`;
}

function getScheduleStageOptionLabel(stage: (typeof scheduleHStages)[number]) {
  if (stage.id === "spa") return "SPA Signing";

  return `${stage.code} ${stage.englishTitle}`;
}

function getBuyerPaymentTone(result: BuyerPaymentScheduleStage) {
  if (result.requiredBuyerPayment <= 0) return "Bank funded";
  if (result.bankPayment > 0) return "Own Funds + Bank";

  return "Own Funds Required";
}

function getBuyerPaymentSummary(stages: BuyerPaymentScheduleStage[]) {
  const spaStage = stages.find((result) => result.stage.id === "spa") ?? null;
  const buyerStages = stages.filter((result) => result.requiredBuyerPayment > 0);
  const bankStages = stages.filter((result) => result.bankPayment > 0);
  const lastBuyerStage = buyerStages.at(-1) ?? null;
  const firstBankStage = bankStages[0] ?? null;
  const beginsDuringSplit =
    Boolean(firstBankStage) &&
    firstBankStage?.stage.id === lastBuyerStage?.stage.id &&
    firstBankStage.requiredBuyerPayment > 0 &&
    firstBankStage.bankPayment > 0;

  return {
    spaStage,
    lastBuyerStage,
    firstBankStage,
    beginsDuringSplit,
  };
}

function getBankBeginsLabel(
  schedule: BuyerPaymentScheduleResult,
  summary: ReturnType<typeof getBuyerPaymentSummary>,
) {
  if (schedule.buyerFundsToPrepare === 0 && schedule.effectiveDeveloperRebate === 0) {
    return "Bank funds from SPA signing";
  }

  if (!summary.firstBankStage) {
    return "Bank funding not shown";
  }

  if (summary.beginsDuringSplit) {
    return `During ${getStageDisplayTitle(summary.firstBankStage)}`;
  }

  return getStageDisplayTitle(summary.firstBankStage);
}

function getBuyerFullyUtilisedLabel(
  schedule: BuyerPaymentScheduleResult,
  summary: ReturnType<typeof getBuyerPaymentSummary>,
) {
  if (schedule.buyerFundsToPrepare === 0) {
    return schedule.rebateTreatment === "direct_offset" && schedule.effectiveDeveloperRebate > 0
      ? "Covered by Developer Rebate Offset"
      : "No buyer equity required";
  }

  if (!summary.lastBuyerStage) {
    return "—";
  }

  return getStageDisplayTitle(summary.lastBuyerStage);
}

function printBuyerPaymentSchedule(proposalWindow: Window) {
  proposalWindow.setTimeout(() => {
    proposalWindow.print();
  }, 100);
}

function buildBuyerPaymentScheduleProposalHtml({
  projectName,
  unitNo,
  stageTimings,
  schedule,
  branding,
}: {
  projectName: string;
  unitNo: string;
  stageTimings: Record<TimelineStageId, StageTiming>;
  schedule: BuyerPaymentScheduleResult;
  branding: CustomerPdfBranding;
}) {
  const ownFundsStages = schedule.stages.filter((stage) => stage.requiredBuyerPayment > 0);
  const summary = getBuyerPaymentSummary(schedule.stages);
  const transitionStage = summary.firstBankStage;
  const isCashbackLater = schedule.rebateTreatment === "cashback_later";
  const isCashPurchase = schedule.purchaseMethod === "cash";
  const showDeveloperOffset =
    schedule.rebateTreatment === "direct_offset" &&
    schedule.effectiveDeveloperRebate > 0 &&
    !schedule.allocationError;
  const rebateStageLabel = escapeHtml(schedule.rebateStageLabel);
  const summaryItems = isCashbackLater
    ? `
        <div class="summary-item"><span>Purchase Method</span><strong>${isCashPurchase ? "Cash" : "Loan"}</strong></div>
        <div class="summary-item"><span>SPA Price</span><strong>${escapeHtml(formatCurrency(schedule.spaPrice))}</strong></div>
        ${isCashPurchase ? "" : `<div class="summary-item"><span>Loan Margin</span><strong>${escapeHtml(formatPercent(schedule.loanMarginPercent))}</strong></div><div class="summary-item"><span>Loan Amount</span><strong>${escapeHtml(formatCurrency(schedule.loanAmount))}</strong></div>`}
        <div class="summary-item"><span>Rebate Treatment</span><strong>Cashback Later</strong></div>
        <div class="summary-item"><span>Gross Buyer Funds To Prepare</span><strong>${escapeHtml(formatCurrency(schedule.grossBuyerPayments))}</strong></div>
        <div class="summary-item"><span>Cashback Received Later</span><strong>${escapeHtml(formatCurrency(schedule.totalCashbackReceived))}</strong></div>
        <div class="summary-item"><span>Cashback Release Stage</span><strong>${rebateStageLabel}</strong></div>
        <div class="summary-item highlight"><span>Final Net Buyer Outlay</span><strong>${escapeHtml(formatCurrency(schedule.finalNetBuyerOutlay))}</strong></div>
      `
    : `
        <div class="summary-item"><span>Purchase Method</span><strong>${isCashPurchase ? "Cash" : "Loan"}</strong></div>
        <div class="summary-item"><span>SPA Price</span><strong>${escapeHtml(formatCurrency(schedule.spaPrice))}</strong></div>
        ${isCashPurchase ? "" : `<div class="summary-item"><span>Loan Margin</span><strong>${escapeHtml(formatPercent(schedule.loanMarginPercent))}</strong></div><div class="summary-item"><span>Loan Amount</span><strong>${escapeHtml(formatCurrency(schedule.loanAmount))}</strong></div>`}
        <div class="summary-item"><span>Rebate Treatment</span><strong>Direct Payment Offset</strong></div>
        <div class="summary-item"><span>${isCashPurchase ? "Gross Purchase Obligation" : "Gross Buyer Equity"}</span><strong>${escapeHtml(formatCurrency(schedule.grossBuyerPaymentObligation))}</strong></div>
        <div class="summary-item"><span>Developer Offset</span><strong>${escapeHtml(formatCurrency(schedule.effectiveDeveloperRebate))}</strong></div>
        <div class="summary-item highlight"><span>${isCashPurchase ? "Net Buyer Funds Required" : "Net Own Funds Required"}</span><strong>${escapeHtml(formatCurrency(schedule.netOwnFundsRequired))}</strong></div>
      `;
  const transitionSplit =
    transitionStage && summary.beginsDuringSplit
      ? `
        <div class="transition-split">
          ${
            transitionStage.requiredBuyerPayment > 0
              ? `<span>Buyer: <strong>${escapeHtml(formatCurrency(transitionStage.requiredBuyerPayment))}</strong></span>`
              : ""
          }
          ${
            transitionStage.bankPayment > 0
              ? `<span>Bank: <strong>${escapeHtml(formatCurrency(transitionStage.bankPayment))}</strong></span>`
              : ""
          }
        </div>
      `
      : "";
  const ownFundsRows = ownFundsStages.length
    ? ownFundsStages
        .map(
          (stage) => `
            <tr>
              <td class="stage-code">${escapeHtml(stage.stage.code)}</td>
              <td>
                <strong>${escapeHtml(getShortStageTitle(stage).replace(`${stage.stage.code} `, ""))}</strong>
                <span>${escapeHtml(stage.stage.chineseTitle)}</span>
              </td>
              <td>${escapeHtml(formatPercent(stage.stagePercentage))}</td>
              <td class="buyer-amount">${escapeHtml(formatCurrency(stage.requiredBuyerPayment))}</td>
              <td>${escapeHtml(getStageTimingLabel(stage.stage.id, stageTimings))}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td colspan="5" class="empty-plan">No buyer own funds are required based on the current financing and rebate treatment.</td>
      </tr>
    `;
  const cashbackEvent =
    isCashbackLater && schedule.effectiveDeveloperRebate > 0
      ? `
        <div class="cashback-event">
          <span>Cashback Received</span>
          <strong>${escapeHtml(formatCurrency(schedule.effectiveDeveloperRebate))}</strong>
          <em>At: ${rebateStageLabel} · ${escapeHtml(getStageTimingLabel(schedule.rebateStageId, stageTimings))}</em>
        </div>
      `
      : "";
  const scheduleRows = schedule.stages
    .map(
      (stage) => `
        <tr>
          <td class="stage-code">${escapeHtml(stage.stage.code)}</td>
          <td>${escapeHtml(formatPercent(stage.stagePercentage))}</td>
          <td>${escapeHtml(formatCurrency(stage.stageAmount))}</td>
          ${
            showDeveloperOffset
              ? `<td class="offset-amount">${escapeHtml(formatCurrency(stage.developerOffset))}</td>`
              : ""
          }
          <td class="buyer-amount">${escapeHtml(formatCurrency(stage.requiredBuyerPayment))}</td>
          ${isCashPurchase ? "" : `<td>${escapeHtml(formatCurrency(stage.bankPayment))}</td>`}
          ${isCashbackLater ? `<td class="offset-amount">${escapeHtml(formatCurrency(stage.cashbackReceived))}</td><td>${escapeHtml(formatCurrency(stage.netBuyerCashMovement))}</td><td>${escapeHtml(formatCurrency(stage.cumulativeNetBuyerOutlay))}</td>` : ""}
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Buyer Payment Schedule</title>
    <style>
      @page { size: A4 portrait; margin: 10mm 10mm 16mm; }
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
        padding: 10mm 10mm 15mm;
        position: relative;
      }
      .header {
        border-bottom: 2px solid #0f766e;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 7px;
      }
      .eyebrow {
        color: #0f766e;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.18em;
        margin: 0 0 3px;
        text-transform: uppercase;
      }
      h1 {
        color: #09090b;
        font-size: 21px;
        line-height: 1.08;
        margin: 0;
        text-transform: uppercase;
      }
      .subtitle {
        color: #52525b;
        font-size: 10px;
        font-weight: 700;
        margin: 4px 0 0;
      }
      .project-line {
        color: #3f3f46;
        font-size: 10px;
        font-weight: 700;
        margin: 4px 0 0;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(${isCashPurchase ? "5" : "6"}, 1fr);
        gap: 5px;
        margin-top: 8px;
      }
      .summary-item {
        border: 1px solid #e4e4e7;
        border-radius: 8px;
        min-height: 34px;
        padding: 5px 6px;
      }
      .summary-item.highlight {
        background: #f1fbf8;
        border-color: #b7e6dc;
      }
      .summary-item span {
        color: #71717a;
        display: block;
        font-size: 6.8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary-item strong {
        color: #18181b;
        display: block;
        font-size: 9px;
        line-height: 1.15;
        margin-top: 3px;
      }
      .summary-item.highlight strong {
        color: #087F6B;
        font-size: 11px;
      }
      .section {
        margin-top: 9px;
      }
      .section-title {
        align-items: baseline;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 5px;
      }
      h2 {
        color: #083f3a;
        font-size: 10px;
        letter-spacing: 0.12em;
        line-height: 1.2;
        margin: 0;
        text-transform: uppercase;
      }
      .section-title span {
        color: #71717a;
        font-size: 8px;
        font-weight: 700;
      }
      table {
        border-collapse: collapse;
        table-layout: fixed;
        width: 100%;
      }
      th,
      td {
        border: 1px solid #e4e4e7;
        padding: 3.3px 4px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #0f766e;
        color: #ffffff;
        font-size: 7.1px;
        font-weight: 800;
        line-height: 1.1;
        text-transform: uppercase;
      }
      td {
        color: #18181b;
        font-size: 8px;
        font-weight: 600;
        line-height: 1.15;
      }
      td span {
        color: #71717a;
        display: block;
        font-size: 7px;
        font-weight: 500;
        margin-top: 1px;
      }
      .stage-code {
        color: #09090b;
        font-weight: 800;
      }
      .buyer-amount {
        color: #087F6B;
        font-weight: 800;
      }
      .offset-amount {
        color: #1E4E79;
        font-weight: 800;
      }
      .empty-plan {
        color: #71717a;
        font-weight: 600;
        padding: 10px;
        text-align: center;
      }
      .plan-total {
        align-items: center;
        background: #f1fbf8;
        border: 1px solid #b7e6dc;
        border-radius: 9px;
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        padding: 6px 8px;
      }
      .plan-total span {
        color: #087F6B;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .plan-total strong {
        color: #087F6B;
        font-size: 13px;
        font-weight: 800;
      }
      .transition {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        display: grid;
        gap: 7px;
        grid-template-columns: repeat(2, 1fr);
        padding: 8px;
      }
      .transition-card span {
        color: #71717a;
        display: block;
        font-size: 7.2px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .transition-card strong {
        color: #18181b;
        display: block;
        font-size: 9px;
        line-height: 1.25;
        margin-top: 3px;
      }
      .transition-split {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        grid-column: 1 / -1;
      }
      .transition-split span {
        background: #f4f4f5;
        border-radius: 999px;
        color: #52525b;
        font-size: 7.4px;
        font-weight: 700;
        padding: 4px 7px;
      }
      .reference th {
        background: #3f3f46;
      }
      .rebate-note {
        background: #f8fafc;
        border: 1px solid #e4e4e7;
        border-radius: 8px;
        color: #52525b;
        font-size: 7.5px;
        font-weight: 600;
        line-height: 1.28;
        margin-top: 5px;
        padding: 5px 7px;
      }
      .cashback-event {
        align-items: center;
        background: #f8fafc;
        border: 1px solid #d4d4d8;
        border-radius: 9px;
        display: grid;
        gap: 3px;
        grid-template-columns: 1fr auto;
        margin-top: 5px;
        padding: 6px 8px;
      }
      .cashback-event span {
        color: #52525b;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .cashback-event strong {
        color: #1E4E79;
        font-size: 12px;
        font-weight: 800;
      }
      .cashback-event em {
        color: #71717a;
        font-size: 7.4px;
        font-style: normal;
        font-weight: 700;
        grid-column: 1 / -1;
      }
      .disclaimer {
        color: #71717a;
        font-size: 7.4px;
        line-height: 1.28;
        margin: 8px 0 0;
      }
      .disclaimer strong {
        color: #3f3f46;
      }
      ${getCustomerPdfBrandingStyles()}
      @media print {
        body { background: #ffffff; }
        .page { width: auto; min-height: auto; margin: 0; padding: 0; }
        tr, .transition, .plan-total { break-inside: avoid; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    ${renderCustomerPdfWatermark(branding)}
    <main class="page">
      <header class="header">
        <div>
          <p class="eyebrow">Buyer Payment Schedule</p>
          <h1>Buyer Payment Schedule</h1>
          <p class="subtitle">When do I need to prepare my own funds?</p>
          ${
            projectName || unitNo
              ? `<p class="project-line">${escapeHtml(
                  [projectName, unitNo ? `Unit ${unitNo}` : ""].filter(Boolean).join(" · "),
                )}</p>`
              : ""
          }
        </div>
      </header>

      <section class="summary-grid">
        ${summaryItems}
      </section>

      <section class="section">
        <div class="section-title">
          <h2>Your Own Funds Payment Plan</h2>
          <span>See when your own funds are required</span>
        </div>
        <table>
          <colgroup>
            <col style="width: 12%;" />
            <col style="width: 40%;" />
            <col style="width: 10%;" />
            <col style="width: 20%;" />
            <col style="width: 18%;" />
          </colgroup>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Payment Stage</th>
              <th>%</th>
              <th>Buyer Pays</th>
              <th>Estimated Timing</th>
            </tr>
          </thead>
          <tbody>${ownFundsRows}</tbody>
        </table>
        <div class="plan-total">
          <span>${isCashbackLater ? "Gross Buyer Funds To Prepare" : isCashPurchase ? "Net Buyer Funds Required" : "Net Own Funds Required"}</span>
          <strong>${escapeHtml(formatCurrency(schedule.buyerFundsToPrepare))}</strong>
        </div>
        ${cashbackEvent}
      </section>

      <section class="section">
        <div class="section-title">
          <h2>${isCashPurchase ? "Purchase Funding" : "Financing Transition"}</h2>
          <span>${isCashPurchase ? "Cash purchase" : "Where bank financing begins"}</span>
        </div>
        <div class="transition">
          ${isCashPurchase ? `<div class="transition-card"><span>Cash Purchase</span><strong>No bank financing required.</strong></div>` : `<div class="transition-card"><span>Buyer Own Funds Fully Utilised At</span><strong>${escapeHtml(getBuyerFullyUtilisedLabel(schedule, summary))}</strong></div><div class="transition-card"><span>${summary.beginsDuringSplit ? "Bank Financing Begins During" : "Bank Financing Begins At"}</span><strong>${escapeHtml(getBankBeginsLabel(schedule, summary))}</strong></div>${transitionSplit}`}
        </div>
      </section>

      <section class="section reference">
        <div class="section-title">
          <h2>Schedule H Reference</h2>
          <span>Full buyer and bank split</span>
        </div>
        <table>
          <colgroup>
            <col />
            <col />
            <col />
            ${showDeveloperOffset ? `<col />` : ""}
            <col />
            ${isCashPurchase ? "" : `<col />`}
            ${isCashbackLater ? `<col /><col /><col />` : ""}
          </colgroup>
          <thead>
            <tr>
              <th>Stage</th>
              <th>%</th>
              <th>Stage Amount</th>
              ${showDeveloperOffset ? "<th>Developer Offset</th>" : ""}
              <th>Required Buyer Payment</th>
              ${isCashPurchase ? "" : `<th>Bank Payment</th>`}
              ${isCashbackLater ? `<th>Cashback Received</th><th>Net Buyer Cash Movement</th><th>Cumulative Net Buyer Outlay</th>` : ""}
            </tr>
          </thead>
          <tbody>${scheduleRows}</tbody>
        </table>
        ${
        showDeveloperOffset
            ? `<p class="rebate-note">Application Stage: ${rebateStageLabel}. Developer Offset is shown for payment allocation illustration only. Actual rebate application and billing treatment may vary by developer.</p>`
            : ""
        }
        <p class="rebate-note">Rebate Treatment: ${isCashbackLater ? "Cashback Later" : "Direct Payment Offset"}.</p>
      </section>

      <p class="disclaimer">
        <strong>Estimate only.</strong>
        This schedule estimates how buyer own funds and bank financing may be allocated across
        Schedule H stages using the selected purchase method and rebate treatment. Actual payment timing and
        financing treatment are subject to bank, developer and final documentation.
      </p>

      ${renderCustomerPdfBranding(branding)}
    </main>
  </body>
</html>`;
}

export default function BuyerPaymentSchedulePage() {
  const { displayName, phone } = useAppPermissions();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [exportError, setExportError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [spaPrice, setSpaPrice] = useState("");
  const [purchaseMethod, setPurchaseMethod] = useState<PurchaseMethod>("loan");
  const [loanMarginPercent, setLoanMarginPercent] = useState("90");
  const [developerRebatePercent, setDeveloperRebatePercent] = useState("0");
  const [rebateTreatment, setRebateTreatment] = useState<RebateTreatment>("direct_offset");
  const [rebateStageId, setRebateStageId] = useState<ScheduleHStageId>("spa");
  const [stageTimings, setStageTimings] = useState(createInitialStageTimings);
  const [currentStageId, setCurrentStageId] = useState<TimelineStageId | "">("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/projects", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load projects");

        return response.json() as Promise<ProjectOption[]>;
      })
      .then((data) => {
        setProjects(data);
        setProjectsError("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setProjectsError(error instanceof Error ? error.message : "Unable to load projects");
      });

    return () => controller.abort();
  }, []);

  const numericInput = useMemo(
    () => ({
      spaPrice: parseNumberInput(spaPrice),
      loanMarginPercent: parseNumberInput(loanMarginPercent),
      developerRebatePercent: parseNumberInput(developerRebatePercent),
    }),
    [developerRebatePercent, loanMarginPercent, spaPrice],
  );

  const paymentSchedule = useMemo(
    () =>
      calculateBuyerPaymentSchedule({
        spaPrice: numericInput.spaPrice,
        purchaseMethod,
        loanMarginPercent: numericInput.loanMarginPercent,
        developerRebatePercent: numericInput.developerRebatePercent,
        rebateTreatment,
        rebateStageId,
      }),
    [numericInput, purchaseMethod, rebateStageId, rebateTreatment],
  );

  const invalidSpaPrice =
    spaPrice.trim() !== "" &&
    paymentSchedule.validationErrors.some((error) => error.startsWith("SPA Price"));
  const invalidLoanMargin =
    purchaseMethod === "loan" &&
    loanMarginPercent.trim() !== "" &&
    paymentSchedule.validationErrors.some((error) => error.startsWith("Loan margin"));
  const invalidDeveloperRebate =
    developerRebatePercent.trim() !== "" &&
    (!Number.isFinite(numericInput.developerRebatePercent) ||
      numericInput.developerRebatePercent < 0 ||
      numericInput.developerRebatePercent > 100);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const summary = getBuyerPaymentSummary(paymentSchedule.stages);
  const initialSpaPayment = summary.spaStage?.requiredBuyerPayment ?? 0;
  const remainingOwnFundsAfterSpa = Math.max(
    paymentSchedule.buyerFundsToPrepare - initialSpaPayment,
    0,
  );
  const canShowAdjustedSchedule = !paymentSchedule.allocationError;
  const ownFundsStages = canShowAdjustedSchedule
    ? paymentSchedule.stages.filter((result) => result.requiredBuyerPayment > 0)
    : [];
  const isCashbackLater = paymentSchedule.rebateTreatment === "cashback_later";
  const isCashPurchase = paymentSchedule.purchaseMethod === "cash";
  const showDeveloperOffset =
    paymentSchedule.rebateTreatment === "direct_offset" &&
    paymentSchedule.effectiveDeveloperRebate > 0 &&
    !paymentSchedule.allocationError;

  function updateStageTiming(stageId: TimelineStageId, field: keyof StageTiming, value: string) {
    setStageTimings((current) => ({
      ...current,
      [stageId]: {
        ...current[stageId],
        [field]: value,
      },
    }));
  }

  function handleExportPdf() {
    setExportError("");

    if (!paymentSchedule.isValid) {
      setExportError(
        purchaseMethod === "loan"
          ? "Complete valid SPA Price and Loan Margin before exporting the customer PDF."
          : "Complete a valid SPA Price before exporting the customer PDF.",
      );
      return;
    }

    if (invalidDeveloperRebate) {
      setExportError("Developer Rebate must be between 0% and 100% before exporting.");
      return;
    }

    if (paymentSchedule.allocationError) {
      setExportError(paymentSchedule.allocationError);
      return;
    }

    const proposalWindow = window.open("", "_blank");

    if (!proposalWindow) {
      window.alert("Please allow pop-ups to preview and export the PDF.");
      return;
    }

    proposalWindow.document.open();
    proposalWindow.document.write(
      buildBuyerPaymentScheduleProposalHtml({
        projectName: selectedProject?.project_name?.trim() || "",
        unitNo: unitNo.trim(),
        stageTimings,
        schedule: paymentSchedule,
        branding: {
          agentName: displayName,
          agentPhone: phone,
        },
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();

    printBuyerPaymentSchedule(proposalWindow);
  }

  return (
    <main className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#087F6B]">
            Schedule H · Buyer Own Funds
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Buyer Payment Schedule
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Estimate when your own funds are required throughout the Schedule H payment stages.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                <span className="block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Schedule Total
                </span>
                <strong className="mt-1 block text-lg text-zinc-950">100%</strong>
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Export PDF
              </button>
            </div>
          </div>
          {exportError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-[#FFF9E8] px-4 py-3 text-sm font-medium text-amber-800">
              {exportError}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  Property / Purchase Details
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Project and unit details are optional presentation context.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">Project</span>
                  <SearchCombobox
                    value={selectedProjectId}
                    options={[
                      {
                        id: "",
                        label: "",
                        description: "Continue without a Project",
                      },
                      ...projects.flatMap((project) =>
                        project.project_name
                          ? [{
                              id: project.id,
                              label: project.project_name,
                              description: [project.location, project.developer].filter(Boolean).join(" · "),
                              searchText: [project.developer, project.location].filter(Boolean).join(" "),
                            }]
                          : [],
                      ),
                    ]}
                    placeholder="Search project..."
                    emptyLabel="No projects found."
                    onChange={setSelectedProjectId}
                  />
                  {projectsError ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      {projectsError}. Manual entry still works.
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">Unit No.</span>
                  <input
                    value={unitNo}
                    onChange={(event) => setUnitNo(event.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
                  />
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">SPA Price</span>
                  <div className={`flex rounded-2xl border ${getInputStateClass(invalidSpaPrice)}`}>
                    <span className="border-r border-zinc-200 px-3 py-2 text-zinc-500">RM</span>
                    <input
                      inputMode="decimal"
                      value={spaPrice}
                      onChange={(event) => setSpaPrice(event.target.value)}
                      placeholder="600000"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                    />
                  </div>
                </label>

                <div className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">Purchase Method</span>
                  <div className="grid grid-cols-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                    {(["loan", "cash"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPurchaseMethod(method)}
                        className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                          purchaseMethod === method
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "text-zinc-600 hover:text-zinc-950"
                        }`}
                      >
                        {method === "loan" ? "Loan" : "Cash"}
                      </button>
                    ))}
                  </div>
                </div>

                {purchaseMethod === "loan" ? (
                  <label className="block text-sm text-zinc-600">
                    <span className="mb-1 block font-medium text-zinc-900">Loan Margin</span>
                    <div className={`flex rounded-2xl border ${getInputStateClass(invalidLoanMargin)}`}>
                      <input
                        inputMode="decimal"
                        value={loanMarginPercent}
                        onChange={(event) => setLoanMarginPercent(event.target.value)}
                        className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                      />
                      <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">%</span>
                    </div>
                  </label>
                ) : null}

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Developer Rebate
                  </span>
                  <div
                    className={`flex rounded-2xl border ${getInputStateClass(
                      invalidDeveloperRebate,
                    )}`}
                  >
                    <input
                      inputMode="decimal"
                      value={developerRebatePercent}
                      onChange={(event) => setDeveloperRebatePercent(event.target.value)}
                      placeholder="0"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                    />
                    <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">%</span>
                  </div>
                  {paymentSchedule.isValid && !invalidDeveloperRebate ? (
                    <span className="mt-1 block text-xs text-zinc-500">
                      {rebateTreatment === "cashback_later" ? "Cashback" : "Offset"}: {formatCurrency(paymentSchedule.effectiveDeveloperRebate)}
                      {paymentSchedule.developerRebateAmount >
                      paymentSchedule.effectiveDeveloperRebate
                        ? isCashPurchase
                          ? " capped to gross purchase obligation"
                          : " capped to gross buyer equity"
                        : ""}
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Rebate Treatment
                  </span>
                  <select
                    value={rebateTreatment}
                    onChange={(event) => setRebateTreatment(event.target.value as RebateTreatment)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
                  >
                    {rebateTreatmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-900">
                    {rebateTreatment === "cashback_later"
                      ? "Cashback Release Stage"
                      : "Application Stage"}
                  </span>
                  <select
                    value={rebateStageId}
                    onChange={(event) => setRebateStageId(event.target.value as ScheduleHStageId)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
                  >
                    {scheduleHStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {getScheduleStageOptionLabel(stage)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {paymentSchedule.validationErrors.length ||
              invalidDeveloperRebate ||
              paymentSchedule.allocationError ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-[#FFF9E8] px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Check inputs</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {paymentSchedule.validationErrors
                      .filter((error) => !error.startsWith("Developer Rebate"))
                      .map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                    {invalidDeveloperRebate ? (
                      <li>Developer Rebate must be between 0% and 100%.</li>
                    ) : null}
                    {paymentSchedule.allocationError ? (
                      <li>{paymentSchedule.allocationError}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Payment Timing</h2>
                  <p className="mt-1 text-sm leading-5 text-zinc-500">
                    Add estimated year and quarter where useful. Exact dates are not required.
                  </p>
                </div>
                <label className="block w-full text-sm text-zinc-600 lg:w-64">
                  <span className="mb-1 block font-medium text-zinc-900">
                    Current Construction Stage
                  </span>
                  <select
                    value={currentStageId}
                    onChange={(event) =>
                      setCurrentStageId(event.target.value as TimelineStageId | "")
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
                  >
                    <option value="">Not specified</option>
                    {timelineStageIds.map((stageId) => {
                      const stage = scheduleHStages.find((item) => item.id === stageId);

                      return stage ? (
                        <option key={stage.id} value={stage.id}>
                          {stage.code} {stage.englishTitle}
                        </option>
                      ) : null;
                    })}
                  </select>
                </label>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200">
                {timelineStageIds.map((stageId) => {
                  const stage = scheduleHStages.find((item) => item.id === stageId);
                  const timing = stageTimings[stageId];
                  const shortLabel = shortStageLabels[stageId];

                  if (!stage) return null;

                  return (
                    <div
                      key={stage.id}
                      className="grid items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2.5 last:border-b-0 sm:grid-cols-[56px_minmax(0,1fr)_92px_92px]"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{stage.code}</p>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {shortLabel.english} / {shortLabel.chinese}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {stage.englishTitle}
                        </p>
                      </div>
                      <input
                        inputMode="numeric"
                        maxLength={4}
                        value={timing.year}
                        onChange={(event) => updateStageTiming(stageId, "year", event.target.value)}
                        placeholder="Year"
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                      />
                      <select
                        value={timing.quarter}
                        onChange={(event) =>
                          updateStageTiming(stageId, "quarter", event.target.value)
                        }
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                      >
                        <option value="">Quarter</option>
                        {quarterOptions.map((quarter) => (
                          <option key={quarter} value={quarter}>
                            {quarter}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:self-start">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Purchase Summary
              </p>
              {selectedProject || unitNo.trim() ? (
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {[selectedProject?.project_name, unitNo.trim() ? `Unit ${unitNo.trim()}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                  <span className="text-zinc-500">Purchase Method</span>
                  <strong className="text-right text-zinc-900">
                    {isCashPurchase ? "Cash" : "Loan"}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                  <span className="text-zinc-500">SPA Price</span>
                  <strong className="text-right text-zinc-900">
                    {formatCurrency(paymentSchedule.spaPrice)}
                  </strong>
                </div>
                {!isCashPurchase ? (
                  <>
                    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                      <span className="text-zinc-500">Loan Margin</span>
                      <strong className="text-right text-zinc-900">
                        {formatPercent(paymentSchedule.loanMarginPercent)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                      <span className="text-zinc-500">Loan Amount</span>
                      <strong className="text-right text-zinc-900">
                        {formatCurrency(paymentSchedule.loanAmount)}
                      </strong>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                  <span className="text-zinc-500">
                    {isCashPurchase
                      ? isCashbackLater
                        ? "Gross Buyer Payments"
                        : "Gross Purchase Obligation"
                      : isCashbackLater
                        ? "Gross Buyer Funds To Prepare"
                        : "Gross Buyer Equity"}
                  </span>
                  <strong className="text-right text-zinc-900">
                    {formatCurrency(paymentSchedule.grossBuyerPaymentObligation)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                  <span className="text-zinc-500">
                    {isCashbackLater ? "Developer Cashback" : "Developer Rebate"}
                  </span>
                  <strong className="text-right text-zinc-900">
                    {formatCurrency(paymentSchedule.effectiveDeveloperRebate)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                  <span className="text-zinc-500">Rebate Treatment</span>
                  <strong className="text-right text-zinc-900">
                    {isCashbackLater ? "Cashback Later" : "Direct Payment Offset"}
                  </strong>
                </div>
                {isCashbackLater ? (
                  <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500">Cashback Release Stage</span>
                    <strong className="text-right text-zinc-900">
                      {paymentSchedule.rebateStageLabel}
                    </strong>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[#b7e6dc] bg-[#f1fbf8] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#087F6B]">
                    {isCashbackLater
                      ? "Final Net Buyer Outlay"
                      : isCashPurchase
                        ? "Net Buyer Funds Required"
                        : "Net Own Funds Required"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[#087F6B]">
                    {formatCurrency(
                      isCashbackLater
                        ? paymentSchedule.finalNetBuyerOutlay
                        : paymentSchedule.netOwnFundsRequired,
                    )}
                  </p>
                  {!isCashbackLater ? (
                    <p className="mt-1 text-sm font-medium text-[#087F6B]">
                      {formatPercent(paymentSchedule.netOwnFundsPercent)}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Buyer Payment Summary
              </p>
              {paymentSchedule.allocationError ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-[#FFF9E8] px-4 py-3 text-sm leading-6 text-amber-800">
                  {paymentSchedule.allocationError}
                </p>
              ) : (
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500">Initial SPA Payment</span>
                    <strong className="text-right text-zinc-900">
                      {formatCurrency(initialSpaPayment)}
                    </strong>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500">Remaining Own Funds After SPA</span>
                    <strong className="text-right text-zinc-900">
                      {formatCurrency(remainingOwnFundsAfterSpa)}
                    </strong>
                  </div>
                  {!isCashPurchase ? (
                    <div className="border-b border-zinc-100 pb-3">
                      <span className="text-zinc-500">Buyer Own Funds Fully Utilised At</span>
                      <strong className="mt-1 block text-zinc-900">
                        {getBuyerFullyUtilisedLabel(paymentSchedule, summary)}
                      </strong>
                    </div>
                  ) : null}
                  <div>
                    {isCashPurchase ? (
                      <>
                        <span className="text-zinc-500">Cash Purchase</span>
                        <strong className="mt-1 block text-zinc-900">
                          No bank financing required.
                        </strong>
                      </>
                    ) : (
                      <>
                    <span className="text-zinc-500">
                      {summary.beginsDuringSplit
                        ? "Bank Financing Begins During"
                        : "Bank Financing Begins At"}
                    </span>
                    <strong className="mt-1 block text-zinc-900">
                      {getBankBeginsLabel(paymentSchedule, summary)}
                    </strong>
                    {summary.firstBankStage && summary.beginsDuringSplit ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        {summary.firstBankStage.requiredBuyerPayment > 0 ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
                            Buyer {formatCurrency(summary.firstBankStage.requiredBuyerPayment)}
                          </span>
                        ) : null}
                        {summary.firstBankStage.bankPayment > 0 ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
                            Bank {formatCurrency(summary.firstBankStage.bankPayment)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className="rounded-[28px] border border-[#b7e6dc] bg-[#f7fcfa] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
                Your Own Funds Payment Plan
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                See when your own funds are required throughout the purchase.
              </h2>
            </div>
            <div className="rounded-2xl border border-[#b7e6dc] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#087F6B]">
                {isCashbackLater
                  ? isCashPurchase
                    ? "Gross Buyer Payments"
                    : "Gross Buyer Funds To Prepare"
                  : isCashPurchase
                    ? "Net Buyer Funds"
                    : "Net Own Funds"}
              </p>
              <p className="mt-1 text-xl font-semibold text-[#087F6B]">
                {formatCurrency(paymentSchedule.buyerFundsToPrepare)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ownFundsStages.length ? (
              ownFundsStages.map((result) => (
                <article
                  key={result.stage.id}
                  className="rounded-[22px] border border-[#b7e6dc] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        {result.stage.code}
                      </p>
                      <p className="mt-1 font-semibold text-zinc-950">
                        {getShortStageTitle(result).replace(`${result.stage.code} `, "")}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#b7e6dc] bg-[#f1fbf8] px-3 py-1 text-xs font-semibold text-[#087F6B]">
                      Own Funds
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-[#087F6B]">
                    {formatCurrency(result.requiredBuyerPayment)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {getStageTimingLabel(result.stage.id, stageTimings)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[22px] border border-zinc-200 bg-white p-5 text-sm text-zinc-600 md:col-span-2 xl:col-span-3">
                No buyer own funds are required based on the current financing and rebate
                treatment.
              </div>
            )}
          </div>
          {isCashbackLater && paymentSchedule.effectiveDeveloperRebate > 0 ? (
            <div className="mt-5 rounded-[22px] border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Cashback Received
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-2xl font-semibold text-[#1E4E79]">
                  {formatCurrency(paymentSchedule.effectiveDeveloperRebate)}
                </p>
                <p className="text-sm font-semibold text-zinc-600">
                  At: {paymentSchedule.rebateStageLabel} · {getStageTimingLabel(paymentSchedule.rebateStageId, stageTimings)}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">When Do I Need To Pay?</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Schedule H stage amounts are shown by buyer own funds and bank financing after the
              selected rebate treatment. Rows with buyer payment required are highlighted subtly.
            </p>
            {showDeveloperOffset ? (
              <p className="mt-3 max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                Application Stage: {paymentSchedule.rebateStageLabel}. Developer Offset is
                shown for payment allocation illustration only. Actual rebate application and
                billing treatment may vary by developer.
              </p>
            ) : null}
          </div>

          {paymentSchedule.allocationError ? (
            <div className="mt-5 rounded-[22px] border border-amber-200 bg-[#FFF9E8] p-5 text-sm leading-6 text-amber-800">
              {paymentSchedule.allocationError}
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {paymentSchedule.stages.map((result) => {
              const hasBuyerPayment = result.requiredBuyerPayment > 0;
              const bankAmount = result.bankPayment;

              return (
                <article
                  key={result.stage.id}
                  className={`rounded-[22px] border p-4 ${
                    hasBuyerPayment
                      ? "border-[#b7e6dc] bg-[#f7fcfa]"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                        Stage
                      </p>
                      <p className="mt-1 text-base font-semibold text-zinc-950">
                        {result.stage.code}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-950">{result.stage.englishTitle}</p>
                      <p className="mt-1 text-sm leading-5 text-zinc-500">
                        {result.stage.chineseTitle}
                      </p>
                      {hasBuyerPayment ? (
                        <span className="mt-2 inline-flex rounded-full border border-[#b7e6dc] bg-white px-3 py-1 text-xs font-semibold text-[#087F6B]">
                          {getBuyerPaymentTone(result)}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                        %
                      </p>
                      <p className="mt-1 font-semibold text-zinc-900">
                        {formatPercent(result.stagePercentage)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                        Stage Amount
                      </p>
                      <p className="mt-1 font-semibold text-zinc-900">
                        {formatCurrency(result.stageAmount)}
                      </p>
                    </div>
                    {showDeveloperOffset ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                          Developer Offset
                        </p>
                        <p
                          className={`mt-1 font-semibold ${
                            result.developerOffset > 0 ? "text-[#1E4E79]" : "text-zinc-500"
                          }`}
                        >
                          {formatCurrency(result.developerOffset)}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                        Required Buyer Payment
                      </p>
                      <p
                        className={`mt-1 font-semibold ${
                          hasBuyerPayment ? "text-[#087F6B]" : "text-zinc-500"
                        }`}
                      >
                        {formatCurrency(result.requiredBuyerPayment)}
                      </p>
                    </div>
                    {!isCashPurchase ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                          Bank Payment
                        </p>
                        <p className="mt-1 font-semibold text-zinc-900">
                          {formatCurrency(bankAmount)}
                        </p>
                      </div>
                    ) : null}
                    {isCashbackLater ? (
                      <>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                            Cashback Received
                          </p>
                          <p className={`mt-1 font-semibold ${result.cashbackReceived > 0 ? "text-[#1E4E79]" : "text-zinc-500"}`}>
                            {formatCurrency(result.cashbackReceived)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                            Net Buyer Cash Movement
                          </p>
                          <p className={`mt-1 font-semibold ${result.netBuyerCashMovement < 0 ? "text-[#1E4E79]" : "text-zinc-900"}`}>
                            {formatCurrency(result.netBuyerCashMovement)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                            Cumulative Net Buyer Outlay
                          </p>
                          <p className="mt-1 font-semibold text-zinc-900">
                            {formatCurrency(result.cumulativeNetBuyerOutlay)}
                          </p>
                        </div>
                      </>
                    ) : null}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                        Estimated Timing
                      </p>
                      <p className="mt-1 font-semibold text-zinc-900">
                        {getStageTimingLabel(result.stage.id, stageTimings)}
                      </p>
                    </div>
                  </div>
                </article>
              );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-sm font-semibold text-zinc-950">Estimate only</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            This schedule estimates how buyer own funds and bank financing may be allocated across
            Schedule H stages after the overall developer rebate offset. Actual payment timing and
            financing treatment are subject to bank, developer and final documentation.
          </p>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomerPdfBrandingStyles,
  renderCustomerPdfBranding,
  renderCustomerPdfWatermark,
  type CustomerPdfBranding,
} from "@/lib/customer-pdf-branding";
import { calculateMonthlyInstalment } from "@/lib/property-finance";
import {
  calculateProgressiveInterest,
  scheduleHStages,
  type ProgressiveInterestStageResult,
  type ProgressiveInterestResult,
  type ScheduleHStageId,
} from "@/lib/progressive-interest";
import {
  progressiveInterestSavedWorkSchemaVersion,
  validateProgressiveInterestSavedWorkPayload,
  type ProgressiveInterestSavedProjectSnapshotV1,
  type ProgressiveInterestSavedWorkPayloadV1,
} from "@/lib/progressive-interest-saved-work";
import { useAppPermissions } from "../../components/AppPermissionProvider";

type ProjectOption = {
  id: string;
  project_name: string | null;
};

type TimelineStageId = Extract<
  ScheduleHStageId,
  "2a" | "2b" | "2c" | "2d" | "2e" | "2f" | "2g" | "2h" | "vp"
>;

type StageTiming = {
  year: string;
  quarter: string;
};

type SaveModalMode = "new" | "save-as";

type SavedWorkDetailResponse = {
  savedWork?: {
    id: string;
    title: string;
    workType: string;
    schemaVersion: number;
    payload: unknown;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
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

const journeyStageLabels: Record<TimelineStageId, { english: string; chinese: string }> = {
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

const pdfStageLabels: Record<ScheduleHStageId, { english: string; chinese: string }> = {
  spa: { english: "Signing", chinese: "签约" },
  "2a": { english: "Foundation", chinese: "地基工程" },
  "2b": { english: "Structural Framework", chinese: "主体结构" },
  "2c": { english: "Walls & Frames", chinese: "墙体及门窗框" },
  "2d": { english: "M&E / Services", chinese: "水电及管线" },
  "2e": { english: "Finishes", chinese: "室内外饰面" },
  "2f": { english: "Sewerage", chinese: "排污系统" },
  "2g": { english: "Drainage", chinese: "排水系统" },
  "2h": { english: "Road Works", chinese: "道路工程" },
  vp: { english: "Vacant Possession", chinese: "正式交屋" },
  strata: { english: "Strata Title & Transfer", chinese: "分层地契与转让" },
  stakeholder: { english: "Stakeholder Retention", chinese: "缺陷责任期保留款" },
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

function formatCurrencyDetailed(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatSplitPercent(value: number) {
  if (!Number.isFinite(value)) return "—";

  const rounded = Math.round(value * 10) / 10;

  return `${rounded.toFixed(Math.abs(rounded % 1) < 0.000001 ? 0 : 1)}%`;
}

function getStageSplit(result: ProgressiveInterestStageResult, spaPrice: number) {
  const buyerAmount = Number.isFinite(result.buyerFundedForStage)
    ? result.buyerFundedForStage
    : 0;
  const bankAmount =
    result.estimatedBankReleaseForStage !== null &&
    Number.isFinite(result.estimatedBankReleaseForStage)
      ? result.estimatedBankReleaseForStage
      : 0;
  const stageAmount = Number.isFinite(result.stageAmount) ? result.stageAmount : 0;
  const buyerPercent = spaPrice > 0 ? (buyerAmount / spaPrice) * 100 : 0;
  const bankPercent = spaPrice > 0 ? (bankAmount / spaPrice) * 100 : 0;
  const buyerStageShare = stageAmount > 0 ? (buyerAmount / stageAmount) * 100 : 0;
  const bankStageShare = stageAmount > 0 ? (bankAmount / stageAmount) * 100 : 0;

  return {
    buyerAmount,
    bankAmount,
    buyerPercent,
    bankPercent,
    buyerStageShare,
    bankStageShare,
    isSplit: buyerAmount > 0 && bankAmount > 0,
  };
}

function getSplitLabel(result: ProgressiveInterestStageResult, spaPrice: number) {
  const split = getStageSplit(result, spaPrice);

  return `Buyer ${formatSplitPercent(split.buyerPercent)} · Bank ${formatSplitPercent(split.bankPercent)}`;
}

function getChineseSplitLabel(result: ProgressiveInterestStageResult, spaPrice: number) {
  const split = getStageSplit(result, spaPrice);

  return `买家 ${formatSplitPercent(split.buyerPercent)} · 银行 ${formatSplitPercent(split.bankPercent)}`;
}

function getPdfBankReleaseDisplay(result: ProgressiveInterestStageResult, spaPrice: number) {
  const split = getStageSplit(result, spaPrice);

  return `
    <strong>${escapeHtml(formatSplitPercent(split.bankPercent))}</strong>
    <span>(${escapeHtml(formatCurrency(split.bankAmount))})</span>
  `;
}

function PaymentSplit({
  result,
  spaPrice,
}: {
  result: ProgressiveInterestStageResult;
  spaPrice: number;
}) {
  const split = getStageSplit(result, spaPrice);

  return (
    <div className="min-w-52">
      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="bg-zinc-300"
          style={{ width: `${Math.max(0, Math.min(split.buyerStageShare, 100))}%` }}
        />
        <div
          className="bg-[#087F6B]"
          style={{ width: `${Math.max(0, Math.min(split.bankStageShare, 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-zinc-800">
        {getSplitLabel(result, spaPrice)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {getChineseSplitLabel(result, spaPrice)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Buyer {formatCurrency(split.buyerAmount)} · Bank {formatCurrency(split.bankAmount)}
      </p>
    </div>
  );
}

function getStageTimingLabel(stageId: ScheduleHStageId, timings: Record<TimelineStageId, StageTiming>) {
  if (stageId === "spa") return "Upon Signing";
  if (!timelineStageIds.includes(stageId as TimelineStageId)) return "—";

  const timing = timings[stageId as TimelineStageId];

  return timing?.year && timing?.quarter ? `${timing.year} ${timing.quarter}` : "—";
}

function getProgressiveInterestDisplay(
  result: ProgressiveInterestStageResult,
  fullMonthlyInstalment: number | null,
) {
  if (result.stage.id === "vp") {
    return fullMonthlyInstalment === null
      ? "Full Instalment"
      : `Full Instalment ${formatCurrencyDetailed(fullMonthlyInstalment)} / month`;
  }

  if (result.stage.category !== "construction") return "—";

  return formatCurrencyDetailed(result.estimatedMonthlyProgressiveInterest);
}

function getInputStateClass(isInvalid: boolean) {
  return isInvalid ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactField(label: string, value: string | null | undefined) {
  if (!value?.trim()) return "";

  return `
    <div class="compact-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function getDefaultSavedWorkTitle({
  projectName,
  unitNo,
}: {
  projectName: string;
  unitNo: string;
}) {
  return [projectName, unitNo ? `Unit ${unitNo}` : ""].filter(Boolean).join(" - ") ||
    "Progressive Interest Estimate";
}

function SaveWorkModal({
  mode,
  title,
  error,
  isSaving,
  onTitleChange,
  onCancel,
  onConfirm,
}: {
  mode: SaveModalMode;
  title: string;
  error: string;
  isSaving: boolean;
  onTitleChange: (title: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
            Saved Work
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">
            {mode === "save-as" ? "Save As" : "Save Progressive Interest"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Name this progressive interest estimate so you can reopen it later.
          </p>
        </div>

        <label className="mt-5 block text-sm text-zinc-600">
          <span className="mb-1 block font-medium text-zinc-900">Saved Work Title</span>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={isSaving}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
            maxLength={120}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || !title.trim()}
            className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : mode === "save-as" ? "Save As" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getPdfInterestDisplay(
  result: ProgressiveInterestStageResult,
  fullMonthlyInstalment: number | null,
) {
  if (result.stage.id === "vp") {
    return fullMonthlyInstalment === null
      ? "Full Instalment —"
      : `Full Instalment ${formatCurrencyDetailed(fullMonthlyInstalment)}/mo`;
  }

  if (result.stage.category !== "construction") return "—";

  return result.estimatedMonthlyProgressiveInterest === null
    ? "—"
    : `${formatCurrencyDetailed(result.estimatedMonthlyProgressiveInterest)}/mo`;
}

function getPdfDateLabel(stageId: ScheduleHStageId, timings: Record<TimelineStageId, StageTiming>) {
  if (stageId === "spa") return "Upon Signing / 签约时";
  if (stageId === "stakeholder") return "8 / 24 months after VP";

  return getStageTimingLabel(stageId, timings);
}

function printProgressiveInterestProposal(proposalWindow: Window) {
  proposalWindow.setTimeout(() => {
    proposalWindow.print();
  }, 100);
}

function buildProgressiveInterestProposalHtml({
  projectName,
  unitNo,
  stageTimings,
  result,
  fullMonthlyInstalment,
  branding,
}: {
  projectName: string;
  unitNo: string;
  stageTimings: Record<TimelineStageId, StageTiming>;
  result: ProgressiveInterestResult;
  fullMonthlyInstalment: number | null;
  branding: CustomerPdfBranding;
}) {
  const estimatedVp = getStageTimingLabel("vp", stageTimings);
  const scheduleRows = result.stages
    .map((stageResult) => {
      const label = pdfStageLabels[stageResult.stage.id];

      return `
        <tr>
          <td class="stage-code">${escapeHtml(stageResult.stage.code)}</td>
          <td>
            <strong>${escapeHtml(label.english)}</strong>
            <span>${escapeHtml(label.chinese)}</span>
          </td>
          <td>${escapeHtml(formatPercent(stageResult.stagePercentage))}</td>
          <td>${escapeHtml(formatCurrency(stageResult.stageAmount))}</td>
          <td class="bank-release">${getPdfBankReleaseDisplay(stageResult, result.spaPrice)}</td>
          <td class="interest">${escapeHtml(getPdfInterestDisplay(stageResult, fullMonthlyInstalment))}</td>
          <td>${escapeHtml(getPdfDateLabel(stageResult.stage.id, stageTimings))}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Progressive Interest Estimate</title>
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
        color: #71717a;
        font-size: 9px;
        font-weight: 700;
        margin: 4px 0 0;
      }
      .project-line {
        color: #3f3f46;
        font-size: 10px;
        font-weight: 700;
        margin: 4px 0 0;
      }
      .compact-fields {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 5px;
        margin-top: 8px;
      }
      .compact-field {
        border: 1px solid #e4e4e7;
        border-radius: 8px;
        min-height: 34px;
        padding: 5px 6px;
      }
      .compact-field span {
        color: #71717a;
        display: block;
        font-size: 6.8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .compact-field strong {
        color: #18181b;
        display: block;
        font-size: 9px;
        line-height: 1.15;
        margin-top: 3px;
      }
      .journey {
        margin-top: 10px;
      }
      .section-title {
        align-items: baseline;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 6px;
      }
      h2 {
        color: #083f3a;
        font-size: 10.5px;
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
      .schedule {
        margin-top: 8px;
      }
      table {
        border-collapse: collapse;
        table-layout: fixed;
        width: 100%;
      }
      th,
      td {
        border: 1px solid #e4e4e7;
        padding: 3.2px 4px;
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
        font-size: 7.9px;
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
        width: 12mm;
      }
      .bank-release strong {
        color: #18181b;
        display: block;
        font-size: 8px;
        font-weight: 800;
        line-height: 1.05;
      }
      .bank-release span {
        color: #71717a;
        display: block;
        font-size: 6.7px;
        font-weight: 700;
        margin-top: 1px;
      }
      .interest {
        color: #087F6B;
        font-weight: 800;
      }
      .highlights {
        margin-top: 9px;
      }
      .highlight {
        border: 1px solid #b7e6dc;
        border-radius: 10px;
        background: #f1fbf8;
        display: inline-block;
        min-width: 72mm;
        padding: 7px 9px;
      }
      .highlight span {
        color: #087F6B;
        display: block;
        font-size: 7.4px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .highlight strong {
        color: #087F6B;
        display: block;
        font-size: 13px;
        line-height: 1.1;
        margin-top: 3px;
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
        tr { break-inside: avoid; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    ${renderCustomerPdfWatermark(branding)}
    <main class="page">
      <header class="header">
        <div>
          <p class="eyebrow">Progressive Interest Estimate</p>
          <h1>Progressive Interest Estimate</h1>
          <p class="subtitle">Schedule H · Under Construction Property</p>
          ${
            projectName || unitNo
              ? `<p class="project-line">${escapeHtml(
                  [projectName, unitNo ? `Unit ${unitNo}` : ""].filter(Boolean).join(" · "),
                )}</p>`
              : ""
          }
        </div>
      </header>

      <section class="compact-fields">
        ${compactField("SPA Price", formatCurrency(result.spaPrice))}
        ${compactField("Loan Margin", formatPercent(result.loanMarginPercent))}
        ${compactField("Loan Amount", formatCurrency(result.loanAmount))}
        ${compactField("Interest Rate", formatPercent(result.annualInterestRatePercent))}
        ${compactField("Estimated VP", estimatedVp)}
        ${compactField("Est. Full Instalment", `${formatCurrencyDetailed(fullMonthlyInstalment)}/mo`)}
      </section>

      <section class="schedule">
        <div class="section-title">
          <h2>Schedule H Breakdown / 建筑阶段明细</h2>
          <span>Estimated monthly interest by stage</span>
        </div>
        <table>
          <colgroup>
            <col style="width: 10%;" />
            <col style="width: 29%;" />
            <col style="width: 7%;" />
            <col style="width: 12%;" />
            <col style="width: 15%;" />
            <col style="width: 18%;" />
            <col style="width: 9%;" />
          </colgroup>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Construction Stage / 建筑阶段</th>
              <th>%</th>
              <th>Stage Amount</th>
              <th>Bank Release % / 银行放款 %</th>
              <th>Est. Progressive Interest</th>
              <th>Est. Date</th>
            </tr>
          </thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </section>

      <section class="highlights">
        <div class="highlight">
          <span>Est. Full Instalment After VP</span>
          <strong>${escapeHtml(formatCurrencyDetailed(fullMonthlyInstalment))} / month</strong>
        </div>
      </section>

      <p class="disclaimer">
        <strong>Estimate only / 仅供估算.</strong>
        Estimated bank releases assume the buyer's required equity is used first, followed by
        progressive bank financing. 预计银行放款以买家先支付所需自付部分，之后才由银行逐步放款为估算基础。
        Actual progressive interest depends on the actual timing and amount of loan disbursement by
        the bank, construction progress, applicable interest rate and financing terms.
        实际 Progressive Interest 将根据银行实际放款时间与金额、建筑进度、适用利率及贷款条件而有所不同。
      </p>

      ${renderCustomerPdfBranding(branding)}
    </main>
  </body>
</html>`;
}

export default function ProgressiveInterestPage() {
  const { displayName, phone } = useAppPermissions();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [exportError, setExportError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [spaPrice, setSpaPrice] = useState("");
  const [loanMarginPercent, setLoanMarginPercent] = useState("90");
  const [annualInterestRatePercent, setAnnualInterestRatePercent] = useState("4.00");
  const [loanTenureYears, setLoanTenureYears] = useState("35");
  const [stageTimings, setStageTimings] = useState(createInitialStageTimings);
  const [currentStageId, setCurrentStageId] = useState<TimelineStageId | "">("");
  const [expandedStageIds, setExpandedStageIds] = useState<Set<ScheduleHStageId>>(
    () => new Set(),
  );
  const [savedProjectSnapshot, setSavedProjectSnapshot] =
    useState<ProgressiveInterestSavedProjectSnapshotV1 | null>(null);
  const [currentSavedWorkId, setCurrentSavedWorkId] = useState<string | null>(null);
  const [currentSavedWorkTitle, setCurrentSavedWorkTitle] = useState("");
  const [saveModalMode, setSaveModalMode] = useState<SaveModalMode | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [reopenWarning, setReopenWarning] = useState("");
  const savedWorkHydratedRef = useRef(false);

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
      annualInterestRatePercent: parseNumberInput(annualInterestRatePercent),
      loanTenureYears: parseNumberInput(loanTenureYears),
    }),
    [annualInterestRatePercent, loanMarginPercent, loanTenureYears, spaPrice],
  );

  const progressiveResult = useMemo(
    () =>
      calculateProgressiveInterest({
        spaPrice: numericInput.spaPrice,
        loanMarginPercent: numericInput.loanMarginPercent,
        annualInterestRatePercent: numericInput.annualInterestRatePercent,
      }),
    [
      numericInput.annualInterestRatePercent,
      numericInput.loanMarginPercent,
      numericInput.spaPrice,
    ],
  );

  const fullMonthlyInstalment = useMemo(
    () =>
      calculateMonthlyInstalment(
        progressiveResult.loanAmount,
        numericInput.annualInterestRatePercent,
        numericInput.loanTenureYears,
      ),
    [
      numericInput.annualInterestRatePercent,
      numericInput.loanTenureYears,
      progressiveResult.loanAmount,
    ],
  );

  const constructionResults = progressiveResult.stages.filter(
    (result) => result.stage.category === "construction",
  );
  const knownConstructionInterest = constructionResults
    .map((result) => result.estimatedMonthlyProgressiveInterest)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const hasCompleteConstructionInterest =
    constructionResults.length > 0 &&
    constructionResults.every((result) =>
      Number.isFinite(result.estimatedMonthlyProgressiveInterest),
    );
  const peakProgressiveInterest =
    hasCompleteConstructionInterest && knownConstructionInterest.length
      ? Math.max(...knownConstructionInterest)
      : null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedProjectName =
    selectedProject?.project_name?.trim() ||
    (savedProjectSnapshot?.id === selectedProjectId ? savedProjectSnapshot.projectName : "");
  const shouldShowSavedProjectOption =
    Boolean(savedProjectSnapshot?.id) &&
    savedProjectSnapshot?.id === selectedProjectId &&
    !projects.some((project) => project.id === selectedProjectId);
  const invalidSpaPrice = spaPrice.trim() !== "" && progressiveResult.validationErrors.some(
    (error) => error.startsWith("SPA Price"),
  );
  const invalidLoanMargin =
    loanMarginPercent.trim() !== "" &&
    progressiveResult.validationErrors.some((error) => error.startsWith("Loan margin"));
  const invalidInterestRate =
    annualInterestRatePercent.trim() !== "" &&
    progressiveResult.validationErrors.some((error) => error.startsWith("Annual interest"));
  const invalidLoanTenure =
    loanTenureYears.trim() !== "" &&
    (!Number.isFinite(numericInput.loanTenureYears) || numericInput.loanTenureYears <= 0);

  function buildProgressiveInterestSavedWorkPayload(): ProgressiveInterestSavedWorkPayloadV1 {
    return {
      tool: "progressive_interest",
      schemaVersion: progressiveInterestSavedWorkSchemaVersion,
      selectedProjectId,
      unitNo,
      spaPrice,
      loanMarginPercent,
      annualInterestRatePercent,
      loanTenureYears,
      currentStageId,
      stageTimings,
      snapshots: {
        project:
          selectedProjectId && selectedProjectName
            ? {
                id: selectedProjectId,
                projectName: selectedProjectName,
              }
            : null,
      },
    };
  }

  async function saveProgressiveInterestWork(title: string, savedWorkId: string | null) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setSaveStatus("error");
      setSaveMessage("Saved Work title is required.");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const response = await fetch(
        savedWorkId ? `/api/saved-work/${savedWorkId}` : "/api/saved-work",
        {
          method: savedWorkId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            savedWorkId
              ? {
                  title: trimmedTitle,
                  payload: buildProgressiveInterestSavedWorkPayload(),
                  schemaVersion: progressiveInterestSavedWorkSchemaVersion,
                }
              : {
                  title: trimmedTitle,
                  workType: "progressive_interest",
                  payload: buildProgressiveInterestSavedWorkPayload(),
                  schemaVersion: progressiveInterestSavedWorkSchemaVersion,
                },
          ),
        },
      );
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "Unable to save Progressive Interest");
      }

      setCurrentSavedWorkId(data.savedWork.id);
      setCurrentSavedWorkTitle(data.savedWork.title);
      setSaveStatus("saved");
      setSaveMessage("Saved");
      setSaveModalMode(null);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  function openSaveModal(mode: SaveModalMode) {
    setSaveModalMode(mode);
    setSaveTitle(
      mode === "save-as"
        ? `${getDefaultSavedWorkTitle({ projectName: selectedProjectName, unitNo })} Copy`
        : getDefaultSavedWorkTitle({ projectName: selectedProjectName, unitNo }),
    );
    setSaveMessage("");
    setSaveStatus("idle");
  }

  function handleSaveClick() {
    if (currentSavedWorkId) {
      void saveProgressiveInterestWork(
        currentSavedWorkTitle ||
          getDefaultSavedWorkTitle({ projectName: selectedProjectName, unitNo }),
        currentSavedWorkId,
      );
      return;
    }

    openSaveModal("new");
  }

  function hydrateSavedProgressiveInterestPayload(payload: ProgressiveInterestSavedWorkPayloadV1) {
    setSelectedProjectId(payload.selectedProjectId);
    setUnitNo(payload.unitNo);
    setSpaPrice(payload.spaPrice);
    setLoanMarginPercent(payload.loanMarginPercent);
    setAnnualInterestRatePercent(payload.annualInterestRatePercent);
    setLoanTenureYears(payload.loanTenureYears);
    setStageTimings(payload.stageTimings);
    setCurrentStageId(payload.currentStageId);
    setSavedProjectSnapshot(payload.snapshots.project);
    setExpandedStageIds(new Set());
    setExportError("");
  }

  async function openSavedProgressiveInterest(savedWorkId: string) {
    setReopenWarning("");

    try {
      const response = await fetch(`/api/saved-work/${savedWorkId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as SavedWorkDetailResponse;

      if (!response.ok || !data.savedWork) {
        throw new Error(data.error || "This saved work could not be opened.");
      }

      if (data.savedWork.workType !== "progressive_interest") {
        throw new Error("This saved Progressive Interest version cannot be opened.");
      }

      const validated = validateProgressiveInterestSavedWorkPayload(data.savedWork.payload);

      if (!validated.valid) {
        throw new Error(validated.error);
      }

      hydrateSavedProgressiveInterestPayload(validated.payload);
      setCurrentSavedWorkId(data.savedWork.id);
      setCurrentSavedWorkTitle(data.savedWork.title);
      setSaveStatus("saved");
      setSaveMessage("Saved Work opened");
    } catch (error) {
      setReopenWarning(
        error instanceof Error ? error.message : "This saved work could not be opened.",
      );
      setCurrentSavedWorkId(null);
      setCurrentSavedWorkTitle("");
    }
  }

  useEffect(() => {
    if (savedWorkHydratedRef.current) return;

    const savedWorkId = new URL(window.location.href).searchParams.get("savedWork");

    if (!savedWorkId) {
      savedWorkHydratedRef.current = true;
      return;
    }

    savedWorkHydratedRef.current = true;
    void openSavedProgressiveInterest(savedWorkId);
    // Run only once so normal editing after reopen is never rehydrated over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!savedProjectSnapshot || !selectedProjectId || projectsError) return;
    if (projects.length === 0) return;
    if (projects.some((project) => project.id === selectedProjectId)) return;

    setReopenWarning("Current Project reference is unavailable. Saved project details were preserved.");
  }, [projects, projectsError, savedProjectSnapshot, selectedProjectId]);

  function updateStageTiming(stageId: TimelineStageId, field: keyof StageTiming, value: string) {
    setStageTimings((current) => ({
      ...current,
      [stageId]: {
        ...current[stageId],
        [field]: value,
      },
    }));
  }

  function toggleStageExplanation(stageId: ScheduleHStageId) {
    setExpandedStageIds((current) => {
      const next = new Set(current);

      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }

      return next;
    });
  }

  function handleExportPdf() {
    setExportError("");

    if (!progressiveResult.isValid || fullMonthlyInstalment === null) {
      setExportError("Complete valid financing inputs before exporting the customer PDF.");
      return;
    }

    const proposalWindow = window.open("", "_blank");

    if (!proposalWindow) {
      window.alert("Please allow pop-ups to preview and export the PDF.");
      return;
    }

    proposalWindow.document.open();
    proposalWindow.document.write(
      buildProgressiveInterestProposalHtml({
        projectName: selectedProjectName,
        unitNo: unitNo.trim(),
        stageTimings,
        result: progressiveResult,
        fullMonthlyInstalment,
        branding: {
          agentName: displayName,
          agentPhone: phone,
        },
      }),
    );
    proposalWindow.document.close();
    proposalWindow.focus();

    printProgressiveInterestProposal(proposalWindow);
  }

  return (
    <>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#087F6B]">
            Schedule H · Under Construction Property
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Progressive Interest Calculator
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Estimate progressive interest throughout the construction period.
              </p>
              {currentSavedWorkTitle ? (
                <p className="mt-2 truncate text-xs text-zinc-500">
                  Saved Work:{" "}
                  <span className="font-medium text-zinc-700">{currentSavedWorkTitle}</span>
                </p>
              ) : null}
              {saveMessage ? (
                <p
                  className={`mt-1 text-xs font-medium ${
                    saveStatus === "error" ? "text-amber-700" : "text-[#087F6B]"
                  }`}
                >
                  {saveMessage}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                <span className="block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Structure Total
                </span>
                <strong className="mt-1 block text-lg text-zinc-950">100%</strong>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saveStatus === "saving"}
                  className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveStatus === "saving" ? "Saving..." : "Save"}
                </button>
                {currentSavedWorkId ? (
                  <button
                    type="button"
                    onClick={() => openSaveModal("save-as")}
                    disabled={saveStatus === "saving"}
                    className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save As
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Export PDF
                </button>
              </div>
            </div>
          </div>
          {reopenWarning ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {reopenWarning}
            </div>
          ) : null}
          {exportError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-[#FFF9E8] px-4 py-3 text-sm font-medium text-amber-800">
              {exportError}
            </div>
          ) : null}
        </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Property & Financing</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Project and unit details are for presentation context only in this version.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">Project</span>
                <select
                  value={selectedProjectId}
                  onChange={(event) => {
                    setSelectedProjectId(event.target.value);
                    setSavedProjectSnapshot(null);
                  }}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                >
                  <option value="">Optional Project</option>
                  {shouldShowSavedProjectOption && savedProjectSnapshot ? (
                    <option value={savedProjectSnapshot.id}>
                      {savedProjectSnapshot.projectName || "Saved Project"}
                    </option>
                  ) : null}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_name || "Untitled Project"}
                    </option>
                  ))}
                </select>
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
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
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
                    placeholder="584000"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                  />
                </div>
              </label>

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

              <label className="block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">Interest Rate</span>
                <div className={`flex rounded-2xl border ${getInputStateClass(invalidInterestRate)}`}>
                  <input
                    inputMode="decimal"
                    value={annualInterestRatePercent}
                    onChange={(event) => setAnnualInterestRatePercent(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                  />
                  <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">%</span>
                </div>
              </label>

              <label className="block text-sm text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-900">Loan Tenure</span>
                <div className={`flex rounded-2xl border ${getInputStateClass(invalidLoanTenure)}`}>
                  <input
                    inputMode="decimal"
                    value={loanTenureYears}
                    onChange={(event) => setLoanTenureYears(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                  />
                  <span className="border-l border-zinc-200 px-3 py-2 text-zinc-500">years</span>
                </div>
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
              Estimated bank releases assume the buyer&apos;s required equity is used first,
              followed by progressive bank financing.
              <span className="mt-1 block">
                预计银行放款以买家先支付所需自付部分，之后才由银行逐步放款为估算基础。
              </span>
            </div>
          </section>

          <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  Estimated Construction Timeline
                </h2>
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
                  onChange={(event) => setCurrentStageId(event.target.value as TimelineStageId | "")}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
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
                const shortLabel = journeyStageLabels[stageId];

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
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{stage.englishTitle}</p>
                    </div>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={timing.year}
                      onChange={(event) => updateStageTiming(stageId, "year", event.target.value)}
                      placeholder="Year"
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <select
                      value={timing.quarter}
                      onChange={(event) => updateStageTiming(stageId, "quarter", event.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
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
              Financing Summary
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                <span className="text-zinc-500">SPA Price</span>
                <strong className="text-right text-zinc-900">
                  {formatCurrency(progressiveResult.spaPrice)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                <span className="text-zinc-500">Loan Amount</span>
                <strong className="text-right text-zinc-900">
                  {formatCurrency(progressiveResult.loanAmount)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                <span className="text-zinc-500">Buyer Equity</span>
                <strong className="text-right text-zinc-900">
                  {formatCurrency(progressiveResult.buyerEquity)}
                </strong>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[#f1fbf8] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#087F6B]">
                  Est. Full Instalment
                </p>
                <p className="mt-2 text-xl font-semibold text-[#087F6B]">
                  {formatCurrencyDetailed(fullMonthlyInstalment)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">After VP / month</p>
              </div>
              <div className="rounded-2xl border border-[#b7e6dc] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#087F6B]">
                  Peak Est. Progressive Interest
                </p>
                <p className="mt-2 text-xl font-semibold text-[#087F6B]">
                  {formatCurrencyDetailed(peakProgressiveInterest)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">During construction / month</p>
              </div>
            </div>
          </section>

          {progressiveResult.validationErrors.length ? (
            <section className="rounded-[28px] border border-amber-200 bg-[#FFF9E8] p-5 text-sm text-amber-800">
              <p className="font-semibold">Check inputs</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {progressiveResult.validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Progressive Payment Schedule
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Schedule H stage details with bilingual explanations.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Schedule H percentage shows the stage billing amount. Progressive Interest is
              calculated only on the portion released by the bank.
              <span className="mt-1 block">
                Schedule H 百分比代表该建筑阶段的付款比例。Progressive Interest
                只根据银行实际放款的部分计算。
              </span>
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1160px] border-separate border-spacing-0 text-left text-sm">
              <colgroup>
                <col className="w-20" />
                <col className="w-[280px]" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-60" />
                <col className="w-56" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Stage
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Construction Stage / 建筑阶段
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    %
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Stage Amount
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Payment Split / 付款分配
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#087F6B]">
                    Est. Progressive Interest
                  </th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Est. Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {progressiveResult.stages.map((result) => {
                  const isExpanded = expandedStageIds.has(result.stage.id);
                  const timelineLabel = timelineStageIds.includes(
                    result.stage.id as TimelineStageId,
                  )
                    ? journeyStageLabels[result.stage.id as TimelineStageId]
                    : null;

                  return (
                    <tr key={result.stage.id} className="align-top">
                      <td className="border-b border-zinc-100 py-4 pr-4 font-semibold text-zinc-900">
                        {result.stage.code}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4">
                        <p className="font-semibold text-zinc-900">
                          {timelineLabel
                            ? `${timelineLabel.english} / ${timelineLabel.chinese}`
                            : `${result.stage.englishTitle} / ${result.stage.chineseTitle}`}
                        </p>
                        <button
                          type="button"
                          aria-label={`${isExpanded ? "Hide" : "Show"} details for ${result.stage.code}`}
                          onClick={() => toggleStageExplanation(result.stage.id)}
                          className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 text-xs font-medium text-zinc-500 transition hover:border-[#087F6B] hover:text-[#087F6B]"
                        >
                          <span aria-hidden="true">{isExpanded ? "⌃" : "⌄"}</span>
                        </button>
                        {isExpanded ? (
                          <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
                            <p>{result.stage.englishShortDescription}</p>
                            <p className="mt-1">{result.stage.chineseShortDescription}</p>
                          </div>
                        ) : null}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 font-medium text-zinc-700">
                        {formatPercent(result.stagePercentage)}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 font-medium text-zinc-900">
                        {formatCurrency(result.stageAmount)}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4">
                        <PaymentSplit result={result} spaPrice={progressiveResult.spaPrice} />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 text-base font-semibold text-[#087F6B]">
                        {getProgressiveInterestDisplay(result, fullMonthlyInstalment)}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 text-zinc-600">
                        {getStageTimingLabel(result.stage.id, stageTimings)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-6 xl:col-span-2">
          <p className="text-sm font-semibold text-zinc-950">Estimate only / 仅供估算</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Actual progressive interest depends on the actual timing and amount of loan
            disbursement by the bank, construction progress, applicable interest rate and financing
            terms.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            实际 Progressive Interest 将根据银行实际放款时间与金额、建筑进度、适用利率及贷款条件而有所不同。
          </p>
        </section>
      </div>
      </main>

      {saveModalMode ? (
        <SaveWorkModal
          mode={saveModalMode}
          title={saveTitle}
          error={saveStatus === "error" ? saveMessage : ""}
          isSaving={saveStatus === "saving"}
          onTitleChange={setSaveTitle}
          onCancel={() => {
            if (saveStatus === "saving") return;
            setSaveModalMode(null);
            setSaveMessage("");
            setSaveStatus("idle");
          }}
          onConfirm={() => void saveProgressiveInterestWork(saveTitle, null)}
        />
      ) : null}
    </>
  );
}

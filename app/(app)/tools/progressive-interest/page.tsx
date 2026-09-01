"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateMonthlyInstalment } from "@/lib/property-finance";
import {
  calculateProgressiveInterest,
  scheduleHStages,
  type ProgressiveInterestStageResult,
  type ScheduleHStageId,
} from "@/lib/progressive-interest";

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

const constructionStageIds: TimelineStageId[] = [
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "2g",
  "2h",
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

  if (result.calculationStatus === "manual_release_required") {
    return "Custom bank release required";
  }

  return formatCurrencyDetailed(result.estimatedMonthlyProgressiveInterest);
}

function getJourneyStatus(
  stageId: TimelineStageId,
  currentStageId: TimelineStageId | "",
) {
  if (!currentStageId) return "upcoming";

  const currentIndex = timelineStageIds.indexOf(currentStageId);
  const stageIndex = timelineStageIds.indexOf(stageId);

  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";

  return "upcoming";
}

function getInputStateClass(isInvalid: boolean) {
  return isInvalid ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50";
}

export default function ProgressiveInterestPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [spaPrice, setSpaPrice] = useState("");
  const [loanMarginPercent, setLoanMarginPercent] = useState("90");
  const [annualInterestRatePercent, setAnnualInterestRatePercent] = useState("4.00");
  const [loanTenureYears, setLoanTenureYears] = useState("35");
  const [stageTimings, setStageTimings] = useState(createInitialStageTimings);
  const [currentStageId, setCurrentStageId] = useState<TimelineStageId | "">("");
  const [bankReleaseInputs, setBankReleaseInputs] = useState<
    Partial<Record<TimelineStageId, string>>
  >({});
  const [expandedStageIds, setExpandedStageIds] = useState<Set<ScheduleHStageId>>(
    () => new Set(),
  );

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

  const isCustomBankRelease = numericInput.loanMarginPercent !== 90;
  const bankReleaseOverrides = useMemo(() => {
    if (!isCustomBankRelease) return undefined;

    return constructionStageIds.reduce(
      (overrides, stageId) => {
        const value = bankReleaseInputs[stageId];

        if (!value?.trim()) return overrides;

        const parsed = parseNumberInput(value);

        if (Number.isFinite(parsed) && parsed >= 0) {
          overrides[stageId] = parsed;
        }

        return overrides;
      },
      {} as Partial<Record<ScheduleHStageId, number>>,
    );
  }, [bankReleaseInputs, isCustomBankRelease]);

  const progressiveResult = useMemo(
    () =>
      calculateProgressiveInterest({
        spaPrice: numericInput.spaPrice,
        loanMarginPercent: numericInput.loanMarginPercent,
        annualInterestRatePercent: numericInput.annualInterestRatePercent,
        bankReleaseOverridesByStageId: bankReleaseOverrides,
      }),
    [
      bankReleaseOverrides,
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
  const customReleaseTotal = constructionStageIds.reduce((sum, stageId) => {
    const parsed = parseNumberInput(bankReleaseInputs[stageId] ?? "");

    return Number.isFinite(parsed) && parsed >= 0 ? sum + parsed : sum;
  }, 0);
  const customReleaseExceedsLoan =
    isCustomBankRelease &&
    progressiveResult.isValid &&
    customReleaseTotal > progressiveResult.loanAmount;
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

  function updateBankRelease(stageId: TimelineStageId, value: string) {
    setBankReleaseInputs((current) => ({
      ...current,
      [stageId]: value,
    }));
  }

  return (
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
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <span className="block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
              Structure Total
            </span>
            <strong className="mt-1 block text-lg text-zinc-950">100%</strong>
          </div>
        </div>
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
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
                >
                  <option value="">Optional Project</option>
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

          {isCustomBankRelease ? (
            <section className="rounded-[28px] border border-amber-200 bg-[#FFF9E8] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  Custom Bank Release Required
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  Actual bank disbursement may vary based on financing structure. Enter the estimated
                  bank release for each construction stage to calculate progressive interest.
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  需要输入银行预计放款金额。实际银行放款会根据贷款结构而有所不同。请输入各建筑阶段的预计银行放款金额，以计算 Progressive Interest。
                </p>
              </div>

              {customReleaseExceedsLoan ? (
                <div className="mt-4 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-800">
                  Cumulative custom releases exceed the loan amount. Please review the stage release
                  amounts.
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {constructionStageIds.map((stageId) => {
                  const stage = scheduleHStages.find((item) => item.id === stageId);
                  const value = bankReleaseInputs[stageId] ?? "";
                  const parsed = parseNumberInput(value);
                  const invalid = value.trim() !== "" && (!Number.isFinite(parsed) || parsed < 0);

                  if (!stage) return null;

                  return (
                    <label key={stage.id} className="block text-sm text-zinc-600">
                      <span className="mb-1 block font-medium text-zinc-900">
                        {stage.code} Estimated Bank Release
                      </span>
                      <div className={`flex rounded-2xl border ${getInputStateClass(invalid)}`}>
                        <span className="border-r border-zinc-200 px-3 py-2 text-zinc-500">RM</span>
                        <input
                          inputMode="decimal"
                          value={value}
                          onChange={(event) => updateBankRelease(stageId, event.target.value)}
                          placeholder="Release for this stage"
                          className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

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

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)] xl:col-span-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#087F6B]">
                Your Payment Journey
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                你的供款时间线
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                Progressive interest starts lower, increases as the bank releases more, then
                transitions toward full instalment after VP.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-[#f1fbf8] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#087F6B]">
                Peak During Construction
              </p>
              <p className="mt-1 text-xl font-semibold text-[#087F6B]">
                {formatCurrencyDetailed(peakProgressiveInterest)}
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto pb-3">
            <div className="relative flex min-w-[1120px] items-start gap-0 px-2">
              <div className="absolute left-16 right-16 top-[4.9rem] h-px bg-zinc-200" />
              {timelineStageIds.map((stageId) => {
                const result = progressiveResult.stages.find((item) => item.stage.id === stageId);

                if (!result) return null;

                const status = getJourneyStatus(stageId, currentStageId);
                const label = journeyStageLabels[stageId];

                return (
                  <article
                    key={stageId}
                    className="relative z-10 flex w-32 shrink-0 flex-col items-center text-center"
                  >
                    <p className="h-5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                      {getStageTimingLabel(stageId, stageTimings)}
                    </p>
                    <div
                      className={`mt-5 flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white text-xs font-semibold ${
                        status === "current"
                          ? "border-[#087F6B] text-[#087F6B] shadow-[0_0_0_6px_rgba(8,127,107,0.08)]"
                          : status === "completed"
                            ? "border-emerald-300 text-emerald-700"
                            : "border-zinc-200 text-zinc-500"
                      }`}
                    >
                      {result.stage.code}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-zinc-950">{label.english}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{label.chinese}</p>
                    <p className="mt-3 text-base font-bold text-[#087F6B]">
                      {stageId === "vp"
                        ? formatCurrencyDetailed(fullMonthlyInstalment)
                        : result.estimatedMonthlyProgressiveInterest === null
                          ? "—"
                          : formatCurrencyDetailed(result.estimatedMonthlyProgressiveInterest)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {stageId === "vp" ? "Full instalment / mo" : "Progressive interest / mo"}
                    </p>
                    {status === "current" ? (
                      <span className="mt-3 rounded-full bg-[#087F6B] px-2.5 py-1 text-[11px] font-semibold text-white">
                        Current
                      </span>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Progressive Payment Schedule
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Schedule H stage details with bilingual explanations.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
              <colgroup>
                <col className="w-20" />
                <col className="w-[280px]" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-44" />
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
                    Est. Bank Release
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
                      <td className="border-b border-zinc-100 px-4 py-4 font-medium text-zinc-900">
                        {formatCurrency(result.estimatedBankReleaseForStage)}
                        {result.calculationStatus === "manual_release_required" ? (
                          <p className="mt-1 text-xs text-amber-700">Manual release required</p>
                        ) : null}
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
  );
}

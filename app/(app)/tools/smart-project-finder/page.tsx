"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  findSmartProjectMatches,
  type SmartFinderBedroomFilterResult,
  type SmartFinderBudgetFilterResult,
  type SmartFinderDataSet,
  type SmartFinderPreferenceResult,
  type SmartFinderPurpose,
  type SmartFinderRailPreference,
  type SmartFinderResult,
  type SmartFinderTenurePreference,
  type SmartFinderUnitTypeFact,
} from "@/lib/smart-project-finder";

type FinderOptionsResponse = {
  projects: SmartFinderDataSet["projects"];
  unit_types: SmartFinderDataSet["unitTypes"];
  connectivity: SmartFinderDataSet["connectivity"];
  metadata?: {
    area_options?: string[];
  };
};

type FinderForm = {
  maxBudget: string;
  minimumBedrooms: string;
  preferredAreas: string[];
  tenure: SmartFinderTenurePreference;
  rail: SmartFinderRailPreference;
  completionByYear: string;
  maxMonthlyInstalment: string;
  purpose: SmartFinderPurpose;
  loanMarginPercent: string;
  interestRatePercent: string;
  loanTenureYears: string;
};

type SelectedComparisonItem = {
  projectId: string;
  unitTypeId: string;
  projectName: string;
  unitTypeLabel: string;
};

const initialForm: FinderForm = {
  maxBudget: "",
  minimumBedrooms: "",
  preferredAreas: [],
  tenure: "no_preference",
  rail: "no_preference",
  completionByYear: "",
  maxMonthlyInstalment: "",
  purpose: "both",
  loanMarginPercent: "90",
  interestRatePercent: "4",
  loanTenureYears: "35",
};

const bedroomOptions = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
];

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInteger(value: string) {
  const parsed = parseOptionalNumber(value);

  if (parsed === null) return null;

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function formatMoney(value: number) {
  return `RM${value.toLocaleString("en-MY", {
    maximumFractionDigits: 0,
  })}`;
}

function formatPriceRange(from: number | null, to: number | null) {
  if (typeof from !== "number" || !Number.isFinite(from)) return "Price unavailable";
  if (typeof to !== "number" || !Number.isFinite(to) || to === from) return formatMoney(from);

  return `${formatMoney(from)} - ${formatMoney(to)}`;
}

function formatEstimatedCompletion(project: SmartFinderDataSet["projects"][number]) {
  if (!project.estimated_vp_year) return null;
  if (!project.estimated_vp_quarter) return `Est. ${project.estimated_vp_year}`;

  return `Est. ${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function getUnitTypeLabel(unitType: SmartFinderUnitTypeFact) {
  return [unitType.type_code, unitType.type_name].filter(Boolean).join(" - ");
}

function getUnitConfiguration(unitType: SmartFinderUnitTypeFact) {
  if (unitType.display_configuration) return unitType.display_configuration;

  const roomLabel =
    typeof unitType.bedrooms === "number"
      ? `${unitType.bedrooms}R`
      : null;
  const bathroomLabel =
    typeof unitType.bathrooms === "number"
      ? `${unitType.bathrooms}B`
      : null;

  return [roomLabel, bathroomLabel].filter(Boolean).join("");
}

function getPrimaryUnitFacts(unitType: SmartFinderUnitTypeFact) {
  return [
    getUnitConfiguration(unitType),
    typeof unitType.size_sqft === "number" ? `${unitType.size_sqft.toLocaleString("en-MY")} sqft` : null,
  ].filter(Boolean);
}

function getSecondaryUnitFacts(unitType: SmartFinderUnitTypeFact) {
  return [
    typeof unitType.bathrooms === "number" ? `${unitType.bathrooms} bath` : null,
    typeof unitType.default_carparks === "number"
      ? `${unitType.default_carparks} carpark`
      : unitType.carpark_description,
    unitType.is_dual_key ? "Dual Key" : null,
    unitType.has_balcony ? "Balcony" : null,
  ].filter(Boolean);
}

function getPreferenceStatusLabel(status: SmartFinderPreferenceResult["status"]) {
  if (status === "matched") return "Matched";
  if (status === "partial") return "Partial";
  if (status === "not_matched") return "Not Matched";

  return "Unavailable";
}

function getPreferenceMarker(status: SmartFinderPreferenceResult["status"]) {
  if (status === "matched") return "✓";
  if (status === "partial") return "△";
  if (status === "not_matched") return "✕";

  return "—";
}

function getPreferenceTitle(preference: SmartFinderPreferenceResult) {
  const labels: Record<SmartFinderPreferenceResult["key"], string> = {
    area: "Preferred Area",
    tenure: "Tenure",
    rail: "Rail Access",
    completion: "Completion",
    instalment: "Monthly Instalment",
  };

  return labels[preference.key];
}

function getPreferenceClass(status: SmartFinderPreferenceResult["status"]) {
  if (status === "matched") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "not_matched") return "border-rose-100 bg-rose-50/40 text-zinc-700";

  return "border-zinc-200 bg-white text-zinc-500";
}

function getRequirementMarker(status: SmartFinderPreferenceResult["status"]) {
  return getPreferenceMarker(status);
}

function getRequirementClass(status: SmartFinderPreferenceResult["status"]) {
  return getPreferenceClass(status);
}

function getBudgetRequirementStatus(
  status: SmartFinderBudgetFilterResult["status"],
): SmartFinderPreferenceResult["status"] {
  if (status === "within_budget") return "matched";
  if (status === "partially_within_budget") return "partial";
  if (status === "unavailable") return "unavailable";

  return "not_matched";
}

function getBedroomRequirementStatus(
  status: SmartFinderBedroomFilterResult["status"],
): SmartFinderPreferenceResult["status"] {
  if (status === "matched") return "matched";
  if (status === "unavailable") return "unavailable";

  return "not_matched";
}

function getRequirementRows({
  budget,
  bedrooms,
  maxBudget,
  minimumBedrooms,
}: {
  budget: SmartFinderBudgetFilterResult;
  bedrooms: SmartFinderBedroomFilterResult;
  maxBudget: number | null;
  minimumBedrooms: number | null;
}) {
  const rows: Array<{
    key: string;
    title: string;
    evidence: string;
    status: SmartFinderPreferenceResult["status"];
  }> = [];

  if (budget.active) {
    const status = getBudgetRequirementStatus(budget.status);
    const budgetLabel =
      typeof maxBudget === "number" && Number.isFinite(maxBudget)
        ? `${formatMoney(maxBudget)} Budget`
        : "Budget";
    const prefix =
      status === "matched"
        ? "Within"
        : status === "partial"
          ? "Partially Within"
          : status === "unavailable"
            ? "Budget Unavailable"
            : "Outside";

    rows.push({
      key: "budget",
      title: status === "unavailable" ? prefix : `${prefix} ${budgetLabel}`,
      evidence: budget.evidence,
      status,
    });
  }

  if (bedrooms.active) {
    const status = getBedroomRequirementStatus(bedrooms.status);
    const bedroomLabel =
      typeof minimumBedrooms === "number" && Number.isInteger(minimumBedrooms)
        ? `Minimum ${minimumBedrooms} Bedroom${minimumBedrooms === 1 ? "" : "s"}`
        : "Minimum Bedrooms";

    rows.push({
      key: "bedrooms",
      title: bedroomLabel,
      evidence: bedrooms.evidence,
      status,
    });
  }

  return rows;
}

function getBudgetBadge(status: string) {
  if (status === "within_budget") {
    return {
      label: "Within Budget",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "partially_within_budget") {
    return {
      label: "Partially Within Budget",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return null;
}

function countResults(result: SmartFinderResult | null) {
  if (!result) return { projects: 0, unitTypes: 0 };

  return {
    projects: result.projects.length,
    unitTypes: result.projects.reduce(
      (sum, project) => sum + project.matchingUnitTypes.length,
      0,
    ),
  };
}

function getSelectedItemKey(projectId: string, unitTypeId: string) {
  return `${projectId}:${unitTypeId}`;
}

export default function SmartProjectFinderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FinderForm>(initialForm);
  const [finderData, setFinderData] = useState<SmartFinderDataSet | null>(null);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [areaSearch, setAreaSearch] = useState("");
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<SmartFinderResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFinancingAssumptions, setShowFinancingAssumptions] = useState(false);
  const [selectedComparisons, setSelectedComparisons] = useState<SelectedComparisonItem[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const areaPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setIsLoadingOptions(true);
      setOptionsError("");

      try {
        const response = await fetch("/api/tools/smart-project-finder/options");

        if (!response.ok) {
          throw new Error("Unable to load Smart Project Finder options");
        }

        const data = (await response.json()) as FinderOptionsResponse;

        if (!isMounted) return;

        setFinderData({
          projects: data.projects,
          unitTypes: data.unit_types,
          connectivity: data.connectivity,
        });
        setAreaOptions(data.metadata?.area_options ?? []);
      } catch {
        if (isMounted) {
          setOptionsError("Unable to load Smart Project Finder. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const resultCount = useMemo(() => countResults(result), [result]);
  const currentResultSelectionKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const projectResult of result?.projects ?? []) {
      for (const match of projectResult.matchingUnitTypes) {
        keys.add(getSelectedItemKey(projectResult.project.id, match.unitType.id));
      }
    }

    return keys;
  }, [result]);
  const filteredAreaOptions = useMemo(() => {
    const query = areaSearch.trim().toLowerCase();

    return areaOptions.filter((area) => {
      if (form.preferredAreas.includes(area)) return false;
      if (!query) return true;

      return area.toLowerCase().includes(query);
    });
  }, [areaOptions, areaSearch, form.preferredAreas]);
  const financingSummary = `${form.loanMarginPercent || "0"}% Loan - ${
    form.interestRatePercent || "0"
  }% - ${form.loanTenureYears || "0"} Years`;

  function updateForm<K extends keyof FinderForm>(key: K, value: FinderForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function getSelectionForProject(projectId: string) {
    return selectedComparisons.find((item) => item.projectId === projectId) ?? null;
  }

  function isSelectionOutsideCurrentSearch(selection: SelectedComparisonItem) {
    return (
      hasSearched &&
      !currentResultSelectionKeys.has(
        getSelectedItemKey(selection.projectId, selection.unitTypeId),
      )
    );
  }

  function selectComparisonUnit({
    projectId,
    unitTypeId,
    projectName,
    unitTypeLabel,
  }: SelectedComparisonItem) {
    setSelectionMessage("");
    const existingProjectSelection = selectedComparisons.find(
      (item) => item.projectId === projectId,
    );

    if (existingProjectSelection) {
      if (existingProjectSelection.unitTypeId === unitTypeId) return;

      setSelectionMessage(`${projectName} selection updated to ${unitTypeLabel}.`);
      setSelectedComparisons((current) =>
        current.map((item) =>
          item.projectId === projectId
            ? { projectId, unitTypeId, projectName, unitTypeLabel }
            : item,
        ),
      );

      return;
    }

    if (selectedComparisons.length >= 3) {
      setSelectionMessage("Maximum 3 projects can be compared.");

      return;
    }

    setSelectedComparisons((current) => [
      ...current,
      { projectId, unitTypeId, projectName, unitTypeLabel },
    ]);
  }

  function removeComparisonSelection(projectId: string) {
    setSelectionMessage("");
    setSelectedComparisons((current) =>
      current.filter((item) => item.projectId !== projectId),
    );
  }

  function handleCompareSelected() {
    if (selectedComparisons.length < 2) return;

    const loanMargin = parseOptionalNumber(form.loanMarginPercent);
    const interestRate = parseOptionalNumber(form.interestRatePercent);
    const loanTenure = parseOptionalNumber(form.loanTenureYears);

    if (
      loanMargin === null ||
      interestRate === null ||
      loanTenure === null ||
      !Number.isFinite(loanMargin) ||
      !Number.isFinite(interestRate) ||
      !Number.isFinite(loanTenure)
    ) {
      setSelectionMessage("Complete financing assumptions before comparing.");

      return;
    }

    const params = new URLSearchParams();

    selectedComparisons.slice(0, 3).forEach((selection, index) => {
      const slotNumber = index + 1;

      params.set(`project${slotNumber}`, selection.projectId);
      params.set(`unit${slotNumber}`, selection.unitTypeId);
    });
    params.set("loanMargin", String(loanMargin));
    params.set("interestRate", String(interestRate));
    params.set("loanTenure", String(loanTenure));

    router.push(`/tools/project-comparison?${params.toString()}`);
  }

  function selectArea(area: string) {
    setForm((current) => {
      if (current.preferredAreas.includes(area)) return current;

      return {
        ...current,
        preferredAreas: [...current.preferredAreas, area],
      };
    });
    setAreaSearch("");
    setIsAreaDropdownOpen(true);
  }

  function removeArea(area: string) {
    setForm((current) => ({
      ...current,
      preferredAreas: current.preferredAreas.filter((item) => item !== area),
    }));
  }

  function validateForm() {
    const maxBudget = parseOptionalNumber(form.maxBudget);
    const minimumBedrooms = parseOptionalInteger(form.minimumBedrooms);
    const completionByYear = parseOptionalInteger(form.completionByYear);
    const maxMonthlyInstalment = parseOptionalNumber(form.maxMonthlyInstalment);
    const loanMarginPercent = parseOptionalNumber(form.loanMarginPercent);
    const interestRatePercent = parseOptionalNumber(form.interestRatePercent);
    const loanTenureYears = parseOptionalNumber(form.loanTenureYears);

    if (maxBudget !== null && (!Number.isFinite(maxBudget) || maxBudget < 0)) {
      return "Max Budget must be a valid non-negative amount.";
    }
    if (
      minimumBedrooms !== null &&
      (!Number.isInteger(minimumBedrooms) || minimumBedrooms < 0)
    ) {
      return "Minimum Bedrooms must be a valid whole number.";
    }
    if (
      completionByYear !== null &&
      (!Number.isInteger(completionByYear) || completionByYear < 1900 || completionByYear > 9999)
    ) {
      return "Completion By must be a valid year.";
    }
    if (
      maxMonthlyInstalment !== null &&
      (!Number.isFinite(maxMonthlyInstalment) || maxMonthlyInstalment < 0)
    ) {
      return "Max Monthly Instalment must be a valid non-negative amount.";
    }
    if (
      loanMarginPercent === null ||
      !Number.isFinite(loanMarginPercent) ||
      loanMarginPercent < 0 ||
      loanMarginPercent > 100
    ) {
      return "Loan Margin must be between 0 and 100.";
    }
    if (
      interestRatePercent === null ||
      !Number.isFinite(interestRatePercent) ||
      interestRatePercent < 0
    ) {
      return "Interest Rate must be a valid non-negative percentage.";
    }
    if (
      loanTenureYears === null ||
      !Number.isFinite(loanTenureYears) ||
      loanTenureYears <= 0
    ) {
      return "Loan Tenure must be more than 0 years.";
    }

    return null;
  }

  function handleFindMatches() {
    if (!finderData) return;

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError("");
    setResult(
      findSmartProjectMatches({
        requirements: {
          maxFinalNetPrice: parseOptionalNumber(form.maxBudget),
          minimumBedrooms: parseOptionalInteger(form.minimumBedrooms),
          preferredAreas: form.preferredAreas,
          tenure: form.tenure,
          rail: form.rail,
          completionByYear: parseOptionalInteger(form.completionByYear),
          maxMonthlyInstalment: parseOptionalNumber(form.maxMonthlyInstalment),
          purpose: form.purpose,
        },
        financingAssumptions: {
          loanMarginPercent: parseOptionalNumber(form.loanMarginPercent) ?? 90,
          interestRatePercent: parseOptionalNumber(form.interestRatePercent) ?? 4,
          loanTenureYears: parseOptionalNumber(form.loanTenureYears) ?? 35,
        },
        data: finderData,
      }),
    );
    setHasSearched(true);
  }

  function handleReset() {
    setForm(initialForm);
    setFormError("");
    setResult(null);
    setHasSearched(false);
    setShowFinancingAssumptions(false);
    setSelectedComparisons([]);
    setSelectionMessage("");
  }

  function retryOptions() {
    setIsLoadingOptions(true);
    setOptionsError("");
    window.location.reload();
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Tools</p>
          <p className="text-base font-semibold text-zinc-900">Smart Project Finder</p>
        </div>
      </header>

      <main className={`p-6 lg:p-8 ${selectedComparisons.length ? "pb-64 lg:pb-40" : ""}`}>
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              SMART PROJECT FINDER
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              Find the Right Property
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Match your customer&apos;s requirements with available Project + Unit Type options.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Customer Requirements</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Enter the must-have details first, then add preferences if useful.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleFindMatches}
                disabled={isLoadingOptions || Boolean(optionsError) || !finderData}
                className="rounded-2xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Find Matching Projects
              </button>
            </div>
          </div>

          {formError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {formError}
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Must Have
            </p>
            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Max Budget</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.maxBudget}
                  onChange={(event) => updateForm("maxBudget", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                  placeholder="RM"
                />
                <span className="mt-1 block text-xs text-zinc-500">Final Net Price</span>
              </label>

              <div>
                <p className="text-sm font-medium text-zinc-700">Minimum Bedrooms</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {bedroomOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm("minimumBedrooms", option.value)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        form.minimumBedrooms === option.value
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Preferences
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-700">Preferred Area</p>
              {form.preferredAreas.length ? (
                <button
                  type="button"
                  onClick={() => updateForm("preferredAreas", [])}
                  className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                >
                  Any Area
                </button>
              ) : null}
            </div>
            {isLoadingOptions ? (
              <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Loading area options...
              </div>
            ) : !areaOptions.length ? (
              <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No area options available yet.
              </div>
            ) : (
              <div
                ref={areaPickerRef}
                className="mt-2"
                onBlur={(event) => {
                  if (!areaPickerRef.current?.contains(event.relatedTarget)) {
                    setIsAreaDropdownOpen(false);
                  }
                }}
              >
                <div className="rounded-2xl border border-zinc-200 px-3 py-2 focus-within:border-zinc-400">
                  {form.preferredAreas.length ? (
                    <div className="mb-2 flex max-h-20 flex-wrap gap-2 overflow-y-auto">
                      {form.preferredAreas.map((area) => (
                        <span
                          key={area}
                          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white"
                        >
                          {area}
                          <button
                            type="button"
                            onClick={() => removeArea(area)}
                            className="text-xs font-semibold text-zinc-300 transition hover:text-white"
                            aria-label={`Remove ${area}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <input
                    type="search"
                    value={areaSearch}
                    onFocus={() => setIsAreaDropdownOpen(true)}
                    onChange={(event) => {
                      setAreaSearch(event.target.value);
                      setIsAreaDropdownOpen(true);
                    }}
                    className="w-full border-0 px-1 py-1 text-sm outline-none"
                    placeholder={
                      form.preferredAreas.length
                        ? "Search another area..."
                        : "Any Area / Search area..."
                    }
                  />
                </div>
                {isAreaDropdownOpen ? (
                  <div className="relative z-10">
                    <div className="absolute mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                      {filteredAreaOptions.length ? (
                        filteredAreaOptions.map((area) => (
                          <button
                            key={area}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectArea(area)}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
                          >
                            {area}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-zinc-500">
                          No matching area options.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Tenure</span>
              <select
                value={form.tenure}
                onChange={(event) =>
                  updateForm("tenure", event.target.value as SmartFinderTenurePreference)
                }
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400"
              >
                <option value="no_preference">No Preference</option>
                <option value="freehold">Freehold</option>
                <option value="leasehold">Leasehold</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Rail Access</span>
              <select
                value={form.rail}
                onChange={(event) =>
                  updateForm("rail", event.target.value as SmartFinderRailPreference)
                }
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400"
              >
                <option value="no_preference">No Preference</option>
                <option value="walking">Walking</option>
                <option value="nearby">Nearby</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Completion By</span>
              <input
                type="number"
                min="1900"
                max="9999"
                step="1"
                value={form.completionByYear}
                onChange={(event) => updateForm("completionByYear", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                placeholder="No Preference"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Max Monthly Instalment</span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.maxMonthlyInstalment}
                onChange={(event) => updateForm("maxMonthlyInstalment", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                placeholder="RM"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Based on SPA Price and financing assumptions
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Customer Context
            </p>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-zinc-700">Purpose</span>
              <select
                value={form.purpose}
                onChange={(event) =>
                  updateForm("purpose", event.target.value as SmartFinderPurpose)
                }
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 md:max-w-xs"
              >
                <option value="own_stay">Own Stay</option>
                <option value="investment">Investment</option>
                <option value="both">Both</option>
              </select>
              <span className="mt-1 block text-xs text-zinc-500">Customer context only</span>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setShowFinancingAssumptions((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  Financing Assumptions
                </span>
                <span className="block text-xs text-zinc-500">{financingSummary}</span>
              </span>
              <span className="text-sm font-semibold text-zinc-500">
                {showFinancingAssumptions ? "Hide" : "Edit"}
              </span>
            </button>

            {showFinancingAssumptions ? (
              <div className="grid gap-4 border-t border-zinc-200 p-4 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Loan Margin %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.loanMarginPercent}
                    onChange={(event) => updateForm("loanMarginPercent", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Interest Rate %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interestRatePercent}
                    onChange={(event) => updateForm("interestRatePercent", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Loan Tenure (Years)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.loanTenureYears}
                    onChange={(event) => updateForm("loanTenureYears", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </section>

        {isLoadingOptions ? (
          <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            Loading Smart Project Finder...
          </section>
        ) : optionsError ? (
          <section className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-900">Unable to load Finder options</p>
            <p className="mt-1 text-sm text-red-700">
              Please refresh or try again in a moment.
            </p>
            <button
              type="button"
              onClick={retryOptions}
              className="mt-4 rounded-2xl bg-red-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </section>
        ) : !hasSearched ? (
          <section className="mt-6 rounded-[28px] border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              Enter your customer&apos;s requirements and select Find Matching Projects.
            </p>
          </section>
        ) : resultCount.unitTypes === 0 ? (
          <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-zinc-900">No matching Unit Types found.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Try adjusting the Max Budget or Minimum Bedrooms.
            </p>
          </section>
        ) : (
          <section className="mt-6 space-y-5">
            <div className="flex flex-col gap-2 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {resultCount.projects} Projects · {resultCount.unitTypes} Matching Unit Types
                </p>
              </div>
            </div>

            {result?.projects.map((projectResult) => {
              const projectMeta = [
                projectResult.project.location,
                projectResult.project.tenure,
                formatEstimatedCompletion(projectResult.project),
              ].filter(Boolean);

              return (
                <article
                  key={projectResult.project.id}
                  className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-zinc-900">
                        {projectResult.project.name}
                      </h2>
                      {projectMeta.length ? (
                        <p className="mt-1 text-sm text-zinc-500">
                          {projectMeta.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <p className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {projectResult.matchingUnitTypes.length} Matching Unit{" "}
                      {projectResult.matchingUnitTypes.length === 1 ? "Type" : "Types"}
                    </p>
                  </div>

                  <div className="divide-y divide-zinc-100">
                    {projectResult.matchingUnitTypes.map((match) => {
                      const budgetBadge = getBudgetBadge(match.hardFilters.budget.status);
                      const primaryFacts = getPrimaryUnitFacts(match.unitType);
                      const secondaryFacts = getSecondaryUnitFacts(match.unitType);
                      const unitTypeLabel = getUnitTypeLabel(match.unitType);
                      const projectSelection = getSelectionForProject(projectResult.project.id);
                      const isSelected = projectSelection?.unitTypeId === match.unitType.id;
                      const isReplacingSameProject =
                        Boolean(projectSelection) && !isSelected;
                      const isCompareDisabled =
                        !isSelected &&
                        !isReplacingSameProject &&
                        selectedComparisons.length >= 3;
                      const requirementRows = getRequirementRows({
                        budget: match.hardFilters.budget,
                        bedrooms: match.hardFilters.bedrooms,
                        maxBudget: parseOptionalNumber(form.maxBudget),
                        minimumBedrooms: parseOptionalInteger(form.minimumBedrooms),
                      });

                      return (
                        <div key={match.unitType.id} className="py-4">
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                            <div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold text-zinc-900">
                                    {unitTypeLabel}
                                  </h3>
                                  {primaryFacts.length ? (
                                    <p className="mt-1 text-sm font-medium text-zinc-600">
                                      {primaryFacts.join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectComparisonUnit({
                                        projectId: projectResult.project.id,
                                        unitTypeId: match.unitType.id,
                                        projectName: projectResult.project.name,
                                        unitTypeLabel,
                                      })
                                    }
                                    disabled={isSelected || isCompareDisabled}
                                    aria-label={
                                      isSelected
                                        ? `${projectResult.project.name} ${unitTypeLabel} selected for comparison`
                                        : `Select ${projectResult.project.name} ${unitTypeLabel} for comparison`
                                    }
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                      isSelected
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : isCompareDisabled
                                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
                                          : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                    }`}
                                  >
                                    {isSelected ? "✓ Selected" : "+ Compare"}
                                  </button>
                                  {isCompareDisabled ? (
                                    <p className="mt-1 max-w-36 text-right text-[11px] leading-4 text-zinc-500">
                                      Maximum 3 projects can be compared.
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Final Net Price
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                  <p className="text-2xl font-semibold text-zinc-900">
                                    {formatPriceRange(
                                      match.unitType.price_from,
                                      match.unitType.price_to,
                                    )}
                                  </p>
                                  {budgetBadge ? (
                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${budgetBadge.className}`}
                                    >
                                      {budgetBadge.label}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {secondaryFacts.length ? (
                                <p className="mt-3 text-sm text-zinc-500">
                                  {secondaryFacts.join(" · ")}
                                </p>
                              ) : null}

                              {match.preferenceSummary.active > 0 ? (
                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Preferences
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-zinc-900">
                                    {match.preferenceSummary.matched} of{" "}
                                    {match.preferenceSummary.active} matched
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              {requirementRows.length ? (
                                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Must Have
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {requirementRows.map((requirement) => (
                                      <div
                                        key={requirement.key}
                                        className={`rounded-xl border px-3 py-2 ${getRequirementClass(
                                          requirement.status,
                                        )}`}
                                      >
                                        <p className="text-sm font-semibold">
                                          {getRequirementMarker(requirement.status)}{" "}
                                          {requirement.title}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 opacity-80">
                                          {requirement.evidence}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {match.preferences.length ? (
                                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Preferences
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {match.preferences.map((preference) => (
                                      <div
                                        key={preference.key}
                                        className={`rounded-xl border px-3 py-2 ${getPreferenceClass(
                                          preference.status,
                                        )}`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-sm font-semibold">
                                              {getPreferenceMarker(preference.status)}{" "}
                                              {getPreferenceTitle(preference)}
                                            </p>
                                            {preference.evidence ? (
                                              <p className="mt-1 text-xs leading-5 opacity-80">
                                                {preference.evidence}
                                              </p>
                                            ) : null}
                                          </div>
                                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                                            {getPreferenceStatusLabel(preference.status)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {selectedComparisons.length ? (
          <section className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 rounded-[24px] border border-zinc-200 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur lg:left-[19rem] lg:right-6 lg:bottom-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Compare Projects
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">
                  {selectedComparisons.length} of 3 selected
                </p>
                {selectionMessage ? (
                  <p className="mt-1 text-xs text-zinc-500">{selectionMessage}</p>
                ) : selectedComparisons.length < 2 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Select at least 2 projects to compare.
                  </p>
                ) : null}
              </div>

              <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
                {selectedComparisons.map((selection) => {
                  const isOutsideCurrentSearch = isSelectionOutsideCurrentSearch(selection);

                  return (
                    <div
                      key={selection.projectId}
                      className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {selection.projectName}
                        </p>
                        <p className="truncate text-xs text-zinc-600">
                          {selection.unitTypeLabel}
                        </p>
                        {isOutsideCurrentSearch ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">
                            Outside Current Search
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComparisonSelection(selection.projectId)}
                        className="shrink-0 rounded-full px-2 text-lg leading-6 text-zinc-400 transition hover:bg-white hover:text-zinc-900"
                        aria-label={`Remove ${selection.projectName} ${selection.unitTypeLabel} from comparison`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleCompareSelected}
                disabled={selectedComparisons.length < 2}
                className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Compare Selected
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

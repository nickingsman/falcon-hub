"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  calculateProjectComparisonMetrics,
  type ComparisonAssumptions,
  type ComparisonRange,
  type ProjectComparisonMetrics,
} from "@/lib/project-comparison-engine";

type ProjectOption = {
  id: string;
  name: string;
  location: string | null;
};

type FurnishingPackage = {
  id: string;
  package_name: string;
  description: string | null;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number | null;
    description: string | null;
    sort_order: number | null;
  }>;
};

type UnitTypeOption = {
  id: string;
  type_code: string;
  type_name: string | null;
  bedrooms: number | null;
  additional_rooms: number;
  bathrooms: number | null;
  display_configuration: string | null;
  size_sqft: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
  price_from: number | null;
  price_to: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
  has_balcony: boolean | null;
  is_dual_key: boolean | null;
  furnishing_package: FurnishingPackage | null;
};

type CommercialPackageOption = {
  id: string;
  package_name: string;
  customer_description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  applicable_unit_type_ids: string[];
  furnishing_package: FurnishingPackage | null;
  items: Array<{
    id: string;
    item_type: string;
    description: string;
    discount_method: string | null;
    value: number | null;
    cash_benefit_treatment: string | null;
    receive_at: string | null;
    sort_order: number | null;
  }>;
  purchase_costs: Array<{
    id: string;
    cost_key: string;
    treatment: string;
    amount_override: number | null;
    sort_order: number | null;
  }>;
};

type ConnectivityPoint = {
  id: string;
  project_id: string;
  category: string;
  name: string;
  distance_meters: number | null;
  connection_mode: string | null;
  customer_description: string | null;
  sort_order: number | null;
};

type ProjectOptions = {
  project: {
    id: string;
    name: string;
    developer: string | null;
    location: string | null;
    property_type: string | null;
    tenure: string | null;
    title_type: string | null;
    total_units: number | null;
    estimated_vp_year: number | null;
    estimated_vp_quarter: number | null;
    maintenance_fee_per_sqft: number | null;
  };
  unit_types: UnitTypeOption[];
  connectivity: ConnectivityPoint[];
  commercial_packages: CommercialPackageOption[];
};

type ComparisonSlot = {
  id: string;
  projectId: string;
  unitTypeId: string;
  packageId: string;
  isLoadingOptions: boolean;
  error: string;
};

type ComparedOption = {
  slot: ComparisonSlot;
  project: ProjectOptions["project"];
  unitType: UnitTypeOption;
  commercialPackage: CommercialPackageOption | null;
  connectivity: ConnectivityPoint[];
  metrics: ProjectComparisonMetrics;
};

const initialSlots: ComparisonSlot[] = [
  { id: "slot-1", projectId: "", unitTypeId: "", packageId: "", isLoadingOptions: false, error: "" },
  { id: "slot-2", projectId: "", unitTypeId: "", packageId: "", isLoadingOptions: false, error: "" },
];

const currencyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseNumber(value: string) {
  if (!value.trim()) return Number.NaN;

  return Number(value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace("MYR", "RM");
}

function formatMoneyRange(range: ComparisonRange, suffix = "") {
  if (range.kind === "unavailable") return "—";
  if (range.kind === "single") return `${formatCurrency(range.value)}${suffix}`;

  return `${formatCurrency(range.from)} – ${formatCurrency(range.to)}${suffix}`;
}

function formatPercentRange(range: ComparisonRange) {
  if (range.kind === "unavailable") return "—";
  if (range.kind === "single") return `${percentageFormatter.format(range.value)}%`;

  return `${percentageFormatter.format(range.from)}% – ${percentageFormatter.format(range.to)}%`;
}

function getUnitTypeLabel(unitType: UnitTypeOption) {
  const details = [
    unitType.display_configuration,
    unitType.size_sqft ? `${unitType.size_sqft.toLocaleString("en-MY")} sqft` : null,
  ].filter(Boolean);
  const name = [unitType.type_code, unitType.type_name].filter(Boolean).join(" - ");

  return details.length ? `${name} · ${details.join(" · ")}` : name;
}

function formatEstimatedCompletion(project: ProjectOptions["project"]) {
  if (!project.estimated_vp_year || !project.estimated_vp_quarter) return "—";

  return `${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function getSelectedProjectIds(slots: ComparisonSlot[]) {
  return slots.map((slot) => slot.projectId).filter(Boolean);
}

function formatText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : "—";
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-MY")
    : "—";
}

function formatSize(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-MY")} sqft`
    : "—";
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return "—";
}

function formatCarParks(unitType: UnitTypeOption) {
  if (typeof unitType.default_carparks === "number" && Number.isFinite(unitType.default_carparks)) {
    return unitType.default_carparks.toLocaleString("en-MY");
  }

  return formatText(unitType.carpark_description);
}

function formatDistance(distanceMeters: number | null | undefined) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${distanceMeters.toLocaleString("en-MY")} m`;

  const kilometers = distanceMeters / 1000;

  return `${kilometers.toLocaleString("en-MY", {
    minimumFractionDigits: kilometers % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} km`;
}

function formatConnectionMode(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    walking: "Walking",
    direct_connected: "Direct Connected",
    sheltered_walking: "Sheltered Walking",
    shuttle: "Shuttle",
    driving: "Driving",
    nearby: "Nearby",
    other: "Other",
  };

  return mode ? labels[mode] ?? formatText(mode) : null;
}

function formatConnectivityMeta(point: ConnectivityPoint) {
  const parts = [
    formatDistance(point.distance_meters),
    formatConnectionMode(point.connection_mode),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "—";
}

function getConnectivityItemsForGroup(option: ComparedOption, categories: string[]) {
  return option.connectivity.filter((point) => categories.includes(point.category));
}

function renderConnectivityItems(items: ConnectivityPoint[]) {
  if (!items.length) return "—";

  return (
    <div className="space-y-4">
      {items.map((point) => (
        <div key={point.id}>
          <p className="font-semibold text-zinc-900">{point.name}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {formatConnectivityMeta(point)}
          </p>
          {point.customer_description ? (
            <p className="mt-2 text-xs font-normal leading-5 text-zinc-600">
              {point.customer_description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function getFurnishingSummary(
  unitType: UnitTypeOption,
  commercialPackage: CommercialPackageOption | null,
) {
  const furnishingPackage = commercialPackage?.furnishing_package ?? unitType.furnishing_package;

  if (!furnishingPackage) return "—";

  return (
    <div>
      <p>{furnishingPackage.package_name}</p>
      {furnishingPackage.items.length ? (
        <p className="mt-1 text-xs font-normal leading-5 text-zinc-500">
          {furnishingPackage.items
            .slice(0, 4)
            .map((item) =>
              item.quantity ? `${item.item_name} x ${item.quantity}` : item.item_name,
            )
            .join(", ")}
          {furnishingPackage.items.length > 4 ? "..." : ""}
        </p>
      ) : null}
    </div>
  );
}

const connectivityGroups = [
  {
    label: "Public Transport",
    categories: ["lrt", "mrt", "ktm", "monorail", "brt"],
  },
  {
    label: "Lifestyle & Convenience",
    categories: ["mall", "grocery", "park"],
  },
  {
    label: "Education & Healthcare",
    categories: ["school", "university", "hospital"],
  },
  {
    label: "Road & Employment",
    categories: ["highway", "business_district"],
  },
  {
    label: "Other",
    categories: ["other"],
  },
];

type ComparisonRow = {
  label: string;
  values: ReactNode[];
};

function ComparisonTable({
  title,
  description,
  comparedOptions,
  rows,
}: {
  title: string;
  description: string;
  comparedOptions: ComparedOption[];
  rows: ComparisonRow[];
}) {
  return (
    <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 border-b border-zinc-200 bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Detail
              </th>
              {comparedOptions.map((option) => (
                <th
                  key={`${title}-${option.slot.id}`}
                  className="border-b border-zinc-200 px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-900">
                    {option.project.name}
                  </p>
                  <p className="mt-1 text-xs font-medium normal-case tracking-normal text-zinc-500">
                    {formatText(option.project.location)}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="sticky left-0 border-b border-zinc-200 bg-white py-4 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className="border-b border-zinc-200 px-4 py-4 font-medium text-zinc-900"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ProjectComparisonPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectOptionsById, setProjectOptionsById] = useState<Record<string, ProjectOptions>>({});
  const [slots, setSlots] = useState<ComparisonSlot[]>(initialSlots);
  const [loanMarginPercent, setLoanMarginPercent] = useState("90");
  const [annualInterestRatePercent, setAnnualInterestRatePercent] = useState("4.0");
  const [loanTenureYears, setLoanTenureYears] = useState("35");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectListError, setProjectListError] = useState("");
  const [hasCompared, setHasCompared] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        const response = await fetch("/api/tools/project-comparison/projects");

        if (!response.ok) {
          throw new Error("Unable to load Projects");
        }

        const data = (await response.json()) as ProjectOption[];

        if (isMounted) {
          setProjects(data);
        }
      } catch (error) {
        if (isMounted) {
          setProjectListError(error instanceof Error ? error.message : "Unable to load Projects");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const assumptions: ComparisonAssumptions = useMemo(
    () => ({
      loanMarginPercent: parseNumber(loanMarginPercent),
      annualInterestRatePercent: parseNumber(annualInterestRatePercent),
      loanTenureYears: parseNumber(loanTenureYears),
    }),
    [annualInterestRatePercent, loanMarginPercent, loanTenureYears],
  );

  const assumptionsValid =
    Number.isFinite(assumptions.loanMarginPercent) &&
    assumptions.loanMarginPercent > 0 &&
    assumptions.loanMarginPercent <= 100 &&
    Number.isFinite(assumptions.annualInterestRatePercent) &&
    assumptions.annualInterestRatePercent >= 0 &&
    Number.isFinite(assumptions.loanTenureYears) &&
    assumptions.loanTenureYears > 0;
  const selectedSlots = useMemo(() => slots.filter((slot) => slot.projectId), [slots]);
  const canCompare =
    selectedSlots.length >= 2 &&
    selectedSlots.every((slot) => slot.unitTypeId && !slot.isLoadingOptions && !slot.error) &&
    assumptionsValid;
  const comparedOptions = useMemo<ComparedOption[]>(() => {
    if (!hasCompared || !canCompare) return [];

    return selectedSlots
      .map((slot) => {
        const options = projectOptionsById[slot.projectId];
        const unitType = options?.unit_types.find((item) => item.id === slot.unitTypeId);

        if (!options || !unitType) return null;

        return {
          slot,
          project: options.project,
          unitType,
          commercialPackage:
            options.commercial_packages.find((item) => item.id === slot.packageId) ?? null,
          connectivity: options.connectivity ?? [],
          metrics: calculateProjectComparisonMetrics(
            {
              price_from: unitType.price_from,
              price_to: unitType.price_to,
              size_sqft: unitType.size_sqft,
              maintenance_fee_per_sqft: options.project.maintenance_fee_per_sqft,
              estimated_rental_from: unitType.estimated_rental_from,
              estimated_rental_to: unitType.estimated_rental_to,
            },
            assumptions,
          ),
        };
      })
      .filter((item): item is ComparedOption => Boolean(item));
  }, [assumptions, canCompare, hasCompared, projectOptionsById, selectedSlots]);

  async function loadProjectOptions(slotId: string, projectId: string) {
    if (projectOptionsById[projectId]) return;

    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, isLoadingOptions: true, error: "" } : slot,
      ),
    );

    try {
      const response = await fetch(`/api/tools/project-comparison/projects/${projectId}/options`);

      if (!response.ok) {
        throw new Error("Unable to load Project options");
      }

      const data = (await response.json()) as ProjectOptions;
      setProjectOptionsById((current) => ({ ...current, [projectId]: data }));
    } catch (error) {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                error: error instanceof Error ? error.message : "Unable to load Project options",
              }
            : slot,
        ),
      );
    } finally {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === slotId ? { ...slot, isLoadingOptions: false } : slot,
        ),
      );
    }
  }

  function updateSlot(slotId: string, updates: Partial<ComparisonSlot>) {
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot)),
    );
    setHasCompared(false);
  }

  function handleProjectChange(slotId: string, projectId: string) {
    updateSlot(slotId, {
      projectId,
      unitTypeId: "",
      packageId: "",
      error: "",
    });

    if (projectId) {
      void loadProjectOptions(slotId, projectId);
    }
  }

  function handleUnitTypeChange(slotId: string, unitTypeId: string) {
    updateSlot(slotId, {
      unitTypeId,
      packageId: "",
    });
  }

  function addSlot() {
    if (slots.length >= 3) return;

    setSlots((current) => [
      ...current,
      {
        id: `slot-${current.length + 1}`,
        projectId: "",
        unitTypeId: "",
        packageId: "",
        isLoadingOptions: false,
        error: "",
      },
    ]);
    setHasCompared(false);
  }

  function removeSlot(slotId: string) {
    if (slots.length <= 2) return;

    setSlots((current) => current.filter((slot) => slot.id !== slotId));
    setHasCompared(false);
  }

  function getAvailableProjects(slotId: string) {
    const selectedProjectIds = getSelectedProjectIds(slots);

    return projects.filter(
      (project) =>
        !selectedProjectIds.includes(project.id) ||
        slots.find((slot) => slot.id === slotId)?.projectId === project.id,
    );
  }

  function getApplicablePackages(projectOptions: ProjectOptions | undefined, unitTypeId: string) {
    if (!projectOptions || !unitTypeId) return [];

    return projectOptions.commercial_packages.filter((item) =>
      item.applicable_unit_type_ids.includes(unitTypeId),
    );
  }

  function handleCompare() {
    if (!canCompare) return;

    setHasCompared(true);
  }

  const activeConnectivityGroups = hasCompared
    ? connectivityGroups.filter((group) =>
        comparedOptions.some(
          (option) => getConnectivityItemsForGroup(option, group.categories).length > 0,
        ),
      )
    : [];

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Tools - Project Comparison</p>
          <p className="text-base font-semibold text-zinc-900">Compare trusted project facts</p>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Express Comparison
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Project Comparison
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
                Compare 2 to 3 projects using final net selling price, Unit Type facts,
                rental estimates, and shared financing assumptions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Compare Projects
            </button>
          </div>
        </section>

        {projectListError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {projectListError}
          </div>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Shared Loan Assumptions</p>
              <p className="text-sm text-zinc-500">Applied equally to every selected project.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Loan Margin %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={loanMarginPercent}
                onChange={(event) => {
                  setLoanMarginPercent(event.target.value);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Interest Rate %</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={annualInterestRatePercent}
                onChange={(event) => {
                  setAnnualInterestRatePercent(event.target.value);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Loan Tenure Years</span>
              <input
                type="number"
                min="1"
                step="1"
                value={loanTenureYears}
                onChange={(event) => {
                  setLoanTenureYears(event.target.value);
                  setHasCompared(false);
                }}
                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              />
            </label>
          </div>

          {!assumptionsValid ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Loan margin must be more than 0 and up to 100. Interest cannot be negative.
              Tenure must be more than 0.
            </p>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          {slots.map((slot, index) => {
            const projectOptions = projectOptionsById[slot.projectId];
            const applicablePackages = getApplicablePackages(projectOptions, slot.unitTypeId);

            return (
              <article key={slot.id} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Project {index + 1}</p>
                    <p className="text-sm text-zinc-500">Choose project, unit and package.</p>
                  </div>
                  {slots.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Project</span>
                    <select
                      value={slot.projectId}
                      disabled={isLoadingProjects}
                      onChange={(event) => handleProjectChange(slot.id, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400"
                    >
                      <option value="">{isLoadingProjects ? "Loading Projects..." : "Select Project"}</option>
                      {getAvailableProjects(slot.id).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.location ? `${project.name} - ${project.location}` : project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.error ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {slot.error}
                    </p>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Unit Type</span>
                    <select
                      value={slot.unitTypeId}
                      disabled={!slot.projectId || slot.isLoadingOptions || !projectOptions}
                      onChange={(event) => handleUnitTypeChange(slot.id, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                    >
                      <option value="">
                        {slot.isLoadingOptions
                          ? "Loading Unit Types..."
                          : !slot.projectId
                            ? "Select Project first"
                            : "Select Unit Type"}
                      </option>
                      {projectOptions?.unit_types.map((unitType) => (
                        <option key={unitType.id} value={unitType.id}>
                          {getUnitTypeLabel(unitType)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.projectId && projectOptions && projectOptions.unit_types.length === 0 ? (
                    <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      No Unit Types available for this Project.
                    </p>
                  ) : null}

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">Commercial Package</span>
                    <select
                      value={slot.packageId}
                      disabled={!slot.unitTypeId}
                      onChange={(event) => updateSlot(slot.id, { packageId: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                    >
                      <option value="">No Package</option>
                      {applicablePackages.map((commercialPackage) => (
                        <option key={commercialPackage.id} value={commercialPackage.id}>
                          {commercialPackage.package_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {slot.unitTypeId && applicablePackages.length === 0 ? (
                    <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      No applicable Commercial Packages. No Package is allowed.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}

          {slots.length < 3 ? (
            <button
              type="button"
              onClick={addSlot}
              className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-white/70 p-5 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:bg-white"
            >
              + Add Project
            </button>
          ) : null}
        </section>

        {hasCompared && comparedOptions.length > 0 ? (
          <>
            <ComparisonTable
              title="Quick Comparison"
              description="Factual comparison using final net Unit Type prices. Package discounts are not deducted again."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Project",
                  values: comparedOptions.map((option) => option.project.name),
                },
                {
                  label: "Unit Type",
                  values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
                },
                {
                  label: "Final Net Price",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.finalNetPrice)),
                },
                {
                  label: "Size",
                  values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
                },
                {
                  label: "Tenure",
                  values: comparedOptions.map((option) => formatText(option.project.tenure)),
                },
                {
                  label: "Est. Monthly Instalment",
                  values: comparedOptions.map((option) =>
                    formatMoneyRange(option.metrics.estimatedMonthlyInstalment, " / month"),
                  ),
                },
                {
                  label: "Est. Rental",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.estimatedRental)),
                },
                {
                  label: "Est. Gross Yield",
                  values: comparedOptions.map((option) =>
                    formatPercentRange(option.metrics.estimatedGrossRentalYieldPercent),
                  ),
                },
                {
                  label: "Estimated Completion",
                  values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
                },
                {
                  label: "Commercial Package",
                  values: comparedOptions.map((option) =>
                    option.commercialPackage?.package_name ?? "No Package",
                  ),
                },
              ]}
            />

            <ComparisonTable
              title="Project Overview"
              description="High-level project facts from the customer-safe comparison data."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Developer",
                  values: comparedOptions.map((option) => formatText(option.project.developer)),
                },
                {
                  label: "Location",
                  values: comparedOptions.map((option) => formatText(option.project.location)),
                },
                {
                  label: "Tenure",
                  values: comparedOptions.map((option) => formatText(option.project.tenure)),
                },
                {
                  label: "Property Type",
                  values: comparedOptions.map((option) => formatText(option.project.property_type)),
                },
                {
                  label: "Title Type",
                  values: comparedOptions.map((option) => formatText(option.project.title_type)),
                },
                {
                  label: "Total Units",
                  values: comparedOptions.map((option) => formatNumber(option.project.total_units)),
                },
                {
                  label: "Estimated Completion",
                  values: comparedOptions.map((option) => formatEstimatedCompletion(option.project)),
                },
              ]}
            />

            <ComparisonTable
              title="Unit Comparison"
              description="Selected Unit Type facts and calculated metrics using the shared assumptions above."
              comparedOptions={comparedOptions}
              rows={[
                {
                  label: "Unit Type",
                  values: comparedOptions.map((option) => getUnitTypeLabel(option.unitType)),
                },
                {
                  label: "Final Net Price",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.finalNetPrice)),
                },
                {
                  label: "Size",
                  values: comparedOptions.map((option) => formatSize(option.unitType.size_sqft)),
                },
                {
                  label: "Bedrooms",
                  values: comparedOptions.map((option) => formatNumber(option.unitType.bedrooms)),
                },
                {
                  label: "Bathrooms",
                  values: comparedOptions.map((option) => formatNumber(option.unitType.bathrooms)),
                },
                {
                  label: "Car Parks",
                  values: comparedOptions.map((option) => formatCarParks(option.unitType)),
                },
                {
                  label: "PSF",
                  values: comparedOptions.map((option) => formatMoneyRange(option.metrics.psf, " psf")),
                },
                {
                  label: "Balcony",
                  values: comparedOptions.map((option) => formatBoolean(option.unitType.has_balcony)),
                },
                {
                  label: "Dual Key",
                  values: comparedOptions.map((option) => formatBoolean(option.unitType.is_dual_key)),
                },
                {
                  label: "Furnishing",
                  values: comparedOptions.map((option) =>
                    getFurnishingSummary(option.unitType, option.commercialPackage),
                  ),
                },
              ]}
            />

            {activeConnectivityGroups.length ? (
              <ComparisonTable
                title="Connectivity & Convenience"
                description="Customer-facing connectivity facts grouped by category."
                comparedOptions={comparedOptions}
                rows={activeConnectivityGroups.map((group) => ({
                  label: group.label,
                  values: comparedOptions.map((option) =>
                    renderConnectivityItems(
                      getConnectivityItemsForGroup(option, group.categories),
                    ),
                  ),
                }))}
              />
            ) : (
              <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Connectivity & Convenience</p>
                  <p className="text-sm text-zinc-500">
                    Customer-facing connectivity facts grouped by category.
                  </p>
                </div>
                <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  No connectivity information added yet.
                </p>
              </section>
            )}
          </>
        ) : null}
      </main>
    </>
  );
}

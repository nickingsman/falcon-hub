import { calculateMonthlyInstalment } from "@/lib/property-finance";

export type SmartFinderPurpose = "own_stay" | "investment" | "both";
export type SmartFinderTenurePreference = "freehold" | "leasehold" | "no_preference";
export type SmartFinderRailPreference = "walking" | "nearby" | "no_preference";
export type SmartFinderPreferenceKey =
  | "area"
  | "tenure"
  | "rail"
  | "completion"
  | "instalment";
export type SmartFinderPreferenceStatus =
  | "matched"
  | "partial"
  | "not_matched"
  | "unavailable";
export type SmartFinderBudgetStatus =
  | "not_applied"
  | "within_budget"
  | "partially_within_budget"
  | "excluded"
  | "unavailable";
export type SmartFinderBedroomStatus =
  | "not_applied"
  | "matched"
  | "excluded"
  | "unavailable";

export type SmartFinderRequirements = {
  maxFinalNetPrice?: number | null;
  minimumBedrooms?: number | null;
  purpose?: SmartFinderPurpose | null;
  preferredAreas?: string[];
  tenure?: SmartFinderTenurePreference;
  rail?: SmartFinderRailPreference;
  completionByYear?: number | null;
  maxMonthlyInstalment?: number | null;
};

export type SmartFinderFinancingAssumptions = {
  loanMarginPercent: number;
  interestRatePercent: number;
  loanTenureYears: number;
};

export type SmartFinderProjectFact = {
  id: string;
  name: string;
  location: string | null;
  tenure: string | null;
  property_type: string | null;
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
};

export type SmartFinderUnitTypeFact = {
  id: string;
  project_id: string;
  type_code: string;
  type_name: string | null;
  display_configuration: string | null;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
  spa_price_from: number | null;
  spa_price_to: number | null;
  price_from: number | null;
  price_to: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
  has_balcony: boolean | null;
  is_dual_key: boolean | null;
  sort_order: number | null;
};

export type SmartFinderConnectivityFact = {
  project_id: string;
  category: string;
  name: string;
  distance_meters: number | null;
  connection_mode: string | null;
};

export type SmartFinderDataSet = {
  projects: SmartFinderProjectFact[];
  unitTypes: SmartFinderUnitTypeFact[];
  connectivity: SmartFinderConnectivityFact[];
};

export type SmartFinderBudgetFilterResult = {
  active: boolean;
  status: SmartFinderBudgetStatus;
  passes: boolean;
  evidence: string;
};

export type SmartFinderBedroomFilterResult = {
  active: boolean;
  status: SmartFinderBedroomStatus;
  passes: boolean;
  evidence: string;
};

export type SmartFinderPreferenceResult = {
  key: SmartFinderPreferenceKey;
  status: SmartFinderPreferenceStatus;
  label: string;
  evidence?: string;
};

export type SmartFinderPreferenceSummary = {
  active: number;
  matched: number;
  partial: number;
  notMatched: number;
  unavailable: number;
};

export type SmartFinderFinancingResult = {
  monthlyInstalmentFrom: number | null;
  monthlyInstalmentTo: number | null;
  evidence: string;
};

export type SmartFinderUnitTypeMatch = {
  unitType: SmartFinderUnitTypeFact;
  hardFilters: {
    budget: SmartFinderBudgetFilterResult;
    bedrooms: SmartFinderBedroomFilterResult;
  };
  preferences: SmartFinderPreferenceResult[];
  preferenceSummary: SmartFinderPreferenceSummary;
  financing: SmartFinderFinancingResult;
};

export type SmartFinderProjectResult = {
  project: SmartFinderProjectFact;
  matchingUnitTypes: SmartFinderUnitTypeMatch[];
};

export type SmartFinderResult = {
  projects: SmartFinderProjectResult[];
};

const railCategories = new Set(["lrt", "mrt", "ktm", "monorail", "brt"]);
const walkingRailModes = new Set(["walking", "sheltered_walking", "direct_connected"]);

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: number | null | undefined): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function formatCurrency(value: number) {
  return `RM${value.toLocaleString("en-MY", {
    maximumFractionDigits: 0,
  })}`;
}

function formatCurrencyRange(from: number | null, to: number | null) {
  if (!isNonNegativeNumber(from)) return "Price unavailable";
  if (!isNonNegativeNumber(to) || to === from) return formatCurrency(from);

  return `${formatCurrency(from)} - ${formatCurrency(to)}`;
}

function formatMonthlyInstalmentRange(from: number | null, to: number | null) {
  if (!isFiniteNumber(from)) return "Monthly instalment unavailable";
  if (!isFiniteNumber(to) || to === from) return `${formatCurrency(from)} / month`;

  return `${formatCurrency(from)} - ${formatCurrency(to)} / month`;
}

function formatDistance(distanceMeters: number | null) {
  if (!isFiniteNumber(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${distanceMeters.toLocaleString("en-MY")} m`;

  const kilometers = distanceMeters / 1000;

  return `${kilometers.toLocaleString("en-MY", {
    minimumFractionDigits: kilometers % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} km`;
}

function formatConnectionMode(mode: string | null) {
  const labels: Record<string, string> = {
    walking: "Walking",
    direct_connected: "Direct Connected",
    sheltered_walking: "Sheltered Walking",
    shuttle: "Shuttle",
    driving: "Driving",
    nearby: "Nearby",
    other: "Other",
  };

  return mode ? labels[mode] ?? mode : null;
}

function formatRailEvidence(point: SmartFinderConnectivityFact) {
  return [
    point.name,
    formatDistance(point.distance_meters),
    formatConnectionMode(point.connection_mode),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatEstimatedCompletion(project: SmartFinderProjectFact) {
  if (!project.estimated_vp_year) return "Estimated completion unavailable";
  if (!project.estimated_vp_quarter) return `Estimated ${project.estimated_vp_year}`;

  return `Estimated ${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function normalizeTenure(value: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return null;
  if (normalized.includes("freehold")) return "freehold";
  if (normalized.includes("leasehold")) return "leasehold";

  return null;
}

function normalizeAreaSelections(areas: string[] | undefined) {
  return new Set((areas ?? []).map((area) => area.trim()).filter(Boolean));
}

function areFinancingAssumptionsValid(assumptions: SmartFinderFinancingAssumptions) {
  return (
    Number.isFinite(assumptions.loanMarginPercent) &&
    assumptions.loanMarginPercent >= 0 &&
    assumptions.loanMarginPercent <= 100 &&
    Number.isFinite(assumptions.interestRatePercent) &&
    assumptions.interestRatePercent >= 0 &&
    Number.isFinite(assumptions.loanTenureYears) &&
    assumptions.loanTenureYears > 0
  );
}

function calculateMonthlyInstalmentFact(
  unitType: SmartFinderUnitTypeFact,
  assumptions: SmartFinderFinancingAssumptions,
): SmartFinderFinancingResult {
  if (!areFinancingAssumptionsValid(assumptions)) {
    return {
      monthlyInstalmentFrom: null,
      monthlyInstalmentTo: null,
      evidence: "Monthly instalment unavailable because financing assumptions are incomplete",
    };
  }

  if (!isNonNegativeNumber(unitType.spa_price_from)) {
    return {
      monthlyInstalmentFrom: null,
      monthlyInstalmentTo: null,
      evidence: "Monthly instalment unavailable because SPA Price is unavailable",
    };
  }

  const loanFrom = unitType.spa_price_from * (assumptions.loanMarginPercent / 100);
  const instalmentFrom = calculateMonthlyInstalment(
    loanFrom,
    assumptions.interestRatePercent,
    assumptions.loanTenureYears,
  );

  if (!isFiniteNumber(instalmentFrom)) {
    return {
      monthlyInstalmentFrom: null,
      monthlyInstalmentTo: null,
      evidence: "Monthly instalment unavailable",
    };
  }

  if (!isNonNegativeNumber(unitType.spa_price_to) || unitType.spa_price_to === unitType.spa_price_from) {
    return {
      monthlyInstalmentFrom: instalmentFrom,
      monthlyInstalmentTo: null,
      evidence: formatMonthlyInstalmentRange(instalmentFrom, null),
    };
  }

  const loanTo = unitType.spa_price_to * (assumptions.loanMarginPercent / 100);
  const instalmentTo = calculateMonthlyInstalment(
    loanTo,
    assumptions.interestRatePercent,
    assumptions.loanTenureYears,
  );

  if (!isFiniteNumber(instalmentTo)) {
    return {
      monthlyInstalmentFrom: null,
      monthlyInstalmentTo: null,
      evidence: "Monthly instalment unavailable",
    };
  }

  return {
    monthlyInstalmentFrom: Math.min(instalmentFrom, instalmentTo),
    monthlyInstalmentTo: Math.max(instalmentFrom, instalmentTo),
    evidence: formatMonthlyInstalmentRange(
      Math.min(instalmentFrom, instalmentTo),
      Math.max(instalmentFrom, instalmentTo),
    ),
  };
}

function evaluateBudgetFilter(
  unitType: SmartFinderUnitTypeFact,
  maxBudget: number | null | undefined,
): SmartFinderBudgetFilterResult {
  if (!isNonNegativeNumber(maxBudget)) {
    return {
      active: false,
      status: "not_applied",
      passes: true,
      evidence: "No Final Net Price budget filter applied",
    };
  }

  if (!isNonNegativeNumber(unitType.price_from)) {
    return {
      active: true,
      status: "unavailable",
      passes: false,
      evidence: `Final Net Price unavailable; cannot prove within ${formatCurrency(maxBudget)} budget`,
    };
  }

  const priceLabel = formatCurrencyRange(unitType.price_from, unitType.price_to);

  if (!isNonNegativeNumber(unitType.price_to)) {
    return {
      active: true,
      status: "within_budget",
      passes: true,
      evidence: `${priceLabel} · within ${formatCurrency(maxBudget)} budget`,
    };
  }

  if (unitType.price_to <= maxBudget) {
    return {
      active: true,
      status: "within_budget",
      passes: true,
      evidence: `${priceLabel} · within ${formatCurrency(maxBudget)} budget`,
    };
  }

  if (unitType.price_from <= maxBudget) {
    return {
      active: true,
      status: "partially_within_budget",
      passes: true,
      evidence: `${priceLabel} · partially within ${formatCurrency(maxBudget)} budget`,
    };
  }

  return {
    active: true,
    status: "excluded",
    passes: false,
    evidence: `${priceLabel} · above ${formatCurrency(maxBudget)} budget`,
  };
}

function evaluateBedroomFilter(
  unitType: SmartFinderUnitTypeFact,
  minimumBedrooms: number | null | undefined,
): SmartFinderBedroomFilterResult {
  const minimum =
    typeof minimumBedrooms === "number" && Number.isInteger(minimumBedrooms)
      ? minimumBedrooms
      : null;

  if (minimum === null || minimum < 0) {
    return {
      active: false,
      status: "not_applied",
      passes: true,
      evidence: "No bedroom filter applied",
    };
  }

  if (!Number.isInteger(unitType.bedrooms)) {
    return {
      active: true,
      status: "unavailable",
      passes: false,
      evidence: `Bedrooms unavailable; cannot prove at least ${minimum} bedroom(s)`,
    };
  }

  const bedrooms =
    typeof unitType.bedrooms === "number" && Number.isInteger(unitType.bedrooms)
      ? unitType.bedrooms
      : null;

  if (bedrooms === null) {
    return {
      active: true,
      status: "unavailable",
      passes: false,
      evidence: `Bedrooms unavailable; cannot prove at least ${minimum} bedroom(s)`,
    };
  }

  if (bedrooms >= minimum) {
    return {
      active: true,
      status: "matched",
      passes: true,
      evidence: `${bedrooms} bedroom(s) · meets minimum ${minimum}`,
    };
  }

  return {
    active: true,
    status: "excluded",
    passes: false,
    evidence: `${bedrooms} bedroom(s) · below minimum ${minimum}`,
  };
}

function evaluateAreaPreference(
  project: SmartFinderProjectFact,
  preferredAreas: string[] | undefined,
): SmartFinderPreferenceResult | null {
  const areas = normalizeAreaSelections(preferredAreas);

  if (areas.size === 0) return null;

  if (!project.location?.trim()) {
    return {
      key: "area",
      status: "unavailable",
      label: "Preferred Area",
      evidence: "Project location unavailable",
    };
  }

  return {
    key: "area",
    status: areas.has(project.location.trim()) ? "matched" : "not_matched",
    label: "Preferred Area",
    evidence: project.location,
  };
}

function evaluateTenurePreference(
  project: SmartFinderProjectFact,
  preference: SmartFinderTenurePreference | undefined,
): SmartFinderPreferenceResult | null {
  if (!preference || preference === "no_preference") return null;

  const tenure = normalizeTenure(project.tenure);

  if (!tenure) {
    return {
      key: "tenure",
      status: "unavailable",
      label: "Tenure",
      evidence: "Tenure unavailable or not recognized",
    };
  }

  return {
    key: "tenure",
    status: tenure === preference ? "matched" : "not_matched",
    label: "Tenure",
    evidence: project.tenure ?? undefined,
  };
}

function evaluateRailPreference(
  projectConnectivity: SmartFinderConnectivityFact[],
  preference: SmartFinderRailPreference | undefined,
): SmartFinderPreferenceResult | null {
  if (!preference || preference === "no_preference") return null;

  const railPoints = projectConnectivity.filter((point) => railCategories.has(point.category));

  if (railPoints.length === 0) {
    return {
      key: "rail",
      status: "unavailable",
      label: "Rail Preference",
      evidence: "No structured rail connectivity has been added",
    };
  }

  const matchingPoint = railPoints.find((point) => {
    if (preference === "walking") {
      return point.connection_mode !== null && walkingRailModes.has(point.connection_mode);
    }

    return point.connection_mode === "nearby";
  });

  if (matchingPoint) {
    return {
      key: "rail",
      status: "matched",
      label: "Rail Preference",
      evidence: formatRailEvidence(matchingPoint),
    };
  }

  return {
    key: "rail",
    status: "not_matched",
    label: "Rail Preference",
    evidence:
      preference === "walking"
        ? "Rail information exists, but no walking/direct/sheltered rail access is recorded"
        : "Rail information exists, but no explicit nearby rail access is recorded",
  };
}

function evaluateCompletionPreference(
  project: SmartFinderProjectFact,
  completionByYear: number | null | undefined,
): SmartFinderPreferenceResult | null {
  const preferredYear =
    typeof completionByYear === "number" && Number.isInteger(completionByYear)
      ? completionByYear
      : null;

  if (preferredYear === null) return null;

  if (!Number.isInteger(project.estimated_vp_year)) {
    return {
      key: "completion",
      status: "unavailable",
      label: "Completion",
      evidence: "Estimated completion unavailable",
    };
  }

  const estimatedYear =
    typeof project.estimated_vp_year === "number" &&
    Number.isInteger(project.estimated_vp_year)
      ? project.estimated_vp_year
      : null;

  if (estimatedYear === null) {
    return {
      key: "completion",
      status: "unavailable",
      label: "Completion",
      evidence: "Estimated completion unavailable",
    };
  }

  return {
    key: "completion",
    status: estimatedYear <= preferredYear ? "matched" : "not_matched",
    label: "Completion",
    evidence: formatEstimatedCompletion(project),
  };
}

function evaluateInstalmentPreference(
  financing: SmartFinderFinancingResult,
  maxMonthlyInstalment: number | null | undefined,
): SmartFinderPreferenceResult | null {
  if (!isNonNegativeNumber(maxMonthlyInstalment)) return null;

  if (!isFiniteNumber(financing.monthlyInstalmentFrom)) {
    return {
      key: "instalment",
      status: "unavailable",
      label: "Monthly Instalment",
      evidence: financing.evidence,
    };
  }

  const high = isFiniteNumber(financing.monthlyInstalmentTo)
    ? financing.monthlyInstalmentTo
    : financing.monthlyInstalmentFrom;
  let status: SmartFinderPreferenceStatus = "not_matched";

  if (high <= maxMonthlyInstalment) {
    status = "matched";
  } else if (financing.monthlyInstalmentFrom <= maxMonthlyInstalment) {
    status = "partial";
  }

  return {
    key: "instalment",
    status,
    label: "Monthly Instalment",
    evidence: `${financing.evidence} · budget ${formatCurrency(maxMonthlyInstalment)} / month`,
  };
}

function summarizePreferences(
  preferences: SmartFinderPreferenceResult[],
): SmartFinderPreferenceSummary {
  return preferences.reduce(
    (summary, preference) => ({
      active: summary.active + 1,
      matched: summary.matched + (preference.status === "matched" ? 1 : 0),
      partial: summary.partial + (preference.status === "partial" ? 1 : 0),
      notMatched: summary.notMatched + (preference.status === "not_matched" ? 1 : 0),
      unavailable: summary.unavailable + (preference.status === "unavailable" ? 1 : 0),
    }),
    {
      active: 0,
      matched: 0,
      partial: 0,
      notMatched: 0,
      unavailable: 0,
    },
  );
}

function compareUnitMatches(
  leftProject: SmartFinderProjectFact,
  left: SmartFinderUnitTypeMatch,
  rightProject: SmartFinderProjectFact,
  right: SmartFinderUnitTypeMatch,
) {
  const matchedDelta = right.preferenceSummary.matched - left.preferenceSummary.matched;
  if (matchedDelta !== 0) return matchedDelta;

  const notMatchedDelta = left.preferenceSummary.notMatched - right.preferenceSummary.notMatched;
  if (notMatchedDelta !== 0) return notMatchedDelta;

  const partialDelta = right.preferenceSummary.partial - left.preferenceSummary.partial;
  if (partialDelta !== 0) return partialDelta;

  const projectNameDelta = leftProject.name.localeCompare(rightProject.name);
  if (projectNameDelta !== 0) return projectNameDelta;

  const leftSort = left.unitType.sort_order ?? Number.MAX_SAFE_INTEGER;
  const rightSort = right.unitType.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (leftSort !== rightSort) return leftSort - rightSort;

  return left.unitType.type_code.localeCompare(right.unitType.type_code);
}

export function findSmartProjectMatches({
  requirements,
  financingAssumptions,
  data,
}: {
  requirements: SmartFinderRequirements;
  financingAssumptions: SmartFinderFinancingAssumptions;
  data: SmartFinderDataSet;
}): SmartFinderResult {
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const connectivityByProjectId = new Map<string, SmartFinderConnectivityFact[]>();
  const flatMatches: Array<{
    project: SmartFinderProjectFact;
    match: SmartFinderUnitTypeMatch;
  }> = [];

  for (const point of data.connectivity) {
    const points = connectivityByProjectId.get(point.project_id) ?? [];
    points.push(point);
    connectivityByProjectId.set(point.project_id, points);
  }

  for (const unitType of data.unitTypes) {
    const project = projectById.get(unitType.project_id);

    if (!project) continue;

    const budget = evaluateBudgetFilter(unitType, requirements.maxFinalNetPrice);
    const bedrooms = evaluateBedroomFilter(unitType, requirements.minimumBedrooms);

    if (!budget.passes || !bedrooms.passes) continue;

    const financing = calculateMonthlyInstalmentFact(unitType, financingAssumptions);
    const preferences = [
      evaluateAreaPreference(project, requirements.preferredAreas),
      evaluateTenurePreference(project, requirements.tenure),
      evaluateRailPreference(
        connectivityByProjectId.get(project.id) ?? [],
        requirements.rail,
      ),
      evaluateCompletionPreference(project, requirements.completionByYear),
      evaluateInstalmentPreference(financing, requirements.maxMonthlyInstalment),
    ].filter((item): item is SmartFinderPreferenceResult => Boolean(item));

    flatMatches.push({
      project,
      match: {
        unitType,
        hardFilters: {
          budget,
          bedrooms,
        },
        preferences,
        preferenceSummary: summarizePreferences(preferences),
        financing,
      },
    });
  }

  flatMatches.sort((left, right) =>
    compareUnitMatches(left.project, left.match, right.project, right.match),
  );

  const groupedProjects = new Map<string, SmartFinderProjectResult>();

  for (const item of flatMatches) {
    const group = groupedProjects.get(item.project.id) ?? {
      project: item.project,
      matchingUnitTypes: [],
    };

    group.matchingUnitTypes.push(item.match);
    groupedProjects.set(item.project.id, group);
  }

  return {
    projects: [...groupedProjects.values()],
  };
}

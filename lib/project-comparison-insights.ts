export type ProjectComparisonInsightCategory =
  | "price"
  | "investment"
  | "property"
  | "timeline"
  | "connectivity";

export type ProjectComparisonInsightType =
  | "clear_advantage"
  | "feature_highlight"
  | "competitive";

export type ProjectComparisonInsightEvidence = {
  project_id: string;
  project_name: string;
  value_label: string;
  numeric_value?: number | null;
  range_min?: number | null;
  range_max?: number | null;
};

export type ProjectComparisonInsight = {
  id: string;
  category: ProjectComparisonInsightCategory;
  type: ProjectComparisonInsightType;
  metric_key: string;
  title: string;
  project_ids: string[];
  evidence: ProjectComparisonInsightEvidence[];
  explanation?: string | null;
};

export type ComparableRange = {
  min: number;
  max: number;
  label: string;
};

export type ComparableConnectivityPoint = {
  category: string;
  name: string;
  distanceMeters: number | null;
  connectionMode: string | null;
  label: string;
};

export type ProjectComparisonInsightInput = {
  projectId: string;
  projectName: string;
  finalNetPrice: ComparableRange | null;
  psf: ComparableRange | null;
  monthlyInstalment: ComparableRange | null;
  estimatedCashRequired: ComparableRange | null;
  estimatedRental: ComparableRange | null;
  netRentalYield: ComparableRange | null;
  monthlyCashFlow: ComparableRange | null;
  cashOnCashReturn: ComparableRange | null;
  monthlyMaintenance: ComparableRange | null;
  unitSizeSqft: number | null;
  unitSizeLabel: string;
  tenure: string | null;
  isDualKey: boolean | null;
  estimatedCompletion: {
    sortValue: number;
    label: string;
  } | null;
  connectivity: ComparableConnectivityPoint[];
};

type RankingDirection = "lower" | "higher";

type RankingMetricConfig = {
  category: ProjectComparisonInsightCategory;
  metricKey: string;
  title: string;
  competitiveTitle?: string;
  direction: RankingDirection;
  getRange: (input: ProjectComparisonInsightInput) => ComparableRange | null;
  explanation?: string;
};

const numericTolerance = 0.005;
const railCategories = new Set(["lrt", "mrt", "ktm", "monorail", "brt"]);

function rangesEqual(left: ComparableRange, right: ComparableRange) {
  return (
    Math.abs(left.min - right.min) <= numericTolerance &&
    Math.abs(left.max - right.max) <= numericTolerance
  );
}

function rangeDominates(
  candidate: ComparableRange,
  other: ComparableRange,
  direction: RankingDirection,
) {
  if (rangesEqual(candidate, other)) return true;

  return direction === "lower"
    ? candidate.max < other.min - numericTolerance
    : candidate.min > other.max + numericTolerance;
}

function buildEvidence(
  inputs: ProjectComparisonInsightInput[],
  getRange: (input: ProjectComparisonInsightInput) => ComparableRange | null,
) {
  const evidence: ProjectComparisonInsightEvidence[] = [];

  for (const input of inputs) {
    const range = getRange(input);

    if (!range) continue;

    evidence.push({
      project_id: input.projectId,
      project_name: input.projectName,
      value_label: range.label,
      numeric_value: range.min === range.max ? range.min : null,
      range_min: range.min,
      range_max: range.max,
    });
  }

  return evidence;
}

function createRankingInsight(
  inputs: ProjectComparisonInsightInput[],
  config: RankingMetricConfig,
): ProjectComparisonInsight | null {
  const usable = inputs
    .map((input) => ({ input, range: config.getRange(input) }))
    .filter((item): item is { input: ProjectComparisonInsightInput; range: ComparableRange } =>
      Boolean(item.range),
    );

  if (usable.length < 2) return null;

  const dominant = usable.filter((candidate) =>
    usable.every((other) => rangeDominates(candidate.range, other.range, config.direction)),
  );
  const evidence = buildEvidence(inputs, config.getRange);

  if (dominant.length > 0 && dominant.length < usable.length) {
    return {
      id: config.metricKey,
      category: config.category,
      type: "clear_advantage",
      metric_key: config.metricKey,
      title: config.title,
      project_ids: dominant.map((item) => item.input.projectId),
      evidence: dominant.map((item) => ({
        project_id: item.input.projectId,
        project_name: item.input.projectName,
        value_label: item.range.label,
        numeric_value: item.range.min === item.range.max ? item.range.min : null,
        range_min: item.range.min,
        range_max: item.range.max,
      })),
      explanation: config.explanation ?? null,
    };
  }

  return {
    id: `${config.metricKey}_competitive`,
    category: config.category,
    type: "competitive",
    metric_key: config.metricKey,
    title: config.competitiveTitle ?? `Competitive ${config.title}`,
    project_ids: usable.map((item) => item.input.projectId),
    evidence,
    explanation:
      "Available ranges are close or overlapping, so no clear objective advantage is identified.",
  };
}

function createUnitSizeInsight(inputs: ProjectComparisonInsightInput[]) {
  return createRankingInsight(inputs, {
    category: "property",
    metricKey: "largest_unit_size",
    title: "Largest Unit Size",
    direction: "higher",
    getRange: (input) =>
      typeof input.unitSizeSqft === "number" && Number.isFinite(input.unitSizeSqft)
        ? {
            min: input.unitSizeSqft,
            max: input.unitSizeSqft,
            label: input.unitSizeLabel,
          }
        : null,
  });
}

function createCompletionInsight(inputs: ProjectComparisonInsightInput[]) {
  return createRankingInsight(inputs, {
    category: "timeline",
    metricKey: "earliest_completion",
    title: "Earliest Estimated Completion",
    direction: "lower",
    getRange: (input) =>
      input.estimatedCompletion
        ? {
            min: input.estimatedCompletion.sortValue,
            max: input.estimatedCompletion.sortValue,
            label: input.estimatedCompletion.label,
          }
        : null,
  });
}

function createFreeholdInsight(inputs: ProjectComparisonInsightInput[]) {
  const freeholdInputs = inputs.filter((input) =>
    input.tenure?.trim().toLowerCase().includes("freehold"),
  );

  if (freeholdInputs.length === 0) return null;

  return {
    id: "freehold_tenure",
    category: "property",
    type: "feature_highlight",
    metric_key: "freehold_tenure",
    title: "Freehold Tenure",
    project_ids: freeholdInputs.map((input) => input.projectId),
    evidence: freeholdInputs.map((input) => ({
      project_id: input.projectId,
      project_name: input.projectName,
      value_label: input.tenure ?? "Freehold",
    })),
    explanation: null,
  } satisfies ProjectComparisonInsight;
}

function createDualKeyInsight(inputs: ProjectComparisonInsightInput[]) {
  const dualKeyInputs = inputs.filter((input) => input.isDualKey === true);

  if (dualKeyInputs.length === 0) return null;

  return {
    id: "dual_key_layout",
    category: "property",
    type: "feature_highlight",
    metric_key: "dual_key_layout",
    title: "Dual Key Layout",
    project_ids: dualKeyInputs.map((input) => input.projectId),
    evidence: dualKeyInputs.map((input) => ({
      project_id: input.projectId,
      project_name: input.projectName,
      value_label: "Dual Key",
    })),
    explanation: null,
  } satisfies ProjectComparisonInsight;
}

function createWalkingRailInsight(inputs: ProjectComparisonInsightInput[]) {
  const railInputs = inputs
    .map((input) => ({
      input,
      points: input.connectivity.filter(
        (point) =>
          railCategories.has(point.category) &&
          point.connectionMode === "walking",
      ),
    }))
    .filter((item) => item.points.length > 0);

  if (railInputs.length === 0) return null;

  return {
    id: "walking_distance_to_rail",
    category: "connectivity",
    type: "feature_highlight",
    metric_key: "walking_distance_to_rail",
    title: "Walking Distance to Rail",
    project_ids: railInputs.map((item) => item.input.projectId),
    evidence: railInputs.flatMap((item) =>
      item.points.map((point) => ({
        project_id: item.input.projectId,
        project_name: item.input.projectName,
        value_label: `${point.name} · ${point.label}`,
        numeric_value: point.distanceMeters,
      })),
    ),
    explanation: null,
  } satisfies ProjectComparisonInsight;
}

export function generateProjectComparisonInsights(
  inputs: ProjectComparisonInsightInput[],
): ProjectComparisonInsight[] {
  const rankingInsights = [
    createRankingInsight(inputs, {
      category: "price",
      metricKey: "lowest_final_net_price",
      title: "Lowest Final Net Price",
      direction: "lower",
      getRange: (input) => input.finalNetPrice,
    }),
    createRankingInsight(inputs, {
      category: "price",
      metricKey: "lowest_psf",
      title: "Lowest PSF",
      competitiveTitle: "Competitive PSF",
      direction: "lower",
      getRange: (input) => input.psf,
    }),
    createRankingInsight(inputs, {
      category: "price",
      metricKey: "lowest_monthly_instalment",
      title: "Lowest Estimated Monthly Instalment",
      direction: "lower",
      getRange: (input) => input.monthlyInstalment,
    }),
    createRankingInsight(inputs, {
      category: "price",
      metricKey: "lowest_estimated_cash_required",
      title: "Lowest Estimated Cash Required",
      direction: "lower",
      getRange: (input) => input.estimatedCashRequired,
    }),
    createRankingInsight(inputs, {
      category: "investment",
      metricKey: "highest_estimated_rental",
      title: "Highest Estimated Rental",
      competitiveTitle: "Competitive Estimated Rental",
      direction: "higher",
      getRange: (input) => input.estimatedRental,
    }),
    createRankingInsight(inputs, {
      category: "investment",
      metricKey: "highest_net_rental_yield",
      title: "Highest Net Rental Yield",
      competitiveTitle: "Competitive Net Rental Yield",
      direction: "higher",
      getRange: (input) => input.netRentalYield,
    }),
    createRankingInsight(inputs, {
      category: "investment",
      metricKey: "highest_monthly_cash_flow",
      title: "Highest Estimated Monthly Cash Flow",
      competitiveTitle: "Competitive Estimated Monthly Cash Flow",
      direction: "higher",
      getRange: (input) => input.monthlyCashFlow,
    }),
    createRankingInsight(inputs, {
      category: "investment",
      metricKey: "highest_cash_on_cash_return",
      title: "Highest Cash-on-Cash Return (CoC)",
      competitiveTitle: "Competitive Cash-on-Cash Return (CoC)",
      direction: "higher",
      getRange: (input) => input.cashOnCashReturn,
    }),
    createRankingInsight(inputs, {
      category: "investment",
      metricKey: "lowest_monthly_maintenance",
      title: "Lowest Monthly Maintenance",
      direction: "lower",
      getRange: (input) => input.monthlyMaintenance,
    }),
    createUnitSizeInsight(inputs),
    createCompletionInsight(inputs),
  ];
  const featureInsights = [
    createFreeholdInsight(inputs),
    createDualKeyInsight(inputs),
    createWalkingRailInsight(inputs),
  ];

  return [...rankingInsights, ...featureInsights].filter(
    (insight): insight is ProjectComparisonInsight => Boolean(insight),
  );
}

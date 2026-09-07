import type { ScheduleHStageId } from "@/lib/progressive-interest";

export const progressiveInterestSavedWorkSchemaVersion = 1;

export type ProgressiveInterestTimelineStageId = Extract<
  ScheduleHStageId,
  "2a" | "2b" | "2c" | "2d" | "2e" | "2f" | "2g" | "2h" | "vp"
>;

export type ProgressiveInterestSavedStageTimingV1 = {
  year: string;
  quarter: string;
};

export type ProgressiveInterestSavedProjectSnapshotV1 = {
  id: string;
  projectName: string;
};

export type ProgressiveInterestSavedWorkPayloadV1 = {
  tool: "progressive_interest";
  schemaVersion: 1;
  selectedProjectId: string;
  unitNo: string;
  spaPrice: string;
  loanMarginPercent: string;
  annualInterestRatePercent: string;
  loanTenureYears: string;
  currentStageId: ProgressiveInterestTimelineStageId | "";
  stageTimings: Record<
    ProgressiveInterestTimelineStageId,
    ProgressiveInterestSavedStageTimingV1
  >;
  snapshots: {
    project: ProgressiveInterestSavedProjectSnapshotV1 | null;
  };
};

export const progressiveInterestTimelineStageIds = [
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "2g",
  "2h",
  "vp",
] as const satisfies readonly ProgressiveInterestTimelineStageId[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function createDefaultStageTimings() {
  return progressiveInterestTimelineStageIds.reduce(
    (timings, stageId) => ({
      ...timings,
      [stageId]: { year: "", quarter: "" },
    }),
    {} as Record<
      ProgressiveInterestTimelineStageId,
      ProgressiveInterestSavedStageTimingV1
    >,
  );
}

function normalizeStageTimings(value: unknown) {
  const normalized = createDefaultStageTimings();

  if (!isRecord(value)) return normalized;

  for (const stageId of progressiveInterestTimelineStageIds) {
    const timing = value[stageId];

    if (!isRecord(timing)) continue;

    normalized[stageId] = {
      year: stringValue(timing.year),
      quarter: stringValue(timing.quarter),
    };
  }

  return normalized;
}

function isTimelineStageId(value: unknown): value is ProgressiveInterestTimelineStageId {
  return (
    typeof value === "string" &&
    progressiveInterestTimelineStageIds.includes(
      value as ProgressiveInterestTimelineStageId,
    )
  );
}

function normalizeProjectSnapshot(
  value: unknown,
): ProgressiveInterestSavedProjectSnapshotV1 | null {
  if (!isRecord(value)) return null;

  return {
    id: stringValue(value.id),
    projectName: stringValue(value.projectName),
  };
}

export function validateProgressiveInterestSavedWorkPayload(value: unknown):
  | { valid: true; payload: ProgressiveInterestSavedWorkPayloadV1 }
  | { valid: false; error: string } {
  if (!isRecord(value)) {
    return { valid: false, error: "This saved Progressive Interest version cannot be opened." };
  }

  if (
    value.tool !== "progressive_interest" ||
    value.schemaVersion !== progressiveInterestSavedWorkSchemaVersion
  ) {
    return { valid: false, error: "This saved Progressive Interest version cannot be opened." };
  }

  const snapshots = isRecord(value.snapshots) ? value.snapshots : {};
  const currentStageId = isTimelineStageId(value.currentStageId) ? value.currentStageId : "";

  return {
    valid: true,
    payload: {
      tool: "progressive_interest",
      schemaVersion: progressiveInterestSavedWorkSchemaVersion,
      selectedProjectId: stringValue(value.selectedProjectId),
      unitNo: stringValue(value.unitNo),
      spaPrice: stringValue(value.spaPrice),
      loanMarginPercent: stringValue(value.loanMarginPercent) || "90",
      annualInterestRatePercent: stringValue(value.annualInterestRatePercent) || "4.00",
      loanTenureYears: stringValue(value.loanTenureYears) || "35",
      currentStageId,
      stageTimings: normalizeStageTimings(value.stageTimings),
      snapshots: {
        project: normalizeProjectSnapshot(snapshots.project),
      },
    },
  };
}

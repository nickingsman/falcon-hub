export const academyCourseStatuses = ["draft", "published", "archived"] as const;
export const academyVideoSourceTypes = ["youtube", "vimeo", "google_drive", "external"] as const;

export type AcademyCourseStatus = (typeof academyCourseStatuses)[number];
export type AcademyVideoSourceType = (typeof academyVideoSourceTypes)[number];

export type AcademyProgressSummary = {
  lastPositionSeconds: number;
  maxWatchedSeconds: number;
  learningPercentage: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  startedAt: string | null;
  lastWatchedAt: string | null;
};

export type AcademyProgressStatus = "not_started" | "in_progress" | "completed";

export function isAcademyCourseStatus(value: unknown): value is AcademyCourseStatus {
  return typeof value === "string" && academyCourseStatuses.includes(value as AcademyCourseStatus);
}

export function isAcademyVideoSourceType(value: unknown): value is AcademyVideoSourceType {
  return typeof value === "string" && academyVideoSourceTypes.includes(value as AcademyVideoSourceType);
}

export function normalizeHttpsUrl(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return undefined;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integer = Math.floor(value);

  return integer >= 0 ? integer : undefined;
}

export function normalizePositiveInteger(value: unknown) {
  const integer = normalizeNonNegativeInteger(value);
  if (integer === undefined) return undefined;
  if (integer === null) return null;

  return integer > 0 ? integer : undefined;
}

export function getAcademyCompletionThreshold(durationSeconds: number | null | undefined) {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  const duration = Math.floor(durationSeconds);
  const ninetyPercent = Math.ceil(duration * 0.9);

  if (duration <= 10) {
    return ninetyPercent;
  }

  return Math.min(ninetyPercent, duration - 10);
}

export function isAcademyProgressCompleted(
  maxWatchedSeconds: number,
  durationSeconds: number | null | undefined,
) {
  const threshold = getAcademyCompletionThreshold(durationSeconds);

  if (threshold === null) return false;

  return maxWatchedSeconds >= threshold;
}

export function deriveAcademyProgressSummary(input: {
  durationSeconds: number | null | undefined;
  lastPositionSeconds: number | null | undefined;
  maxWatchedSeconds: number | null | undefined;
  completedAt?: string | null;
  startedAt?: string | null;
  lastWatchedAt?: string | null;
}): AcademyProgressSummary {
  const duration =
    input.durationSeconds && Number.isFinite(input.durationSeconds) && input.durationSeconds > 0
      ? Math.floor(input.durationSeconds)
      : null;
  const lastPositionSeconds = Math.max(0, Math.floor(input.lastPositionSeconds ?? 0));
  const maxWatchedSeconds = Math.max(0, Math.floor(input.maxWatchedSeconds ?? 0));
  const learningPercentage =
    duration === null ? null : Math.min(100, Math.round((maxWatchedSeconds / duration) * 100));
  const isCompleted = Boolean(input.completedAt) || isAcademyProgressCompleted(maxWatchedSeconds, duration);

  return {
    lastPositionSeconds,
    maxWatchedSeconds,
    learningPercentage,
    isCompleted,
    completedAt: input.completedAt ?? null,
    startedAt: input.startedAt ?? null,
    lastWatchedAt: input.lastWatchedAt ?? null,
  };
}

export function getAcademyProgressStatus(
  progress: Pick<AcademyProgressSummary, "maxWatchedSeconds" | "isCompleted"> | null | undefined,
): AcademyProgressStatus {
  if (progress?.isCompleted) return "completed";
  if ((progress?.maxWatchedSeconds ?? 0) > 0) return "in_progress";

  return "not_started";
}

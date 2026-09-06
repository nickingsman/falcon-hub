export const savedWorkTypes = ["roi", "project_comparison", "progressive_interest"] as const;

export type SavedWorkType = (typeof savedWorkTypes)[number];

export const savedWorkSchemaVersion = 1;
export const savedWorkTitleMaxLength = 120;
export const savedWorkPayloadMaxBytes = 100 * 1024;

export function isSavedWorkType(value: unknown): value is SavedWorkType {
  return typeof value === "string" && savedWorkTypes.includes(value as SavedWorkType);
}

export function normalizeSavedWorkTitle(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > savedWorkTitleMaxLength) return null;

  return trimmed;
}

export function validateSavedWorkPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Payload must be a JSON object" } as const;
  }

  const serialized = JSON.stringify(value);

  if (new TextEncoder().encode(serialized).length > savedWorkPayloadMaxBytes) {
    return { valid: false, error: "Payload is too large" } as const;
  }

  return { valid: true, payload: value as Record<string, unknown> } as const;
}

export function normalizeSavedWorkSchemaVersion(value: unknown) {
  if (value === undefined || value === null) return savedWorkSchemaVersion;

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return null;

  return value;
}

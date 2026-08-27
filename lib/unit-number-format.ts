export const unitNumberFormatOptions = [
  "tower-floor-stack",
  "floor-stack",
  "manual",
] as const;

export type UnitNumberFormat = (typeof unitNumberFormatOptions)[number];

export type ParsedUnitNumber =
  | {
      detected: true;
      towerCode: string | null;
      floor: number;
      stackCode: string;
    }
  | {
      detected: false;
      towerCode: null;
      floor: null;
      stackCode: null;
    };

export function isUnitNumberFormat(value: unknown): value is UnitNumberFormat {
  return (
    typeof value === "string" &&
    unitNumberFormatOptions.includes(value as UnitNumberFormat)
  );
}

export function normalizeTowerCode(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.toUpperCase() : null;
}

export function normalizeStackCodeForMatching(value: string) {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return {
      kind: "numeric" as const,
      value: trimmed.replace(/^0+(?=\d)/, ""),
    };
  }

  return {
    kind: "text" as const,
    value: trimmed,
  };
}

export function stackCodesMatch(left: string, right: string) {
  const normalizedLeft = normalizeStackCodeForMatching(left);
  const normalizedRight = normalizeStackCodeForMatching(right);

  return (
    normalizedLeft.kind === normalizedRight.kind &&
    normalizedLeft.value === normalizedRight.value
  );
}

function parsePositiveInteger(value: string) {
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseUnitNumber(
  unitNumber: string,
  format: UnitNumberFormat | null | undefined,
): ParsedUnitNumber {
  const normalizedFormat = format ?? "manual";
  const trimmed = unitNumber.trim();

  if (!trimmed || normalizedFormat === "manual") {
    return {
      detected: false,
      towerCode: null,
      floor: null,
      stackCode: null,
    };
  }

  const parts = trimmed.split("-").map((part) => part.trim());

  if (normalizedFormat === "tower-floor-stack") {
    if (parts.length !== 3 || parts.some((part) => !part)) {
      return {
        detected: false,
        towerCode: null,
        floor: null,
        stackCode: null,
      };
    }

    const floor = parsePositiveInteger(parts[1]);

    if (!floor) {
      return {
        detected: false,
        towerCode: null,
        floor: null,
        stackCode: null,
      };
    }

    return {
      detected: true,
      towerCode: normalizeTowerCode(parts[0]),
      floor,
      stackCode: parts[2],
    };
  }

  if (normalizedFormat === "floor-stack") {
    if (parts.length !== 2 || parts.some((part) => !part)) {
      return {
        detected: false,
        towerCode: null,
        floor: null,
        stackCode: null,
      };
    }

    const floor = parsePositiveInteger(parts[0]);

    if (!floor) {
      return {
        detected: false,
        towerCode: null,
        floor: null,
        stackCode: null,
      };
    }

    return {
      detected: true,
      towerCode: null,
      floor,
      stackCode: parts[1],
    };
  }

  return {
    detected: false,
    towerCode: null,
    floor: null,
    stackCode: null,
  };
}

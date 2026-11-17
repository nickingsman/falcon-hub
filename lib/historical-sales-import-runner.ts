import { createHash } from "node:crypto";

export type HistoricalImportYear = 2024 | 2025 | 2026;
export type HistoricalImportSourceType = `historical_${HistoricalImportYear}_case_report`;

export type FrozenImportRecord = {
  sourceType: HistoricalImportSourceType;
  worksheet: string;
  excelRow: number;
  fingerprint: string;
  projectId: string | null;
  sourceProjectName: string;
  originalUnitNo: string;
  unitNo: string;
  bookingDate: string;
  nettPrice: string;
  falconPortion: string;
  status: "booking";
  allocationStatus: "pending";
  remark: string;
  dateAudit: {
    corrected: boolean;
    reason: string | null;
    originalExcelSerial: number | null;
    originalStoredDate: string;
    originalDisplayValue: string;
    originalNumberFormat: string;
  };
  sourceContributorSnapshot: Array<{
    sourceName: string;
    sourceNetGdv: number | null;
    matchedMemberId: string | null;
    matchedMemberName: string | null;
    matchState: "matched" | "missing" | "ambiguous";
  }>;
  contributors: Array<{ sourceName: string; memberId: string | null; portion: null }>;
  sourceFalconGdv: number | null;
  canonicalFalconGdv: number;
  validation: "ready" | "needs_review";
  issues: string[];
  warningReasons: string[];
  sourceAnomalies: Array<{ column: string; originalValue: string; reason: string }>;
};

export type FrozenImportPayload = {
  schemaVersion: 1;
  createdAt: string;
  sourceWorkbook: { fileName: string; sha256: string };
  parserCommit: string;
  baseline: {
    salesCount: number;
    contributorCount: number;
    existingSalesSha256: string;
    existingContributorsSha256: string;
    existing2026SalesSha256: string;
  };
  approvedTotals: {
    recordCount: number;
    nettPrice: string;
    canonicalFalconGdv: string;
    correctedDates: number;
    numericAgentAnomalies: number;
  };
  records: FrozenImportRecord[];
};

export type FrozenImportEnvelope = {
  payloadSha256: string;
  payload: FrozenImportPayload;
};

export type ExistingImportedRecord = {
  id: string;
  source_fingerprint: string;
  source_type: string;
  source_row: number | null;
  project_id: string | null;
  source_project_name: string | null;
  unit_no: string;
  booking_date: string;
  nett_price: number | string;
  falcon_portion: number | string;
  status: string;
  allocation_status: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function createFrozenImportEnvelope(payload: FrozenImportPayload): FrozenImportEnvelope {
  return { payloadSha256: sha256(canonicalJson(payload)), payload };
}

export function verifyFrozenImportEnvelope(envelope: FrozenImportEnvelope) {
  const actual = sha256(canonicalJson(envelope.payload));
  if (actual !== envelope.payloadSha256) throw new Error("Frozen import manifest checksum does not match its payload");
  return actual;
}

export function normalizeImportIdentity(projectId: string | null, sourceProjectName: string | null, unitNo: string) {
  const project = projectId ? `id:${projectId}` : `source:${(sourceProjectName ?? "").trim().replace(/\s+/g, " ").toLowerCase()}`;
  const unit = unitNo.trim().replace(/\s+/g, " ").toLowerCase();
  return `${project}|${unit}`;
}

type ExactDecimal = { units: bigint; scale: number };
const bigZero = BigInt(0);
const bigOne = BigInt(1);
const bigTwo = BigInt(2);
const bigTen = BigInt(10);

function trimExactDecimal(value: ExactDecimal): ExactDecimal {
  let { units, scale } = value;
  while (scale > 0 && units % bigTen === bigZero) {
    units /= bigTen;
    scale -= 1;
  }
  return { units, scale };
}

function parseExactDecimal(value: number | string): ExactDecimal {
  const source = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) throw new Error(`Invalid decimal value: ${source}`);

  const sign = match[1] === "-" ? -bigOne : bigOne;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent)) throw new Error(`Invalid decimal exponent: ${source}`);

  let digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, "");
  let scale = fraction.length - exponent;
  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }

  return trimExactDecimal({ units: sign * BigInt(digits || "0"), scale });
}

function exactDecimalToString(value: ExactDecimal, fixedScale?: number) {
  let { units, scale } = value;
  if (fixedScale !== undefined && scale < fixedScale) {
    units *= bigTen ** BigInt(fixedScale - scale);
    scale = fixedScale;
  }
  const negative = units < bigZero;
  const absolute = negative ? -units : units;
  if (scale === 0) return `${negative ? "-" : ""}${absolute}`;
  const digits = absolute.toString().padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function addExactDecimals(values: Array<number | string>) {
  const parsed = values.map(parseExactDecimal);
  const scale = parsed.reduce((maximum, value) => Math.max(maximum, value.scale), 0);
  const units = parsed.reduce(
    (total, value) => total + value.units * bigTen ** BigInt(scale - value.scale),
    bigZero,
  );
  return { units, scale };
}

function roundExactDecimal(value: ExactDecimal, scale: number) {
  if (value.scale <= scale) {
    return exactDecimalToString({
      units: value.units * bigTen ** BigInt(scale - value.scale),
      scale,
    }, scale);
  }
  const divisor = bigTen ** BigInt(value.scale - scale);
  const negative = value.units < bigZero;
  const absolute = negative ? -value.units : value.units;
  let rounded = absolute / divisor;
  if ((absolute % divisor) * bigTwo >= divisor) rounded += bigOne;
  return exactDecimalToString({ units: negative ? -rounded : rounded, scale }, scale);
}

export function normalizeExactDecimal(value: number | string) {
  return exactDecimalToString(parseExactDecimal(value));
}

export function exactDecimalsEqual(left: number | string, right: number | string) {
  return normalizeExactDecimal(left) === normalizeExactDecimal(right);
}

export function sumMoneyExactly(values: Array<number | string>) {
  return roundExactDecimal(addExactDecimals(values), 2);
}

export function calculateFalconGdvExactly(nettPrice: number | string, falconPortion: number | string) {
  const price = parseExactDecimal(nettPrice);
  const portion = parseExactDecimal(falconPortion);
  return exactDecimalToString(trimExactDecimal({
    units: price.units * portion.units,
    scale: price.scale + portion.scale + 2,
  }));
}

export function existingRecordMatchesManifest(existing: ExistingImportedRecord, planned: FrozenImportRecord) {
  return existing.source_type === planned.sourceType
    && existing.source_row === planned.excelRow
    && existing.project_id === planned.projectId
    && (existing.source_project_name ?? "") === planned.sourceProjectName
    && existing.unit_no === planned.unitNo
    && existing.booking_date === planned.bookingDate
    && exactDecimalsEqual(existing.nett_price, planned.nettPrice)
    && exactDecimalsEqual(existing.falcon_portion, planned.falconPortion)
    && existing.status === "booking"
    && existing.allocation_status === "pending";
}

export function buildResumePlan(records: FrozenImportRecord[], existing: ExistingImportedRecord[]) {
  const plannedByFingerprint = new Map(records.map((record) => [record.fingerprint, record]));
  if (plannedByFingerprint.size !== records.length) throw new Error("Frozen import manifest contains duplicate fingerprints");
  const existingByFingerprint = new Map<string, ExistingImportedRecord>();
  for (const row of existing) {
    if (!plannedByFingerprint.has(row.source_fingerprint)) throw new Error(`Unexpected historical fingerprint exists in production: ${row.source_fingerprint}`);
    if (existingByFingerprint.has(row.source_fingerprint)) throw new Error(`Production contains a duplicate historical fingerprint: ${row.source_fingerprint}`);
    existingByFingerprint.set(row.source_fingerprint, row);
  }
  for (const [fingerprint, row] of existingByFingerprint) {
    const planned = plannedByFingerprint.get(fingerprint);
    if (!planned || !existingRecordMatchesManifest(row, planned)) throw new Error(`Existing imported row does not match the frozen manifest: ${fingerprint}`);
  }
  const completed2024 = records.filter((record) => record.sourceType === "historical_2024_case_report" && existingByFingerprint.has(record.fingerprint));
  const completed2025 = records.filter((record) => record.sourceType === "historical_2025_case_report" && existingByFingerprint.has(record.fingerprint));
  const completed2026 = records.filter((record) => record.sourceType === "historical_2026_case_report" && existingByFingerprint.has(record.fingerprint));
  const all2024 = records.filter((record) => record.sourceType === "historical_2024_case_report");
  const all2025 = records.filter((record) => record.sourceType === "historical_2025_case_report");

  if (completed2025.length && completed2024.length !== all2024.length) throw new Error("2025 imports exist before the 2024 checkpoint is complete");
  if (completed2026.length && completed2025.length !== all2025.length) throw new Error("2026 imports exist before the 2025 checkpoint is complete");

  return {
    completed: [...completed2024, ...completed2025, ...completed2026],
    pending2024: all2024.filter((record) => !existingByFingerprint.has(record.fingerprint)),
    pending2025: records.filter((record) => record.sourceType === "historical_2025_case_report" && !existingByFingerprint.has(record.fingerprint)),
    pending2026: records.filter((record) => record.sourceType === "historical_2026_case_report" && !existingByFingerprint.has(record.fingerprint)),
  };
}

export function assertNoUnitCollisions(records: FrozenImportRecord[], occupiedIdentities: Iterable<string>) {
  const occupied = new Set(occupiedIdentities);
  for (const record of records) {
    const identity = normalizeImportIdentity(record.projectId, record.sourceProjectName, record.unitNo);
    if (occupied.has(identity)) throw new Error(`Planned Project + Unit identity is occupied: ${record.worksheet} row ${record.excelRow}`);
    occupied.add(identity);
  }
  return occupied;
}

export function assertBaseline(actual: { salesCount: number; contributorCount: number; existingSalesSha256: string; existingContributorsSha256: string; existing2026SalesSha256: string }, expected: FrozenImportPayload["baseline"]) {
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (actual[key] !== expected[key]) throw new Error(`Production baseline changed: ${key}`);
  }
}

export function selectImportYear(
  plan: { pending2024: FrozenImportRecord[]; pending2025: FrozenImportRecord[]; pending2026?: FrozenImportRecord[] },
  year: HistoricalImportYear,
) {
  const pending2026 = plan.pending2026 ?? [];

  if (year === 2024) return plan.pending2024;
  if (year === 2025) {
    if (plan.pending2024.length) throw new Error("2024 checkpoint must be complete before 2025 can execute");
    return plan.pending2025;
  }
  if (plan.pending2024.length || plan.pending2025.length) {
    throw new Error("2024 and 2025 checkpoints must be complete before 2026 can execute");
  }
  return pending2026;
}

export async function runImportPlan<T>(input: {
  records: FrozenImportRecord[];
  execute: boolean;
  invoke: (record: FrozenImportRecord) => Promise<T>;
}) {
  if (!input.execute) return { attempted: 0, completed: 0, results: [] as T[] };
  const results: T[] = [];
  for (const record of input.records) {
    results.push(await input.invoke(record));
  }
  return { attempted: input.records.length, completed: results.length, results };
}

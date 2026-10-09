import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { normalizeSalesUnit, parseSalesPercentage, type SalesStatus } from "@/lib/sales";
import {
  getFirstUnusedHistoricalUnit,
  getHistoricalCorrectedDate,
  getHistoricalCorrectedUnit,
  getHistoricalContributorAllocationCorrection,
  getHistoricalMemberLookupName,
  getHistoricalProjectLookupName,
  getHistoricalStatusCorrection,
  normalizeHistoricalName,
} from "./historical-sales-import-rules";
export * from "./historical-sales-import-rules";

export type HistoricalValidationState = "ready" | "needs_review" | "blocked" | "ignored";
export class HistoricalWorkbookError extends Error {
  override name = "HistoricalWorkbookError";
}
type SheetCell = { value: unknown; text: string; numFmt: string; percent: boolean; fillKey: string; excelSerial: number | null };
type ProjectOption = { id: string; project_name: string | null };
type MemberOption = { id: string; full_name: string | null; display_name: string | null; member_code: number | string | null; position: string | null };
type ExistingCase = { id: string; project_id: string | null; source_project_name?: string | null; unit_no: string; status: string };
type ExistingFingerprint = { source_fingerprint: string | null };
export type HistoricalSalesSource = "2024_case_report" | "2025_case_report" | "2026_case_report";
export type HistoricalAllocationStatus = "verified" | "pending";

export type HistoricalDateCorrectionManifestEntry = {
  worksheet: string;
  excelRow: number;
  monthSection: string;
  originalExcelSerial: number | null;
  originalStoredDate: string;
  originalDisplayValue: string;
  originalNumberFormat: string;
  correctedBookingDate: string;
  correctionReason: string;
};

export type HistoricalPreviewContributor = {
  sourceName: string;
  portion: number | null;
  sourceNetGdv: number | null;
  calculatedGdv: number | null;
  memberId: string | null;
  memberName: string | null;
  matchState: "matched" | "missing" | "ambiguous";
};

export type HistoricalPreviewRow = {
  sourceRow: number;
  month: string;
  sourceProject: string;
  projectId: string | null;
  projectName: string | null;
  unitNo: string;
  originalUnitNo: string;
  sourceBookingDate: string;
  sourceBookingDateSerial: number | null;
  sourceBookingDateStored: string;
  sourceBookingDateNumberFormat: string;
  bookingDate: string | null;
  bookingDateKind: "excel_date" | "excel_serial" | "text" | "unknown";
  bookingDateCorrected: boolean;
  bookingDateCorrectionReason: string | null;
  nettPrice: number | null;
  falconPortion: number | null;
  sourceFalconGdv: number | null;
  calculatedFalconGdv: number | null;
  status: SalesStatus | null;
  statusLabel: string;
  contributors: HistoricalPreviewContributor[];
  fingerprint: string | null;
  validation: HistoricalValidationState;
  issues: string[];
  warningReasons: string[];
  plannedRemark: string | null;
  allocationStatus: HistoricalAllocationStatus;
  sourceAnomalies: Array<{ column: string; originalValue: string; reason: string }>;
  collisionKind: "none" | "workbook" | "existing";
};

export type HistoricalPreview = {
  fileName: string;
  sheetName: string;
  source: HistoricalSalesSource;
  sourceYear: 2024 | 2025 | 2026;
  summary: Record<HistoricalValidationState, number> & { total: number };
  statusDistribution: Record<SalesStatus, number>;
  financials: { totalNettPrice: number; totalFalconCreditedGdv: number };
  diagnostics: {
    matchedProjects: number;
    sourceOnlyProjects: number;
    matchedMembers: number;
    unmatchedMembers: number;
    duplicateRisks: number;
    pendingAllocations: number;
    validationErrors: number;
    dateReviews: number;
    numericAgentAnomalies: number;
    unitCellAnomalies: number;
    sourceGdvMismatches: number;
    existingCaseCollisions: number;
    correctedDates: number;
  };
  dateCorrectionManifest: HistoricalDateCorrectionManifestEntry[];
  rows: HistoricalPreviewRow[];
};

const statusLabels: Record<SalesStatus, string> = {
  booking: "Booking", submitted: "Submitted", loan_approved: "Loan Approved", sign_spa: "Sign SPA", cancelled: "Cancelled",
};
const legacyStatuses: Record<string, SalesStatus> = {
  "no update": "booking", booking: "booking", submitted: "submitted", "loan approve": "loan_approved",
  "loan approved": "loan_approved", "sign spa": "sign_spa", "signed spa": "sign_spa",
  cancel: "cancelled", cancelled: "cancelled", canceled: "cancelled",
};
const importMonths = new Set(["January", "February", "March", "April", "May", "June", "July"]);
const importMonthNumbers = new Map([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((month, index) => [month, index + 1]));

function headerKey(value: string) {
  return normalizeHistoricalName(value).replace(/[^a-z0-9%]+/g, " ").trim();
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const item = value as { result?: unknown; text?: string; richText?: Array<{ text?: string }> };
    if (item.result !== undefined) return cellText(item.result);
    if (typeof item.text === "string") return item.text;
    if (Array.isArray(item.richText)) return item.richText.map((part) => part.text ?? "").join("");
  }
  return String(value).trim();
}

function formatExcelDateCell(value: Date, numFmt: string) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  const format = numFmt.toLowerCase().replace(/\[\$-[^\]]+\]/g, "").replace(/\\/g, "");
  if (!/[dmy]/.test(format)) return value.toISOString().slice(0, 10);
  return format.replace(/yyyy|yy|mmmm|mmm|mm|m|dd|d/g, (token) => {
    if (token === "yyyy") return String(year);
    if (token === "yy") return String(year).slice(-2);
    if (token === "mmmm") return new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(value);
    if (token === "mmm") return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(value);
    if (token === "mm") return String(month).padStart(2, "0");
    if (token === "m") return String(month);
    if (token === "dd") return String(day).padStart(2, "0");
    return String(day);
  });
}

function safeExcelCellText(cell: ExcelJS.Cell) {
  if (cell.value instanceof Date && !Number.isNaN(cell.value.getTime())) return formatExcelDateCell(cell.value, cell.numFmt ?? "");
  try {
    return cell.text;
  } catch {
    return cellText(cell.value);
  }
}

function isDateLikeNumberFormat(numFmt: string) {
  const normalized = numFmt.toLowerCase()
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");
  return /d+/.test(normalized) && /m+/.test(normalized) && /y+/.test(normalized);
}

function excelSerialFromDate(value: Date, date1904 = false) {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const serial = (value.getTime() - epoch) / 86_400_000;
  return Number.isFinite(serial) ? Number(serial.toFixed(10)) : null;
}

function fillKey(fill: ExcelJS.Fill | undefined) {
  if (!fill || fill.type === "pattern" && fill.pattern === "none") return "none";
  return JSON.stringify(fill);
}

function makeCell(value: unknown, text = cellText(value), numFmt = "", fill?: ExcelJS.Fill, excelSerial: number | null = null): SheetCell {
  return { value, text: text.trim(), numFmt, percent: numFmt.includes("%"), fillKey: fillKey(fill), excelSerial };
}

function parseCsv(text: string) {
  const rows: SheetCell[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index] ?? "\n";
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row.map((value) => makeCell(value))); row = []; field = ""; }
    else field += char;
  }
  return rows;
}

async function readWorkbook(file: File) {
  if (file.size > 15 * 1024 * 1024) throw new HistoricalWorkbookError("Workbook must be 15 MB or smaller");
  if (file.name.toLowerCase().endsWith(".csv")) {
    return [{ sheetName: "CSV", rows: parseCsv(await file.text()) }];
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new HistoricalWorkbookError("Use an .xlsx or .csv file");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const requestedSheets = ["2024 CASE REPORT", "2025 CASE REPORT", "2026 Case Report"];
  const selected = requestedSheets.flatMap((name) => {
    const worksheet = workbook.worksheets.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    return worksheet ? [worksheet] : [];
  });
  const worksheets = selected.length ? selected : workbook.worksheets.slice(0, 1);
  if (!worksheets.length) throw new HistoricalWorkbookError("Workbook has no worksheets");
  return worksheets.map((worksheet) => {
    const rows: SheetCell[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: SheetCell[] = [];
      for (let column = 1; column <= Math.max(row.cellCount, worksheet.columnCount); column += 1) {
        const cell = row.getCell(column);
        const excelSerial = cell.value instanceof Date
          ? excelSerialFromDate(cell.value, Boolean(workbook.properties.date1904))
          : typeof cell.value === "number" && isDateLikeNumberFormat(cell.numFmt ?? "") ? cell.value : null;
        cells.push(makeCell(cell.value, safeExcelCellText(cell), cell.numFmt, cell.fill, excelSerial));
      }
      rows.push(cells);
    });
    return { sheetName: worksheet.name, rows };
  });
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseMoney(cell: SheetCell | undefined) {
  if (!cell || !cell.text) return null;
  const raw = typeof cell.value === "number" ? cell.value : Number(cell.text.replace(/[RM$,%\s]/gi, "").replace(/,/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(raw) ? raw : null;
}

function parsePortion(cell: SheetCell | undefined) {
  if (!cell || !cell.text) return null;
  let raw: string | number = typeof cell.value === "number" ? cell.value : cell.text.replace(/%/g, "").trim();
  if (cell.percent && typeof raw === "number") raw *= 100;
  const parsed = parseSalesPercentage(raw);
  return parsed ? parsed.scaled / 10_000 : null;
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseDate(cell: SheetCell | undefined, expectedMonth: string | null) {
  if (!cell || !cell.text) return null;
  if (cell.value instanceof Date && !Number.isNaN(cell.value.getTime())) {
    const year = cell.value.getUTCFullYear();
    const excelMonth = cell.value.getUTCMonth() + 1;
    const excelDay = cell.value.getUTCDate();
    const direct = validIsoDate(year, excelMonth, excelDay);
    if (!expectedMonth || direct?.slice(5, 7) === String(importMonthNumbers.get(expectedMonth) ?? 0).padStart(2, "0")) return direct;
    return direct;
  }
  if (typeof cell.value === "number" && cell.value > 20_000 && cell.value < 80_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell.value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = cell.text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(text);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (!local) return null;
  const year = Number(local[3]) + (local[3].length === 2 ? 2000 : 0);
  return validIsoDate(year, Number(local[2]), Number(local[1]));
}

function bookingDateKind(cell: SheetCell | undefined): HistoricalPreviewRow["bookingDateKind"] {
  if (!cell || !cell.text) return "unknown";
  if (cell.value instanceof Date) return "excel_date";
  if (typeof cell.value === "number" && cell.value > 20_000 && cell.value < 80_000) return "excel_serial";
  return "text";
}

export function parseHistoricalBookingDate(value: unknown, text = cellText(value), numFmt = "", expectedMonth: string | null = null) {
  return parseDate(makeCell(value, text, numFmt), expectedMonth);
}

export function recoverHistoricalExcelDate(input: {
  source: HistoricalSalesSource;
  sourceYear: number;
  monthSection: string | null;
  value: unknown;
  numberFormat: string;
  excelSerial?: number | null;
}) {
  if (input.source !== "2024_case_report" && input.source !== "2025_case_report") return null;
  if (!input.monthSection || !isDateLikeNumberFormat(input.numberFormat)) return null;
  const expectedMonth = importMonthNumbers.get(input.monthSection);
  if (!expectedMonth) return null;

  const storedDate = input.value instanceof Date
    ? input.value
    : typeof input.value === "number" && input.value > 20_000 && input.value < 80_000
      ? new Date(Date.UTC(1899, 11, 30) + Math.floor(input.value) * 86_400_000)
      : null;
  if (!storedDate || Number.isNaN(storedDate.getTime())) return null;

  const storedYear = storedDate.getUTCFullYear();
  const storedMonth = storedDate.getUTCMonth() + 1;
  const storedDay = storedDate.getUTCDate();
  if (storedYear !== input.sourceYear || storedMonth === expectedMonth || storedDay !== expectedMonth) return null;

  const correctedBookingDate = validIsoDate(storedYear, storedDay, storedMonth);
  if (!correctedBookingDate || Number(correctedBookingDate.slice(5, 7)) !== expectedMonth) return null;

  return {
    correctedBookingDate,
    originalExcelSerial: input.excelSerial ?? excelSerialFromDate(storedDate),
    originalStoredDate: validIsoDate(storedYear, storedMonth, storedDay) ?? "",
    correctionReason: "Approved DD/MM recovery from a locale-inverted Excel date",
  };
}

export function getHistoricalAllocationStatus(falconPortion: number | null, portions: Array<number | null>): HistoricalAllocationStatus {
  if (falconPortion === null || portions.some((portion) => portion === null)) return "pending";
  const allocatedScaled = Math.round(portions.reduce<number>((sum, portion) => sum + (portion ?? 0), 0) * 10_000);
  return allocatedScaled === Math.round(falconPortion * 10_000) ? "verified" : "pending";
}

const monthNames = new Map([
  ["jan", "January"], ["january", "January"], ["feb", "February"], ["february", "February"],
  ["mar", "March"], ["march", "March"], ["apr", "April"], ["april", "April"],
  ["may", "May"], ["jun", "June"], ["june", "June"], ["jul", "July"], ["july", "July"],
  ["aug", "August"], ["august", "August"], ["sep", "September"], ["sept", "September"],
  ["september", "September"], ["oct", "October"], ["october", "October"],
  ["nov", "November"], ["november", "November"], ["dec", "December"], ["december", "December"],
]);

function reportMonth(cell: SheetCell | undefined) {
  if (!cell) return null;
  if (cell.value instanceof Date) return monthNames.get(cell.value.toLocaleString("en", { month: "long", timeZone: "UTC" }).toLowerCase()) ?? null;
  const normalized = normalizeHistoricalName(cell.text).replace(/[^a-z0-9]+/g, " ").trim();
  const withoutYear = normalized.replace(/\b20\d{2}\b/g, "").trim();
  if (monthNames.has(withoutYear)) return monthNames.get(withoutYear) ?? null;
  if (/^(?:[1-9]|1[0-2])$/.test(withoutYear)) return [...new Set(monthNames.values())][Number(withoutYear) - 1] ?? null;
  return null;
}

function reportCaseNumber(cell: SheetCell | undefined) {
  if (!cell || !cell.text) return null;
  if (typeof cell.value === "number" && Number.isInteger(cell.value) && cell.value > 0) return cell.value;
  const match = /^(\d+)\.?$/.exec(cell.text.trim());
  if (!match || Number(match[1]) <= 0) return null;
  return Number(match[1]);
}

function columnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function isNumericAgentValue(cell: SheetCell | undefined) {
  if (!cell || !cell.text) return false;
  if (typeof cell.value === "number") return true;
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cell.text.replace(/,/g, "").trim());
}

function buildStatusFillMap(legendRow: SheetCell[] | undefined) {
  const fillMap = new Map<string, SalesStatus[]>();
  if (!legendRow) return fillMap;
  for (const column of [0, 2, 3, 5, 7]) {
    const cell = legendRow[column];
    const status = legacyStatuses[normalizeHistoricalName(cell?.text ?? "")];
    if (!cell || !status) continue;
    fillMap.set(cell.fillKey, [...(fillMap.get(cell.fillKey) ?? []), status]);
  }
  return fillMap;
}

function statusFromRow(row: SheetCell[], headers: string[], statusColumn: number, statusFills: Map<string, SalesStatus[]>) {
  if (statusColumn >= 0) {
    const status = legacyStatuses[normalizeHistoricalName(row[statusColumn]?.text ?? "")];
    return { status: status ?? null, issue: status ? null : "Legacy status is missing or unsupported" };
  }
  for (const [legacy, mapped] of Object.entries(legacyStatuses)) {
    const column = headers.indexOf(legacy);
    if (column >= 0 && row[column]?.text && !/^(0|no|false)$/i.test(row[column].text)) return { status: mapped, issue: null };
  }
  const matched = new Set<SalesStatus>();
  const nonNeutralMatched = new Set<SalesStatus>();
  for (const cell of row.slice(0, 8).filter((item) => item.text)) {
    const statuses = statusFills.get(cell.fillKey) ?? [];
    for (const status of statuses) {
      matched.add(status);
      if (status !== "booking") nonNeutralMatched.add(status);
    }
  }
  const candidates = nonNeutralMatched.size ? nonNeutralMatched : matched;
  if (candidates.size === 1) return { status: [...candidates][0], issue: null };
  return { status: null, issue: candidates.size > 1 ? "Multiple legacy status colours were detected" : "Status colour does not match the workbook legend" };
}

function contributorColumns(headers: string[]) {
  const groups: Array<{ agent: number; portion: number; gdv: number }> = [];
  headers.forEach((header, index) => {
    if (!(header === "agent" || header.startsWith("agent ") || header === "contributor" || header.startsWith("contributor "))) return;
    const portion = headers.findIndex((candidate, candidateIndex) => candidateIndex > index && candidateIndex <= index + 3 && ["%", "portion", "portion %", "agent %"].includes(candidate));
    const gdv = headers.findIndex((candidate, candidateIndex) => candidateIndex > index && candidateIndex <= index + 4 && ["net gdv", "nett gdv", "agent gdv", "contributor gdv"].includes(candidate));
    groups.push({ agent: index, portion, gdv });
  });
  return groups;
}

function currencyMatches(actual: number | null, expected: number | null) {
  return actual === null || expected === null || Math.abs(actual - expected) <= 0.02;
}

type HistoricalPreviewContext = { projects: ProjectOption[]; members: MemberOption[]; existingCases: ExistingCase[]; fingerprints: ExistingFingerprint[] };
type HistoricalUnitPlanningState = {
  occupiedUnits: Map<string, Set<string>>;
  existingUnitKeys: Set<string>;
};

function createHistoricalUnitPlanningState(existingCases: ExistingCase[]): HistoricalUnitPlanningState {
  const occupiedUnits = new Map<string, Set<string>>();
  const existingUnitKeys = new Set<string>();
  for (const item of existingCases) {
    const projectIdentity = item.project_id
      ? `id:${item.project_id}`
      : item.source_project_name
        ? `source:${normalizeHistoricalName(item.source_project_name)}`
        : null;
    if (!projectIdentity) continue;
    const units = occupiedUnits.get(projectIdentity) ?? new Set<string>();
    const normalizedUnit = normalizeSalesUnit(item.unit_no);
    units.add(normalizedUnit);
    existingUnitKeys.add(`${projectIdentity}|${normalizedUnit}`);
    occupiedUnits.set(projectIdentity, units);
  }
  return { occupiedUnits, existingUnitKeys };
}

function getSourceDefinition(sheetName: string) {
  const normalized = sheetName.trim().toLowerCase();
  if (normalized === "2024 case report") return { source: "2024_case_report" as const, year: 2024 as const };
  if (normalized === "2025 case report") return { source: "2025_case_report" as const, year: 2025 as const };
  return { source: "2026_case_report" as const, year: 2026 as const };
}

async function buildHistoricalSalesSheetPreview(
  fileName: string,
  sheetName: string,
  rows: SheetCell[][],
  context: HistoricalPreviewContext,
  unitPlanningState: HistoricalUnitPlanningState,
): Promise<HistoricalPreview> {
  const sourceDefinition = getSourceDefinition(sheetName);
  const isPendingAllocationSource = sourceDefinition.year === 2024 || sourceDefinition.year === 2025;
  if (!rows.length) throw new HistoricalWorkbookError("Workbook is empty");
  let headerRow = -1;
  let headers: string[] = [];
  const headerRows = new Set<number>();
  for (let index = 0; index < rows.length; index += 1) {
    const candidate = rows[index].map((cell) => headerKey(cell.text));
    const score = [
      ["project", "project name"], ["unit", "unit no", "unit number"],
      ["booking date", "book date"], ["nett price", "net price"],
    ].filter((aliases) => aliases.some((key) => candidate.includes(key))).length;
    if (score < 3) continue;
    headerRows.add(index);
    if (headerRow < 0) { headerRow = index; headers = candidate; }
  }
  if (headerRow < 0) throw new HistoricalWorkbookError("Could not find the Sales header row. Expected Project, Unit No, Booking Date, and Nett Price columns");

  const structuredReport = ["2024 case report", "2025 case report", "2026 case report"].includes(sheetName.trim().toLowerCase());
  const columns = structuredReport ? {
    no: 0, month: 1, project: 2, unit: 3, bookingDate: 4, nettPrice: 5, falconPortion: 6, gdv: 7,
    status: -1,
  } : {
    no: findColumn(headers, ["no", "no ", "number"]),
    month: findColumn(headers, ["month"]), project: findColumn(headers, ["project", "project name"]),
    unit: findColumn(headers, ["unit", "unit no", "unit number"]), bookingDate: findColumn(headers, ["booking date", "book date"]),
    nettPrice: findColumn(headers, ["nett price", "net price"]), falconPortion: findColumn(headers, ["portion", "falcon portion", "falcon portion %", "falcon %"]),
    gdv: findColumn(headers, ["gdv", "falcon gdv", "falcon credited gdv"]), status: findColumn(headers, ["status", "current status"]),
  };
  if ([columns.project, columns.unit, columns.bookingDate, columns.nettPrice, columns.falconPortion].some((column) => column < 0)) throw new HistoricalWorkbookError("Required Sales columns are missing");
  const fixedContributorGroups = [{ agent: 10, portion: 11, gdv: 12 }, { agent: 15, portion: 16, gdv: 17 }, { agent: 20, portion: 21, gdv: 22 }, { agent: 25, portion: 26, gdv: 27 }, { agent: 29, portion: 30, gdv: 31 }];
  const hasFixedContributorLayout = fixedContributorGroups.some((group) =>
    ["agent", "contributor"].some((label) => headers[group.agent]?.startsWith(label))
    && ["%", "portion", "portion %", "agent %"].includes(headers[group.portion] ?? "")
    && ["net gdv", "nett gdv", "agent gdv", "contributor gdv"].includes(headers[group.gdv] ?? ""),
  );
  const contributorGroups = structuredReport && hasFixedContributorLayout ? fixedContributorGroups : contributorColumns(headers);
  if (!contributorGroups.length) throw new HistoricalWorkbookError("No Agent contributor columns were found");
  const statusFills = buildStatusFillMap(rows[0]);

  const projectMap = new Map<string, ProjectOption[]>();
  for (const project of context.projects) {
    if (!project.project_name) continue;
    const key = normalizeHistoricalName(project.project_name);
    projectMap.set(key, [...(projectMap.get(key) ?? []), project]);
  }
  const memberMap = new Map<string, MemberOption[]>();
  for (const member of context.members) {
    for (const value of [member.full_name, member.display_name, member.member_code === null ? null : String(member.member_code), member.member_code === null ? null : String(member.member_code).padStart(3, "0")]) {
      if (!value) continue;
      const key = normalizeHistoricalName(value);
      const matches = memberMap.get(key) ?? [];
      if (!matches.some((item) => item.id === member.id)) matches.push(member);
      memberMap.set(key, matches);
    }
  }
  const existingFingerprints = new Set(context.fingerprints.map((item) => item.source_fingerprint).filter(Boolean));
  const previewRows: HistoricalPreviewRow[] = [];
  let currentMonth: string | null = null;

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    if (headerRows.has(rowIndex)) continue;
    const row = rows[rowIndex];
    const coreCells = row.slice(0, 8);
    if (coreCells.every((cell) => !cell.text)) {
      if (structuredReport) currentMonth = null;
      continue;
    }
    const rowMonth = reportMonth(row[columns.month]);
    if (rowMonth) currentMonth = rowMonth;
    if (structuredReport && (!currentMonth || (sourceDefinition.year === 2026 && !importMonths.has(currentMonth)))) continue;
    const sourceProject = row[columns.project]?.text.trim() ?? "";
    const sourceRow = rowIndex + 1;
    const originalUnitNo = row[columns.unit]?.text.trim() ?? "";
    const unitNo = sourceDefinition.year === 2026 ? getHistoricalCorrectedUnit(sourceRow, originalUnitNo) : originalUnitNo;
    const hasBookingOrPrice = Boolean(row[columns.bookingDate]?.text || row[columns.nettPrice]?.text);
    const hasCaseIdentity = Boolean(sourceProject || unitNo || row[columns.bookingDate]?.text);
    const caseNumber = reportCaseNumber(row[columns.no]);
    if (structuredReport && sourceProject && unitNo && hasBookingOrPrice && (!caseNumber || !currentMonth)) {
      if (process.env.NODE_ENV === "development") console.info("[historical-sales-preview] rejected former case candidate", {
        worksheetRow: rowIndex + 1, rawNumber: row[columns.no]?.text ?? "", month: row[columns.month]?.text ?? "",
        project: sourceProject, unit: unitNo, bookingDate: row[columns.bookingDate]?.text ?? "",
        nettPrice: row[columns.nettPrice]?.text ?? "", reason: !caseNumber ? "missing positive case number" : "outside a recognized monthly section",
      });
      continue;
    }
    if (structuredReport && (!caseNumber || !currentMonth)) continue;
    if (structuredReport ? !hasCaseIdentity : (!sourceProject || !unitNo || !hasBookingOrPrice)) continue;
    const acceptedReason = structuredReport
      ? "numbered row inside a recognized monthly section with Project, Unit, and Booking Date or Nett Price"
      : "Project, Unit, and Booking Date or Nett Price are populated";
    try {
    const normalizedProject = normalizeHistoricalName(sourceProject);
    const normalizedUnit = normalizeSalesUnit(unitNo);
    const bookingDateCell = row[columns.bookingDate];
    const sourceBookingDate = bookingDateCell?.text.trim() ?? "";
    const dateKind = bookingDateKind(bookingDateCell);
    const parsedBookingDate = parseDate(bookingDateCell, currentMonth);
    const automaticDateRecovery = recoverHistoricalExcelDate({
      source: sourceDefinition.source,
      sourceYear: sourceDefinition.year,
      monthSection: currentMonth,
      value: bookingDateCell?.value,
      numberFormat: bookingDateCell?.numFmt ?? "",
      excelSerial: bookingDateCell?.excelSerial,
    });
    const recoveredBookingDate = automaticDateRecovery?.correctedBookingDate ?? parsedBookingDate;
    const bookingDate = getHistoricalCorrectedDate(sourceRow, recoveredBookingDate, sourceDefinition.source);
    const bookingDateCorrected = bookingDate !== parsedBookingDate;
    const bookingDateCorrectionReason = automaticDateRecovery?.correctionReason
      ?? (bookingDate !== recoveredBookingDate ? "User-confirmed source date correction" : null);
    const sourceBookingDateStored = automaticDateRecovery?.originalStoredDate ?? parsedBookingDate ?? "";
    const sourceBookingDateSerial = bookingDateCell?.excelSerial ?? null;
    const sourceBookingDateNumberFormat = bookingDateCell?.numFmt ?? "";
    const nettPrice = parseMoney(row[columns.nettPrice]);
    const falconPortion = parsePortion(row[columns.falconPortion]);
    const sourceFalconGdv = columns.gdv >= 0 ? parseMoney(row[columns.gdv]) : null;
    const statusResult = sourceDefinition.year === 2026
      ? statusFromRow(row, headers, columns.status, statusFills)
      : { status: "booking" as SalesStatus, issue: null };
    const status = sourceDefinition.year === 2026 ? getHistoricalStatusCorrection(sourceRow) ?? statusResult.status : "booking";
    const canonicalProjectName = getHistoricalProjectLookupName(sourceProject);
    const projectMatches = projectMap.get(canonicalProjectName) ?? [];
    const project = projectMatches.length === 1 ? projectMatches[0] : null;
    const contributorCorrection = sourceDefinition.year === 2026 ? getHistoricalContributorAllocationCorrection(sourceRow) : null;
    const sourceAnomalies: HistoricalPreviewRow["sourceAnomalies"] = [];
    if (row[columns.unit]?.value instanceof Date) {
      sourceAnomalies.push({
        column: columnLabel(columns.unit),
        originalValue: originalUnitNo,
        reason: "Unit No is stored as an Excel date and was preserved using its displayed number format",
      });
    }
    const rawContributors = contributorGroups.flatMap((group) => {
      const name = row[group.agent]?.text.trim() ?? "";
      if (!name) return [];
      if (isNumericAgentValue(row[group.agent])) {
        sourceAnomalies.push({
          column: columnLabel(group.agent),
          originalValue: name,
          reason: "Numeric Agent cell was not treated as a contributor name",
        });
        return [];
      }
      const correctedPortion = contributorCorrection?.get(normalizeHistoricalName(name));
      const portion = correctedPortion ?? (group.portion >= 0 ? parsePortion(row[group.portion]) : null);
      const sourceNetGdv = correctedPortion !== undefined && nettPrice !== null
        ? nettPrice * correctedPortion / 100
        : group.gdv >= 0 ? parseMoney(row[group.gdv]) : null;
      return [{ name, portion, sourceNetGdv }];
    });
    const contributors = rawContributors.map((source) => {
      const canonicalMemberName = getHistoricalMemberLookupName(source.name);
      const matches = memberMap.get(canonicalMemberName) ?? [];
      const portion = typeof source.portion === "number" ? source.portion : null;
      const matchedMember = matches.length === 1 ? matches[0] : null;
      return { sourceName: source.name, portion, sourceNetGdv: source.sourceNetGdv, calculatedGdv: nettPrice !== null && portion !== null ? nettPrice * portion / 100 : null, memberId: matchedMember?.id ?? null, memberName: matchedMember?.display_name || matchedMember?.full_name || null, matchState: matches.length === 1 ? "matched" as const : matches.length === 0 ? "missing" as const : "ambiguous" as const };
    });
    const calculatedFalconGdv = nettPrice !== null && falconPortion !== null ? nettPrice * falconPortion / 100 : null;
    const allocationStatus: HistoricalAllocationStatus = isPendingAllocationSource
      ? getHistoricalAllocationStatus(falconPortion, contributors.map((item) => item.portion))
      : "verified";
    const fingerprintPayload = bookingDate && nettPrice !== null && falconPortion !== null && status ? [sourceDefinition.source, sheetName, sourceRow, normalizedProject, normalizedUnit, bookingDate, nettPrice.toFixed(2), falconPortion.toFixed(4), status, contributors.map((item) => `${normalizeHistoricalName(item.sourceName)}:${item.portion?.toFixed(4) ?? "?"}`).sort().join("|")].join("|") : null;
    const fingerprint = fingerprintPayload ? createHash("sha256").update(fingerprintPayload).digest("hex") : null;
    const issues: string[] = [];
    const warningReasons: string[] = [];
    let validation: HistoricalValidationState = "ready";
      if (!sourceProject) { validation = "blocked"; issues.push("Project is required"); }
      else if (!project) { validation = "needs_review"; issues.push(projectMatches.length ? "Multiple canonical project matches" : "No matching Falcon project; source name will be preserved"); warningReasons.push("Project not found"); }
      if (!unitNo) { validation = "blocked"; issues.push("Unit No is required"); }
      if (!bookingDate) { validation = "blocked"; issues.push("Booking Date is invalid"); }
      else if (!bookingDate.startsWith(`${sourceDefinition.year}-`) || (currentMonth && Number(bookingDate.slice(5, 7)) !== importMonthNumbers.get(currentMonth))) {
        validation = "blocked";
        issues.push(`Date Review — ${dateKind === "excel_date" || dateKind === "excel_serial" ? "stored Excel date" : "text date"} ${bookingDate} does not match the ${currentMonth ?? "unknown"} ${sourceDefinition.year} section`);
        warningReasons.push("Date Review");
      }
      if (bookingDateCorrected) {
        issues.push(`${bookingDateCorrectionReason ?? "Owner-approved Booking Date correction"}: ${sourceBookingDate || parsedBookingDate || "blank"} → ${bookingDate}`);
        warningReasons.push("Booking Date corrected");
        if (validation === "ready") validation = "needs_review";
      }
      if (nettPrice === null || nettPrice <= 0) { validation = "blocked"; issues.push("Nett Price must be greater than 0"); }
      if (falconPortion === null) { validation = "blocked"; issues.push("Falcon Portion is invalid or exceeds four decimals"); }
      if (!status) { validation = "blocked"; issues.push(statusResult.issue ?? "Legacy status requires review"); warningReasons.push("Status unresolved"); }
      if (!contributors.length) { validation = "blocked"; issues.push("At least one contributor is required"); }
      if (allocationStatus === "pending") { if (validation !== "blocked") validation = "needs_review"; issues.push("Individual contributor allocation is pending verification"); warningReasons.push("Pending Allocation"); }
      else if (contributors.some((item) => item.portion === null)) { validation = "blocked"; issues.push("Contributor percentage is invalid or exceeds four decimals"); warningReasons.push("Contributor allocation requires review"); }
      const matchedMemberIds = contributors.flatMap((item) => item.memberId ? [item.memberId] : []);
      if (new Set(matchedMemberIds).size !== matchedMemberIds.length) { validation = "blocked"; issues.push("The same Falcon member appears more than once"); }
      if (allocationStatus === "verified" && falconPortion !== null && contributors.every((item) => item.portion !== null) && Math.round(contributors.reduce((sum, item) => sum + (item.portion ?? 0), 0) * 10_000) !== Math.round(falconPortion * 10_000)) { validation = "blocked"; issues.push("Contributor portions do not exactly equal Falcon Portion"); warningReasons.push("Contributor allocation requires review"); }
      if (contributors.some((item) => item.matchState !== "matched")) { if (validation !== "blocked") validation = "needs_review"; issues.push("Unmatched contributor names will be preserved as historical identities"); warningReasons.push("Member not found"); }
      if (sourceAnomalies.length) {
        if (validation !== "blocked") validation = "needs_review";
        issues.push(...sourceAnomalies.map((item) => `${item.reason} (${item.column}: ${item.originalValue})`));
        if (sourceAnomalies.some((item) => item.reason.startsWith("Numeric Agent"))) warningReasons.push("Suspicious Agent value");
        if (sourceAnomalies.some((item) => item.reason.startsWith("Unit No"))) warningReasons.push("Unit Review");
      }
      if (sourceDefinition.year === 2026 && sourceFalconGdv === null) { validation = "blocked"; issues.push("Source Falcon GDV is required"); }
      if (sourceDefinition.year === 2026 && !currencyMatches(sourceFalconGdv, calculatedFalconGdv)) { validation = "blocked"; issues.push("Source GDV materially differs from calculated Falcon GDV"); }
      if (sourceDefinition.year === 2026 && contributors.some((item) => item.sourceNetGdv === null)) { validation = "blocked"; issues.push("Source contributor Net GDV is required"); }
      if (sourceDefinition.year === 2026 && contributors.some((item) => !currencyMatches(item.sourceNetGdv, item.calculatedGdv))) { validation = "blocked"; issues.push("Source contributor Net GDV materially differs from calculated GDV"); }
      if (isPendingAllocationSource && (sourceFalconGdv === null || !currencyMatches(sourceFalconGdv, calculatedFalconGdv))) {
        if (validation !== "blocked") validation = "needs_review";
        issues.push(sourceFalconGdv === null
          ? "Source GDV is missing or invalid; canonical Falcon GDV uses Nett Price × Falcon Portion"
          : "Source GDV differs from Nett Price × Falcon Portion; canonical Falcon GDV will be used");
        warningReasons.push("Source GDV review");
      }
      if (fingerprint && existingFingerprints.has(fingerprint)) { validation = "blocked"; issues.push("This historical source row was already imported"); }
      if (status === "sign_spa") issues.push("Historical Sign SPA: exact SPA Signed Date will remain blank");
      if (status === "cancelled") issues.push("Historical Cancelled: exact Cancel Date will remain blank");
    previewRows.push({ sourceRow, month: currentMonth ?? (columns.month >= 0 ? row[columns.month]?.text.trim() ?? "" : ""), sourceProject, projectId: project?.id ?? null, projectName: project?.project_name ?? null, unitNo, originalUnitNo, sourceBookingDate, sourceBookingDateSerial, sourceBookingDateStored, sourceBookingDateNumberFormat, bookingDate, bookingDateKind: dateKind, bookingDateCorrected, bookingDateCorrectionReason, nettPrice, falconPortion, sourceFalconGdv, calculatedFalconGdv, status, statusLabel: status ? statusLabels[status] : "Unknown", contributors, fingerprint, validation, issues, warningReasons, plannedRemark: null, allocationStatus, sourceAnomalies, collisionKind: "none" });
    if (process.env.NODE_ENV === "development") console.info("[historical-sales-preview] accepted case row", {
      worksheetRow: rowIndex + 1, caseNumber, month: currentMonth, project: sourceProject, unit: unitNo,
      bookingDate, nettPrice, detectedStatus: status ? statusLabels[status] : "Unknown", acceptedReason,
    });
    } catch (error) {
      previewRows.push({
        sourceRow: rowIndex + 1, month: columns.month >= 0 ? row[columns.month]?.text.trim() ?? "" : "",
        sourceProject, projectId: null, projectName: null, unitNo, originalUnitNo, sourceBookingDate: row[columns.bookingDate]?.text.trim() ?? "", sourceBookingDateSerial: row[columns.bookingDate]?.excelSerial ?? null, sourceBookingDateStored: "", sourceBookingDateNumberFormat: row[columns.bookingDate]?.numFmt ?? "", bookingDate: null, bookingDateKind: bookingDateKind(row[columns.bookingDate]), bookingDateCorrected: false, bookingDateCorrectionReason: null, nettPrice: null,
        falconPortion: null, sourceFalconGdv: null, calculatedFalconGdv: null, status: null,
        statusLabel: "Unknown", contributors: [], fingerprint: null, validation: "blocked",
        issues: [`Row could not be parsed: ${error instanceof Error ? error.message : "Unknown cell value"}`], warningReasons: ["Row parsing failed"], plannedRemark: "Historical Import Review — Row parsing failed", allocationStatus: "pending", sourceAnomalies: [], collisionKind: "none",
      });
    }
  }

  for (const row of previewRows) {
    const projectIdentity = row.projectId ? `id:${row.projectId}` : `source:${normalizeHistoricalName(row.sourceProject)}`;
    const units = unitPlanningState.occupiedUnits.get(projectIdentity) ?? new Set<string>();
    const normalizedOriginalUnit = normalizeSalesUnit(row.unitNo);
    const plannedUnit = getFirstUnusedHistoricalUnit(row.unitNo, units);
    if (plannedUnit !== row.unitNo) {
      row.collisionKind = unitPlanningState.existingUnitKeys.has(`${projectIdentity}|${normalizedOriginalUnit}`) ? "existing" : "workbook";
      row.unitNo = plannedUnit;
      row.warningReasons.push("Duplicate Project + Unit");
      row.issues.push(`${row.collisionKind === "existing" ? "Existing Sales" : "Workbook"} Project + Unit collision; planned historical Unit is ${plannedUnit}`);
      if (row.validation === "ready") row.validation = "needs_review";
    }
    units.add(normalizeSalesUnit(plannedUnit));
    unitPlanningState.occupiedUnits.set(projectIdentity, units);
    const uniqueWarningReasons = [...new Set(row.warningReasons)];
    row.warningReasons = uniqueWarningReasons;
    row.plannedRemark = row.allocationStatus === "pending"
      ? `⚠️ Pending Allocation${uniqueWarningReasons.filter((reason) => reason !== "Pending Allocation").length ? `; Historical Import Review — ${uniqueWarningReasons.filter((reason) => reason !== "Pending Allocation").join("; ")}` : ""}`
      : uniqueWarningReasons.length ? `Historical Import Review — ${uniqueWarningReasons.join("; ")}` : null;
  }
  const summary = { total: previewRows.length, ready: 0, needs_review: 0, blocked: 0, ignored: 0 };
  const statusDistribution = { booking: 0, submitted: 0, loan_approved: 0, sign_spa: 0, cancelled: 0 };
  for (const row of previewRows) { summary[row.validation] += 1; if (row.status) statusDistribution[row.status] += 1; }
  const included = previewRows.filter((row) => row.validation !== "ignored");
  const dateCorrectionManifest: HistoricalDateCorrectionManifestEntry[] = previewRows.flatMap((row) => {
    if (!row.bookingDateCorrected || !row.bookingDate || !row.bookingDateCorrectionReason) return [];
    return [{
      worksheet: sheetName,
      excelRow: row.sourceRow,
      monthSection: row.month,
      originalExcelSerial: row.sourceBookingDateSerial,
      originalStoredDate: row.sourceBookingDateStored,
      originalDisplayValue: row.sourceBookingDate,
      originalNumberFormat: row.sourceBookingDateNumberFormat,
      correctedBookingDate: row.bookingDate,
      correctionReason: row.bookingDateCorrectionReason,
    }];
  });
  return {
    fileName,
    sheetName,
    source: sourceDefinition.source,
    sourceYear: sourceDefinition.year,
    summary,
    statusDistribution,
    financials: {
      totalNettPrice: included.reduce((sum, row) => sum + (row.nettPrice ?? 0), 0),
      totalFalconCreditedGdv: included.reduce((sum, row) => sum + (row.calculatedFalconGdv ?? 0), 0),
    },
    diagnostics: {
      matchedProjects: previewRows.filter((row) => row.projectId !== null).length,
      sourceOnlyProjects: previewRows.filter((row) => row.projectId === null).length,
      matchedMembers: previewRows.reduce((sum, row) => sum + row.contributors.filter((item) => item.matchState === "matched").length, 0),
      unmatchedMembers: previewRows.reduce((sum, row) => sum + row.contributors.filter((item) => item.matchState !== "matched").length, 0),
      duplicateRisks: previewRows.filter((row) => row.warningReasons.includes("Duplicate Project + Unit") || row.issues.some((issue) => issue.includes("already imported"))).length,
      pendingAllocations: previewRows.filter((row) => row.allocationStatus === "pending").length,
      validationErrors: previewRows.filter((row) => row.validation === "blocked").length,
      dateReviews: previewRows.filter((row) => row.warningReasons.includes("Date Review")).length,
      numericAgentAnomalies: previewRows.reduce((sum, row) => sum + row.sourceAnomalies.filter((item) => item.reason.startsWith("Numeric Agent")).length, 0),
      unitCellAnomalies: previewRows.reduce((sum, row) => sum + row.sourceAnomalies.filter((item) => item.reason.startsWith("Unit No")).length, 0),
      sourceGdvMismatches: previewRows.filter((row) => row.warningReasons.includes("Source GDV review")).length,
      existingCaseCollisions: previewRows.filter((row) => row.collisionKind === "existing").length,
      correctedDates: dateCorrectionManifest.length,
    },
    dateCorrectionManifest,
    rows: previewRows,
  };
}

export async function buildHistoricalSalesPreviews(file: File, context: HistoricalPreviewContext) {
  const worksheets = await readWorkbook(file);
  const unitPlanningState = createHistoricalUnitPlanningState(context.existingCases);
  const previews: HistoricalPreview[] = [];
  for (const worksheet of worksheets) {
    previews.push(await buildHistoricalSalesSheetPreview(file.name, worksheet.sheetName, worksheet.rows, context, unitPlanningState));
  }
  return previews;
}

export async function buildHistoricalSalesPreview(file: File, context: HistoricalPreviewContext): Promise<HistoricalPreview> {
  const previews = await buildHistoricalSalesPreviews(file, context);
  return previews[0];
}

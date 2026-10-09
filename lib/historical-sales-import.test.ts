import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  buildHistoricalSalesPreviews,
  getHistoricalAllocationStatus,
  parseHistoricalBookingDate,
  recoverHistoricalExcelDate,
} from "./historical-sales-import";
import {
  getFirstUnusedHistoricalUnit,
  getHistoricalCorrectedDate,
  getHistoricalCorrectedUnit,
  getHistoricalContributorAllocationCorrection,
  getHistoricalMemberLookupName,
  getHistoricalProjectLookupName,
  getHistoricalStatusCorrection,
} from "./historical-sales-import-rules";

test("approved member aliases are explicit and deterministic", () => {
  assert.equal(getHistoricalMemberLookupName(" Yang Li "), "ong yang li");
  assert.equal(getHistoricalMemberLookupName("Yangli"), "ong yang li");
  assert.equal(getHistoricalMemberLookupName("Alvin Foo"), "alvin");
  assert.equal(getHistoricalMemberLookupName("Shirley Lee"), "shirley lee");
});

test("approved project aliases do not use fuzzy matching", () => {
  assert.equal(getHistoricalProjectLookupName("Aster Hill"), "aster hill residence");
  assert.equal(getHistoricalProjectLookupName("Aurum Suites"), "aurum suite");
  assert.equal(getHistoricalProjectLookupName("Residensi ZIG"), "zig residence");
  assert.equal(getHistoricalProjectLookupName("Levia Residence"), "levia residence");
});

test("only approved source rows receive date and unit corrections", () => {
  assert.equal(getHistoricalCorrectedDate(28, "2025-01-23"), "2026-01-23");
  assert.equal(getHistoricalCorrectedDate(29, "2025-01-23"), "2025-01-23");
  assert.equal(getHistoricalCorrectedDate(140, "2024-04-30", "2025_case_report"), "2025-04-30");
  assert.equal(getHistoricalCorrectedDate(139, "2024-04-30", "2025_case_report"), "2024-04-30");
  assert.equal(getHistoricalCorrectedDate(140, "2024-04-30", "2024_case_report"), "2024-04-30");
  assert.equal(getHistoricalCorrectedUnit(74, "2026-08-16"), "08-16");
  assert.equal(getHistoricalCorrectedUnit(75, "B-08-16"), "B-08-16");
});

test("only the three owner-approved blocker rows receive final corrections", () => {
  const row87 = getHistoricalContributorAllocationCorrection(87);
  assert.equal(row87?.get("nicholas yap"), 50);
  assert.equal(row87?.get("peiling"), 25);
  assert.equal(row87?.get("sim yap"), 25);

  const row207 = getHistoricalContributorAllocationCorrection(207);
  assert.equal(row207?.get("nicholas yap"), 16.67);
  assert.equal(row207?.get("ah seng"), 16.67);
  assert.equal(row207?.get("hermes lim"), 16.66);
  assert.equal(row207?.get("eric siow"), 50);

  assert.equal(getHistoricalStatusCorrection(117), "booking");
  assert.equal(getHistoricalContributorAllocationCorrection(86), null);
  assert.equal(getHistoricalContributorAllocationCorrection(208), null);
  assert.equal(getHistoricalStatusCorrection(116), null);
  assert.equal(getHistoricalStatusCorrection(118), null);
});

test("duplicate units use the first unused dotted representation", () => {
  assert.equal(getFirstUnusedHistoricalUnit("A-15-12", new Set(["a-15-12", "a-15-12."])), "A-15-12..");
  assert.equal(getFirstUnusedHistoricalUnit("B-43A-10", new Set()), "B-43A-10");
});

test("historical migration keeps manual lifecycle validation and adds snapshot identities", () => {
  const migration = readFileSync("supabase/migrations/20261007000400_add_historical_sales_import_support.sql", "utf8");
  assert.match(migration, /source_type = 'historical_2026_case_report'/);
  assert.match(migration, /status <> 'sign_spa'[\s\S]*spa_signed_date is not null[\s\S]*source_type = 'historical_2026_case_report'/);
  assert.match(migration, /status <> 'cancelled'[\s\S]*cancel_date is not null[\s\S]*source_type = 'historical_2026_case_report'/);
  assert.match(migration, /source_project_name text null/);
  assert.match(migration, /source_member_name text null/);
  assert.match(migration, /create or replace function public\.import_historical_sales_case/);
  assert.match(migration, /revoke all on function public\.import_historical_sales_case[\s\S]*from public, anon, authenticated/);
});

test("historical text dates are parsed strictly as DD/MM/YY", () => {
  assert.equal(parseHistoricalBookingDate("03/04/24"), "2024-04-03");
  assert.equal(parseHistoricalBookingDate("31/12/25"), "2025-12-31");
  assert.equal(parseHistoricalBookingDate("12/31/25"), null);
});

test("genuine Excel date cells retain their actual calendar date", () => {
  assert.equal(parseHistoricalBookingDate(new Date(Date.UTC(2025, 6, 9)), "09/07/25", "m/d/yyyy"), "2025-07-09");
});

test("unknown or mismatched contributor portions remain pending instead of being invented", () => {
  assert.equal(getHistoricalAllocationStatus(100, [null, null]), "pending");
  assert.equal(getHistoricalAllocationStatus(50, [25, null]), "pending");
  assert.equal(getHistoricalAllocationStatus(50, [25, 20]), "pending");
  assert.equal(getHistoricalAllocationStatus(50, [25, 25]), "verified");
});

test("2024/2025 pending allocation migration is traceable, idempotent, and exact on verification", () => {
  const migration = readFileSync("supabase/migrations/20261009000100_add_pending_historical_sales_allocations.sql", "utf8");
  assert.match(migration, /historical_2024_case_report/);
  assert.match(migration, /historical_2025_case_report/);
  assert.match(migration, /source_contributor_snapshot jsonb/);
  assert.match(migration, /allocation_status in \('verified', 'pending'\)/);
  assert.match(migration, /unique index[\s\S]*source_type, source_fingerprint/);
  assert.match(migration, /Pending historical allocations must not store unverified portions/);
  assert.match(migration, /Contributor allocations must exactly equal Falcon Portion/);
  assert.match(migration, /p_source_type[\s\S]*'booking'/);
  assert.match(migration, /p_source_type = 'historical_2024_case_report'[\s\S]*extract\(year from p_booking_date\)::integer <> 2024/);
  assert.match(migration, /p_source_type = 'historical_2025_case_report'[\s\S]*extract\(year from p_booking_date\)::integer <> 2025/);
});

test("cross-year Project and Unit collisions share one deterministic dotted-unit plan", async () => {
  const workbook = new ExcelJS.Workbook();
  const collisions = [
    ["QUAVER RESIDENCE", "B-22-01"],
    ["THE ATAS RESIDENCE", "A-26-02"],
    ["QUAVER RESIDENCE", "A-19-03"],
    ["AYANNA RESIDENCE", "B-40-09"],
    ["KUCHAI UPTOWN", "TC-29-02"],
  ] as const;
  for (const year of [2024, 2025] as const) {
    const sheet = workbook.addWorksheet(`${year} CASE REPORT`);
    sheet.getRow(2).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
    collisions.forEach(([project, unit], index) => {
      sheet.getRow(index + 3).values = [index + 1, "January", project, unit, `15/01/${year}`, 500_000, 100, 500_000, "Former Agent"];
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2024 2025.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const projects = [
    { id: "project-ayanna", project_name: "AYANNA RESIDENCE" },
    { id: "project-kuchai", project_name: "KUCHAI UPTOWN" },
  ];

  const previews = await buildHistoricalSalesPreviews(file, { projects, members: [], existingCases: [], fingerprints: [] });
  assert.deepEqual(previews[0].rows.map((row) => row.unitNo), collisions.map(([, unit]) => unit));
  assert.deepEqual(previews[1].rows.map((row) => row.unitNo), collisions.map(([, unit]) => `${unit}.`));
  assert.ok(previews[1].rows.every((row) => row.collisionKind === "workbook"));
  assert.ok(previews[1].rows.every((row) => row.originalUnitNo === row.unitNo.slice(0, -1)));

  const rerun = await buildHistoricalSalesPreviews(file, { projects, members: [], existingCases: [], fingerprints: [] });
  assert.deepEqual(rerun.map((preview) => preview.rows.map((row) => row.unitNo)), previews.map((preview) => preview.rows.map((row) => row.unitNo)));
});

test("existing production units and both historical years use the same occupied-unit sequence", async () => {
  const workbook = new ExcelJS.Workbook();
  for (const year of [2024, 2025] as const) {
    const sheet = workbook.addWorksheet(`${year} CASE REPORT`);
    sheet.getRow(2).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
    sheet.getRow(3).values = [1, "January", "ARRA RESIDENCE", "A-01-01", `15/01/${year}`, 500_000, 100, 500_000, "Former Agent"];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2024 2025.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const previews = await buildHistoricalSalesPreviews(file, {
    projects: [{ id: "project-arra", project_name: "ARRA RESIDENCE" }],
    members: [],
    existingCases: [{ id: "existing", project_id: "project-arra", unit_no: "A-01-01", status: "booking" }],
    fingerprints: [],
  });

  assert.deepEqual(previews.map((preview) => preview.rows[0].unitNo), ["A-01-01.", "A-01-01.."]);
  assert.deepEqual(previews.map((preview) => preview.rows[0].collisionKind), ["existing", "existing"]);
});

test("a combined 2024/2025 workbook previews both sheets as Booking with pending allocations", async () => {
  const workbook = new ExcelJS.Workbook();
  for (const [year, date] of [[2024, "03/04/24"], [2025, "09/07/25"]] as const) {
    const sheet = workbook.addWorksheet(`${year} CASE REPORT`);
    sheet.getRow(1).values = ["No Update"];
    sheet.getRow(2).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "", "", "Agent", "%", "Net GDV"];
    sheet.getRow(3).values = [1, year === 2024 ? "April" : "July", "Arra Residence", `${year}-01`, date, 500_000, 50, 250_000, "", "", "Former Agent", "", ""];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = {
    name: "2024 2025.xlsx",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => "",
  } as File;
  const previews = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });
  assert.deepEqual(previews.map((preview) => preview.sourceYear), [2024, 2025]);
  assert.deepEqual(previews.map((preview) => preview.rows[0].bookingDate), ["2024-04-03", "2025-07-09"]);
  assert.ok(previews.every((preview) => preview.rows[0].status === "booking"));
  assert.ok(previews.every((preview) => preview.rows[0].allocationStatus === "pending"));
  assert.ok(previews.every((preview) => preview.rows[0].plannedRemark?.startsWith("⚠️ Pending Allocation")));

  const fingerprints = previews.flatMap((preview) => preview.rows.map((row) => ({ source_fingerprint: row.fingerprint })));
  const duplicatePreviews = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints });
  assert.ok(duplicatePreviews.every((preview) => preview.rows[0].validation === "blocked"));
  assert.ok(duplicatePreviews.every((preview) => preview.rows[0].issues.includes("This historical source row was already imported")));
});

test("real workbook layout supports metadata, repeated monthly headers, and Agent-only columns", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2025 CASE REPORT");
  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "Falcon Group | Kingsman Realty";
  sheet.getRow(4).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent", "Agent", "Agent"];
  sheet.getRow(5).values = [1, "January", "Arra Residence", "A-01-01", "15/01/2025", 500_000, 100, 500_000, "Nicholas Yap", 14.75, "Former Agent"];
  sheet.getRow(6).values = [null, null, null, null, null, 500_000, 100, 500_000];
  sheet.getRow(8).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent", "Agent", "Agent"];
  sheet.getRow(9).values = [1, "February", "Arra Residence", "A-02-01", "18/02/2025", 600_000, 50, 300_000, "Nicholas Yap", "Former Agent"];
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2025.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const [preview] = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });

  assert.equal(preview.summary.total, 2);
  assert.deepEqual(preview.rows.map((row) => row.month), ["January", "February"]);
  assert.deepEqual(preview.rows[0].contributors.map((item) => item.sourceName), ["Nicholas Yap", "Former Agent"]);
  assert.deepEqual(preview.rows[0].sourceAnomalies, [{ column: "J", originalValue: "14.75", reason: "Numeric Agent cell was not treated as a contributor name" }]);
  assert.equal(preview.diagnostics.numericAgentAnomalies, 1);
});

test("approved 2024/2025 Excel date inversions are recovered with an audit snapshot", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2024 CASE REPORT");
  sheet.getRow(3).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
  sheet.getRow(4).values = [1, "January", "Arra Residence", "A-01-01", new Date(Date.UTC(2024, 4, 1)), 500_000, 100, 500_000, "Former Agent"];
  sheet.getCell("E4").numFmt = "m/d/yyyy";
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2024.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const [preview] = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });

  assert.equal(preview.rows[0].bookingDate, "2024-01-05");
  assert.equal(preview.rows[0].bookingDateKind, "excel_date");
  assert.equal(preview.rows[0].validation, "needs_review");
  assert.equal(preview.rows[0].sourceBookingDateSerial, 45413);
  assert.equal(preview.rows[0].sourceBookingDateStored, "2024-05-01");
  assert.equal(preview.rows[0].sourceBookingDate, "5/1/2024");
  assert.equal(preview.rows[0].sourceBookingDateNumberFormat, "m/d/yyyy");
  assert.equal(preview.rows[0].bookingDateCorrectionReason, "Approved DD/MM recovery from a locale-inverted Excel date");
  assert.equal(preview.diagnostics.correctedDates, 1);
  assert.equal(preview.diagnostics.dateReviews, 0);
  assert.deepEqual(preview.dateCorrectionManifest, [{
    worksheet: "2024 CASE REPORT",
    excelRow: 4,
    monthSection: "January",
    originalExcelSerial: 45413,
    originalStoredDate: "2024-05-01",
    originalDisplayValue: "5/1/2024",
    originalNumberFormat: "m/d/yyyy",
    correctedBookingDate: "2024-01-05",
    correctionReason: "Approved DD/MM recovery from a locale-inverted Excel date",
  }]);
});

test("safe date recovery requires every approved worksheet, year, format, and month condition", () => {
  const recoverable = {
    source: "2025_case_report" as const,
    sourceYear: 2025,
    monthSection: "August",
    value: new Date(Date.UTC(2025, 0, 8)),
    numberFormat: "m/d/yyyy",
    excelSerial: 45665,
  };
  assert.equal(recoverHistoricalExcelDate(recoverable)?.correctedBookingDate, "2025-08-01");
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, source: "2026_case_report" }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, sourceYear: 2024 }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, monthSection: "January" }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, monthSection: "July" }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, value: "01/08/2025" }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, numberFormat: "@" }), null);
  assert.equal(recoverHistoricalExcelDate({ ...recoverable, value: new Date(Number.NaN) }), null);
});

test("the owner-approved 2025 row 140 date is corrected while preserving its source value", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2025 CASE REPORT");
  sheet.getRow(4).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
  sheet.getRow(140).values = [48, "April", "Aurum Suite", "A-26-03A", "30/04/2024", 517_274.6, 100, 517_274.6, "Former Agent"];
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2025.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const [preview] = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });

  assert.equal(preview.rows[0].sourceRow, 140);
  assert.equal(preview.rows[0].sourceBookingDate, "30/04/2024");
  assert.equal(preview.rows[0].bookingDate, "2025-04-30");
  assert.equal(preview.rows[0].bookingDateCorrected, true);
  assert.equal(preview.rows[0].bookingDateCorrectionReason, "User-confirmed source date correction");
  assert.equal(preview.rows[0].validation, "needs_review");
  assert.ok(preview.rows[0].issues.some((issue) => issue.includes("User-confirmed source date correction")));
  assert.deepEqual(preview.dateCorrectionManifest, [{
    worksheet: "2025 CASE REPORT",
    excelRow: 140,
    monthSection: "April",
    originalExcelSerial: null,
    originalStoredDate: "2024-04-30",
    originalDisplayValue: "30/04/2024",
    originalNumberFormat: "",
    correctedBookingDate: "2025-04-30",
    correctionReason: "User-confirmed source date correction",
  }]);
});

test("source GDV discrepancies remain reviewable and use canonical case-level GDV", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2024 CASE REPORT");
  sheet.getRow(2).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
  sheet.getRow(3).values = [1, "April", "Arra Residence", "A-01-01", "20/04/2024", 520_540, 50, 520_540, "Former Agent"];
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2024.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const [preview] = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });

  assert.equal(preview.rows[0].sourceFalconGdv, 520_540);
  assert.equal(preview.rows[0].calculatedFalconGdv, 260_270);
  assert.equal(preview.rows[0].validation, "needs_review");
  assert.equal(preview.diagnostics.sourceGdvMismatches, 1);
});

test("date-formatted Unit cells preserve their displayed identifier and require review", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2025 CASE REPORT");
  sheet.getRow(2).values = ["No", "Month", "Project", "Unit No", "Booking Date", "Nett Price", "Portion", "GDV", "Agent"];
  sheet.getCell("A3").value = 1;
  sheet.getCell("B3").value = "March";
  sheet.getCell("C3").value = "Arra Residence";
  sheet.getCell("D3").value = new Date(Date.UTC(2025, 8, 5));
  sheet.getCell("D3").numFmt = "mm-dd";
  sheet.getCell("E3").value = "15/03/2025";
  sheet.getCell("F3").value = 500_000;
  sheet.getCell("G3").value = 100;
  sheet.getCell("H3").value = 500_000;
  sheet.getCell("I3").value = "Former Agent";
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const file = { name: "2025.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => "" } as File;
  const [preview] = await buildHistoricalSalesPreviews(file, { projects: [], members: [], existingCases: [], fingerprints: [] });

  assert.equal(preview.rows[0].originalUnitNo, "09-05");
  assert.ok(preview.rows[0].warningReasons.includes("Unit Review"));
  assert.equal(preview.diagnostics.unitCellAnomalies, 1);
});

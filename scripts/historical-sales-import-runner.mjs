import nextEnv from "@next/env";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { File } from "node:buffer";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { buildHistoricalSalesPreviews } from "../lib/historical-sales-import.ts";
import {
  assertBaseline,
  assertNoUnitCollisions,
  buildResumePlan,
  calculateFalconGdvExactly,
  canonicalJson,
  createFrozenImportEnvelope,
  normalizeImportIdentity,
  runImportPlan,
  selectImportYear,
  sha256,
  sumMoneyExactly,
  verifyFrozenImportEnvelope,
} from "../lib/historical-sales-import-runner.ts";

nextEnv.loadEnvConfig(process.cwd());

const EXPECTED_WORKBOOK_SHA256 = "b88c0fedaf0dcb2e8691996bc530fa43d221edd217ddf1ec557e3d9a42d8cbbe";
const EXPECTED_COMMIT = "40676798a60d1e2787fdae47b9c298da39d573d2";
const WORKBOOK_PATH = "import-data/2024 2025.xlsx";
const DATE_MANIFEST_PATH = "import-data/2024-2025-date-correction-manifest.json";
const DEFAULT_MANIFEST_PATH = "import-data/2024-2025-historical-sales-import-manifest.json";
const DEFAULT_REPORT_PATH = "import-data/2024-2025-historical-sales-import-report.json";
const IMPORT_SOURCE_TYPES = new Set(["historical_2024_case_report", "historical_2025_case_report"]);
const PAGE_SIZE = 1000;

function parseArguments(argv) {
  const options = { freeze: false, execute: false, manifestPath: DEFAULT_MANIFEST_PATH, reportPath: DEFAULT_REPORT_PATH };
  for (const argument of argv) {
    if (argument === "--freeze") options.freeze = true;
    else if (argument === "--execute") options.execute = true;
    else if (argument.startsWith("--manifest=")) options.manifestPath = argument.slice("--manifest=".length);
    else if (argument.startsWith("--report=")) options.reportPath = argument.slice("--report=".length);
    else if (argument.startsWith("--confirm-project-ref=")) options.confirmProjectRef = argument.slice("--confirm-project-ref=".length);
    else if (argument.startsWith("--confirm-manifest-sha=")) options.confirmManifestSha = argument.slice("--confirm-manifest-sha=".length);
    else if (argument.startsWith("--actor-id=")) options.actorId = argument.slice("--actor-id=".length);
    else if (argument.startsWith("--year=")) {
      const year = Number(argument.slice("--year=".length));
      if (year !== 2024 && year !== 2025) throw new Error("--year must be 2024 or 2025");
      options.year = year;
    }
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.freeze && options.execute) throw new Error("--freeze and --execute cannot be used together");
  return options;
}

function assertImportDataPath(filePath) {
  const root = path.resolve("import-data");
  const resolved = path.resolve(filePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Manifests and reports must remain under ignored import-data/");
  return resolved;
}

function requireEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role credentials must be supplied through the local environment");
  let projectRef;
  try {
    projectRef = new URL(url).hostname.split(".")[0];
  } catch {
    throw new Error("Configured Supabase URL is invalid");
  }
  return {
    projectRef,
    client: createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

async function fetchAll(client, table, columns, configure = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await configure(client.from(table).select(columns).range(from, from + PAGE_SIZE - 1));
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function sortedRows(rows, keys) {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const comparison = String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
      if (comparison) return comparison;
    }
    return 0;
  });
}

function hashRows(rows, keys) {
  return sha256(canonicalJson(sortedRows(rows, keys)));
}

async function readProductionState(client) {
  const [projects, members, sales, contributors] = await Promise.all([
    fetchAll(client, "projects", "id, project_name", (query) => query.eq("is_deleted", false)),
    fetchAll(client, "users", "id, full_name, display_name, member_code, position", (query) => query.eq("is_deleted", false)),
    fetchAll(client, "sales_cases", "id, project_id, source_type, source_project_name, source_row, source_fingerprint, allocation_status, source_contributor_snapshot, unit_no, booking_date, nett_price, falcon_portion, status, spa_signed_date, cancel_date, remark, created_by, updated_by, is_deleted", (query) => query.eq("is_deleted", false)),
    fetchAll(client, "sales_case_contributors", "sales_case_id, member_id, source_member_name, portion"),
  ]);
  return { projects, members, sales, contributors };
}

function baselineFromState(state) {
  const sales = state.sales.filter((row) => !IMPORT_SOURCE_TYPES.has(row.source_type));
  const salesIds = new Set(sales.map((row) => row.id));
  const contributors = state.contributors.filter((row) => salesIds.has(row.sales_case_id));
  const historical2026 = sales.filter((row) => row.source_type === "historical_2026_case_report");
  return {
    salesCount: sales.length,
    contributorCount: contributors.length,
    existingSalesSha256: hashRows(sales, ["id"]),
    existingContributorsSha256: hashRows(contributors, ["sales_case_id", "member_id", "source_member_name"]),
    existing2026SalesSha256: hashRows(historical2026, ["id"]),
  };
}

function currentCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

async function workbookSha256() {
  return sha256(await readFile(WORKBOOK_PATH));
}

function assertApprovedPreview(previews, state, dateManifest) {
  const rows = previews.flatMap((preview) => preview.rows);
  const manifestCorrections = previews.flatMap((preview) => preview.dateCorrectionManifest);
  const fingerprints = rows.map((row) => row.fingerprint).filter(Boolean);
  const occupied = state.sales.map((row) => normalizeImportIdentity(row.project_id, row.source_project_name, row.unit_no));
  const plannedIdentities = rows.map((row) => normalizeImportIdentity(row.projectId, row.sourceProject, row.unitNo));
  const numericAgentAnomalies = rows.reduce((count, row) => count + row.sourceAnomalies.filter((item) => item.reason.startsWith("Numeric Agent")).length, 0);
  const nettPrice = sumMoneyExactly(rows.map((row) => String(row.nettPrice ?? 0)));
  const falconGdv = sumMoneyExactly(rows.map((row) => calculateFalconGdvExactly(
    String(row.nettPrice ?? 0),
    String(row.falconPortion ?? 0),
  )));
  const failures = [
    [previews.find((item) => item.sourceYear === 2024)?.summary.total === 392, "2024 record count"],
    [previews.find((item) => item.sourceYear === 2025)?.summary.total === 535, "2025 record count"],
    [rows.length === 927, "combined record count"],
    [rows.every((row) => row.validation !== "blocked" && row.validation !== "ignored"), "zero blocked/ignored rows"],
    [rows.every((row) => row.status === "booking"), "Booking status"],
    [rows.every((row) => row.allocationStatus === "pending"), "pending allocation status"],
    [rows.every((row) => row.contributors.length > 0 && row.contributors.every((item) => item.portion === null)), "NULL unverified portions"],
    [fingerprints.length === 927 && new Set(fingerprints).size === 927, "unique fingerprints"],
    [new Set(plannedIdentities).size === 927, "unique planned Project + Unit identities"],
    [plannedIdentities.every((identity) => !new Set(occupied).has(identity)), "zero production identity collisions"],
    [manifestCorrections.length === 305, "date correction count"],
    [JSON.stringify(manifestCorrections) === JSON.stringify(dateManifest.corrections), "date correction manifest"],
    [numericAgentAnomalies === 31, "numeric Agent anomaly count"],
    [nettPrice === "619536435.92", "Nett Price total"],
    [falconGdv === "534148128.46", "canonical Falcon GDV total"],
  ].filter(([passed]) => !passed).map(([, label]) => label);
  if (failures.length) throw new Error(`Approved preview assertion failed: ${failures.join(", ")}`);
  return { rows, nettPrice, falconGdv, numericAgentAnomalies, manifestCorrections };
}

function frozenRecord(preview, row) {
  if (!row.fingerprint || !row.bookingDate || row.nettPrice === null || row.falconPortion === null || row.calculatedFalconGdv === null) {
    throw new Error(`${preview.sheetName} row ${row.sourceRow} is not importable`);
  }
  return {
    sourceType: preview.sourceYear === 2024 ? "historical_2024_case_report" : "historical_2025_case_report",
    worksheet: preview.sheetName,
    excelRow: row.sourceRow,
    fingerprint: row.fingerprint,
    projectId: row.projectId,
    sourceProjectName: row.sourceProject,
    originalUnitNo: row.originalUnitNo,
    unitNo: row.unitNo,
    bookingDate: row.bookingDate,
    nettPrice: String(row.nettPrice),
    falconPortion: String(row.falconPortion),
    status: "booking",
    allocationStatus: "pending",
    remark: row.plannedRemark ?? "⚠️ Pending Allocation",
    dateAudit: {
      corrected: row.bookingDateCorrected,
      reason: row.bookingDateCorrectionReason,
      originalExcelSerial: row.sourceBookingDateSerial,
      originalStoredDate: row.sourceBookingDateStored,
      originalDisplayValue: row.sourceBookingDate,
      originalNumberFormat: row.sourceBookingDateNumberFormat,
    },
    sourceContributorSnapshot: row.contributors.map((item) => ({
      sourceName: item.sourceName,
      sourceNetGdv: item.sourceNetGdv,
      matchedMemberId: item.memberId,
      matchedMemberName: item.memberName,
      matchState: item.matchState,
    })),
    contributors: row.contributors.map((item) => ({ sourceName: item.sourceName, memberId: item.memberId, portion: null })),
    sourceFalconGdv: row.sourceFalconGdv,
    canonicalFalconGdv: row.calculatedFalconGdv,
    validation: row.validation,
    issues: row.issues,
    warningReasons: row.warningReasons,
    sourceAnomalies: row.sourceAnomalies,
  };
}

async function freezeManifest(client, manifestPath) {
  if (currentCommit() !== EXPECTED_COMMIT) throw new Error(`Freeze must run from approved commit ${EXPECTED_COMMIT}`);
  const sourceSha256 = await workbookSha256();
  if (sourceSha256 !== EXPECTED_WORKBOOK_SHA256) throw new Error("Source workbook SHA-256 does not match the approved workbook");
  const [state, dateManifest] = await Promise.all([
    readProductionState(client),
    readFile(DATE_MANIFEST_PATH, "utf8").then(JSON.parse),
  ]);
  const baseline = baselineFromState(state);
  if (baseline.salesCount !== 455 || baseline.contributorCount !== 840) throw new Error("Production baseline is not 455 Sales and 840 contributors");
  if (state.sales.filter((row) => row.source_type === "historical_2026_case_report").length !== 337) throw new Error("Production Historical 2026 count is not 337");
  if (state.sales.some((row) => IMPORT_SOURCE_TYPES.has(row.source_type))) throw new Error("Production already contains 2024/2025 historical Sales");
  const file = new File([await readFile(WORKBOOK_PATH)], "2024 2025.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const previews = await buildHistoricalSalesPreviews(file, {
    projects: state.projects,
    members: state.members,
    existingCases: state.sales.map((row) => ({ id: row.id, project_id: row.project_id, source_project_name: row.source_project_name, unit_no: row.unit_no, status: row.status })),
    fingerprints: state.sales.map((row) => ({ source_fingerprint: row.source_fingerprint })),
  });
  const approved = assertApprovedPreview(previews, state, dateManifest);
  const records = previews.flatMap((preview) => preview.rows.map((row) => frozenRecord(preview, row)));
  const payload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    sourceWorkbook: { fileName: "2024 2025.xlsx", sha256: sourceSha256 },
    parserCommit: EXPECTED_COMMIT,
    baseline,
    approvedTotals: {
      recordCount: records.length,
      nettPrice: approved.nettPrice,
      canonicalFalconGdv: approved.falconGdv,
      correctedDates: approved.manifestCorrections.length,
      numericAgentAnomalies: approved.numericAgentAnomalies,
    },
    records,
  };
  const envelope = createFrozenImportEnvelope(payload);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const handle = await open(manifestPath, "wx", 0o400);
  try { await handle.writeFile(`${JSON.stringify(envelope, null, 2)}\n`); } finally { await handle.close(); }
  await chmod(manifestPath, 0o400);
  return envelope;
}

async function loadManifest(manifestPath) {
  const envelope = JSON.parse(await readFile(manifestPath, "utf8"));
  verifyFrozenImportEnvelope(envelope);
  if (envelope.payload.schemaVersion !== 1 || envelope.payload.parserCommit !== EXPECTED_COMMIT) throw new Error("Frozen manifest version or parser commit is not approved");
  if (envelope.payload.sourceWorkbook.sha256 !== EXPECTED_WORKBOOK_SHA256) throw new Error("Frozen manifest references an unapproved workbook");
  return envelope;
}

function activeImportRows(state) {
  return state.sales.filter((row) => IMPORT_SOURCE_TYPES.has(row.source_type));
}

function assertCompletedContributors(state, manifest, completedRows) {
  const planned = new Map(manifest.payload.records.map((record) => [record.fingerprint, record]));
  const completedIds = new Map(completedRows.map((row) => [row.id, row.source_fingerprint]));
  const actualByFingerprint = new Map();
  for (const contributor of state.contributors) {
    const fingerprint = completedIds.get(contributor.sales_case_id);
    if (!fingerprint) continue;
    const list = actualByFingerprint.get(fingerprint) ?? [];
    list.push(contributor);
    actualByFingerprint.set(fingerprint, list);
  }
  for (const row of completedRows) {
    const record = planned.get(row.source_fingerprint);
    const contributors = actualByFingerprint.get(row.source_fingerprint) ?? [];
    const expected = record?.contributors
      .map((item) => ({ memberId: item.memberId, sourceName: item.sourceName, portion: item.portion }))
      .sort((left, right) => `${left.sourceName}|${left.memberId ?? ""}`.localeCompare(`${right.sourceName}|${right.memberId ?? ""}`));
    const actual = contributors
      .map((item) => ({ memberId: item.member_id, sourceName: item.source_member_name, portion: item.portion }))
      .sort((left, right) => `${left.sourceName}|${left.memberId ?? ""}`.localeCompare(`${right.sourceName}|${right.memberId ?? ""}`));
    if (!record || canonicalJson(actual) !== canonicalJson(expected) || contributors.some((item) => item.portion !== null)) {
      throw new Error(`Imported contributor reconciliation failed: ${row.source_fingerprint}`);
    }
  }
}

function reconcileState(state, envelope) {
  const baseline = baselineFromState(state);
  assertBaseline(baseline, envelope.payload.baseline);
  const imported = activeImportRows(state);
  const plan = buildResumePlan(envelope.payload.records, imported);
  const expectedSalesCount = envelope.payload.baseline.salesCount + plan.completed.length;
  if (state.sales.length !== expectedSalesCount) throw new Error(`Production Sales count is ${state.sales.length}; expected ${expectedSalesCount} for the current checkpoint`);
  assertCompletedContributors(state, envelope, imported);
  const completedFingerprints = new Set(plan.completed.map((record) => record.fingerprint));
  const baselineOccupied = state.sales
    .filter((row) => !IMPORT_SOURCE_TYPES.has(row.source_type))
    .map((row) => normalizeImportIdentity(row.project_id, row.source_project_name, row.unit_no));
  const completedOccupied = plan.completed.map((row) => normalizeImportIdentity(row.projectId, row.sourceProjectName, row.unitNo));
  const pending = envelope.payload.records.filter((record) => !completedFingerprints.has(record.fingerprint));
  assertNoUnitCollisions(pending, [...baselineOccupied, ...completedOccupied]);
  return { imported, plan, expectedSalesCount };
}

async function invokeImport(client, record, actorId) {
  const { data: existing, error: lookupError } = await client.from("sales_cases")
    .select("id, project_id, source_type, source_project_name, source_row, source_fingerprint, allocation_status, unit_no, booking_date, nett_price, falcon_portion, status")
    .eq("source_type", record.sourceType).eq("source_fingerprint", record.fingerprint).eq("is_deleted", false).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) throw new Error(`Fingerprint appeared after reconciliation; rerun dry-run before resuming: ${record.fingerprint}`);
  const { data, error } = await client.rpc("import_historical_sales_case_v2", {
    p_source_type: record.sourceType,
    p_project_id: record.projectId,
    p_source_project_name: record.sourceProjectName,
    p_source_row: record.excelRow,
    p_source_fingerprint: record.fingerprint,
    p_unit_no: record.unitNo,
    p_booking_date: record.bookingDate,
    p_nett_price: record.nettPrice,
    p_falcon_portion: record.falconPortion,
    p_allocation_status: "pending",
    p_remark: record.remark,
    p_source_contributor_snapshot: record.sourceContributorSnapshot,
    p_contributors: record.contributors,
    p_actor: actorId,
  });
  if (error) throw error;
  return data;
}

async function writeReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}

function reportFor(mode, envelope, reconciliation, extra = {}) {
  const completed2024 = reconciliation.plan.completed.filter((record) => record.sourceType === "historical_2024_case_report").length;
  const completed2025 = reconciliation.plan.completed.filter((record) => record.sourceType === "historical_2025_case_report").length;
  const pendingRecords = [...reconciliation.plan.pending2024, ...reconciliation.plan.pending2025];
  return {
    generatedAt: new Date().toISOString(),
    mode,
    manifestSha256: envelope.payloadSha256,
    approvedTotals: envelope.payload.approvedTotals,
    production: {
      baselineSales: envelope.payload.baseline.salesCount,
      completed2024,
      completed2025,
      pending2024: reconciliation.plan.pending2024.length,
      pending2025: reconciliation.plan.pending2025.length,
      currentSales: reconciliation.expectedSalesCount,
      expectedAfter2024: 847,
      expectedAfter2025: 1382,
    },
    fingerprintReconciliation: {
      manifest: envelope.payload.records.length,
      unique: new Set(envelope.payload.records.map((record) => record.fingerprint)).size,
      completed: reconciliation.plan.completed.length,
      pending: pendingRecords.length,
      duplicateOrUnexpected: 0,
    },
    financialReconciliation: {
      approvedNettPrice: envelope.payload.approvedTotals.nettPrice,
      approvedCanonicalFalconGdv: envelope.payload.approvedTotals.canonicalFalconGdv,
      completedNettPrice: sumMoneyExactly(reconciliation.plan.completed.map((record) => record.nettPrice)),
      completedCanonicalFalconGdv: sumMoneyExactly(reconciliation.plan.completed.map((record) => calculateFalconGdvExactly(record.nettPrice, record.falconPortion))),
      pendingNettPrice: sumMoneyExactly(pendingRecords.map((record) => record.nettPrice)),
      pendingCanonicalFalconGdv: sumMoneyExactly(pendingRecords.map((record) => calculateFalconGdvExactly(record.nettPrice, record.falconPortion))),
    },
    allocationReconciliation: {
      expectedStatus: "booking",
      expectedAllocationStatus: "pending",
      unverifiedPortions: "NULL",
      completedRowsReconciled: reconciliation.plan.completed.length,
    },
    unitIdentityReconciliation: {
      manifestUniquePlannedIdentities: new Set(envelope.payload.records.map((record) => normalizeImportIdentity(record.projectId, record.sourceProjectName, record.unitNo))).size,
      productionCollisionsAfterPlanning: 0,
    },
    failedRows: [],
    skippedRows: reconciliation.plan.completed.map((record) => ({ worksheet: record.worksheet, excelRow: record.excelRow, fingerprint: record.fingerprint, reason: "Already imported and reconciled" })),
    resume: "Rerun without --execute for reconciliation. To resume writes, repeat the fully confirmed --execute command; reconciled fingerprints are skipped and no failed write is retried automatically.",
    ...extra,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestPath = assertImportDataPath(options.manifestPath);
  const reportPath = assertImportDataPath(options.reportPath);
  const { client, projectRef } = requireEnvironment();
  if (options.freeze) {
    const envelope = await freezeManifest(client, manifestPath);
    console.log(JSON.stringify({ mode: "freeze", records: envelope.payload.records.length, manifestSha256: envelope.payloadSha256, manifestPath: path.relative(process.cwd(), manifestPath) }, null, 2));
    return;
  }
  const envelope = await loadManifest(manifestPath);
  if (await workbookSha256() !== envelope.payload.sourceWorkbook.sha256) throw new Error("Current source workbook no longer matches the frozen manifest");
  let state = await readProductionState(client);
  let reconciliation = reconcileState(state, envelope);
  if (!options.execute) {
    const report = reportFor("dry-run", envelope, reconciliation, { writeRpcCalls: 0, goForExecution: reconciliation.plan.pending2024.length + reconciliation.plan.pending2025.length > 0 });
    await writeReport(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (options.confirmProjectRef !== projectRef) throw new Error("Production project confirmation does not match the configured Supabase project");
  if (options.confirmManifestSha !== envelope.payloadSha256) throw new Error("Manifest checksum confirmation does not match");
  if (!options.actorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.actorId)) throw new Error("--actor-id must contain the approved production actor UUID");
  if (!options.year) throw new Error("--execute requires an explicit --year=2024 or --year=2025 safety gate");
  const attempted = [];
  let currentRecord = null;
  try {
    const selectedRecords = selectImportYear(reconciliation.plan, options.year);
    await runImportPlan({ records: selectedRecords, execute: true, invoke: async (record) => {
      currentRecord = record;
      const id = await invokeImport(client, record, options.actorId);
      attempted.push({ worksheet: record.worksheet, excelRow: record.excelRow, fingerprint: record.fingerprint, id });
      currentRecord = null;
      return id;
    } });
    state = await readProductionState(client);
    reconciliation = reconcileState(state, envelope);
    if (options.year === 2024) {
      if (reconciliation.plan.pending2024.length || reconciliation.plan.completed.some((record) => record.sourceType === "historical_2025_case_report") || state.sales.length !== 847) {
        throw new Error("2024-only checkpoint reconciliation did not reach exactly 847 Sales with zero 2025 imports");
      }
    } else if (reconciliation.plan.pending2024.length || reconciliation.plan.pending2025.length || state.sales.length !== 1382) {
      throw new Error("Final 2025 import reconciliation did not reach the approved checkpoint");
    }
    const report = reportFor("execute", envelope, reconciliation, { executionYear: options.year, importedThisRun: attempted.length, executedRows: attempted });
    await writeReport(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const failed = error instanceof Error ? error.message : String(error);
    const report = reportFor("execute-failed", envelope, reconciliation, {
      importedBeforeStop: attempted.length,
      executedRows: attempted,
      failedRows: [{ worksheet: currentRecord?.worksheet ?? null, excelRow: currentRecord?.excelRow ?? null, fingerprint: currentRecord?.fingerprint ?? null, reason: failed }],
    });
    await writeReport(reportPath, report);
    throw error;
  }
}

main().catch((error) => {
  console.error(`Historical Sales runner stopped: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

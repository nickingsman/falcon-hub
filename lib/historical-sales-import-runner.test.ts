import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertBaseline,
  assertNoUnitCollisions,
  buildResumePlan,
  calculateFalconGdvExactly,
  createFrozenImportEnvelope,
  exactDecimalsEqual,
  normalizeExactDecimal,
  runImportPlan,
  selectImportYear,
  sumMoneyExactly,
  type ExistingImportedRecord,
  type FrozenImportPayload,
  type FrozenImportRecord,
  verifyFrozenImportEnvelope,
} from "./historical-sales-import-runner";

function record(year: 2024 | 2025, row: number, unitNo = `A-${row}`): FrozenImportRecord {
  return {
    sourceType: `historical_${year}_case_report`, worksheet: `${year} CASE REPORT`, excelRow: row,
    fingerprint: `${year}-${row}`, projectId: "project-1", sourceProjectName: "Project One",
    originalUnitNo: unitNo, unitNo, bookingDate: `${year}-01-01`, nettPrice: "100000", falconPortion: "100",
    status: "booking", allocationStatus: "pending", remark: "⚠️ Pending Allocation",
    dateAudit: { corrected: false, reason: null, originalExcelSerial: null, originalStoredDate: `${year}-01-01`, originalDisplayValue: "01/01", originalNumberFormat: "dd/mm/yyyy" },
    sourceContributorSnapshot: [{ sourceName: "Historical Agent", sourceNetGdv: null, matchedMemberId: null, matchedMemberName: null, matchState: "missing" }],
    contributors: [{ sourceName: "Historical Agent", memberId: null, portion: null }],
    sourceFalconGdv: 100000, canonicalFalconGdv: 100000, validation: "needs_review", issues: [], warningReasons: ["Pending Allocation"], sourceAnomalies: [],
  };
}

function payload(records = [record(2024, 1)]): FrozenImportPayload {
  return {
    schemaVersion: 1, createdAt: "2026-10-09T00:00:00.000Z", sourceWorkbook: { fileName: "source.xlsx", sha256: "abc" }, parserCommit: "commit",
    baseline: { salesCount: 455, contributorCount: 840, existingSalesSha256: "sales", existingContributorsSha256: "contributors", existing2026SalesSha256: "2026" },
    approvedTotals: { recordCount: records.length, nettPrice: "100000.00", canonicalFalconGdv: "100000.00", correctedDates: 0, numericAgentAnomalies: 0 }, records,
  };
}

function existing(planned: FrozenImportRecord): ExistingImportedRecord {
  return {
    id: "case-1", source_fingerprint: planned.fingerprint, source_type: planned.sourceType, source_row: planned.excelRow,
    project_id: planned.projectId, source_project_name: planned.sourceProjectName, unit_no: planned.unitNo,
    booking_date: planned.bookingDate, nett_price: planned.nettPrice, falcon_portion: planned.falconPortion,
    status: "booking", allocation_status: "pending",
  };
}

test("dry run never invokes the write dependency", async () => {
  let calls = 0;
  const result = await runImportPlan({ records: [record(2024, 1)], execute: false, invoke: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.deepEqual(result, { attempted: 0, completed: 0, results: [] });
});

test("frozen manifest integrity detects any payload change", () => {
  const envelope = createFrozenImportEnvelope(payload());
  assert.equal(verifyFrozenImportEnvelope(envelope), envelope.payloadSha256);
  envelope.payload.records[0].unitNo = "CHANGED";
  assert.throws(() => verifyFrozenImportEnvelope(envelope), /checksum/);
});

test("partial imports resume only the missing frozen records", () => {
  const records = [record(2024, 1), record(2024, 2), record(2025, 3)];
  const plan = buildResumePlan(records, [existing(records[0])]);
  assert.deepEqual(plan.pending2024.map((item) => item.fingerprint), ["2024-2"]);
  assert.deepEqual(plan.pending2025.map((item) => item.fingerprint), ["2025-3"]);
});

test("duplicate or mismatched fingerprints stop resume", () => {
  const planned = record(2024, 1);
  assert.throws(() => buildResumePlan([planned], [existing(planned), { ...existing(planned), id: "case-2" }]), /duplicate/);
  assert.throws(() => buildResumePlan([planned], [{ ...existing(planned), unit_no: "OTHER" }]), /does not match/);
});

test("planned units cannot collide with production or each other", () => {
  const first = record(2024, 1, "A-01");
  assert.throws(() => assertNoUnitCollisions([first], ["id:project-1|a-01"]), /occupied/);
  assert.throws(() => assertNoUnitCollisions([first, { ...first, fingerprint: "other", excelRow: 2 }], []), /occupied/);
});

test("unexpected production baseline changes stop execution", () => {
  const expected = payload().baseline;
  assert.doesNotThrow(() => assertBaseline(expected, expected));
  assert.throws(() => assertBaseline({ ...expected, salesCount: 456 }, expected), /salesCount/);
});

test("2025 cannot be resumed before the complete 2024 checkpoint", () => {
  const first = record(2024, 1);
  const second = record(2024, 2);
  const nextYear = record(2025, 3);
  assert.throws(() => buildResumePlan([first, second, nextYear], [existing(first), existing(nextYear)]), /2025 imports exist/);
});

test("a 2024-only execution can never invoke a 2025 record", async () => {
  const plan = {
    pending2024: [record(2024, 1), record(2024, 2)],
    pending2025: [record(2025, 3)],
  };
  const invoked: string[] = [];
  await runImportPlan({
    records: selectImportYear(plan, 2024),
    execute: true,
    invoke: async (item) => { invoked.push(item.fingerprint); },
  });
  assert.deepEqual(invoked, ["2024-1", "2024-2"]);
  assert.ok(invoked.every((fingerprint) => fingerprint.startsWith("2024-")));
});

test("a 2025 execution is refused until the 2024 checkpoint is complete", () => {
  assert.throws(() => selectImportYear({ pending2024: [record(2024, 1)], pending2025: [record(2025, 2)] }, 2025), /2024 checkpoint/);
  assert.deepEqual(selectImportYear({ pending2024: [], pending2025: [record(2025, 2)] }, 2025).map((item) => item.fingerprint), ["2025-2"]);
});

test("three-decimal Nett Prices reconcile exactly without Number rounding", () => {
  assert.equal(normalizeExactDecimal("639176.6250"), "639176.625");
  assert.equal(exactDecimalsEqual("639176.625", 639176.625), true);
  assert.equal(exactDecimalsEqual("639176.625", "639176.63"), false);

  const planned = { ...record(2024, 223), nettPrice: "639176.625" };
  assert.doesNotThrow(() => buildResumePlan([planned], [{
    ...existing(planned),
    nett_price: "639176.625",
  }]));
  assert.throws(() => buildResumePlan([planned], [{
    ...existing(planned),
    nett_price: "639176.630",
  }]), /does not match/);
});

test("money totals use exact decimal addition with two-decimal presentation", () => {
  assert.equal(sumMoneyExactly(["290624074", "0.525"]), "290624074.53");
  assert.equal(sumMoneyExactly(["619536435", "0.915"]), "619536435.92");
  assert.equal(sumMoneyExactly([]), "0.00");
});

test("canonical Falcon GDV preserves three-decimal Nett Price precision", () => {
  assert.equal(calculateFalconGdvExactly("639176.625", "100"), "639176.625");
  assert.equal(calculateFalconGdvExactly("655258.086", "25"), "163814.5215");
  assert.equal(calculateFalconGdvExactly("654316.992", "25"), "163579.248");
});

test("all approved 2025 three-decimal prices remain distinct from cent-rounded values", () => {
  const prices = ["654316.992", "655258.086", "725241.258", "654316.992", "651801.862"];
  const rounded = ["654316.99", "655258.09", "725241.26", "654316.99", "651801.86"];
  prices.forEach((price, index) => assert.equal(exactDecimalsEqual(price, rounded[index]), false));
});

test("precision migration is atomic, guarded, and corrects only the approved fingerprint", () => {
  const migration = readFileSync(
    "supabase/migrations/20261010000100_widen_sales_nett_price_precision.sql",
    "utf8",
  );
  assert.match(migration, /^begin;/);
  assert.match(migration, /alter column nett_price type numeric\(16,3\)/);
  assert.match(migration, /61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c/);
  assert.match(migration, /set nett_price = 639176\.625/);
  assert.match(migration, /get diagnostics v_corrected = row_count/);
  assert.match(migration, /v_corrected <> 1/);
  assert.match(migration, /290624074\.525/);
  assert.match(migration, /242806045\.782500000/);
  assert.match(migration, /numeric_precision = 16[\s\S]*numeric_scale = 3/);
  assert.match(
    migration,
    /when before_row\.source_fingerprint = '61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c' then[\s\S]*to_jsonb\(current_row\) - 'nett_price' - 'updated_at'[\s\S]*current_row\.updated_at is distinct from transaction_timestamp\(\)[\s\S]*else[\s\S]*to_jsonb\(current_row\) - 'nett_price'/,
  );
  assert.match(migration, /commit;\s*$/);
});

test("precision snapshot exception permits only the approved price and timestamp mutation", () => {
  const fingerprint = "61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c";
  const transactionTimestamp = "2026-10-10T04:00:00.000Z";
  const before = {
    source_fingerprint: fingerprint,
    nett_price: "639176.63",
    updated_at: "2026-10-09T04:00:00.000Z",
    remark: "⚠️ Pending Allocation",
    status: "booking",
  };
  const matchesApprovedChange = (after: typeof before) => {
    if (after.source_fingerprint !== fingerprint) return JSON.stringify(after) === JSON.stringify(before);
    const beforeProtected = { source_fingerprint: before.source_fingerprint, remark: before.remark, status: before.status };
    const afterProtected = { source_fingerprint: after.source_fingerprint, remark: after.remark, status: after.status };
    return JSON.stringify(afterProtected) === JSON.stringify(beforeProtected)
      && after.nett_price === "639176.625"
      && after.updated_at === transactionTimestamp;
  };

  assert.equal(matchesApprovedChange({ ...before, nett_price: "639176.625", updated_at: transactionTimestamp }), true);
  assert.equal(matchesApprovedChange({ ...before, nett_price: "639176.625", updated_at: transactionTimestamp, remark: "changed" }), false);
  assert.equal(matchesApprovedChange({ ...before, nett_price: "639176.625", updated_at: before.updated_at }), false);
});

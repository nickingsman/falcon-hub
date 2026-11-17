import assert from "node:assert/strict";
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

function record(year: 2024 | 2025 | 2026, row: number, unitNo = `A-${row}`): FrozenImportRecord {
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

test("2026 cannot be resumed before the complete 2025 checkpoint", () => {
  const complete2024 = record(2024, 1);
  const pending2025 = record(2025, 2);
  const nextYear = record(2026, 3);
  assert.throws(() => buildResumePlan([complete2024, pending2025, nextYear], [existing(complete2024), existing(nextYear)]), /2026 imports exist/);
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

test("a 2026 execution is refused until the 2024 and 2025 checkpoints are complete", () => {
  assert.throws(() => selectImportYear({ pending2024: [record(2024, 1)], pending2025: [], pending2026: [record(2026, 2)] }, 2026), /2024 and 2025 checkpoints/);
  assert.throws(() => selectImportYear({ pending2024: [], pending2025: [record(2025, 1)], pending2026: [record(2026, 2)] }, 2026), /2024 and 2025 checkpoints/);
  assert.deepEqual(selectImportYear({ pending2024: [], pending2025: [], pending2026: [record(2026, 2)] }, 2026).map((item) => item.fingerprint), ["2026-2"]);
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


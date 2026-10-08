import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectContributionExportRows,
  calculateProjectContributionReport,
  getProjectContributionProjectKey,
  type ProjectContributionCase,
} from "./sales-project-contribution";

const projectKey = "project:11111111-1111-4111-8111-111111111111";

function sale(overrides: Partial<ProjectContributionCase> = {}): ProjectContributionCase {
  return {
    id: "sale-1",
    projectKey,
    projectName: "Arra Residence",
    unitNo: "A-01-01",
    bookingDate: "2026-10-05",
    nettPrice: 500_000,
    status: "booking",
    contributors: [
      { memberId: "member-eric", sourceMemberName: "Eric Source", memberName: "Eric", portion: 75 },
      { memberId: "member-shanie", sourceMemberName: "Shanie Source", memberName: "Shanie", portion: 25 },
    ],
    ...overrides,
  };
}

function report(cases: ProjectContributionCase[], statusFilter: "all" | "converted" | "loan_approved" = "all") {
  return calculateProjectContributionReport(cases, {
    projectKey,
    projectName: "Arra Residence",
    from: "2026-10-01",
    to: "2026-10-31",
    statusFilter,
  });
}

test("multiple contributors receive their actual portions and credited GDV", () => {
  const result = report([sale()]);
  assert.deepEqual(result.rows.map((row) => [row.memberName, row.totalPortion, row.creditedGdv]), [
    ["Eric", 0.75, 375_000],
    ["Shanie", 0.25, 125_000],
  ]);
});

test("the same member aggregates across Sales while Sales Cases remains distinct", () => {
  const result = report([
    sale(),
    sale({ id: "sale-2", unitNo: "A-01-02", contributors: [{ memberId: "member-eric", sourceMemberName: null, memberName: "Eric", portion: 50 }] }),
  ]);
  assert.equal(result.rows[0].salesCases, 2);
  assert.equal(result.rows[0].totalPortion, 1.25);
});

test("All Sales includes Cancelled records", () => {
  assert.equal(report([sale({ status: "cancelled" })]).summary.totalSalesCases, 1);
});

test("Converted includes Sign SPA only", () => {
  const result = report([
    sale({ id: "spa", status: "sign_spa" }),
    sale({ id: "loan", status: "loan_approved" }),
    sale({ id: "cancelled", status: "cancelled" }),
  ], "converted");
  assert.equal(result.summary.totalSalesCases, 1);
  assert.equal(result.details[0].salesCaseId, "spa");
});

test("Loan Approved does not count as Converted but supports its own filter", () => {
  assert.equal(report([sale({ status: "loan_approved" })], "converted").summary.totalSalesCases, 0);
  assert.equal(report([sale({ status: "loan_approved" })], "loan_approved").summary.totalSalesCases, 1);
});

test("booking-date range excludes records outside the selected period", () => {
  assert.equal(report([sale({ bookingDate: "2026-09-30" }), sale({ id: "inside" })]).summary.totalSalesCases, 1);
});

test("project filtering excludes other projects", () => {
  assert.equal(report([sale(), sale({ id: "other", projectKey: "project:other" })]).summary.totalSalesCases, 1);
});

test("historical contributors with null member ids aggregate by normalized exact source name", () => {
  const result = report([
    sale({ contributors: [{ memberId: null, sourceMemberName: " Former Agent ", memberName: "Former Agent", portion: 25 }] }),
    sale({ id: "sale-2", contributors: [{ memberId: null, sourceMemberName: "former   agent", memberName: "former agent", portion: 25 }] }),
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].salesCases, 2);
});

test("approved aliases aggregate through their shared member id", () => {
  const result = report([
    sale({ contributors: [{ memberId: "member-yangli", sourceMemberName: "Yang Li", memberName: "Ong Yang Li", portion: 25 }] }),
    sale({ id: "sale-2", contributors: [{ memberId: "member-yangli", sourceMemberName: "Yangli", memberName: "Ong Yang Li", portion: 25 }] }),
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].totalPortion, 0.5);
});

test("historical project snapshots use a stable normalized identity", () => {
  assert.equal(getProjectContributionProjectKey(null, " The Shang  "), "historical:the shang");
  assert.equal(getProjectContributionProjectKey(null, "the   shang"), "historical:the shang");
});

test("a duplicated input case id is counted once in Sales Cases for a contributor", () => {
  const duplicated = sale();
  const result = report([duplicated, duplicated]);
  assert.equal(result.rows[0].salesCases, 1);
});

test("Total Portion sums exact contributor allocations before display rounding", () => {
  const result = report([sale({ contributors: [
    { memberId: "a", sourceMemberName: null, memberName: "A", portion: 16.67 },
    { memberId: "b", sourceMemberName: null, memberName: "B", portion: 16.67 },
    { memberId: "c", sourceMemberName: null, memberName: "C", portion: 16.66 },
  ] })]);
  assert.equal(result.summary.totalPortion, 0.5);
});

test("Credited GDV uses nett price multiplied by contributor allocation", () => {
  const result = report([sale({ nettPrice: 800_000, contributors: [{ memberId: "a", sourceMemberName: null, memberName: "A", portion: 25 }] })]);
  assert.equal(result.summary.totalCreditedGdv, 200_000);
});

test("Falcon Portion is represented by absolute contributor allocations and is not applied twice", () => {
  // This mirrors a 50% Falcon Portion split between two 25% contributors.
  const result = report([sale({ nettPrice: 800_000, contributors: [
    { memberId: "a", sourceMemberName: null, memberName: "A", portion: 25 },
    { memberId: "b", sourceMemberName: null, memberName: "B", portion: 25 },
  ] })]);
  const exported = buildProjectContributionExportRows(result);

  assert.deepEqual(result.rows.map((row) => row.creditedGdv), [200_000, 200_000]);
  assert.equal(result.summary.totalCreditedGdv, 400_000);
  assert.equal(result.summary.totalCreditedGdv, 800_000 * 50 / 100);
  assert.equal(exported.summary.reduce((sum, row) => sum + row["Credited GDV"], 0), 400_000);
  assert.equal(exported.details.reduce((sum, row) => sum + row["Credited GDV"], 0), 400_000);
});

test("export totals match visible report totals", () => {
  const result = report([sale()]);
  const exported = buildProjectContributionExportRows(result);
  assert.equal(exported.summary.reduce((sum, row) => sum + row["Total Portion"], 0), result.summary.totalPortion);
  assert.equal(exported.summary.reduce((sum, row) => sum + row["Credited GDV"], 0), result.summary.totalCreditedGdv);
  assert.equal(exported.details.length, result.details.length);
});

test("an empty project result has zero summaries", () => {
  const result = report([]);
  assert.deepEqual(result.summary, { totalSalesCases: 0, totalContributors: 0, totalPortion: 0, totalCreditedGdv: 0 });
  assert.deepEqual(result.rows, []);
});

test("ranking ties use credited GDV, Sales Cases, name, then stable identity", () => {
  const result = report([sale({ contributors: [
    { memberId: "member-z", sourceMemberName: null, memberName: "Zed", portion: 50 },
    { memberId: "member-a", sourceMemberName: null, memberName: "Amy", portion: 50 },
  ] })]);
  assert.deepEqual(result.rows.map((row) => row.memberName), ["Amy", "Zed"]);
  assert.deepEqual(result.rows.map((row) => row.rank), [1, 2]);
});

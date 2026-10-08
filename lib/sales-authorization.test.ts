import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesAccessScope,
  filterSalesCasesForAccess,
  type SalesAuthorizationProfile,
} from "./sales-authorization";
import {
  buildProjectContributionExportRows,
  calculateProjectContributionReport,
  type ProjectContributionCase,
} from "./sales-project-contribution";

const members = [
  { id: "leader", leader_id: null, status: "Active" },
  { id: "direct", leader_id: "leader", status: "Active" },
  { id: "indirect", leader_id: "direct", status: "Active" },
  { id: "deep", leader_id: "indirect", status: "Active" },
  { id: "other-leader", leader_id: null, status: "Active" },
  { id: "other-agent", leader_id: "other-leader", status: "Active" },
];

function profile(role: SalesAuthorizationProfile["role"], memberId: string | null): SalesAuthorizationProfile {
  return { role, member_id: memberId, status: "active" };
}

type AccessCase = { id: string; contributors: Array<{ memberId: string | null }> };
const cases: AccessCase[] = [
  { id: "leader-own", contributors: [{ memberId: "leader" }] },
  { id: "direct", contributors: [{ memberId: "direct" }] },
  { id: "indirect", contributors: [{ memberId: "indirect" }] },
  { id: "deep", contributors: [{ memberId: "deep" }] },
  { id: "unrelated", contributors: [{ memberId: "other-agent" }] },
  { id: "shared", contributors: [{ memberId: "direct" }, { memberId: "other-agent" }] },
  { id: "historical-unmapped", contributors: [{ memberId: null }] },
  { id: "historical-unmapped-response", contributors: [{ memberId: "historical-member:snapshot-id" }] },
];

function visibleIds(viewer: SalesAuthorizationProfile) {
  const scope = buildSalesAccessScope(viewer, members);
  return filterSalesCasesForAccess(cases, scope).map((item) => item.id);
}

test("Admin receives full Sales access", () => {
  assert.deepEqual(visibleIds(profile("admin", "admin")), cases.map((item) => item.id));
});

test("Super Admin receives full Sales access", () => {
  assert.deepEqual(visibleIds(profile("super_admin", "super")), cases.map((item) => item.id));
});

test("Leader can view their own Sales", () => {
  assert.ok(visibleIds(profile("leader", "leader")).includes("leader-own"));
});

test("Leader can view direct downline Sales", () => {
  assert.ok(visibleIds(profile("leader", "leader")).includes("direct"));
});

test("Leader can view indirect and arbitrarily deep downline Sales", () => {
  const visible = visibleIds(profile("leader", "leader"));
  assert.ok(visible.includes("indirect"));
  assert.ok(visible.includes("deep"));
});

test("Leader cannot view unrelated team Sales", () => {
  assert.equal(visibleIds(profile("leader", "leader")).includes("unrelated"), false);
});

test("Agent can view their own Sales", () => {
  assert.deepEqual(visibleIds(profile("agent", "direct")), ["direct", "shared"]);
});

test("Agent cannot view unrelated Sales", () => {
  assert.equal(visibleIds(profile("agent", "direct")).includes("unrelated"), false);
});

test("Shared Sales is visible when at least one mapped contributor is authorized", () => {
  assert.ok(visibleIds(profile("leader", "leader")).includes("shared"));
  assert.ok(visibleIds(profile("agent", "other-agent")).includes("shared"));
});

test("Unmapped historical contributor names never grant scoped access", () => {
  assert.equal(visibleIds(profile("leader", "leader")).includes("historical-unmapped"), false);
  assert.equal(visibleIds(profile("leader", "leader")).includes("historical-unmapped-response"), false);
  assert.equal(visibleIds(profile("agent", "direct")).includes("historical-unmapped"), false);
  assert.equal(visibleIds(profile("agent", "direct")).includes("historical-unmapped-response"), false);
});

test("cycle-safe hierarchy traversal cannot loop or broaden access", () => {
  const cyclicMembers = [
    { id: "leader", leader_id: "deep", status: "Active" },
    { id: "direct", leader_id: "leader", status: "Active" },
    { id: "deep", leader_id: "direct", status: "Active" },
    { id: "unrelated", leader_id: null, status: "Active" },
  ];
  const scope = buildSalesAccessScope(profile("leader", "leader"), cyclicMembers);
  assert.deepEqual(new Set(scope.memberIds), new Set(["leader", "direct", "deep"]));
  assert.equal(scope.memberIds.includes("unrelated"), false);
});

test("Project Contribution export contains only server-authorized Sales", () => {
  const contributionCases: ProjectContributionCase[] = [
    {
      id: "authorized",
      projectKey: "project:arra",
      projectName: "Arra Residence",
      unitNo: "A-01-01",
      bookingDate: "2026-01-01",
      nettPrice: 500_000,
      status: "booking",
      contributors: [{ memberId: "direct", sourceMemberName: null, memberName: "Direct", portion: 100 }],
    },
    {
      id: "unauthorized",
      projectKey: "project:arra",
      projectName: "Arra Residence",
      unitNo: "A-01-02",
      bookingDate: "2026-01-02",
      nettPrice: 600_000,
      status: "booking",
      contributors: [{ memberId: "other-agent", sourceMemberName: null, memberName: "Other", portion: 100 }],
    },
  ];
  const scope = buildSalesAccessScope(profile("agent", "direct"), members);
  const authorizedCases = filterSalesCasesForAccess(contributionCases, scope);
  const report = calculateProjectContributionReport(authorizedCases, {
    projectKey: "project:arra",
    projectName: "Arra Residence",
    from: "2026-01-01",
    to: "2026-12-31",
    statusFilter: "all",
  });
  const exported = buildProjectContributionExportRows(report);

  assert.deepEqual(exported.summary.map((row) => row.Member), ["Direct"]);
  assert.deepEqual(exported.details.map((row) => row.Unit), ["A-01-01"]);
});

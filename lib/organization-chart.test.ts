import assert from "node:assert/strict";
import test from "node:test";
import {
  canViewOrganizationChart,
  getAuthorizedOrganizationMembers,
  getOrganizationAncestorPath,
  getOrganizationCounts,
  getOrganizationRoots,
  type OrganizationChartMember,
} from "./organization-chart";

const members: OrganizationChartMember[] = [
  { id: "nicholas", leader_id: null, status: "Active", member_code: 1, full_name: "Nicholas", display_name: null, position: "Managing Partner" },
  { id: "eric", leader_id: "nicholas", status: "Active", member_code: 2, full_name: "Eric", display_name: null, position: "Team Leader" },
  { id: "a", leader_id: "eric", status: "Active", member_code: 3, full_name: "A", display_name: null, position: "REN 70" },
  { id: "b", leader_id: "a", status: "Active", member_code: 4, full_name: "B", display_name: null, position: "REN 70" },
  { id: "c", leader_id: "b", status: "Active", member_code: 5, full_name: "C", display_name: null, position: "REN 70" },
  { id: "jinan", leader_id: "nicholas", status: "Active", member_code: 6, full_name: "Jinan", display_name: null, position: "Team Leader" },
  { id: "d", leader_id: "jinan", status: "Active", member_code: 7, full_name: "D", display_name: null, position: "REN 70" },
];

const ids = (records: OrganizationChartMember[]) => records.map((member) => member.id);

test("super admin receives the complete organization", () => {
  assert.deepEqual(
    ids(getAuthorizedOrganizationMembers(members, { role: "super_admin", memberId: "nicholas" })),
    ["nicholas", "eric", "a", "b", "c", "jinan", "d"],
  );
});

test("leaders receive only themselves and their recursive downline", () => {
  assert.deepEqual(
    ids(getAuthorizedOrganizationMembers(members, { role: "leader", memberId: "eric" })),
    ["eric", "a", "b", "c"],
  );
  assert.deepEqual(
    ids(getAuthorizedOrganizationMembers(members, { role: "leader", memberId: "jinan" })),
    ["jinan", "d"],
  );
  assert.deepEqual(
    ids(getAuthorizedOrganizationMembers(members, { role: "agent", memberId: "a" })),
    ["a", "b", "c"],
  );
});

test("an agent without descendants cannot access the chart", () => {
  const scope = getAuthorizedOrganizationMembers(members, { role: "agent", memberId: "c" });
  assert.deepEqual(ids(scope), ["c"]);
  assert.equal(canViewOrganizationChart(scope, "agent"), false);
});

test("counts use direct children and all recursive descendants", () => {
  assert.deepEqual(getOrganizationCounts(members, "eric"), {
    directReports: 1,
    totalDownline: 3,
  });
  assert.deepEqual(getOrganizationCounts(members, "a"), {
    directReports: 1,
    totalDownline: 2,
  });
});

test("search scope and ancestor paths cannot cross unrelated branches", () => {
  const ericScope = getAuthorizedOrganizationMembers(members, { role: "leader", memberId: "eric" });
  assert.equal(ericScope.some((member) => member.id === "d"), false);
  assert.deepEqual(getOrganizationAncestorPath(ericScope, "c"), ["eric", "a", "b", "c"]);
  assert.deepEqual(getOrganizationAncestorPath(ericScope, "d"), []);
});

test("multiple top-level roots remain separate", () => {
  const multipleRoots = [
    ...members,
    { id: "second-root", leader_id: null, status: "Active", member_code: 8, full_name: "Second Root", display_name: null, position: "Team Leader" },
  ];
  assert.deepEqual(ids(getOrganizationRoots(multipleRoots)), ["nicholas", "second-root"]);
});

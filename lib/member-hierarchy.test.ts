import assert from "node:assert/strict";
import test from "node:test";
import {
  getDirectReports,
  getHierarchyDescendants,
  getHierarchyMembers,
  getLeaderAssignmentError,
  type HierarchyMember,
} from "./member-hierarchy";

const members: HierarchyMember[] = [
  { id: "nicholas", leader_id: null, status: "Active" },
  { id: "eric", leader_id: "nicholas", status: "Active" },
  { id: "member-a", leader_id: "eric", status: "Active" },
  { id: "member-b", leader_id: "member-a", status: "Active" },
  { id: "member-c", leader_id: "member-b", status: "Active" },
  { id: "member-d", leader_id: "member-c", status: "Active" },
  { id: "other-leader", leader_id: null, status: "Active" },
  { id: "other-member", leader_id: "other-leader", status: "Active" },
];

function ids(records: HierarchyMember[]) {
  return records.map((member) => member.id);
}

test("direct reports include immediate children only", () => {
  assert.deepEqual(ids(getDirectReports(members, "nicholas")), ["eric"]);
  assert.deepEqual(ids(getDirectReports(members, "eric")), ["member-a"]);
});

test("hierarchy descendants traverse every level and exclude the root", () => {
  assert.deepEqual(ids(getHierarchyDescendants(members, "eric")), [
    "member-a",
    "member-b",
    "member-c",
    "member-d",
  ]);

  assert.deepEqual(ids(getHierarchyDescendants(members, "nicholas")), [
    "eric",
    "member-a",
    "member-b",
    "member-c",
    "member-d",
  ]);
});

test("full hierarchy includes the root and excludes unrelated branches", () => {
  assert.deepEqual(ids(getHierarchyMembers(members, "eric")), [
    "eric",
    "member-a",
    "member-b",
    "member-c",
    "member-d",
  ]);
  assert.equal(getHierarchyMembers(members, "eric").some(
    (member) => member.id === "other-member",
  ), false);
});

test("leader filter semantics include all descendants but not the selected leader", () => {
  const filteredIds = new Set(ids(getHierarchyDescendants(members, "eric")));

  assert.equal(filteredIds.has("eric"), false);
  assert.equal(filteredIds.has("member-a"), true);
  assert.equal(filteredIds.has("member-b"), true);
  assert.equal(filteredIds.has("member-c"), true);
  assert.equal(filteredIds.has("other-member"), false);
});

test("leader assignment rejects self-leadership and descendant cycles", () => {
  assert.equal(
    getLeaderAssignmentError(members, "eric", "eric"),
    "A member cannot be their own leader",
  );
  assert.equal(
    getLeaderAssignmentError(members, "nicholas", "member-a"),
    "Leader change would create a reporting cycle",
  );
});

test("leader assignment allows unrelated leaders, ancestors, and unchanged valid leaders", () => {
  assert.equal(
    getLeaderAssignmentError(members, "member-a", "other-leader"),
    null,
  );
  assert.equal(
    getLeaderAssignmentError(members, "member-a", "nicholas"),
    null,
  );
  assert.equal(
    getLeaderAssignmentError(members, "member-a", "eric"),
    null,
  );
});

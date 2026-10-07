import assert from "node:assert/strict";
import test from "node:test";
import { canManageFeatureAccess, isFeatureGrantActive } from "./feature-access";
import {
  attachActionAssignees,
  attachParticipantSnapshots,
  createLeaderMeetingTopicSnapshot,
  getDiscussionStatusAfterMeeting,
  haveParticipantOverlap,
  parseAssigneeMemberIds,
  parseParticipantMemberIds,
} from "./leader-meetings";

type TestRole = "super_admin" | "admin" | "leader" | "agent";

function profile(role: TestRole, status = "active") {
  return { auth_user_id: `${role}-user`, member_id: `${role}-member`, role, status, created_at: "2026-10-07", updated_at: "2026-10-07" };
}

test("workspace access requires an active account and explicit enabled grant for every role", () => {
  for (const role of ["agent", "leader", "admin", "super_admin"] as const) {
    assert.equal(isFeatureGrantActive(profile(role), null), false);
    assert.equal(isFeatureGrantActive(profile(role), { is_enabled: false }), false);
    assert.equal(isFeatureGrantActive(profile(role), { is_enabled: true }), true);
  }
  assert.equal(isFeatureGrantActive(profile("super_admin", "inactive"), { is_enabled: true }), false);
});

test("only an active Super Admin can manage feature access", () => {
  assert.equal(canManageFeatureAccess(profile("super_admin")), true);
  assert.equal(canManageFeatureAccess(profile("admin")), false);
  assert.equal(canManageFeatureAccess(profile("leader")), false);
  assert.equal(canManageFeatureAccess(profile("agent")), false);
  assert.equal(canManageFeatureAccess(profile("super_admin", "inactive")), false);
});

test("meeting participants, discussion participants and action assignees are absent from the access decision", () => {
  const accessInputs = Object.keys({ profile: profile("leader"), grant: { is_enabled: true } });
  assert.deepEqual(accessInputs, ["profile", "grant"]);
});

test("loading a topic does not resolve its discussion item", () => {
  assert.equal(getDiscussionStatusAfterMeeting("pending", "discussed"), "pending");
  assert.equal(getDiscussionStatusAfterMeeting("deferred", "discussed"), "deferred");
});

test("completion resolves only resolved outcomes and keeps deferred topics available", () => {
  assert.equal(getDiscussionStatusAfterMeeting("pending", "resolved"), "resolved");
  assert.equal(getDiscussionStatusAfterMeeting("pending", "deferred"), "deferred");
});

test("meeting topic snapshots do not change when the source item is edited", () => {
  const source = { topic: "October target", notes: "Review progress" };
  const snapshot = createLeaderMeetingTopicSnapshot(source);
  source.topic = "Updated future topic";
  source.notes = "Updated future note";
  assert.deepEqual(snapshot, { topicSnapshot: "October target", sourceNotesSnapshot: "Review progress" });
});

test("one action item supports multiple assignees without duplicating the action", () => {
  const actions = [{ id: "action-1", action: "Prepare Sales Review", status: "open" }];
  const result = attachActionAssignees(actions, [
    { id: "assignment-1", action_item_id: "action-1", member_id: "eric", member_name_snapshot: "Eric" },
    { id: "assignment-2", action_item_id: "action-1", member_id: "jinan", member_name_snapshot: "Jinan" },
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].assignees.map((assignee) => assignee.member_name_snapshot), ["Eric", "Jinan"]);
});

test("assignee validation requires at least one unique member", () => {
  assert.equal(parseAssigneeMemberIds([]).valid, false);
  assert.equal(parseAssigneeMemberIds(null).valid, false);
  assert.deepEqual(parseAssigneeMemberIds(["eric", "jinan"]), { valid: true, memberIds: ["eric", "jinan"] });
  assert.deepEqual(parseAssigneeMemberIds(["eric", "eric"]), { valid: false, reason: "duplicate", memberIds: [] });
});

test("historical assignee snapshots remain independent of current member names", () => {
  const assignees = [{ id: "assignment-1", action_item_id: "action-1", member_id: "member-1", member_name_snapshot: "Original Name" }];
  const result = attachActionAssignees([{ id: "action-1" }], assignees);
  const currentMember = { id: "member-1", name: "Renamed Member", status: "Inactive" };
  assert.equal(result[0].assignees[0].member_name_snapshot, "Original Name");
  assert.equal(currentMember.name, "Renamed Member");
});

test("discussion and meeting records each appear once with multiple participants", () => {
  const participantRows = [
    { id: "p1", parent_id: "record-1", member_id: "jinan", member_name_snapshot: "Jinan" },
    { id: "p2", parent_id: "record-1", member_id: "eric", member_name_snapshot: "Eric" },
  ];
  const discussions = attachParticipantSnapshots([{ id: "record-1", topic: "Falcon Structure" }], participantRows);
  const meetings = attachParticipantSnapshots([{ id: "record-1", meeting_date: "2026-10-07" }], participantRows);
  assert.equal(discussions.length, 1);
  assert.equal(meetings.length, 1);
  assert.deepEqual(discussions[0].participants.map((participant) => participant.member_id), ["jinan", "eric"]);
  assert.equal(meetings[0].participants[0].member_name_snapshot, "Jinan");
});

test("participant validation requires at least one unique member", () => {
  assert.equal(parseParticipantMemberIds([]).valid, false);
  assert.deepEqual(parseParticipantMemberIds(["jinan", "eric"]), { valid: true, memberIds: ["jinan", "eric"] });
  assert.deepEqual(parseParticipantMemberIds(["jinan", "jinan"]), { valid: false, reason: "duplicate", memberIds: [] });
});

test("discussion matching requires at least one overlapping participant", () => {
  assert.equal(haveParticipantOverlap(["jinan", "eric"], ["eric", "yang-li"]), true);
  assert.equal(haveParticipantOverlap(["jinan", "eric"], ["nicholas"]), false);
});

test("historical participant snapshots remain readable after member changes", () => {
  const result = attachParticipantSnapshots([{ id: "meeting-1" }], [{ id: "participant-1", parent_id: "meeting-1", member_id: "member-1", member_name_snapshot: "Original Member (008)" }]);
  assert.equal(result[0].participants[0].member_name_snapshot, "Original Member (008)");
});

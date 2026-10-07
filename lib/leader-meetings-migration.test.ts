import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261007000100_create_leader_meetings.sql",
  "utf8",
);
const completionFunction = migration.slice(
  migration.indexOf("create or replace function public.complete_leader_meeting"),
);
const assigneeMigration = readFileSync(
  "supabase/migrations/20261007000200_add_leader_meeting_action_item_assignees.sql",
  "utf8",
);
const participantMigration = readFileSync(
  "supabase/migrations/20261007000300_add_leader_meeting_participants.sql",
  "utf8",
);

test("meeting completion resolves only explicit resolved/deferred discussion outcomes", () => {
  assert.match(completionFunction, /topic\.outcome_status in \('resolved', 'deferred'\)/);
  assert.match(completionFunction, /when 'resolved' then 'resolved' else 'deferred'/);
});

test("meeting completion preserves action items", () => {
  assert.doesNotMatch(completionFunction, /update public\.leader_meeting_action_items/);
  assert.doesNotMatch(completionFunction, /delete from public\.leader_meeting_action_items/);
});

test("historical meeting, topic and action identities are snapshotted", () => {
  assert.match(migration, /meeting_with_name_snapshot text not null/);
  assert.match(migration, /topic_snapshot text not null/);
  assert.match(migration, /source_notes_snapshot text null/);
  assert.match(migration, /owner_name_snapshot text not null/);
});

test("completion checks explicit feature access and not meeting participants", () => {
  assert.match(completionFunction, /access\.feature_key = 'leader_meetings'/);
  assert.match(completionFunction, /access\.is_enabled = true/);
  assert.doesNotMatch(completionFunction, /meeting_with_member_id = p_actor/);
  assert.doesNotMatch(completionFunction, /owner_member_id = p_actor/);
});

test("multi-assignee migration creates normalized unique assignments with snapshots", () => {
  assert.match(assigneeMigration, /create table if not exists public\.leader_meeting_action_item_assignees/);
  assert.match(assigneeMigration, /member_id uuid not null references public\.users\(id\) on delete restrict/);
  assert.match(assigneeMigration, /member_name_snapshot text not null/);
  assert.match(assigneeMigration, /unique \(action_item_id, member_id\)/);
  assert.doesNotMatch(assigneeMigration, /json|uuid\[\]/i);
});

test("existing single-owner actions are backfilled before old owner columns are removed", () => {
  const backfillPosition = assigneeMigration.indexOf("insert into public.leader_meeting_action_item_assignees");
  const dropPosition = assigneeMigration.indexOf("drop column owner_member_id");
  assert.ok(backfillPosition >= 0);
  assert.ok(dropPosition > backfillPosition);
  assert.match(assigneeMigration, /action_item\.owner_member_id/);
  assert.match(assigneeMigration, /action_item\.owner_name_snapshot/);
});

test("assignee table is private and action-level completion remains unchanged", () => {
  assert.match(assigneeMigration, /enable row level security/);
  assert.match(assigneeMigration, /revoke all on table public\.leader_meeting_action_item_assignees from anon, authenticated/);
  assert.doesNotMatch(assigneeMigration, /status text|completed_at|completed_by/);
  assert.doesNotMatch(completionFunction, /leader_meeting_action_item_assignees/);
});

test("participant migration creates normalized protected relationship tables", () => {
  assert.match(participantMigration, /create table if not exists public\.leader_discussion_item_participants/);
  assert.match(participantMigration, /unique \(discussion_item_id, member_id\)/);
  assert.match(participantMigration, /create table if not exists public\.leader_meeting_participants/);
  assert.match(participantMigration, /unique \(meeting_id, member_id\)/);
  assert.match(participantMigration, /alter table public\.leader_discussion_item_participants enable row level security/);
  assert.match(participantMigration, /alter table public\.leader_meeting_participants enable row level security/);
  assert.match(participantMigration, /revoke all on table public\.leader_discussion_item_participants from anon, authenticated/);
  assert.match(participantMigration, /revoke all on table public\.leader_meeting_participants from anon, authenticated/);
});

test("existing singular discussion and meeting participants are backfilled before columns are removed", () => {
  const discussionBackfill = participantMigration.indexOf("insert into public.leader_discussion_item_participants");
  const meetingBackfill = participantMigration.indexOf("insert into public.leader_meeting_participants");
  const discussionDrop = participantMigration.indexOf("drop column meeting_with_member_id");
  const meetingDrop = participantMigration.indexOf("drop column meeting_with_name_snapshot");
  assert.ok(discussionBackfill >= 0 && discussionDrop > discussionBackfill);
  assert.ok(meetingBackfill >= 0 && meetingDrop > meetingBackfill);
  assert.match(participantMigration, /discussion\.meeting_with_member_id/);
  assert.match(participantMigration, /meeting\.meeting_with_name_snapshot/);
});

test("meeting completion remains atomic and independent of participant identity", () => {
  assert.match(completionFunction, /for update/);
  assert.match(completionFunction, /update public\.leader_meetings/);
  assert.doesNotMatch(completionFunction, /meeting_with_member_id/);
  assert.doesNotMatch(completionFunction, /leader_meeting_participants/);
});

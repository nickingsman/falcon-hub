import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLeaderPromotionCandidates, isLeaderPromotionManager } from "./leader-promotions";

const members = [
  { id: "agent", leader_id: null, status: "Active", is_deleted: false },
  { id: "direct", leader_id: "agent", status: "Active", is_deleted: false },
  { id: "indirect", leader_id: "direct", status: "Active", is_deleted: false },
  { id: "other-agent", leader_id: null, status: "Active", is_deleted: false },
];
const profiles = [
  { auth_user_id: "auth-agent", member_id: "agent", role: "agent", status: "active" },
  { auth_user_id: "auth-other", member_id: "other-agent", role: "agent", status: "active" },
];

test("first direct downline identifies an Agent without changing their role", () => {
  const result = getLeaderPromotionCandidates(members, profiles, []);
  assert.deepEqual(result, [{
    authUserId: "auth-agent",
    memberId: "agent",
    directDownlineCount: 1,
    totalDownlineCount: 2,
  }]);
  assert.equal(profiles[0].role, "agent");
});

test("pending request prevents a duplicate", () => {
  assert.deepEqual(getLeaderPromotionCandidates(members, profiles, [{
    member_id: "agent", status: "pending", direct_downline_count: 1, created_at: "2026-10-16",
  }]), []);
});

test("rejected Agent is reconsidered only after another direct member", () => {
  const rejected = [{ member_id: "agent", status: "rejected" as const, direct_downline_count: 1, created_at: "2026-10-16" }];
  assert.deepEqual(getLeaderPromotionCandidates(members, profiles, rejected), []);
  const expanded = [...members, { id: "direct-2", leader_id: "agent", status: "Active", is_deleted: false }];
  assert.equal(getLeaderPromotionCandidates(expanded, profiles, rejected)[0]?.directDownlineCount, 2);
});

test("inactive, deleted, unlinked, and non-Agent accounts are not eligible", () => {
  assert.deepEqual(getLeaderPromotionCandidates(members, [
    { ...profiles[0], role: "leader" },
    { ...profiles[1], status: "inactive" },
  ], []), []);
});

test("Resigned members cannot trigger or participate in Leader Promotion", () => {
  assert.deepEqual(getLeaderPromotionCandidates([
    { ...members[0], status: "Resigned" },
    ...members.slice(1),
  ], profiles, []), []);
});

test("only an active Super Admin receives promotion-management permission", () => {
  assert.equal(isLeaderPromotionManager({ role: "super_admin", status: "active" }), true);
  assert.equal(isLeaderPromotionManager({ role: "admin", status: "active" }), false);
  assert.equal(isLeaderPromotionManager({ role: "leader", status: "active" }), false);
  assert.equal(isLeaderPromotionManager({ role: "agent", status: "active" }), false);
  assert.equal(isLeaderPromotionManager({ role: "super_admin", status: "inactive" }), false);
});

const migration = readFileSync("supabase/migrations/20261016000100_create_leader_promotion_approvals.sql", "utf8");

test("migration creates one-pending protection, cycle-safe counts, and idempotent backfill", () => {
  assert.match(migration, /unique index[\s\S]*where status = 'pending'/);
  assert.match(migration, /child\.id <> all\(descendants\.path\)/);
  assert.match(migration, /create or replace function public\.backfill_leader_promotion_requests/);
  assert.match(migration, /perform public\.ensure_leader_promotion_request/);
});

test("atomic decision RPC restricts approval, rejects self-approval, and rechecks eligibility", () => {
  const decision = migration.slice(migration.indexOf("create or replace function public.decide_leader_promotion_request"));
  assert.match(decision, /for update/);
  assert.match(decision, /v_actor\.role <> 'super_admin'/);
  assert.match(decision, /v_request\.agent_auth_user_id = v_actor_id/);
  assert.match(decision, /v_request\.status <> 'pending'/);
  assert.match(decision, /v_direct_count = 0/);
  assert.match(decision, /update public\.user_profiles set role = 'leader'/);
  assert.match(decision, /insert into public\.leader_promotion_audit_logs/);
});

test("legacy user management cannot directly promote an Agent to Leader", () => {
  assert.match(migration, /Agent promotion requires an approved Leader Promotion Request/);
  assert.match(migration, /revoke all on function public\.manage_falconhub_user\([\s\S]*from authenticated/);
});

test("RLS and RPC grants expose decisions only through authenticated Super Admin checks", () => {
  assert.match(migration, /alter table public\.leader_promotion_requests enable row level security/);
  assert.match(migration, /profile\.role = 'super_admin'/);
  assert.match(migration, /revoke all on function public\.decide_leader_promotion_request\(uuid, text, text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.decide_leader_promotion_request\(uuid, text, text\) to authenticated/);
});

test("migration is atomic", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
});

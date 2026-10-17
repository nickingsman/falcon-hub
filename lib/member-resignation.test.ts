import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getActiveDirectDownlines,
  parseDownlineReassignments,
  toResignationRpcAssignments,
} from "./member-resignation";
import { getActiveMemberCount } from "./member-hierarchy";

const migration = readFileSync(
  "supabase/migrations/20261017000100_add_resigned_member_workflow.sql",
  "utf8",
);
const adminUserManagementMigration = readFileSync(
  "supabase/migrations/20260825000600_create_admin_user_audit_logs.sql",
  "utf8",
);

function getFunctionBody(sql: string, signature: string) {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`create or replace function ${escapedSignature}[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "i"),
  );
  assert.ok(match, `Expected SQL function ${signature}`);
  return match[1];
}

function attemptFinalSuperAdminChange(activeSuperAdmins: number) {
  if (activeSuperAdmins <= 1) {
    return { activeSuperAdmins, allowed: false };
  }
  return { activeSuperAdmins: activeSuperAdmins - 1, allowed: true };
}

test("only active direct downlines require explicit handling", () => {
  const members = [
    { id: "active", leader_id: "leader", status: "Active" },
    { id: "resigned", leader_id: "leader", status: "Resigned" },
    { id: "indirect", leader_id: "active", status: "Active" },
  ];
  assert.deepEqual(getActiveDirectDownlines(members, "leader").map(({ id }) => id), ["active"]);
  assert.equal(getActiveMemberCount(members), 2);
});

test("downline assignments preserve explicit No Leader and reject duplicates", () => {
  const parsed = parseDownlineReassignments([
    { memberId: "member-a", leaderId: null },
    { memberId: "member-b", leaderId: "leader-b" },
  ]);
  assert.deepEqual(toResignationRpcAssignments(parsed), [
    { member_id: "member-a", leader_id: null },
    { member_id: "member-b", leader_id: "leader-b" },
  ]);
  assert.throws(() => parseDownlineReassignments([
    { memberId: "member-a", leaderId: null },
    { memberId: "member-a", leaderId: "leader-b" },
  ]), /only be reassigned once/);
});

test("migration makes resignation atomic and protects critical failure cases", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(migration, /You cannot resign and deactivate your own account/);
  assert.match(migration, /Admins cannot resign a Super Admin account/);
  assert.match(migration, /final active Super Admin cannot be resigned/);
  assert.match(migration, /Every active direct downline requires an explicit reassignment/);
  assert.match(migration, /Downline reassignment would create a reporting cycle/);
  assert.match(migration, /update public\.users as member set status = 'Resigned'/);
  assert.match(migration, /update public\.user_profiles as profile[\s\S]*set status = 'inactive'/);
});

test("migration does not schema-qualify PostgreSQL conditional expressions", () => {
  assert.doesNotMatch(
    migration,
    /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/i,
  );
  assert.match(
    migration,
    /select coalesce\(pg_catalog\.bool_or\(paths\.cycle_found\), false\)/,
  );
});

test("resignation and deactivation serialize on the same advisory transaction lock", () => {
  const resignationBody = getFunctionBody(
    migration,
    "public.resign_falconhub_member",
  );
  const resignationGuardBody = getFunctionBody(
    migration,
    "public.guard_resigned_member_status_change",
  );
  const deactivationBody = getFunctionBody(
    adminUserManagementMigration,
    "public.deactivate_falconhub_user",
  );
  const sharedLock = /pg_advisory_xact_lock\([\s\S]*?hashtext\('falconhub_admin_user_management'\)[\s\S]*?\)/;

  assert.match(resignationBody, sharedLock);
  assert.match(resignationGuardBody, sharedLock);
  assert.match(deactivationBody, sharedLock);
  assert.doesNotMatch(resignationBody, /falconhub_member_resignation/);
  assert.ok(
    resignationBody.indexOf("falconhub_admin_user_management") <
      resignationBody.indexOf("select profile.* into v_actor"),
    "Resignation must acquire the shared lock before profile row locks",
  );
  assert.ok(
    deactivationBody.indexOf("falconhub_admin_user_management") <
      deactivationBody.indexOf("select *\n  into v_actor_profile"),
    "Deactivation must acquire the shared lock before profile row locks",
  );

  const resignation = attemptFinalSuperAdminChange(2);
  assert.deepEqual(resignation, { activeSuperAdmins: 1, allowed: true });
  const concurrentDeactivationAfterLockRelease = attemptFinalSuperAdminChange(
    resignation.activeSuperAdmins,
  );
  assert.deepEqual(concurrentDeactivationAfterLockRelease, {
    activeSuperAdmins: 1,
    allowed: false,
  });
});

test("constraint parsing fails closed when expected values cannot be extracted", () => {
  const extractionGuards = migration.match(/if v_values is null then/g) ?? [];
  assert.equal(extractionGuards.length, 2);
  assert.match(
    migration,
    /Could not extract values from public\.users status CHECK definition/,
  );
  assert.match(
    migration,
    /Could not extract values from admin_user_audit_logs action CHECK definition/,
  );
});

test("migration blocks bypasses, unsafe reactivation, and anonymous RPC execution", () => {
  assert.match(migration, /guard_resigned_member_status_change/);
  assert.match(migration, /linked member must be Active before access can be reactivated/);
  assert.match(migration, /profile\.status = 'active'/);
  assert.match(migration, /revoke execute on function public\.deactivate_falconhub_user\(uuid\) from public, anon/);
  assert.match(migration, /revoke execute on function public\.reactivate_falconhub_user\(uuid\) from public, anon/);
});

test("migration does not update or delete Sales attribution", () => {
  assert.doesNotMatch(migration, /update\s+public\.sales_/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.sales_/i);
});

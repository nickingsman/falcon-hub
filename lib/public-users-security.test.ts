import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261017000050_harden_public_users_access.sql",
  "utf8",
);
const preflight = readFileSync(
  "supabase/verification/20261017000050_public_users_preflight.sql",
  "utf8",
);
const reconciliation = readFileSync(
  "supabase/verification/20261017000050_public_users_reconciliation.sql",
  "utf8",
);

test("migration atomically enables default-deny RLS without FORCE RLS", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(migration, /alter table public\.users enable row level security/);
  assert.doesNotMatch(
    migration,
    /alter\s+table\s+public\.users\s+force\s+row\s+level\s+security/i,
  );
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(migration, /public\.users must remain default-deny with no client policies/);
});

test("all direct client table and column access is revoked", () => {
  assert.match(
    migration,
    /revoke all privileges on table public\.users from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)/,
  );
  for (const role of ["anon", "authenticated"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(
        migration,
        new RegExp(`has_table_privilege\\('${role}', 'public\\.users', '${privilege}'\\)`),
      );
    }
  }
  assert.match(migration, /has_column_privilege\('authenticated', 'public\.users', attribute_row\.attname, 'UPDATE'\)/);
  assert.match(migration, /A client role retains an effective public\.users column privilege/);
});

test("unauthorized direct leader changes cannot bypass the table boundary", () => {
  assert.match(migration, /revoke all privileges on table public\.users/);
  assert.match(migration, /has_column_privilege\('anon', 'public\.users', attribute_row\.attname, 'UPDATE'\)/);
  assert.match(migration, /has_column_privilege\('authenticated', 'public\.users', attribute_row\.attname, 'UPDATE'\)/);
  assert.doesNotMatch(migration, /grant update[^;]*to (anon|authenticated)/i);
});

test("service role and controlled SECURITY DEFINER functions remain compatible", () => {
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.users to service_role/,
  );
  assert.match(migration, /service_role must exist and have BYPASSRLS/);
  assert.match(migration, /function_row\.prosecdef/);
  assert.match(migration, /function_row\.proowner <> v_users_owner/);
  assert.match(migration, /not owner_role\.rolbypassrls/);
  assert.doesNotMatch(migration, /revoke[^;]*function/i);
  assert.doesNotMatch(migration, /create or replace function/i);
});

test("member-code sequence is unavailable to clients and retained for service role", () => {
  assert.match(
    migration,
    /revoke all privileges on sequence public\.users_member_code_seq[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant usage, select on sequence public\.users_member_code_seq to service_role/,
  );
  assert.match(migration, /has_sequence_privilege\('authenticated'/);
});

test("migration cannot modify Sales, contributors, members, or profiles", () => {
  assert.doesNotMatch(migration, /(insert into|update|delete from)\s+public\.sales_/i);
  assert.doesNotMatch(migration, /(insert into|update|delete from)\s+public\.user_profiles/i);
  assert.doesNotMatch(migration, /(insert into|update|delete from)\s+public\.users/i);
});

test("verification scripts are SELECT-only and cover effective access and reconciliation", () => {
  for (const sql of [preflight, reconciliation]) {
    assert.doesNotMatch(
      sql,
      /(^|;)\s*(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/im,
    );
    assert.match(sql, /has_table_privilege/);
    assert.match(sql, /has_column_privilege/);
    assert.match(sql, /relrowsecurity/);
    assert.match(sql, /relforcerowsecurity/);
    assert.match(sql, /prosecdef/);
    assert.match(sql, /sales_hash/);
    assert.match(sql, /contributor_hash/);
    assert.match(sql, /users_hash/);
    assert.match(sql, /profiles_hash/);
    assert.match(sql, /hierarchy_hash/);
    assert.match(sql, /storage_objects/);
    assert.match(sql, /project-media/);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getFirstUnusedHistoricalUnit,
  getHistoricalCorrectedDate,
  getHistoricalCorrectedUnit,
  getHistoricalContributorAllocationCorrection,
  getHistoricalMemberLookupName,
  getHistoricalProjectLookupName,
  getHistoricalStatusCorrection,
} from "./historical-sales-import-rules";

test("approved member aliases are explicit and deterministic", () => {
  assert.equal(getHistoricalMemberLookupName(" Yang Li "), "ong yang li");
  assert.equal(getHistoricalMemberLookupName("Yangli"), "ong yang li");
  assert.equal(getHistoricalMemberLookupName("Alvin Foo"), "alvin");
  assert.equal(getHistoricalMemberLookupName("Shirley Lee"), "shirley lee");
});

test("approved project aliases do not use fuzzy matching", () => {
  assert.equal(getHistoricalProjectLookupName("Aster Hill"), "aster hill residence");
  assert.equal(getHistoricalProjectLookupName("Aurum Suites"), "aurum suite");
  assert.equal(getHistoricalProjectLookupName("Residensi ZIG"), "zig residence");
  assert.equal(getHistoricalProjectLookupName("Levia Residence"), "levia residence");
});

test("only approved source rows receive date and unit corrections", () => {
  assert.equal(getHistoricalCorrectedDate(28, "2025-01-23"), "2026-01-23");
  assert.equal(getHistoricalCorrectedDate(29, "2025-01-23"), "2025-01-23");
  assert.equal(getHistoricalCorrectedUnit(74, "2026-08-16"), "08-16");
  assert.equal(getHistoricalCorrectedUnit(75, "B-08-16"), "B-08-16");
});

test("only the three owner-approved blocker rows receive final corrections", () => {
  const row87 = getHistoricalContributorAllocationCorrection(87);
  assert.equal(row87?.get("nicholas yap"), 50);
  assert.equal(row87?.get("peiling"), 25);
  assert.equal(row87?.get("sim yap"), 25);

  const row207 = getHistoricalContributorAllocationCorrection(207);
  assert.equal(row207?.get("nicholas yap"), 16.67);
  assert.equal(row207?.get("ah seng"), 16.67);
  assert.equal(row207?.get("hermes lim"), 16.66);
  assert.equal(row207?.get("eric siow"), 50);

  assert.equal(getHistoricalStatusCorrection(117), "booking");
  assert.equal(getHistoricalContributorAllocationCorrection(86), null);
  assert.equal(getHistoricalContributorAllocationCorrection(208), null);
  assert.equal(getHistoricalStatusCorrection(116), null);
  assert.equal(getHistoricalStatusCorrection(118), null);
});

test("duplicate units use the first unused dotted representation", () => {
  assert.equal(getFirstUnusedHistoricalUnit("A-15-12", new Set(["a-15-12", "a-15-12."])), "A-15-12..");
  assert.equal(getFirstUnusedHistoricalUnit("B-43A-10", new Set()), "B-43A-10");
});

test("historical migration keeps manual lifecycle validation and adds snapshot identities", () => {
  const migration = readFileSync("supabase/migrations/20261007000400_add_historical_sales_import_support.sql", "utf8");
  assert.match(migration, /source_type = 'historical_2026_case_report'/);
  assert.match(migration, /status <> 'sign_spa'[\s\S]*spa_signed_date is not null[\s\S]*source_type = 'historical_2026_case_report'/);
  assert.match(migration, /status <> 'cancelled'[\s\S]*cancel_date is not null[\s\S]*source_type = 'historical_2026_case_report'/);
  assert.match(migration, /source_project_name text null/);
  assert.match(migration, /source_member_name text null/);
  assert.match(migration, /create or replace function public\.import_historical_sales_case/);
  assert.match(migration, /revoke all on function public\.import_historical_sales_case[\s\S]*from public, anon, authenticated/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveMonthlyMaintenance } from "./project-property";

test("resolves built-up per-sqft maintenance", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "per_sqft", maintenance_fee_per_sqft: 0.35, maintenance_calculation_basis: "built_up" }, { size_sqft: 1000, land_size_sqft: null }), 350);
});

test("resolves land-size per-sqft maintenance", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "per_sqft", maintenance_fee_per_sqft: 0.25, maintenance_calculation_basis: "land_size" }, { size_sqft: 2200, land_size_sqft: 1650 }), 412.5);
});

test("resolves fixed monthly maintenance", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "fixed", maintenance_fee_fixed_monthly: 150 }, { size_sqft: 2200, land_size_sqft: 1650 }), 150);
});

test("does not substitute built-up for a missing configured land size", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "per_sqft", maintenance_fee_per_sqft: 0.25, maintenance_calculation_basis: "land_size" }, { size_sqft: 2200, land_size_sqft: null }), null);
});

test("legacy per-sqft records continue to use built-up size", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_per_sqft: 0.35 }, { size_sqft: 1000 }), 350);
});

test("zero fixed maintenance and zero rates are valid", () => {
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "fixed", maintenance_fee_fixed_monthly: 0 }, {}), 0);
  assert.equal(resolveMonthlyMaintenance({ maintenance_fee_type: "per_sqft", maintenance_fee_per_sqft: 0, maintenance_calculation_basis: "built_up" }, { size_sqft: 1000 }), 0);
});

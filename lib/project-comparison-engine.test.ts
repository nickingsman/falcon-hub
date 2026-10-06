import assert from "node:assert/strict";
import test from "node:test";

import { calculateProjectComparisonMetrics } from "./project-comparison-engine";

test("comparison price PSF always uses built-up while maintenance can use land size", () => {
  const result = calculateProjectComparisonMetrics(
    {
      price_from: 1_100_000,
      price_to: null,
      size_sqft: 2_200,
      land_size_sqft: 1_650,
      maintenance_fee_type: "per_sqft",
      maintenance_fee_per_sqft: 0.25,
      maintenance_fee_fixed_monthly: null,
      maintenance_calculation_basis: "land_size",
      estimated_rental_from: 4_000,
      estimated_rental_to: null,
    },
    { loanMarginPercent: 90, annualInterestRatePercent: 4, loanTenureYears: 35 },
  );

  assert.deepEqual(result.psf, { kind: "single", value: 500 });
  assert.deepEqual(result.monthlyMaintenance, { kind: "single", value: 412.5 });
});

test("comparison does not fall back to built-up for missing land size", () => {
  const result = calculateProjectComparisonMetrics(
    {
      price_from: 1_100_000,
      price_to: null,
      size_sqft: 2_200,
      land_size_sqft: null,
      maintenance_fee_type: "per_sqft",
      maintenance_fee_per_sqft: 0.25,
      maintenance_fee_fixed_monthly: null,
      maintenance_calculation_basis: "land_size",
      estimated_rental_from: null,
      estimated_rental_to: null,
    },
    { loanMarginPercent: 90, annualInterestRatePercent: 4, loanTenureYears: 35 },
  );

  assert.deepEqual(result.monthlyMaintenance, { kind: "unavailable" });
});

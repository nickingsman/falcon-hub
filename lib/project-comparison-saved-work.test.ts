import assert from "node:assert/strict";
import test from "node:test";

import { validateProjectComparisonSavedWorkPayload } from "./project-comparison-saved-work";

test("legacy comparison snapshots retain built-up maintenance behavior", () => {
  const legacyProject = {
    id: "project-1", name: "Legacy", maintenance_fee_per_sqft: 0.35,
  };
  const legacyUnit = { id: "unit-1", size_sqft: 1000 };
  const result = validateProjectComparisonSavedWorkPayload({
    tool: "project_comparison",
    schemaVersion: 1,
    assumptions: {},
    slots: [
      { snapshot: { project: legacyProject, unit_types: [legacyUnit] } },
      { snapshot: { project: legacyProject, unit_types: [legacyUnit] } },
    ],
  });

  assert.equal(result.valid, true);
  if (!result.valid) return;
  const snapshot = result.payload.slots[0]?.snapshot;
  assert.equal(snapshot?.project.maintenance_fee_type, null);
  assert.equal(snapshot?.project.maintenance_calculation_basis, "built_up");
  assert.equal(snapshot?.unit_types[0]?.size_sqft, 1000);
  assert.equal(snapshot?.unit_types[0]?.land_size_sqft, null);
});

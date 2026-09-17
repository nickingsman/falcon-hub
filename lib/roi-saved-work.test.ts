import assert from "node:assert/strict";
import test from "node:test";

import {
  roiSavedWorkSchemaVersion,
  validateRoiSavedWorkPayload,
} from "./roi-saved-work";

const legacyPayload = {
  tool: "roi",
  schemaVersion: roiSavedWorkSchemaVersion,
  purchasePurpose: "own_stay",
  form: {},
  packageItems: [],
  purchaseCosts: [],
  projectReference: {},
  snapshots: {},
};

test("legacy ROI Saved Work defaults to Malaysian / PR with RM0 consent", () => {
  const validated = validateRoiSavedWorkPayload(legacyPayload);

  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  assert.equal(validated.payload.buyerType, "malaysian_pr");
  assert.equal(validated.payload.foreignerConsent, 0);
});

test("invalid Saved Work buyer fields use safe defaults", () => {
  const validated = validateRoiSavedWorkPayload({
    ...legacyPayload,
    buyerType: "invalid",
    foreignerConsent: -5_000,
  });

  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  assert.equal(validated.payload.buyerType, "malaysian_pr");
  assert.equal(validated.payload.foreignerConsent, 0);
});

test("new foreigner Saved Work fields round-trip without changing schema version", () => {
  const payload = {
    ...legacyPayload,
    purchasePurpose: "investment",
    buyerType: "foreigner",
    foreignerConsent: 5_000,
  };
  const validated = validateRoiSavedWorkPayload(payload);

  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  assert.equal(validated.payload.schemaVersion, 1);
  assert.equal(validated.payload.purchasePurpose, "investment");
  assert.equal(validated.payload.buyerType, "foreigner");
  assert.equal(validated.payload.foreignerConsent, 5_000);
});

import assert from "node:assert/strict";
import test from "node:test";

import { calculateProgressiveInterest } from "./progressive-interest";

const baseInput = {
  spaPrice: 600_000,
  loanMarginPercent: 90,
  annualInterestRatePercent: 4,
};

function requireStage(
  result: ReturnType<typeof calculateProgressiveInterest>,
  stageId: string,
) {
  const stage = result.stages.find((item) => item.stage.id === stageId);
  assert.ok(stage);
  return stage;
}

test("cumulative mode remains the default and preserves buyer-equity-first funding", () => {
  const result = calculateProgressiveInterest(baseInput);
  const foundation = requireStage(result, "2a");
  const structure = requireStage(result, "2b");

  assert.equal(result.mode, "cumulative");
  assert.equal(foundation.estimatedBankReleaseForStage, 60_000);
  assert.equal(foundation.cumulativeEstimatedBankDisbursement, 60_000);
  assert.equal(foundation.estimatedMonthlyProgressiveInterest, 200);
  assert.equal(structure.cumulativeEstimatedBankDisbursement, 150_000);
  assert.equal(structure.estimatedMonthlyProgressiveInterest, 500);
});

test("stage-only mode applies the loan margin independently without prior releases", () => {
  const result = calculateProgressiveInterest({ ...baseInput, mode: "stage_only" });
  const foundation = requireStage(result, "2a");
  const structure = requireStage(result, "2b");

  assert.equal(result.mode, "stage_only");
  assert.equal(foundation.stageAmount, 60_000);
  assert.equal(foundation.estimatedBankReleaseForStage, 54_000);
  assert.equal(foundation.estimatedMonthlyProgressiveInterest, 180);
  assert.equal(structure.stageAmount, 90_000);
  assert.equal(structure.estimatedBankReleaseForStage, 81_000);
  assert.equal(structure.estimatedMonthlyProgressiveInterest, 270);
});

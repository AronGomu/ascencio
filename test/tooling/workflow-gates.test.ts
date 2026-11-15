import test from "node:test";
import assert from "node:assert/strict";
import { workflowGates } from "../../scripts/bot-improvement/workflow-gates.ts";
test("early research cannot promote incomplete evaluation; partial policy labels stay explicit", () => {
  const evidence = {
    policy: {
      mode: "sample" as const,
      sampleMatches: 3,
      seed: "fixed",
      earlyResearch: true,
    },
    evaluationComplete: false,
    selectedReviewComplete: false,
    fullCoverage: false,
    reviewedLosses: 1,
    pairedComparable: true,
    pairedDifference: 0.1,
    integrity: true,
    stopped: false,
  };
  const early = workflowGates(evidence);
  assert.equal(early.research, true);
  assert.equal(early.replay, false);
  assert.equal(early.promote, false);
  assert.equal(early.coverageLabel, "sampled");
  assert.equal(
    workflowGates({
      ...evidence,
      evaluationComplete: true,
      selectedReviewComplete: true,
    }).promote,
    true,
  );
  for (const change of [
    { integrity: false },
    { stopped: true },
    { pairedComparable: false },
    { pairedDifference: 0 },
  ])
    assert.equal(
      workflowGates({
        ...evidence,
        evaluationComplete: true,
        selectedReviewComplete: true,
        ...change,
      }).promote,
      false,
    );
  assert.equal(
    workflowGates({
      ...evidence,
      policy: { mode: "full" },
      evaluationComplete: true,
      selectedReviewComplete: true,
      fullCoverage: false,
    }).promote,
    false,
  );
});

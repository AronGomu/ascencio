/** Alternative analysis changes research coverage, never paired evaluation authority. */
import {
  resolveAnalysisPolicy,
  type AnalysisPolicy,
} from "./analysis-policy.ts";
export interface WorkflowEvidence {
  policy: Partial<AnalysisPolicy>;
  evaluationComplete: boolean;
  selectedReviewComplete: boolean;
  fullCoverage: boolean;
  reviewedLosses: number;
  pairedComparable: boolean;
  pairedDifference: number;
  integrity: boolean;
  stopped: boolean;
}
export function workflowGates(e: WorkflowEvidence) {
  const policy = resolveAnalysisPolicy(e.policy);
  const safe = e.integrity && !e.stopped;
  const analysisComplete =
    policy.mode === "full" ? e.fullCoverage : e.selectedReviewComplete;
  return {
    research:
      safe &&
      e.reviewedLosses > 0 &&
      (policy.earlyResearch || (e.evaluationComplete && analysisComplete)),
    replay: safe && e.evaluationComplete && analysisComplete,
    assemble: safe && e.evaluationComplete && analysisComplete,
    promote:
      safe &&
      e.evaluationComplete &&
      analysisComplete &&
      e.pairedComparable &&
      Number.isFinite(e.pairedDifference) &&
      e.pairedDifference > 0,
    coverageLabel: e.fullCoverage
      ? "full"
      : policy.mode === "two-pass"
        ? "targeted"
        : "sampled",
    analysisComplete,
  };
}

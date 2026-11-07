/** Paths in CLI requests resolve relative to the request JSON. Hashes cover exact bytes. */
export interface CandidateDecisionRequest {
  schemaVersion: 1;
  session: string;
  manifest: { path: string; sha256: string };
  validation: { path: string; sha256: string };
  /** Null only when rejecting a validation result without a candidate. */
  candidateIdentity: string | null;
  decision: "accept" | "reject";
  rationale: string;
  evidence: { path: string; sha256: string }[];
}
export interface CandidateDecisionResult {
  schemaVersion: 1;
  identity: string;
  decision: "accept" | "reject";
  iteration: number;
  nextIteration: number;
  fixtureIdentity: string;
  previousAccepted: { path: string; identity: string };
  accepted: { path: string; identity: string };
  archive: string;
}

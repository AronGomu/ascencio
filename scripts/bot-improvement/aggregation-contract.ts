import type { EvidenceReference } from "./session-control-contract.ts";

/** ARO2-23 extension. Frozen setup and comparisonIdentity remain unchanged. */
export interface AggregationInput {
  /** Session-relative frozen runner output and hash-pinned *.job.json. */
  root: string;
  execution: EvidenceReference;
  /** Optional ARO2-18 baseline-receipt.json; only valid for control. */
  receipt?: EvidenceReference;
  /** Optional ARO2-22 queue JSON. Reports/packets are reverified, not interpreted. */
  analyses?: EvidenceReference;
}
export interface AggregationRequest {
  schemaVersion: 1;
  /** Request-file-relative session and fresh output directory. */
  session: string;
  iteration: number;
  /** Explicit validated candidate identity, independent of the preparation placeholder. */
  candidateIdentity: string;
  control: AggregationInput;
  candidate: AggregationInput;
  output: string;
}

import type { EvidenceReference } from "./session-control-contract.ts";

/** ARO2-22 extension: session/fixture/iteration schemas remain unchanged. */
export interface AnalysisBinding {
  iteration: number;
  role: "control" | "candidate";
  /** Session-relative finalized runner output root. */
  root: string;
  /** Pinned runner preparation (*.job.json); paths inside are runner-owned. */
  execution: EvidenceReference;
  /** Candidate heuristic change and rationale; baseline may describe unchanged control. */
  proposal: EvidenceReference;
}
export interface EventReference {
  game: number;
  perspective: "a" | "b";
  sequence: number;
}
export interface AnalysisPacket {
  schemaVersion: 1;
  adapter: "frozen-xml-v1" | "linked-text-v1";
  id: string;
  iteration: number;
  role: AnalysisBinding["role"];
  match: string;
  fixtureIdentity: string;
  runnerIdentity: string;
  executionIdentity: string;
  candidateIdentity: string;
  opponent: { slot: string; identity: string };
  proposal: EvidenceReference;
  /** Completion receipt and pinned native records/text logs, or legacy XML evidence. */
  files: EvidenceReference[];
  games: {
    number: number;
    id: string;
    status: "completed" | "failed" | "skipped";
    evidenceHash: string | null;
  }[];
  /** Stable tuple addressing an actual timeline entry in a pinned actor record. */
  events: EventReference[];
  /** Native adapter: target losses and legal critical-decision references. */
  lossGames?: { game: number; decisions: string[] }[] | undefined;
}
export interface AnalysisSection {
  text: string;
  /** Empty only when unavailable explains the missing evidence. */
  evidence: EventReference[];
  unavailable?: string;
}
export interface MatchAnalysisReport {
  schemaVersion: 1;
  job: string;
  packetSha256: string;
  sections: {
    activation: AnalysisSection;
    changedDecisions: AnalysisSection;
    impact: AnalysisSection & {
      assessment: "positive" | "negative" | "uncertain";
    };
    consequentialPlays: AnalysisSection;
  };
}
export interface AnalysisQueue {
  schemaVersion: 1;
  binding: AnalysisBinding;
  fixtureIdentity: string;
  runnerIdentity: string;
  executionIdentity: string;
  workers: number;
  queueLimit: number;
  expected: string[];
  jobs: {
    id: string;
    match: string;
    packet: EvidenceReference;
    status: "waiting" | "pending" | "claimed" | "complete";
    attempt: number;
    claim?: { token: string; owner: string };
    report?: EvidenceReference;
    /** Agent-facing Markdown; report holds the code-generated canonical record. */
    findings?: EvidenceReference;
  }[];
}
export type AnalysisAction =
  | { action: "sync"; binding: AnalysisBinding }
  | { action: "status"; iteration: number; role: AnalysisBinding["role"] }
  | {
      action: "claim";
      iteration: number;
      role: AnalysisBinding["role"];
      owner: string;
    }
  | {
      action: "release";
      iteration: number;
      role: AnalysisBinding["role"];
      job: string;
      token: string;
      terminated: true;
    }
  | {
      action: "complete";
      iteration: number;
      role: AnalysisBinding["role"];
      job: string;
      token: string;
      report: EvidenceReference;
    };

export interface LossMatchReport {
  schemaVersion: 1;
  format: "loss-markdown-v1";
  job: string;
  packetSha256: string;
  findings: {
    game: number;
    decision: string | null;
    classification: "avoidable" | "unavoidable" | "unclear";
    reason: string;
    solution: string;
  }[];
}

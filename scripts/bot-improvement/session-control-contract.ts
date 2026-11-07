import type { SetupOptions } from "./session-contract.ts";

export interface EvidenceReference {
  path: string;
  sha256: string;
}
export type StopReason =
  "owner-stop" | "interrupted" | "max-iterations" | "max-games" | "max-wall-ms";
export interface ExecutionAttempt {
  iteration: number;
  role: "control" | "candidate";
  match: string;
  attempt: number;
  executableIdentity: string;
  status: "running" | "complete" | "failed" | "interrupted";
  /** Capacity held until settlement; never reported as completed games. */
  reservedGames: 4;
  games: { number: number; evidence: EvidenceReference }[];
}
export interface SessionControl {
  schemaVersion: 1;
  fixtureIdentity: string;
  limits: SetupOptions["stop"];
  elapsedMs: number;
  activeSince: number | null;
  stoppingReason: StopReason | null;
  ownerStopToken: string | null;
  acknowledgedMarker: string | null;
  iterations: {
    iteration: number;
    status: "active" | "complete" | "failed" | "interrupted";
    accepted: { path: string; identity: string };
    evidence?: EvidenceReference;
  }[];
  attempts: ExecutionAttempt[];
  records: {
    iteration: number;
    kind: "proposal" | "decision" | "comparison";
    evidence: EvidenceReference;
  }[];
}
export type ControlAction =
  | { action: "plan" | "report" }
  | { action: "start"; iteration: number }
  | { action: "stop"; reason: "owner-stop" | "interrupted" }
  | { action: "continue"; ownerStopToken?: string }
  | {
      action: "reserve";
      runnerIdentity: string;
      iteration: number;
      role: ExecutionAttempt["role"];
      match: string;
      executableIdentity: string;
    }
  | {
      action: "settle";
      iteration: number;
      role: ExecutionAttempt["role"];
      match: string;
      attempt: number;
      status: "complete" | "failed" | "interrupted";
      games: ExecutionAttempt["games"];
    }
  | {
      action: "finish";
      iteration: number;
      status: "complete" | "failed" | "interrupted";
      evidence: EvidenceReference;
    }
  | {
      action: "record";
      iteration: number;
      kind: SessionControl["records"][number]["kind"];
      evidence: EvidenceReference;
    };

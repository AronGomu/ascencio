/** Explicit critical decisions and isolated rule variants; the pool never infers causality. */
export interface ReplayPoolCase {
  id: string;
  game: string;
  actor: "a" | "b";
  decision: string;
  pairing?: string;
}
export interface ReplayPoolReason {
  id: string;
  bot?: string;
  strategy?: string;
  pairing?: string;
  cases: ReplayPoolCase[];
}
export interface ReplayPoolRequest {
  schemaVersion: 1;
  reasons: ReplayPoolReason[];
}
export interface PreparedReplayCase {
  id: string;
  reason: string;
  caseId: string;
  game: string;
  gameId: string;
  actor: "a" | "b";
  decision: string;
  pairing: string;
  replacement: string;
  pins: { path: string; sha256: string }[];
}
export type ReplayCaseStatus =
  "pending" | "running" | "complete" | "ignored" | "failed" | "cancelled";
export interface ReplayCaseResult {
  status: "complete" | "ignored";
  game: string;
  actor: "a" | "b";
  decision: string;
  replacementSha256: string;
  branch?: string;
  control?: { winner: string; turns: number; choiceIds: string[] };
  alternative?: { winner: string; turns: number; choiceIds: string[] };
  choiceChanged?: boolean;
  convertedLossToWin?: boolean;
}
export interface ReplayPoolRow {
  id: string;
  reason: string;
  worker: number;
  status: ReplayCaseStatus;
  output: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  result?: ReplayCaseResult;
}

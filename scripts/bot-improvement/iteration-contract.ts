import type { FrozenBot } from "./session-contract.ts";

/** ARO2-20 extension; FrozenSetup schema 1 stays unchanged. */
export interface IterationOptions {
  session: string;
  iteration: number;
  /** Version of the fixture-aware runner and its execution semantics. */
  runnerIdentity: string;
  baseline?: string;
}
export interface BaselineReceipt {
  schemaVersion: 1;
  comparisonIdentity: string;
  status: "complete";
  completedMatches: string[];
  /** Receipt-relative complete match evidence, one file per match. */
  matches: Record<string, { path: string; sha256: string }>;
}
export interface IterationManifest {
  schemaVersion: 1;
  id: string;
  iteration: number;
  fixture: { path: string; identity: string };
  accepted: { path: string; identity: string; bot: FrozenBot };
  control: { path: string; identity: string };
  self: { path: string; identity: string };
  /** Validation owns assigning a new executable identity after editing. */
  candidate: { path: string; basedOn: string; identity: null };
  opponents: { slot: string; path: string; identity: string }[];
  runnerIdentity: string;
  comparisonIdentity: string;
  baseline: {
    receipt: string | null;
    action: "reuse" | "refresh";
    reason:
      "missing" | "identity-mismatch" | "incomplete" | "corrupt" | "verified";
  };
  plan: {
    control: "reuse-baseline" | "evaluate";
    candidate: "validate-then-evaluate";
    matchesPerEvaluation: 500;
    gamesPerEvaluation: 2000;
  };
}

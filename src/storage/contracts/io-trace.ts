import type { StartupPhase } from "./startup.ts";

export const IO_CATEGORIES = [
  "registry",
  "gameplay",
  "config",
  "user-data",
  "scripts",
  "engine",
  "media",
  "maintenance",
  "diagnostics",
] as const;
export type IoCategory = (typeof IO_CATEGORIES)[number];

export const IO_OPERATIONS = [
  "command",
  "read",
  "metadata",
  "write",
  "sqlite-open",
  "sql-query",
  "hash",
  "parse",
  "phase",
] as const;
export type IoOperation = (typeof IO_OPERATIONS)[number];

export interface IoTraceEvent {
  readonly sessionId: string;
  readonly sequence: number;
  readonly phase: StartupPhase;
  readonly category: IoCategory;
  readonly operation: IoOperation;
  /** Fixed code label. Never user content, search terms, or an absolute path. */
  readonly label: string;
  readonly startedMs: number;
  readonly durationMs: number;
  readonly bytes?: number;
}

export interface IoTraceSnapshot {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly enabled: boolean;
  readonly droppedEvents: number;
  readonly pendingEvents: number;
  readonly events: readonly IoTraceEvent[];
}

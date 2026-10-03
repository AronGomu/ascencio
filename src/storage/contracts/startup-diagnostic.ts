import type { StartupPhase } from "./startup.ts";

export interface DiagnosticLocation {
  readonly file: string;
  readonly pointer?: string;
  readonly line?: number;
  readonly column?: number;
  readonly modId?: string;
}

export interface StartupDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly phase: StartupPhase;
  readonly message: string;
  readonly source?: DiagnosticLocation;
  readonly expected?: string;
  readonly received?: string;
  readonly notes: readonly {
    readonly message: string;
    readonly source?: DiagnosticLocation;
  }[];
  readonly causes: readonly string[];
  readonly remediation: string;
}

export interface StartupLogStatus {
  readonly sessionId: string;
  readonly path: string | null;
  readonly loggingError: string | null;
  readonly diagnostics: readonly StartupDiagnostic[];
  readonly droppedDiagnostics: number;
}

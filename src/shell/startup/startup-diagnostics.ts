import {
  invokeNative,
  type StartupDiagnostic,
  type StartupLogStatus,
} from "../../storage/index.ts";

export const emptyStartupLog: StartupLogStatus = {
  sessionId: "unavailable",
  path: null,
  loggingError: null,
  diagnostics: [],
  droppedDiagnostics: 0,
};

export function startupDiagnostic(error: unknown): StartupDiagnostic {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "remediation" in error &&
    "notes" in error &&
    "causes" in error
  )
    return error as StartupDiagnostic;
  const causes: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current !== undefined && depth < 8; depth++) {
    causes.push(
      current instanceof Error
        ? current.message
        : typeof current === "string"
          ? current
          : "Startup failed",
    );
    current = current instanceof Error ? current.cause : undefined;
  }
  const message = causes[0] ?? "Startup failed";
  const code =
    error instanceof Error && error.name === "AbortError"
      ? "OPERATION_CANCELLED"
      : (/^([A-Z][A-Z0-9_]+)(?::|$)/.exec(causes[0] ?? "")?.[1] ??
        "STARTUP_FAILED");
  const file = /^[A-Z][A-Z0-9_]+:\s*([^\n]+?\.(?:json|lua|wasm))(?::|$)/.exec(
    message,
  )?.[1];
  const position = /line (\d+) column (\d+)/.exec(message);
  const hashes = /expected ([a-f0-9]{64}) received ([a-f0-9]{64})/.exec(
    message,
  );
  return {
    code,
    severity: "error",
    phase: code.startsWith("MOD_") ? "mod-composition" : "startup",
    message,
    ...(file
      ? {
          source: {
            file,
            ...(position
              ? { line: Number(position[1]), column: Number(position[2]) }
              : {}),
          },
        }
      : {}),
    ...(hashes ? { expected: hashes[1]!, received: hashes[2]! } : {}),
    notes: [],
    causes,
    remediation:
      code === "APP_ALREADY_OPEN"
        ? "Close the other application instance, then retry."
        : code.startsWith("BASE_") || code.startsWith("ENGINE_")
          ? "Repair the named critical snapshot from the bundled trusted release, then retry. Edited authoring JSON is not activated in normal mode."
          : code.startsWith("MOD_")
            ? "Correct the enabled mods or restore their selected folder, or explicitly disable mods and retry. Your saves have not been removed."
            : code.startsWith("USER_DATA_")
              ? "Keep the current file. While the app is closed, repair user-data.json or restore a known valid copy, then reopen."
              : "Correct the reported content or user-data problem, then retry. Your saves have not been removed.",
  };
}

export function startupDiagnostics(
  error: unknown,
): readonly StartupDiagnostic[] {
  if (
    typeof error === "object" &&
    error !== null &&
    "diagnostics" in error &&
    Array.isArray(error.diagnostics)
  ) {
    const diagnostics = error.diagnostics.slice(0, 128).map(startupDiagnostic);
    if (error.diagnostics.length > 128)
      diagnostics.push({
        code: "DIAGNOSTICS_TRUNCATED",
        severity: "warning",
        phase: "startup",
        message: `${error.diagnostics.length - 128} further diagnostics suppressed.`,
        notes: [],
        causes: [],
        remediation:
          "Correct the reported independent errors and retry to see remaining diagnostics.",
      });
    if (diagnostics.length) return diagnostics;
  }
  return [startupDiagnostic(error)];
}

export async function openStartupLog(folder = false): Promise<void> {
  await invokeNative("native_startup_log_open", { folder });
}

export function readStartupLog(): Promise<StartupLogStatus> {
  return invokeNative("native_startup_log_status");
}
export function recordStartupDiagnostic(
  diagnostic: StartupDiagnostic,
): Promise<StartupLogStatus> {
  return invokeNative("native_startup_log_record", { diagnostic });
}

import {
  invoke,
  type InvokeArgs,
  type InvokeOptions,
} from "@tauri-apps/api/core";
import { createIoTrace } from "../diagnostics/io-trace.ts";
import type { IoTraceSnapshot } from "../contracts/io-trace.ts";
import { nativeCommandCategory } from "./command-category.ts";

let trace: ReturnType<typeof createIoTrace> | null = null;

/** Tracing is enabled only by the native process's explicit environment flag. */
export async function invokeNative<T>(
  command: string,
  ...parameters: [args?: InvokeArgs, options?: InvokeOptions]
): Promise<T> {
  const [args] = parameters;
  const finish = trace?.begin(
    nativeCommandCategory(command, args),
    ["native_user_json_write", "native_user_json_commit"].includes(command)
      ? "write"
      : "command",
    command,
  );
  try {
    const result = await invoke<T>(command, ...parameters);
    if (
      trace === null &&
      ["native_content_status", "native_startup_load"].includes(command) &&
      typeof result === "object" &&
      result !== null &&
      "ioTraceSessionId" in result &&
      typeof result.ioTraceSessionId === "string"
    ) {
      trace = createIoTrace(result.ioTraceSessionId);
      Object.defineProperty(globalThis, "__ASCENCIO_IO_TRACE__", {
        value: Object.freeze({ snapshot: () => nativeIoTrace.snapshot() }),
        configurable: true,
      });
    }
    return result;
  } finally {
    finish?.();
  }
}

export const nativeIoTrace = {
  markStartup(): void {
    trace?.mark("startup");
  },
  async markMaintenance(): Promise<void> {
    await invoke("native_io_trace_maintenance");
    trace?.mark("maintenance");
  },
  get enabled(): boolean {
    return trace !== null;
  },
  async markReady(): Promise<void> {
    if (trace === null) return;
    try {
      await invoke("native_io_trace_ready");
      trace.mark("ready");
    } catch {
      trace.begin("diagnostics", "command", "ready-marker-unavailable")();
    }
  },
  async markBaselineReady(): Promise<void> {
    if (trace === null) return;
    try {
      await invoke("native_io_trace_baseline_ready");
      trace.mark("baseline-ready");
    } catch {
      // Telemetry never changes admission. A missing marker fails the evidence gate.
      trace.begin("diagnostics", "command", "baseline-marker-unavailable")();
    }
  },
  async snapshot(): Promise<{
    readonly frontend: IoTraceSnapshot | null;
    readonly native: IoTraceSnapshot | null;
  }> {
    if (trace === null) return { frontend: null, native: null };
    const frontend = trace.snapshot();
    const native = await invoke<IoTraceSnapshot>("native_io_trace_snapshot");
    const after = trace.snapshot();
    if (
      frontend.events.length !== after.events.length ||
      frontend.droppedEvents !== after.droppedEvents ||
      frontend.pendingEvents !== after.pendingEvents
    )
      throw new Error("IO_TRACE_CAPTURE_CHANGED");
    return { frontend, native };
  },
};

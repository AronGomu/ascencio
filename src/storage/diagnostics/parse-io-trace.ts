import {
  IO_CATEGORIES,
  IO_OPERATIONS,
  type IoTraceSnapshot,
} from "../contracts/io-trace.ts";
import { STARTUP_PHASES } from "../contracts/startup.ts";

/** A malformed/truncated capture must never produce a successful no-read gate. */
export function parseIoTraceSnapshot(value: unknown): IoTraceSnapshot {
  const invalid = () => {
    throw new Error("IO_TRACE_INVALID");
  };
  if (typeof value !== "object" || value === null) return invalid();
  const capture = value as Record<string, unknown>;
  if (
    capture.schemaVersion !== 1 ||
    typeof capture.sessionId !== "string" ||
    capture.sessionId.length === 0 ||
    typeof capture.enabled !== "boolean" ||
    !count(capture.droppedEvents) ||
    !count(capture.pendingEvents) ||
    !Array.isArray(capture.events)
  )
    return invalid();
  let previous = 0;
  for (const raw of capture.events) {
    if (typeof raw !== "object" || raw === null) return invalid();
    const event = raw as Record<string, unknown>;
    if (
      event.sessionId !== capture.sessionId ||
      !count(event.sequence) ||
      event.sequence <= previous ||
      typeof event.label !== "string" ||
      !(IO_CATEGORIES as readonly unknown[]).includes(event.category) ||
      !(IO_OPERATIONS as readonly unknown[]).includes(event.operation) ||
      !(STARTUP_PHASES as readonly unknown[]).includes(event.phase) ||
      !time(event.startedMs) ||
      !time(event.durationMs) ||
      (event.bytes !== undefined && !count(event.bytes))
    )
      return invalid();
    previous = event.sequence;
  }
  return value as IoTraceSnapshot;
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function time(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

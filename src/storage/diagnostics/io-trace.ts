import type {
  IoCategory,
  IoOperation,
  IoTraceEvent,
  IoTraceSnapshot,
} from "../contracts/io-trace.ts";
import type { StartupPhase } from "../contracts/startup.ts";

export function createIoTrace(
  sessionId: string,
  limit = 4096,
  clock: () => number = () => performance.now(),
) {
  const events: IoTraceEvent[] = [];
  const origin = clock();
  let phase: StartupPhase = "startup";
  let sequence = 0;
  let droppedEvents = 0;
  let pendingEvents = 0;
  function append(event: IoTraceEvent): void {
    if (events.length < limit) events.push(Object.freeze(event));
    else droppedEvents++;
  }
  function begin(category: IoCategory, operation: IoOperation, label: string) {
    const startedMs = clock() - origin;
    const startPhase = phase;
    const startSequence = ++sequence;
    pendingEvents++;
    let finished = false;
    return (bytes?: number): void => {
      if (finished) return;
      finished = true;
      pendingEvents--;
      append({
        sessionId,
        sequence: startSequence,
        phase: startPhase,
        category,
        operation,
        label,
        startedMs,
        durationMs: clock() - origin - startedMs,
        ...(bytes === undefined ? {} : { bytes }),
      });
    };
  }
  return {
    begin,
    mark(next: StartupPhase): void {
      phase = next;
      begin("diagnostics", "phase", next)();
    },
    snapshot(): IoTraceSnapshot {
      return Object.freeze({
        schemaVersion: 1,
        sessionId,
        enabled: true,
        droppedEvents,
        pendingEvents,
        events: Object.freeze(
          [...events].sort((a, b) => a.sequence - b.sequence),
        ),
      });
    },
  };
}

/** Logical data reads only; OS/module loading and optional media are separate. */
export function assertNoCriticalReads(
  snapshot: IoTraceSnapshot,
  boundary: "ready" | "baseline-ready" = "ready",
): void {
  if (!snapshot.enabled) throw new Error("IO_TRACE_DISABLED");
  if (snapshot.droppedEvents > 0) throw new Error("IO_TRACE_TRUNCATED");
  if (snapshot.pendingEvents > 0) throw new Error("IO_TRACE_IN_FLIGHT");
  const markers = snapshot.events.filter(
    (event) =>
      event.operation === "phase" &&
      event.label === boundary &&
      event.phase === boundary,
  );
  if (markers.length === 0) throw new Error("IO_TRACE_BOUNDARY_MISSING");
  const intervals = markers.map((marker) => ({
    marker,
    end: snapshot.events.find(
      (event) =>
        event.sequence > marker.sequence &&
        event.operation === "phase" &&
        ((event.label === "maintenance" && event.phase === "maintenance") ||
          (event.label === "startup" && event.phase === "startup")),
    ),
  }));
  for (const event of snapshot.events) {
    if (
      event.category === "media" ||
      event.category === "diagnostics" ||
      (event.category === "maintenance" &&
        (event.phase === "maintenance" || event.operation === "command")) ||
      !["command", "read", "metadata", "sqlite-open", "sql-query"].includes(
        event.operation,
      )
    )
      continue;
    for (const { marker, end } of intervals) {
      if (event.sequence > marker.sequence) {
        if (end && event.sequence > end.sequence) continue;
        throw new Error(
          `CRITICAL_READ_AFTER_READY:${event.category}:${event.label}`,
        );
      }
      if (event.startedMs + event.durationMs > marker.startedMs)
        throw new Error(
          `CRITICAL_READ_CROSSED_READY:${event.category}:${event.label}`,
        );
    }
  }
}

/** Bounded, metadata-only workflow event feed and coherent status/report snapshots. */
import { readFile, mkdir } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { locked, writeOutput } from "./output-storage.ts";
export interface WorkflowCoverage {
  scheduledMatches: number;
  finalizedMatches: number;
  noLossMatches: number;
  totalLosses: number;
  selectedLosses: number;
  reviewedLosses: number;
  acknowledgedPages: number;
  expectedPages: number;
  complete: boolean;
  mode: "full" | "sample" | "two-pass";
}
export interface WorkflowResources {
  elapsedMs: number;
  maxWallMs: number;
  actualBytes: number;
  reservedBytes: number;
  maxBytes: number;
  activeAnalysts: number;
  analystSlots: number;
}
export interface WorkflowEvent {
  id: string;
  sourceIdentity: string;
  kind:
    | "phase"
    | "publication"
    | "checkpoint"
    | "incident"
    | "limit"
    | "completion"
    | "heartbeat";
  phase: string;
  message?: string;
  coverage?: WorkflowCoverage;
  resources?: WorkflowResources;
  counters?: Record<string, number>;
}
export interface WorkflowSnapshot {
  schemaVersion: 1;
  revision: number;
  sourceIdentity: string;
  updatedAt: number;
  current: WorkflowEvent;
  coverage?: WorkflowCoverage;
  resources?: WorkflowResources;
  events: (WorkflowEvent & { at: number; revision: number })[];
  report: string;
}
const location = (session: string) =>
  path.join(path.resolve(session), ".workflow-telemetry", "state.json");
function validate(event: WorkflowEvent) {
  if (
    !event.id ||
    event.id.length > 256 ||
    !event.sourceIdentity ||
    event.sourceIdentity.length > 256 ||
    !event.phase ||
    event.phase.length > 128 ||
    ![
      "phase",
      "publication",
      "checkpoint",
      "incident",
      "limit",
      "completion",
      "heartbeat",
    ].includes(event.kind)
  )
    throw Error("Invalid workflow event identity");
  if (
    (event.message?.length ?? 0) > 2048 ||
    Object.keys(event.counters ?? {}).length > 32 ||
    Object.keys(event.counters ?? {}).some((key) => key.length > 128)
  )
    throw Error("Workflow event exceeds bounded metadata contract");
  const numbers = [
    ...Object.values(event.counters ?? {}),
    ...Object.values(event.resources ?? {}),
    ...Object.entries(event.coverage ?? {})
      .filter(([key]) => !["complete", "mode"].includes(key))
      .map(([, value]) => value),
  ];
  if (
    numbers.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)
  )
    throw Error("Invalid workflow counter");
  const c = event.coverage;
  if (
    c &&
    (c.reviewedLosses > c.selectedLosses ||
      c.selectedLosses > c.totalLosses ||
      c.finalizedMatches > c.scheduledMatches ||
      c.noLossMatches > c.finalizedMatches ||
      c.acknowledgedPages > c.expectedPages ||
      !["full", "sample", "two-pass"].includes(c.mode))
  )
    throw Error("Inconsistent workflow coverage");
  if (
    c?.complete &&
    (c.mode !== "full" ||
      c.reviewedLosses !== c.totalLosses ||
      c.finalizedMatches !== c.scheduledMatches)
  )
    throw Error("Partial coverage cannot be complete");
  const r = event.resources;
  if (r && r.activeAnalysts > r.analystSlots)
    throw Error("Analyst capacity exceeded");
}
function report(snapshot: Omit<WorkflowSnapshot, "report">) {
  const c = snapshot.coverage,
    r = snapshot.resources;
  return (
    [
      `# Workflow status — revision ${snapshot.revision}`,
      `Source: ${snapshot.sourceIdentity}`,
      `Phase: ${snapshot.current.phase} (${snapshot.current.kind})`,
      snapshot.current.message ?? "",
      ...(c
        ? [
            `Coverage mode: ${c.mode}; full coverage complete: ${c.complete}`,
            `${c.reviewedLosses}/${c.totalLosses} losses reviewed; ${c.selectedLosses} selected.`,
            `${c.acknowledgedPages}/${c.expectedPages} pages acknowledged; acknowledgements are not findings.`,
            `${c.finalizedMatches}/${c.scheduledMatches} matches finalized; ${c.noLossMatches} have no target losses.`,
          ]
        : ["Coverage: unknown; no completeness inferred."]),
      ...(r
        ? [
            `Time: ${r.elapsedMs}/${r.maxWallMs} ms. Storage: ${r.actualBytes} actual + ${r.reservedBytes} reserved / ${r.maxBytes} bytes.`,
            `Analysts: ${r.activeAnalysts}/${r.analystSlots}.`,
          ]
        : []),
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  );
}
export async function readWorkflowSnapshot(
  session: string,
): Promise<WorkflowSnapshot | null> {
  try {
    return JSON.parse(
      await readFile(location(session), "utf8"),
    ) as WorkflowSnapshot;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
/** Call after owning tools have checkpointed authoritative metadata. No gameplay scan. */
export async function recordWorkflowEvent(
  session: string,
  event: WorkflowEvent,
) {
  validate(event);
  const file = location(session);
  await mkdir(path.dirname(file), { recursive: true });
  return locked(path.dirname(file), async () => {
    const previous = await readWorkflowSnapshot(session);
    if (previous && previous.sourceIdentity !== event.sourceIdentity)
      throw Error("Telemetry source identity changed; use a distinct session");
    const replay = previous?.events.find((e) => e.id === event.id);
    if (replay) {
      const stored = Object.fromEntries(
        Object.entries(replay).filter(
          ([key]) => key !== "at" && key !== "revision",
        ),
      );
      if (!isDeepStrictEqual(stored, event))
        throw Error("Conflicting telemetry event");
      return previous!;
    }
    const revision = (previous?.revision ?? 0) + 1,
      at = Date.now();
    const next: Omit<WorkflowSnapshot, "report"> = {
      schemaVersion: 1,
      revision,
      sourceIdentity: event.sourceIdentity,
      updatedAt: at,
      current: event,
      events: [...(previous?.events ?? []), { ...event, at, revision }].slice(
        -128,
      ),
      ...((event.coverage ?? previous?.coverage)
        ? { coverage: event.coverage ?? previous!.coverage! }
        : {}),
      ...((event.resources ?? previous?.resources)
        ? { resources: event.resources ?? previous!.resources! }
        : {}),
    };
    const snapshot = { ...next, report: report(next) };
    // One atomic artifact contains both current state and its report. Never two
    // independently updated files that could describe different transitions.
    await writeOutput(file, JSON.stringify(snapshot) + "\n");
    return snapshot;
  });
}
/** Local filesystem events plus bounded lightweight reconciliation; no model wakes. */
export async function subscribeWorkflow(
  session: string,
  onChange: (value: WorkflowSnapshot) => void,
  onError: (error: unknown) => void,
  intervalMs = 30000,
) {
  if (
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 100 ||
    intervalMs > 60000
  )
    throw Error("Invalid reconciliation interval");
  const dir = path.dirname(location(session));
  await mkdir(dir, { recursive: true });
  let revision = -1,
    closed = false,
    pending = false;
  const refresh = async () => {
    if (closed || pending) return;
    pending = true;
    try {
      const state = await readWorkflowSnapshot(session);
      if (!closed && state && state.revision > revision) {
        revision = state.revision;
        onChange(state);
      }
    } catch (e) {
      if (!closed) onError(e);
    } finally {
      pending = false;
    }
  };
  const watcher: FSWatcher = watch(dir, (_event, filename) => {
    if (filename?.toString() === "state.json") void refresh();
  });
  watcher.on("error", onError);
  const timer = setInterval(() => void refresh(), intervalMs);
  timer.unref();
  await refresh();
  return () => {
    closed = true;
    clearInterval(timer);
    watcher.close();
  };
}
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Standalone dashboard; content is rendered only from the bounded snapshot. */
export function renderWorkflowDashboard(snapshot: WorkflowSnapshot) {
  const c = snapshot.coverage,
    r = snapshot.resources;
  const row = (label: string, value: unknown) =>
    `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workflow coverage</title><style>:root{color-scheme:light;--background:#f4f6f8;--foreground:#14212c}body{background:var(--background,#f4f6f8);color:var(--foreground,#14212c);font:16px/1.5 system-ui,sans-serif;max-width:960px;margin:40px auto;padding:0 24px}table{width:100%;border-collapse:collapse;background:#fff;color:#14212c}th,td{text-align:left;padding:12px;border-bottom:1px solid #d6dde3}th{width:45%}small{color:#415365}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:2rem}</style><h1>Workflow coverage</h1><p>${escape(snapshot.current.phase)} · revision ${snapshot.revision}</p><small>Source: ${escape(snapshot.sourceIdentity)} · ${escape(new Date(snapshot.updatedAt).toISOString())}</small><table>${c ? [row("Review policy", c.mode), row("Full coverage complete", c.complete ? "Yes" : "No"), row("Losses fully reviewed", `${c.reviewedLosses} / ${c.totalLosses}`), row("Losses selected", c.selectedLosses), row("Pages acknowledged", `${c.acknowledgedPages} / ${c.expectedPages}`), row("Matches finalized", `${c.finalizedMatches} / ${c.scheduledMatches}`), row("Matches without losses", c.noLossMatches)].join("") : row("Coverage", "Unknown")}${r ? [row("Time used / limit (ms)", `${r.elapsedMs} / ${r.maxWallMs}`), row("Actual + reserved / limit (bytes)", `${r.actualBytes} + ${r.reservedBytes} / ${r.maxBytes}`), row("Active analysts / slots", `${r.activeAnalysts} / ${r.analystSlots}`)].join("") : ""}</table><p>Page acknowledgements record reading progress. Only validated findings count as fully reviewed losses.</p><h2>Current report</h2><pre>${escape(snapshot.report)}</pre></html>`;
}

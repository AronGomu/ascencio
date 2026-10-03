import { describe, expect, it } from "vitest";
import {
  createIoTrace,
  assertNoCriticalReads,
} from "../../../src/storage/diagnostics/io-trace.ts";
import {
  READY_REQUIREMENTS,
  assertStartupReady,
} from "../../../src/storage/contracts/startup.ts";
import { nativeCommandCategory } from "../../../src/storage/native/command-category.ts";
import { parseIoTraceSnapshot } from "../../../src/storage/diagnostics/parse-io-trace.ts";

describe("ADR-104 startup admission and I/O evidence", () => {
  it("refuses disabled, incomplete or malformed evidence", () => {
    const trace = createIoTrace("attempt-1");
    trace.mark("ready");
    expect(() => parseIoTraceSnapshot(trace.snapshot())).not.toThrow();
    for (const field of [
      "schemaVersion",
      "sessionId",
      "enabled",
      "droppedEvents",
      "pendingEvents",
      "events",
    ]) {
      const capture = { ...trace.snapshot(), [field]: undefined };
      expect(() => parseIoTraceSnapshot(capture)).toThrow("IO_TRACE_INVALID");
    }
    expect(() =>
      assertNoCriticalReads({ ...trace.snapshot(), enabled: false }),
    ).toThrow("IO_TRACE_DISABLED");
    trace.begin("gameplay", "read", "not-finished");
    expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
      "IO_TRACE_IN_FLIGHT",
    );
  });
  it("requires every critical preparation step before READY", () => {
    expect(() => assertStartupReady([])).toThrow("STARTUP_NOT_PREPARED");
    for (const missing of READY_REQUIREMENTS) {
      expect(() =>
        assertStartupReady(
          READY_REQUIREMENTS.filter((step) => step !== missing),
        ),
      ).toThrow(missing);
    }
    expect(() => assertStartupReady(READY_REQUIREMENTS)).not.toThrow();
  });

  it("separates current menu readiness from the complete startup contract", () => {
    const trace = createIoTrace("attempt-1");
    trace.mark("baseline-ready");
    expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
      "IO_TRACE_BOUNDARY_MISSING",
    );
    expect(() =>
      assertNoCriticalReads(trace.snapshot(), "baseline-ready"),
    ).not.toThrow();
  });

  it("rejects registry, catalog, config, save, script and engine reads after READY", () => {
    for (const category of [
      "registry",
      "gameplay",
      "config",
      "user-data",
      "scripts",
      "engine",
    ] as const) {
      const trace = createIoTrace("attempt-1");
      trace.mark("ready");
      trace.begin(category, "read", "test-read")();
      expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
        "CRITICAL_READ_AFTER_READY",
      );
    }
  });

  it("allows media, diagnostics and atomic writes, but catches a writer's nested reread", () => {
    const trace = createIoTrace("attempt-1");
    trace.mark("ready");
    trace.begin("media", "read", "artwork")();
    trace.begin("diagnostics", "write", "session-log")();
    trace.begin("user-data", "write", "save")();
    expect(() => assertNoCriticalReads(trace.snapshot())).not.toThrow();
    trace.begin("user-data", "read", "write-source-compare")();
    expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
      "write-source-compare",
    );
  });

  it("captures the start phase of in-flight reads and keeps sessions independent", () => {
    let now = 0;
    const trace = createIoTrace("attempt-1", 8, () => now);
    const finish = trace.begin("gameplay", "read", "preload");
    now = 4;
    trace.mark("ready");
    now = 9;
    finish(512);
    finish(512);
    const snapshot = trace.snapshot();
    expect(
      snapshot.events.filter((event) => event.label === "preload"),
    ).toEqual([
      expect.objectContaining({
        sessionId: "attempt-1",
        phase: "startup",
        durationMs: 9,
        bytes: 512,
      }),
    ]);
    expect(() => assertNoCriticalReads(snapshot)).toThrow(
      "CRITICAL_READ_CROSSED_READY",
    );
    expect(createIoTrace("attempt-2").snapshot().events).toEqual([]);
  });

  it("fails closed on truncated evidence and snapshots do not mutate the collector", () => {
    const trace = createIoTrace("attempt-1", 2);
    trace.mark("ready");
    trace.begin("media", "read", "one")();
    const before = trace.snapshot();
    trace.begin("gameplay", "read", "dropped-read")();
    expect(before.events).toHaveLength(2);
    expect(trace.snapshot().droppedEvents).toBe(1);
    expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
      "IO_TRACE_TRUNCATED",
    );
  });

  it("requires the maintenance phase for critical maintenance reads after ready", () => {
    const trace = createIoTrace("attempt-maintenance");
    trace.mark("ready");
    trace.begin("maintenance", "read", "critical-resource")();
    expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
      "CRITICAL_READ_AFTER_READY",
    );
    const explicit = createIoTrace("explicit-maintenance");
    explicit.mark("ready");
    explicit.mark("maintenance");
    explicit.begin("maintenance", "read", "critical-resource")();
    expect(() => assertNoCriticalReads(explicit.snapshot())).not.toThrow();
  });
  it("classifies nested queries and distinguishes executable assets from optional media", () => {
    expect(
      nativeCommandCategory("native_content_query", {
        request: { kind: "module-query", query: { kind: "scripts" } },
      }),
    ).toBe("scripts");
    expect(
      nativeCommandCategory("native_content_query", {
        request: {
          kind: "asset",
          packageId: "duel-core",
          path: "engine/ocgcore.sync.wasm",
        },
      }),
    ).toBe("engine");
    expect(
      nativeCommandCategory("native_content_query", {
        request: {
          kind: "asset",
          packageId: "chapter-01",
          path: "engine/ocgcore.sync.wasm",
        },
      }),
    ).toBe("media");
    expect(
      nativeCommandCategory("native_content_query", {
        request: { kind: "config" },
      }),
    ).toBe("config");
    expect(nativeCommandCategory("native_package_acquire")).toBe("registry");
    expect(nativeCommandCategory("native_user_json_write")).toBe("user-data");
  });
});

it("verifies every ready interval across explicit maintenance and a fresh preparation", () => {
  const trace = createIoTrace("process-session");
  trace.mark("ready");
  trace.mark("maintenance");
  trace.begin("maintenance", "read", "import")();
  trace.mark("startup");
  trace.begin("gameplay", "read", "new-preload")();
  trace.begin("user-data", "read", "new-user-snapshot")();
  trace.mark("ready");
  trace.begin("media", "read", "cover")();
  expect(() => assertNoCriticalReads(trace.snapshot())).not.toThrow();
});
it("cannot hide a forbidden earlier ready read by starting another preparation", () => {
  const trace = createIoTrace("process-session");
  trace.mark("ready");
  trace.begin("gameplay", "read", "forbidden-first-session")();
  trace.mark("maintenance");
  trace.mark("startup");
  trace.begin("gameplay", "read", "new-preload")();
  trace.mark("ready");
  expect(() => assertNoCriticalReads(trace.snapshot())).toThrow(
    "CRITICAL_READ_AFTER_READY:gameplay:forbidden-first-session",
  );
});

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createIoTrace } from "../../src/storage/diagnostics/io-trace.ts";

describe("startup I/O capture command", () => {
  it("accepts full matching captures, rejects current rereads and incomplete evidence", () => {
    mkdirSync(".tmp", { recursive: true });
    const root = mkdtempSync(path.resolve(".tmp/startup-io-gate-"));
    const file = path.join(root, "capture.json");
    const frontend = createIoTrace("attempt-1");
    const native = createIoTrace("attempt-1");
    frontend.mark("baseline-ready");
    native.mark("baseline-ready");
    const save = (capture: unknown) =>
      writeFileSync(file, JSON.stringify(capture));
    const run = (boundary = "baseline-ready") =>
      spawnSync(
        process.execPath,
        ["scripts/verify-startup-io.ts", file, boundary],
        { encoding: "utf8" },
      );
    try {
      save({ frontend: frontend.snapshot(), native: native.snapshot() });
      expect(
        execFileSync(
          process.execPath,
          ["scripts/verify-startup-io.ts", file, "baseline-ready"],
          { encoding: "utf8" },
        ),
      ).toContain("No critical reads after baseline-ready");
      expect(run("ready").stderr).toContain("IO_TRACE_BOUNDARY_MISSING");
      for (const capture of [
        {
          frontend: frontend.snapshot(),
          native: { ...native.snapshot(), sessionId: "other-attempt" },
        },
        { frontend: frontend.snapshot(), native: null },
        {
          frontend: { ...frontend.snapshot(), droppedEvents: 1 },
          native: native.snapshot(),
        },
        { frontend: frontend.snapshot() },
      ]) {
        save(capture);
        expect(run().status).toBe(1);
      }
      native.begin("user-data", "read", "writer-compare")();
      save({ frontend: frontend.snapshot(), native: native.snapshot() });
      const rejected = run();
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain(
        "CRITICAL_READ_AFTER_READY:user-data:writer-compare",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

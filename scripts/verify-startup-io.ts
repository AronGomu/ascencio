import { readFile } from "node:fs/promises";
import { assertNoCriticalReads } from "../src/storage/diagnostics/io-trace.ts";
import { parseIoTraceSnapshot } from "../src/storage/diagnostics/parse-io-trace.ts";

const [file, boundary = "ready", ...extra] = process.argv.slice(2);
if (
  !file ||
  !["ready", "baseline-ready"].includes(boundary) ||
  extra.length > 0
) {
  console.error(
    "Usage: node scripts/verify-startup-io.ts <capture.json> [ready|baseline-ready]",
  );
  process.exitCode = 2;
} else {
  try {
    const capture: unknown = JSON.parse(await readFile(file, "utf8"));
    if (
      typeof capture !== "object" ||
      capture === null ||
      !("native" in capture) ||
      !("frontend" in capture)
    )
      throw new Error("IO_TRACE_INVALID");
    const native = parseIoTraceSnapshot(capture.native);
    const frontend = parseIoTraceSnapshot(capture.frontend);
    if (native.sessionId !== frontend.sessionId)
      throw new Error("IO_TRACE_SESSION_MISMATCH");
    assertNoCriticalReads(native, boundary as "ready" | "baseline-ready");
    assertNoCriticalReads(frontend, boundary as "ready" | "baseline-ready");
    console.log(
      `No critical reads after ${boundary}: ${native.events.length} native events, ${frontend.events.length} frontend events.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "IO_TRACE_INVALID");
    process.exitCode = 1;
  }
}

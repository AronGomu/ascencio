import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reporter } from "vitest/reporters";

export default class TestTimingReporter implements Reporter {
  onTestRunEnd: NonNullable<Reporter["onTestRunEnd"]> = async (
    modules,
    errors,
    reason,
  ) => {
    const files = modules.map((module) => {
      const diagnostic = module.diagnostic();
      const tests = [...module.children.allTests()];
      return {
        file: module.relativeModuleId,
        state: module.state(),
        cases: tests.length,
        passed: tests.filter((test) => test.result().state === "passed").length,
        failed: tests.filter((test) => test.result().state === "failed").length,
        skipped: tests.filter((test) => test.result().state === "skipped")
          .length,
        environmentMs: diagnostic.environmentSetupDuration,
        runnerPreparationMs: diagnostic.prepareDuration,
        setupFilesMs: diagnostic.setupDuration,
        collectionAndImportsMs: diagnostic.collectDuration,
        testsAndHooksMs: diagnostic.duration,
      };
    });
    const output = path.resolve(
      process.env.TEST_TIMING_OUTPUT ?? "generated/tests/runner-timing.json",
    );
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(
      output,
      JSON.stringify(
        {
          node: process.version,
          platform: process.platform,
          reason,
          processElapsedMs: process.uptime() * 1000,
          unhandledErrors: errors,
          note: "Per-file worker durations overlap. Do not sum them as wall time. Test duration includes hooks; collection includes imports and suite callbacks.",
          files,
        },
        null,
        2,
      ) + "\n",
    );
  };
}

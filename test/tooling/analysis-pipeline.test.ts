import test from "node:test";
import assert from "node:assert/strict";
import { runAnalysisPipeline } from "../../scripts/bot-improvement/analysis-pipeline.ts";
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
test("pipeline analyzes first finalized slice before evaluation ends, respects slots and global completion barrier", async () => {
  let evaluated = false,
    firstDuringEvaluation = false,
    active = 0,
    peak = 0;
  const slices: { id: number; status: string }[] = [];
  const events: string[] = [];
  const result = await runAnalysisPipeline({
    maxWallMs: 2000,
    analystSlots: 4,
    preparationSlots: 2,
    maxPendingSlices: 1,
    reconcileMs: 5,
    evaluate: async (_signal, publish) => {
      slices.push({ id: 1, status: "pending" });
      publish();
      await pause(60);
      slices.push({ id: 2, status: "pending" });
      publish();
      await pause(20);
      evaluated = true;
    },
    sync: async () => ({
      pending: slices.filter((s) => s.status === "pending").length,
      preparationComplete: slices.length === 2,
      selectedReviewComplete:
        slices.length === 2 && slices.every((s) => s.status === "complete"),
      fullCoverage:
        slices.length === 2 && slices.every((s) => s.status === "complete"),
    }),
    claim: async () => {
      const s = slices.find((s) => s.status === "pending");
      if (s) s.status = "claimed";
      return s ?? null;
    },
    analyze: async (s) => {
      active++;
      peak = Math.max(peak, active);
      if (s.id === 1) firstDuringEvaluation = !evaluated;
      await pause(10);
      s.status = "complete";
      active--;
    },
    admit: async () => ({ analystSlots: 1, preparationSlots: 1 }),
    event: async (e) => {
      events.push(e.type);
    },
  });
  assert.equal(firstDuringEvaluation, true);
  assert.equal(peak, 1);
  assert.equal(evaluated, true);
  assert.equal(result.fullCoverage, true);
  assert.equal(events.at(-1), "analysis-settled");
});
test("pipeline applies backpressure, preserves partial coverage and times out zero-resource admission", async () => {
  let syncs = 0;
  await assert.rejects(
    runAnalysisPipeline({
      maxWallMs: 50,
      analystSlots: 1,
      preparationSlots: 1,
      maxPendingSlices: 1,
      reconcileMs: 5,
      shutdownGraceMs: 0,
      evaluate: async () => {},
      sync: async () => {
        syncs++;
        return {
          pending: 1,
          preparationComplete: true,
          selectedReviewComplete: false,
          fullCoverage: false,
        };
      },
      claim: async () => ({}),
      analyze: async () => {},
      admit: async () => ({ analystSlots: 0, preparationSlots: 1 }),
    }),
    /wall budget/,
  );
  assert.equal(syncs, 1);
  const result = await runAnalysisPipeline({
    maxWallMs: 500,
    analystSlots: 1,
    preparationSlots: 1,
    maxPendingSlices: 1,
    reconcileMs: 5,
    evaluate: async () => {},
    sync: async () => ({
      pending: 0,
      preparationComplete: true,
      selectedReviewComplete: true,
      fullCoverage: false,
    }),
    claim: async () => null,
    analyze: async () => {},
    admit: async () => ({ analystSlots: 1, preparationSlots: 1 }),
  });
  assert.equal(result.fullCoverage, false);
  assert.equal(result.selectedReviewComplete, true);
});
test("analyst failure aborts evaluation and cannot report pipeline complete", async () => {
  let cancelled = false;
  await assert.rejects(
    runAnalysisPipeline({
      maxWallMs: 500,
      analystSlots: 1,
      preparationSlots: 1,
      maxPendingSlices: 1,
      reconcileMs: 5,
      evaluate: async (signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            cancelled = true;
            resolve();
          });
        }),
      sync: async () => ({
        pending: 1,
        preparationComplete: false,
        selectedReviewComplete: false,
        fullCoverage: false,
      }),
      claim: async () => ({}),
      analyze: async () => {
        throw Error("analyst failed");
      },
      admit: async () => ({ analystSlots: 1, preparationSlots: 1 }),
    }),
    /analyst failed/,
  );
  assert.equal(cancelled, true);
});

test("isolated finalized-file publication overlaps analyst reading with an unfinished evaluation", async () => {
  const { mkdtemp, writeFile, readFile, readdir, rm } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "pipeline-publication-"));
  const claimed = new Set<string>(),
    completed = new Set<string>();
  let firstReadBeforeEvaluationEnd = false,
    evaluationDone = false;
  try {
    await runAnalysisPipeline({
      maxWallMs: 1000,
      analystSlots: 1,
      preparationSlots: 1,
      maxPendingSlices: 1,
      reconcileMs: 10,
      evaluate: async (_signal, published) => {
        await writeFile(path.join(dir, "slice-1.done"), "target-loss-1");
        published();
        await pause(40);
        await writeFile(path.join(dir, "slice-2.done"), "target-loss-2");
        published();
        await pause(20);
        evaluationDone = true;
      },
      sync: async () => {
        const files = await readdir(dir);
        return {
          pending: files.filter((f) => !claimed.has(f)).length,
          preparationComplete: files.length === 2,
          selectedReviewComplete: completed.size === 2,
          fullCoverage: completed.size === 2,
        };
      },
      claim: async () => {
        const file = (await readdir(dir)).find((f) => !claimed.has(f));
        if (file) claimed.add(file);
        return file ?? null;
      },
      analyze: async (file) => {
        const content = await readFile(path.join(dir, file), "utf8");
        assert.match(content, /target-loss/);
        if (file === "slice-1.done")
          firstReadBeforeEvaluationEnd = !evaluationDone;
        completed.add(file);
      },
      admit: async () => ({ analystSlots: 1, preparationSlots: 1 }),
    });
    assert.equal(firstReadBeforeEvaluationEnd, true);
    assert.equal(completed.size, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pipeline session admission preserves original wall origin and rejects stopped sources before initialization", async () => {
  const { pipelineSessionWallLimit } =
    await import("../../scripts/bot-improvement/analysis-pipeline.ts");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "pipeline-wall-"));
  try {
    await writeFile(
      path.join(dir, "config.json"),
      JSON.stringify({ limits: { stop: { maxWallMs: 10000 } } }),
    );
    await writeFile(
      path.join(dir, "control.json"),
      JSON.stringify({
        startedAt: Date.now() - 5000,
        elapsedMs: 5000,
        limits: { maxWallMs: 10000 },
      }),
    );
    const remaining = await pipelineSessionWallLimit(dir, 10000);
    assert.ok(remaining <= 5000 && remaining > 4000);
    await writeFile(path.join(dir, "OWNER_STOP"), "owner");
    await assert.rejects(pipelineSessionWallLimit(dir, 10000), /OWNER_STOP/);
    await rm(path.join(dir, "OWNER_STOP"));
    await writeFile(
      path.join(dir, "control.json"),
      JSON.stringify({ stoppingReason: "owner-stop" }),
    );
    await assert.rejects(pipelineSessionWallLimit(dir, 10000), /stopped/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

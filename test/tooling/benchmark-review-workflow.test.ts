import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  benchmarkReviewWorkflow,
  recordReviewObservation,
  reviewBenchmarkMetrics,
} from "../../scripts/bot-improvement/benchmark-review-workflow.ts";
import { encodeLogRecord } from "../../scripts/bot-improvement/game-log.ts";
import { digest } from "../../scripts/bot-improvement/session-fixtures.ts";
test("bounded benchmark records verified phases and never infers analyst throughput from bytes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "review-benchmark-"));
  const inputRoot = path.join(dir, "copies"),
    out = path.join(dir, "results");
  await mkdir(inputRoot);
  const text =
    "ASCENCIO_LOSS_LOG\t2\n" +
    encodeLogRecord("EVENT", {
      kind: "decision",
      sequence: 1,
      decision_id: "exact",
      prompt: { choices: { choice: [{ id: "only" }] } },
    });
  await writeFile(path.join(inputRoot, "one.log"), text);
  const request = {
    inputRoot,
    out,
    maxCases: 1,
    maxWallMs: 10000,
    maxBytes: 1000000,
    cases: [
      {
        id: "one",
        path: "one.log",
        sha256: digest(text),
        stratum: "short" as const,
      },
    ],
  };
  try {
    await assert.rejects(
      benchmarkReviewWorkflow({ ...request, maxCases: 0 }),
      /limits/,
    );
    const report = await benchmarkReviewWorkflow(request);
    assert.equal(reviewBenchmarkMetrics(report).lossesPerAnalystHour, null);
    assert.equal(report.cases[0]!.rows, 1);
    const observation = {
      caseId: "one",
      sourceSha256: digest(text),
      analyst: "test-only",
      startedAt: report.startedAt,
      endedAt: Date.now(),
      pagesRead: 0,
      completed: true,
      actualTokens: null,
      lostProgressMs: 0,
      findingsSummary: "One forced choice.",
    };
    await assert.rejects(
      recordReviewObservation(out, observation),
      /every page/,
    );
    const partial = await recordReviewObservation(out, {
      ...observation,
      completed: false,
      findingsSummary: "Not read.",
    });
    assert.equal(reviewBenchmarkMetrics(partial).observedCompletedLosses, 0);
    assert.equal(
      reviewBenchmarkMetrics(partial).actualTokensPerCompletedLoss,
      null,
    );
    const final = await recordReviewObservation(out, {
      ...observation,
      endedAt: Date.now(),
      pagesRead: report.cases[0]!.pages.length,
    });
    assert.equal(reviewBenchmarkMetrics(final).observedCompletedLosses, 1);
    assert.equal(final.observationHistory?.length, 1);
    await assert.rejects(
      recordReviewObservation(out, { ...observation, completed: false }),
      /Conflicting/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

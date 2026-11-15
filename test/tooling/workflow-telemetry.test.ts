import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  recordWorkflowEvent,
  readWorkflowSnapshot,
  renderWorkflowDashboard,
  subscribeWorkflow,
  type WorkflowEvent,
} from "../../scripts/bot-improvement/workflow-telemetry.ts";
const event: WorkflowEvent = {
  id: "one",
  sourceIdentity: "frozen",
  kind: "checkpoint",
  phase: "analysis",
  coverage: {
    scheduledMatches: 10,
    finalizedMatches: 10,
    noLossMatches: 3,
    totalLosses: 15,
    selectedLosses: 15,
    reviewedLosses: 2,
    acknowledgedPages: 20,
    expectedPages: 100,
    complete: false,
    mode: "full",
  },
};
test("telemetry atomically publishes current state/report, distinguishes real coverage and deduplicates retries", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "telemetry-"));
  try {
    const first = await recordWorkflowEvent(dir, event);
    assert.equal(first.revision, 1);
    assert.match(first.report, /2\/15 losses reviewed/);
    assert.match(first.report, /3 have no target losses/);
    assert.equal((await recordWorkflowEvent(dir, event)).revision, 1);
    await assert.rejects(
      recordWorkflowEvent(dir, { ...event, phase: "different" }),
      /Conflicting/,
    );
    await assert.rejects(
      recordWorkflowEvent(dir, {
        ...event,
        id: "two",
        coverage: { ...event.coverage!, mode: "sample", complete: true },
      }),
      /Partial/,
    );
    assert.deepEqual(await readWorkflowSnapshot(dir), first);
    const html = renderWorkflowDashboard({
      ...first,
      current: { ...event, phase: "<script>alert(1)</script>" },
    });
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("color-scheme:light"));
    assert.ok(html.includes("background:var(--background,#f4f6f8)"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("subscription reports metadata revisions once and bounded history retains latest status", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "telemetry-watch-"));
  const seen: number[] = [];
  const errors: unknown[] = [];
  const stop = await subscribeWorkflow(
    dir,
    (s) => seen.push(s.revision),
    (e) => errors.push(e),
    100,
  );
  try {
    await recordWorkflowEvent(dir, event);
    const until = Date.now() + 1000;
    while (!seen.length && Date.now() < until)
      await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(seen, [1]);
    for (let i = 2; i <= 132; i++)
      await recordWorkflowEvent(dir, {
        ...event,
        id: String(i),
        kind: "heartbeat",
      });
    const state = (await readWorkflowSnapshot(dir))!;
    assert.equal(state.events.length, 128);
    assert.equal(state.revision, 132);
    assert.match(state.report, /revision 132/);
    assert.deepEqual(errors, []);
  } finally {
    stop();
    await rm(dir, { recursive: true, force: true });
  }
});

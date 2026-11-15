import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { configureAnalysisPolicy } from "../../scripts/bot-improvement/configure-analysis-policy.ts";
test("cohorts are immutable, expansion pins seed, resource changes require full ledger continuation", async () => {
  const session = await mkdtemp(path.join(tmpdir(), "policy-config-"));
  try {
    await writeFile(
      path.join(session, "config.json"),
      JSON.stringify({ limits: { analysisWorkers: 1 } }),
    );
    const policy = { mode: "sample" as const, sampleMatches: 2, seed: "fixed" };
    await configureAnalysisPolicy(session, { id: "small", policy });
    await configureAnalysisPolicy(session, { id: "small", policy });
    await assert.rejects(
      configureAnalysisPolicy(session, {
        id: "small",
        policy: { ...policy, sampleMatches: 3 },
      }),
      /immutable/,
    );
    await assert.rejects(
      configureAnalysisPolicy(session, {
        id: "bad",
        expandFrom: "small",
        policy: { ...policy, seed: "changed", sampleMatches: 4 },
      }),
      /preserve/,
    );
    await configureAnalysisPolicy(session, {
      id: "large",
      expandFrom: "small",
      policy: { ...policy, sampleMatches: 4 },
    });
    const config = JSON.parse(
      await readFile(path.join(session, "config.json"), "utf8"),
    );
    assert.equal(config.analysisCohorts.large.expandFrom, "small");
    await assert.rejects(
      configureAnalysisPolicy(session, {
        id: "resources",
        policy: { maxBytes: 100_000_000 },
      }),
      /explicit complete/,
    );
    await writeFile(
      path.join(session, "control.json"),
      JSON.stringify({ limits: { maxBytes: 100_000_000, maxWallMs: 1000 } }),
    );
    await assert.rejects(
      configureAnalysisPolicy(session, {
        id: "resources",
        policy: { maxBytes: 200_000_000 },
        continuation: { limits: { maxBytes: 200_000_000 } },
      }),
      /Complete continuation/,
    );
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});

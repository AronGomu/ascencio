import test from "node:test";
import assert from "node:assert/strict";
import { AsyncResource } from "node:async_hooks";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { withSessionLock } from "../../scripts/bot-improvement/session-lock.ts";
import {
  configureOutputStorage,
  clearStorageStop,
  outputUsage,
} from "../../scripts/bot-improvement/output-storage.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "../../scripts/bot-improvement/batch-storage-lease.ts";
import {
  withAnalysisOutput,
  analysisWriteOutput,
  saveAnalysis,
} from "../../scripts/bot-improvement/analysis-output.ts";

async function fixture() {
  const root = await mkdtemp(path.resolve(".tmp/analysis-allowance-"));
  await configureOutputStorage(root, 64_000_000);
  const output = path.join(root, "analysis");
  const run = <T>(work: () => Promise<T>) =>
    withSessionLock(root, () => withAnalysisOutput(root, "analysis", work));
  const lease = async () =>
    JSON.parse(
      await readFile(path.join(root, ".batch-output-lease.json"), "utf8"),
    );
  return { root, output, run, lease };
}
test("analysis lease charges replacement staging, settles failures and fences escaped writes", async () => {
  const f = await fixture();
  try {
    let late!: () => Promise<void>;
    await f.run(async () => {
      const file = path.join(f.output, "loss.log");
      await analysisWriteOutput(file, "x".repeat(15_000_000));
      await assert.rejects(
        analysisWriteOutput(file, "y".repeat(15_000_000)),
        /max-output-bytes/,
      );
      assert.equal((await readFile(file))[0], "x".charCodeAt(0));
      await assert.rejects(
        saveAnalysis(path.join(f.output, "queue.json"), { status: "retained" }),
        /storage is suspended/,
      );
      late = AsyncResource.bind(() =>
        analysisWriteOutput(path.join(f.output, "late.log"), "late"),
      );
    });
    assert.equal((await f.lease()).active, false);
    await assert.rejects(late(), /owner has settled/);
    assert.equal(
      await readFile(path.join(f.root, ".storage-stop"), "utf8"),
      "max-output-bytes\n",
    );
    await clearStorageStop(f.root);
    assert.ok((await outputUsage(f.root, true)).totalBytes < 64_000_000);
    await assert.rejects(
      f.run(async () => {
        await analysisWriteOutput(
          path.join(f.output, "partial.log"),
          "retained",
        );
        throw Error("fixture failure");
      }),
      /fixture failure/,
    );
    assert.equal((await f.lease()).active, false);
    assert.equal(
      await readFile(path.join(f.output, "partial.log"), "utf8"),
      "retained",
    );
    await f.run(() =>
      analysisWriteOutput(path.join(f.output, "resumed.log"), "ok"),
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("analysis refuses live or abandoned reservations and persisted storage suspension", async () => {
  const f = await fixture();
  try {
    const lease = await leaseBatchStorage(f.root, f.output, false);
    await assert.rejects(
      f.run(async () => {}),
      /holds session storage/,
    );
    assert.equal((await f.lease()).token, lease.token);
    assert.equal((await f.lease()).active, true);
    await releaseBatchStorage(f.root, lease.token);
    await writeFile(path.join(f.root, ".storage-stop"), "max-output-bytes\n");
    await assert.rejects(
      f.run(async () => {}),
      /storage is suspended/,
    );
    assert.equal((await f.lease()).active, false);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("analysis never follows a symlink for its reserved output directory", async () => {
  const f = await fixture();
  try {
    await mkdir(path.join(f.root, "elsewhere"));
    await symlink(path.join(f.root, "elsewhere"), f.output);
    await assert.rejects(
      f.run(async () => {}),
      /Symlink batch output/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

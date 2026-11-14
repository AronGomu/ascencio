import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  rm,
  truncate,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  configureOutputStorage,
  writeOutput,
  storageStatus,
  clearStorageStop,
  outputUsage,
} from "../../scripts/bot-improvement/output-storage.ts";

test("data staging preserves control headroom and denied replacement keeps committed bytes", async () => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/quota-test-"));
  try {
    await configureOutputStorage(root, 8192, 2048);
    const file = path.join(root, "game.log");
    await writeOutput(file, "a".repeat(5000));
    await assert.rejects(
      writeOutput(path.join(root, "next.log"), "b".repeat(1500)),
      /max-output-bytes/,
    );
    assert.equal((await storageStatus(root)).exhausted, true);
    await writeOutput(path.join(root, "report.json"), '{"status":"suspended"}');
    await assert.rejects(
      writeOutput(file, "c".repeat(5000)),
      /max-output-bytes/,
    );
    assert.equal(await readFile(file, "utf8"), "a".repeat(5000));
    assert.ok((await outputUsage(root)).totalBytes <= 8192);
    await configureOutputStorage(root, 16384, 2048);
    await clearStorageStop(root);
    await writeOutput(file, "c".repeat(5000));
    assert.equal((await readFile(file, "utf8")).length, 5000);
    assert.equal(
      (await readdir(root)).some((n) => n.includes(".output-stage-")),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("parallel processes share one allowance rather than admitting both data writes", async () => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/quota-race-"));
  try {
    await configureOutputStorage(root, 8192, 2048);
    const launch = (name: string) =>
      new Promise<number | null>((resolve, reject) => {
        const code = `import {writeOutput} from './scripts/bot-improvement/output-storage.ts';try{await writeOutput(process.argv[1], 'x'.repeat(4000));}catch(e){if(e.code==='MAX_OUTPUT_BYTES')process.exitCode=2;else throw e;}`;
        const child = spawn(
          process.execPath,
          ["--input-type=module", "-e", code, path.join(root, name)],
          { stdio: "pipe" },
        );
        child.on("error", reject);
        child.on("close", resolve);
      });
    const exits = await Promise.all([launch("a.log"), launch("b.log")]);
    assert.deepEqual(exits.sort(), [0, 2]);
    assert.ok((await outputUsage(root)).totalBytes <= 8192);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("existing oversized output is reported exhausted and invalid caps fail closed", async () => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/quota-existing-"));
  try {
    await writeFile(path.join(root, "existing.log"), "");
    await truncate(path.join(root, "existing.log"), 7000);
    await configureOutputStorage(root, 8192, 2048);
    assert.equal((await storageStatus(root)).exhausted, true);
    await writeOutput(path.join(root, "report.json"), "{}");
    await writeFile(
      path.join(root, ".output-budget.json"),
      JSON.stringify({ maxBytes: null, controlReserveBytes: 1 }),
    );
    await assert.rejects(
      writeOutput(path.join(root, "other.log"), "x"),
      /Invalid output storage limits/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("nested evaluation sessions cannot acquire independent space outside the parent cap", async () => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/quota-nested-"));
  try {
    await configureOutputStorage(root, 8192, 2048);
    const child = path.join(root, "calibration/session");
    await mkdir(child, { recursive: true });
    await configureOutputStorage(child, 50000, 2048);
    await assert.rejects(
      writeOutput(path.join(child, "game.log"), "x".repeat(7000)),
      /max-output-bytes/,
    );
    assert.equal((await storageStatus(child)).maxBytes, 8192);
    assert.ok((await outputUsage(root)).totalBytes <= 8192);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("usage batches metadata without losing nested bytes or counting lock files", async () => {
  const root = await mkdtemp(path.resolve(".tmp/quota-scan-"));
  try {
    await mkdir(path.join(root, "nested"));
    for (let n = 0; n < 70; n++)
      await writeFile(path.join(root, `game-${n}.log`), "x".repeat(n + 1));
    await writeFile(path.join(root, "nested", "game.log"), "nested");
    await writeFile(path.join(root, "report.json"), "{}");
    await mkdir(path.join(root, ".output-storage.lock"));
    await writeFile(
      path.join(root, ".output-storage.lock", "owner"),
      "ignored",
    );
    assert.deepEqual(await outputUsage(root), {
      dataBytes: (70 * 71) / 2 + 6,
      controlBytes: 2,
      totalBytes: (70 * 71) / 2 + 8,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

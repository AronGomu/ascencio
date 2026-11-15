import type { ChildProcess } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  configureOutputStorage,
  outputUsage,
} from "../../scripts/bot-improvement/output-storage.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
  readBatchStorageLease,
} from "../../scripts/bot-improvement/batch-storage-lease.ts";
import {
  withAnalysisOutput,
  analysisWriteOutput,
} from "../../scripts/bot-improvement/analysis-output.ts";
import { withSessionLock } from "../../scripts/bot-improvement/session-lock.ts";
test("concurrent disjoint writers reserve bounded envelopes and analysis publishes during evaluation", async () => {
  const root = await mkdtemp(path.resolve(".tmp/concurrent-storage-"));
  try {
    await configureOutputStorage(root, 150_000_000);
    await mkdir(path.join(root, "evaluation"));
    await writeFile(
      path.join(root, "config.json"),
      JSON.stringify({
        analysisPolicy: {
          pipeline: { analysisBytes: 40_000_000, evaluationBytes: 60_000_000 },
        },
      }),
    );
    const evaluation = await leaseBatchStorage(
      root,
      path.join(root, "evaluation"),
      false,
      60_000_000,
      8_000_000,
      false,
      true,
    );
    await withSessionLock(root, () =>
      withAnalysisOutput(root, "analysis", async () => {
        await analysisWriteOutput(
          path.join(root, "analysis", "loss.log"),
          "retained",
        );
        assert.ok((await outputUsage(root)).dataBytes >= 100_000_000);
        await assert.rejects(
          leaseBatchStorage(
            root,
            path.join(root, "analysis", "nested"),
            false,
            20_000_000,
            0,
            false,
            true,
          ),
          /holds session storage/,
        );
        await assert.rejects(
          leaseBatchStorage(
            root,
            path.join(root, "third"),
            false,
            60_000_000,
            0,
            false,
            true,
          ),
          /Insufficient/,
        );
      }),
    );
    assert.equal(
      (await readBatchStorageLease(root, evaluation.token))?.active,
      true,
    );
    await releaseBatchStorage(root, evaluation.token);
    await releaseBatchStorage(root, evaluation.token);
    assert.ok((await outputUsage(root)).totalBytes < 1_000_000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("existing scope bytes cannot be hidden by a smaller reservation and active legacy resume retains token", async () => {
  const { truncate } = await import("node:fs/promises");
  const root = await mkdtemp(path.resolve(".tmp/concurrent-existing-"));
  try {
    await configureOutputStorage(root, 150_000_000);
    const scope = path.join(root, "scope");
    await mkdir(scope);
    const file = path.join(scope, "data");
    await writeFile(file, "");
    await truncate(file, 50_000_000);
    await assert.rejects(
      leaseBatchStorage(root, scope, false, 20_000_000, 0, false, true),
      /Insufficient/,
    );
    const lease = await leaseBatchStorage(root, scope, false, 70_000_000);
    assert.equal(
      (await leaseBatchStorage(root, scope, true)).token,
      lease.token,
    );
    await releaseBatchStorage(root, lease.token);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("leased writes persist quota suspension while retaining control checkpoint headroom", async () => {
  const { writeOutput } =
    await import("../../scripts/bot-improvement/output-storage.ts");
  const { readFile } = await import("node:fs/promises");
  const root = await mkdtemp(path.resolve(".tmp/concurrent-staging-"));
  try {
    await configureOutputStorage(root, 90_000_000);
    const scope = path.join(root, "scope");
    await mkdir(scope);
    await leaseBatchStorage(root, scope, false, 20_000_000, 0, false, true);
    // The 20 MB envelope retains 10 MB control reserve, leaving 10 MB data.
    await assert.rejects(
      writeOutput(path.join(scope, "data"), "x".repeat(11_000_000)),
      /max-output-bytes/,
    );
    assert.match(
      await readFile(path.join(root, ".storage-stop"), "utf8"),
      /max-output/,
    );
    await writeOutput(
      path.join(scope, "state.json"),
      JSON.stringify({ status: "suspended" }),
    );
    await assert.rejects(
      writeOutput(path.join(scope, "small"), "x"),
      /max-output-bytes/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  "two processes cannot reserve two 90 MB envelopes under one 150 MB cap",
  { timeout: 10000 },
  async () => {
    const { spawn } = await import("node:child_process");
    const { batchStorageLeases } =
      await import("../../scripts/bot-improvement/batch-storage-lease.ts");
    const root = await mkdtemp(path.resolve(".tmp/concurrent-processes-"));
    const children: ChildProcess[] = [];
    try {
      await configureOutputStorage(root, 150_000_000);
      const module = new URL(
        "../../scripts/bot-improvement/batch-storage-lease.ts",
        import.meta.url,
      ).href;
      const script = `import {leaseBatchStorage} from ${JSON.stringify(module)}; import path from 'node:path'; const go=new Promise(resolve=>process.once('message',resolve));process.send({ready:true});await go;try{const lease=await leaseBatchStorage(process.argv[1],path.join(process.argv[1],process.argv[2]),false,90000000,0,false,true);process.send({status:'admitted',token:lease.token});}catch(error){process.send({status:'rejected',error:String(error)});}finally{process.disconnect();}`;
      const launches = ["a", "b"].map((scope) => {
        const child = spawn(
          process.execPath,
          ["--input-type=module", "-e", script, root, scope],
          { stdio: ["ignore", "ignore", "ignore", "ipc"] },
        );
        children.push(child);
        let readyResolve: () => void;
        let resultResolve: (result: {
          status: string;
          token?: string;
          error?: string;
        }) => void;
        const ready = new Promise<void>((resolve) => {
          readyResolve = resolve;
        });
        const result = new Promise<{
          status: string;
          token?: string;
          error?: string;
        }>((resolve, reject) => {
          resultResolve = resolve;
          child.once("error", reject);
          child.once("exit", (code) => {
            if (code !== 0) reject(Error(`Reservation child exited ${code}`));
          });
        });
        child.on(
          "message",
          (
            message:
              | { ready: true }
              | {
                  ready?: false;
                  status: string;
                  token?: string;
                  error?: string;
                },
          ) => {
            if (message.ready) readyResolve();
            else resultResolve(message);
          },
        );
        return { child, ready, result };
      });
      await Promise.all(launches.map((l) => l.ready));
      for (const launch of launches) launch.child.send({ start: true });
      const results = await Promise.all(launches.map((l) => l.result));
      assert.deepEqual(results.map((r) => r.status).sort(), [
        "admitted",
        "rejected",
      ]);
      assert.match(
        results.find((r) => r.status === "rejected")!.error!,
        /Insufficient/,
      );
      const admitted = results.find((r) => r.status === "admitted")!;
      const ledger = await batchStorageLeases(root);
      assert.equal(ledger.filter((l) => l.active).length, 1);
      assert.equal(
        ledger.find((l) => l.token === admitted.token)?.maxBytes,
        90_000_000,
      );
      const usage = await outputUsage(root);
      assert.ok(usage.dataBytes >= 90_000_000);
      assert.ok(usage.totalBytes < 150_000_000);
      await releaseBatchStorage(root, admitted.token!);
      assert.ok((await outputUsage(root)).totalBytes < 1_000_000);
    } finally {
      for (const child of children)
        if (child.exitCode === null) child.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  },
);

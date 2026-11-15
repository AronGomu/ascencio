import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ownedOperation,
  operationStatus,
} from "../../scripts/bot-improvement/operation-status.ts";
test("owned operation distinguishes active writer, excludes duplicate and persists outcome", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "owned-op-"));
  const file = path.join(dir, "status.json");
  try {
    await ownedOperation(file, "id", async (progress) => {
      assert.equal((await operationStatus(file)).active, true);
      await assert.rejects(
        ownedOperation(file, "id", async () => {}),
        /EEXIST/,
      );
      await progress("verified", { losses: 1 });
    });
    assert.equal((await operationStatus(file)).status, "complete");
    await assert.rejects(
      ownedOperation(file, "id", async () => {
        throw Error("failure");
      }),
      /failure/,
    );
    assert.equal((await operationStatus(file)).status, "failed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("heartbeat persists activity and owned group shutdown is bounded", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "owned-heartbeat-"));
  const file = path.join(dir, "operation.json");
  let pid = 0;
  try {
    await ownedOperation(
      file,
      "bounded",
      async (progress, context) => {
        const launch = await context.spawn(process.execPath, [
          "-e",
          'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)',
        ]);
        pid = launch.child.pid!;
        const before = (await operationStatus(file)).sequence;
        await new Promise((resolve) => setTimeout(resolve, 80));
        const status = await operationStatus(file);
        assert.ok(status.sequence > before);
        assert.equal(status.activeChildren[0]?.pid, pid);
      },
      { heartbeatMs: 20, shutdownGraceMs: 40 },
    );
    const status = await operationStatus(file);
    assert.equal(status.status, "complete");
    assert.equal(status.activeChildren.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recovery refuses live owners and requires the exact stale token", async () => {
  const { writeFile } = await import("node:fs/promises");
  const { recoverOperation, processIdentity } =
    await import("../../scripts/bot-improvement/operation-status.ts");
  const dir = await mkdtemp(path.join(tmpdir(), "owned-recovery-"));
  const file = path.join(dir, "operation.json");
  try {
    await ownedOperation(file, "live", async () => {
      const current = await operationStatus(file);
      await assert.rejects(
        recoverOperation(file, current.token),
        /still active/,
      );
    });
    // Reused PID has a different creation identity and is never signalled.
    const stale = {
      schemaVersion: 2,
      token: "old",
      identity: "test",
      status: "running",
      pid: process.pid,
      birth: "not-the-current-birth",
      children: [],
      updatedAt: 0,
    };
    await writeFile(file, JSON.stringify(stale));
    await writeFile(`${file}.lock`, JSON.stringify(stale));
    assert.equal((await operationStatus(file)).orphaned, true);
    await assert.rejects(recoverOperation(file, "wrong"), /token mismatch/);
    await recoverOperation(file, "old");
    assert.equal((await operationStatus(file)).status, "recovered");
    assert.ok(await processIdentity(process.pid));
    await ownedOperation(file, "next", async () => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("wrapper death preserves active child ownership until explicit verified recovery", async () => {
  const { spawn } = await import("node:child_process");
  const { recoverOperation } =
    await import("../../scripts/bot-improvement/operation-status.ts");
  const dir = await mkdtemp(path.join(tmpdir(), "owned-orphan-"));
  const file = path.join(dir, "operation.json");
  const module = new URL(
    "../../scripts/bot-improvement/operation-status.ts",
    import.meta.url,
  ).href;
  const script = `import {ownedOperation} from ${JSON.stringify(module)}; await ownedOperation(process.argv[1],'wrapper',async(p,c)=>{await c.spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)']);await p('ready',{});await new Promise(()=>{});});`;
  const wrapper = spawn(
    process.execPath,
    ["--input-type=module", "-e", script, file],
    { stdio: "ignore" },
  );
  try {
    let state;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        state = await operationStatus(file);
        if (state.phase === "ready") break;
      } catch {
        /* Process state may disappear during shutdown. */
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(state?.phase, "ready");
    const exited = new Promise((r) => wrapper.once("exit", r));
    wrapper.kill("SIGKILL");
    await exited;
    const orphan = await operationStatus(file);
    assert.equal(orphan.ownerActive, false);
    assert.equal(orphan.active, true);
    assert.equal(orphan.activeChildren.length, 1);
    await assert.rejects(
      ownedOperation(file, "duplicate", async () => {}),
      /EEXIST/,
    );
    await assert.rejects(
      recoverOperation(file, orphan.token),
      /child processes remain active/,
    );
    await recoverOperation(file, orphan.token, {
      terminateChildren: true,
      shutdownGraceMs: 30,
    });
    assert.equal((await operationStatus(file)).activeChildren.length, 0);
  } finally {
    wrapper.kill("SIGKILL");
    try {
      const state = await operationStatus(file);
      if (state.activeChildren.length)
        await recoverOperation(file, state.token, {
          terminateChildren: true,
          shutdownGraceMs: 0,
        });
    } catch {
      /* Process state may disappear during shutdown. */
    }
    await rm(dir, { recursive: true, force: true });
  }
});

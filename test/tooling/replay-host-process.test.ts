import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { ReplayHostProcess } from "../../scripts/bot-improvement/replay-host-process.ts";

async function fixture() {
  const root = await mkdtemp(path.resolve(".tmp/replay-host-"));
  const entry = path.join(root, "host.mjs");
  await writeFile(
    entry,
    `
import {createInterface} from 'node:readline';
let games=0;
const send=value=>console.log(JSON.stringify(value));
for await(const line of createInterface({input:process.stdin})) {
 const command=JSON.parse(line);
 if(command.type==='initialize') {send({type:'ready',pid:process.pid});continue;}
 if(command.mode==='block') {while(true){}}
 if(command.mode==='malformed') {console.log('{broken');continue;}
 if(command.mode==='exit') process.exit(0);
 if(command.mode==='error') {send({type:'host_error',message:'fixture'});continue;}
 games++;
 console.error('game-'+games);
 send({type:'done',pid:process.pid,game:games});
 send({type:'cleanup',handles_created:games,handles_destroyed:command.mode==='unbalanced'?0:games});
}
`,
  );
  const host = new ReplayHostProcess<{
    type: string;
    pid?: number;
    game?: number;
  }>(entry);
  return {
    root,
    entry,
    host,
    async close() {
      await host.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("replay branches reuse one host, delimit their frames and drain diagnostics on close", async () => {
  const f = await fixture();
  try {
    const first = await f.host.run(
      { type: "initialize" },
      { type: "game" },
      5000,
    );
    const second = await f.host.run(
      { type: "initialize" },
      { type: "game" },
      5000,
    );
    assert.equal(first.error, undefined);
    assert.equal(second.error, undefined);
    assert.deepEqual(
      first.frames.map((f) => f.type),
      ["ready", "done", "cleanup"],
    );
    assert.deepEqual(
      second.frames.map((f) => f.type),
      ["ready", "done", "cleanup"],
    );
    assert.equal(first.frames[0]!.pid, second.frames[0]!.pid);
    assert.equal(first.frames[1]!.game, 1);
    assert.equal(second.frames[1]!.game, 2);
    await f.host.close();
    assert.match(f.host.stderr, /game-1/);
    assert.match(f.host.stderr, /game-2/);
    await assert.rejects(f.host.run({}, {}, 100), /stopped/);
  } finally {
    await f.close();
  }
});

test("owner termination during an active branch drains the reusable host", async () => {
  const f = await fixture();
  const runner = path.join(f.root, "runner.mjs");
  await writeFile(
    runner,
    `
import assert from 'node:assert/strict';
import {ReplayHostProcess} from ${JSON.stringify(new URL("../../scripts/bot-improvement/replay-host-process.ts", import.meta.url).href)};
const host=new ReplayHostProcess(${JSON.stringify(f.entry)});
try {
 const first=await host.run({type:'initialize'},{type:'game'},5000);
 console.log(JSON.stringify({pid:first.frames[0].pid}));
 const interrupted=await host.run({type:'initialize'},{type:'game',mode:'block'},10000);
 assert.ok(interrupted.error);
 assert.equal(interrupted.timedOut,false);
} finally {await host.close();}
`,
  );
  const child = spawn(process.execPath, [runner], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  let pid: number | undefined;
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b.toString()));
  const deadline = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const lines = createInterface({ input: child.stdout });
    const first = await lines[Symbol.asyncIterator]().next();
    assert.equal(first.done, false, stderr);
    pid = JSON.parse(first.value!).pid as number;
    child.kill("SIGTERM");
    assert.equal(await exited, 0, stderr);
    assert.throws(() => process.kill(pid!, 0), { code: "ESRCH" });
    lines.close();
  } finally {
    clearTimeout(deadline);
    child.kill("SIGKILL");
    if (pid) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
      }
    }
    await f.close();
  }
});

test("a blocked replay host is terminated by its external deadline and cannot be reused", async () => {
  const f = await fixture();
  try {
    const pending = f.host.run(
      { type: "initialize" },
      { type: "game", mode: "block" },
      150,
    );
    await assert.rejects(f.host.run({}, {}, 100), /Concurrent/);
    const result = await pending;
    assert.equal(result.timedOut, true);
    assert.ok(result.error);
    await assert.rejects(f.host.run({}, {}, 100), /stopped/);
  } finally {
    await f.close();
  }
});

for (const mode of ["malformed", "exit", "error", "unbalanced"]) {
  test(`replay host fences ${mode} protocol failures`, async () => {
    const f = await fixture();
    try {
      const result = await f.host.run(
        { type: "initialize" },
        { type: "game", mode },
        5000,
      );
      assert.ok(result.error);
      assert.equal(result.timedOut, false);
      await assert.rejects(f.host.run({}, {}, 100), /stopped/);
    } finally {
      await f.close();
    }
  });
}

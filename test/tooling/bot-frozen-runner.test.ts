import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  appendFile,
  stat,
  cp,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  benchmarkInputs,
  createBenchmarkSession,
} from "../../scripts/bot-improvement/benchmark-session.ts";
import { digest } from "../../scripts/bot-improvement/session-fixtures.ts";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import {
  prepareMatches,
  executeMatches,
} from "../../scripts/bot-improvement/run-matches.ts";
import {
  machineResources,
  resolveWorkers,
} from "../../scripts/bot-improvement/match-workers.ts";

const session = process.env.ARO2_FROZEN_SESSION;
const binary = path.resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const pause = () => new Promise((r) => setTimeout(r, 30));
test("worker selection respects CPU topology, pending work and session bound", async () => {
  const resources = await machineResources();
  assert.ok(resources.usable >= 1 && resources.usable <= resources.logical);
  assert.equal(await resolveWorkers("64", 1), 1);
  assert.equal(
    await resolveWorkers("64", 500, 2),
    Math.min(2, resources.usable),
  );
  await assert.rejects(resolveWorkers("0", 500));
  await assert.rejects(resolveWorkers("1.5", 500));
});

test("external seed-aware factories receive fixture seeds without mutating frozen configuration", () => {
  const source = `import { instantiate } from "./scripts/bot-evaluation/host-inputs.ts";
const artifact={module:"external",source:'export const contractVersion=1; export const create=c=>({decide(){},sideboard(){return {exchanges:[],reason:{code:"retained",explanation:String(c.seed)}}}});',config:{seed:7},dependencies:[]};
const values=[];
for(const seed of [123,456,undefined]){const bot=await instantiate(artifact,{cards:new Map()},seed);values.push((await bot.sideboard()).reason.explanation);}
console.log(JSON.stringify({values,configuration:artifact.config}));`;
  const run = spawnSync(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "-e",
      source,
    ],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    values: ["123", "456", "7"],
    configuration: { seed: 7 },
  });
});

test(
  "real frozen pool replays across concurrency, resumes cancellation, rejects corrupt/duplicate evidence",
  { skip: !session, timeout: 180000 },
  async (t) => {
    const built = spawnSync(
      "cargo",
      [
        "build",
        "--release",
        "--manifest-path",
        "tools/bot-evaluation/Cargo.toml",
      ],
      { encoding: "utf8" },
    );
    assert.equal(built.status, 0, built.stderr);
    await mkdir(".tmp", { recursive: true });
    const root = await mkdtemp(path.resolve(".tmp/frozen-runner-test-"));
    t.diagnostic(`Retained real-engine evidence: ${root}`);
    const prepared = await prepareMatches({ session: session! });
    const job = {
      ...prepared.job,
      budget: { maxGames: 100 },
      matches: prepared.job.matches.slice(0, 4),
    };
    const file = path.join(root, "job.json");
    await writeFile(file, JSON.stringify(job));
    function start(
      name: string,
      workers: number,
      resume = false,
      input = file,
    ) {
      const child = spawn(
        binary,
        [
          "frozen",
          "--job",
          input,
          "--out",
          path.join(root, name),
          "--workers",
          String(workers),
          ...(resume ? ["--resume"] : []),
        ],
        {
          env: { ...process.env, ARO2_NODE: process.execPath },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      const done = new Promise<number | null>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve(code));
      });
      return { child, done, output: () => output };
    }
    const sequential = start("one", 1);
    assert.equal(await sequential.done, 0, sequential.output());
    // Reverse dispatch guarantees finalized numeric IDs arrive out of schedule order.
    const reversed = path.join(root, "reverse-job.json");
    await writeFile(
      reversed,
      JSON.stringify({ ...job, matches: [...job.matches].reverse() }),
    );
    const parallel = start("two", 2, false, reversed);
    assert.equal(await parallel.done, 0, parallel.output());
    const a = await json(path.join(root, "one/result.json")),
      b = await json(path.join(root, "two/result.json"));
    assert.equal(a.completedGames, 16);
    assert.equal(b.completedGames, 16);
    assert.equal(a.replayIdentity, b.replayIdentity);
    const progress = await json(path.join(root, "two/progress.json"));
    assert.deepEqual(
      progress.finalizedMatches,
      job.matches.map((m) => m.match.id).sort(),
    );
    assert.equal(b.workers, Math.min(2, (await machineResources()).logical));
    const finalized = await Promise.all(
      job.matches.map(async (m) => ({
        id: m.match.id,
        time: (
          await stat(path.join(root, "two/matches", m.match.id, "done.json"))
        ).mtimeMs,
      })),
    );
    finalized.sort((a, b) => a.time - b.time);
    assert.notEqual(finalized[0]!.id, job.matches[0]!.match.id);
    const before = await readFile(path.join(root, "two/result.json"), "utf8");
    const resumeComplete = start("two", 2, true, reversed);
    assert.equal(await resumeComplete.done, 0, resumeComplete.output());
    assert.equal(
      await readFile(path.join(root, "two/result.json"), "utf8"),
      before,
    );
    const cancelled = start("cancel", 2);
    for (let n = 0; n < 1000; n++) {
      try {
        if (
          (await json(path.join(root, "cancel/progress.json"))).reservedGames >=
          8
        )
          break;
      } catch {
        /* Wait for durable dispatch. */
      }
      await pause();
    }
    cancelled.child.kill("SIGINT");
    assert.equal(await cancelled.done, 2, cancelled.output());
    const resumed = start("cancel", 2, true);
    assert.equal(await resumed.done, 0, resumed.output());
    const c = await json(path.join(root, "cancel/result.json"));
    assert.equal(c.completedGames, 16);
    assert.equal(c.replayIdentity, a.replayIdentity);
    const corrupt = path.join(
      root,
      "two/matches",
      job.matches[1]!.match.id,
      "fixture.json",
    );
    await appendFile(corrupt, " ");
    const rejected = start("two", 2, true, reversed);
    assert.equal(await rejected.done, 1);
    assert.match(rejected.output(), /Completed evidence bytes changed/);
    const duplicate = path.join(root, "duplicate.json");
    await writeFile(
      duplicate,
      JSON.stringify({ ...job, matches: [job.matches[0], job.matches[0]] }),
    );
    const bad = start("duplicate", 2, false, duplicate);
    assert.equal(await bad.done, 1);
    assert.match(bad.output(), /Duplicate\/unsafe/);
  },
);

test(
  "public runner settles shared reservations, enforces session game budgets and OWNER_STOP",
  { skip: !session, timeout: 120000 },
  async (t) => {
    await mkdir(".tmp", { recursive: true });
    const root = await mkdtemp(path.resolve(".tmp/frozen-accounting-test-"));
    t.diagnostic(`Retained accounting evidence: ${root}`);
    async function clone(name: string, budget?: number) {
      const destination = path.join(root, name);
      await mkdir(destination);
      const config = await json(path.join(session!, "config.json"));
      config.limits.stop = {
        ownerStop: true,
        ...(budget === undefined ? {} : { maxGames: budget }),
      };
      await writeFile(
        path.join(destination, "config.json"),
        JSON.stringify(config),
      );
      await cp(
        path.join(session!, "state.json"),
        path.join(destination, "state.json"),
      );
      for (const dir of ["iterations", "versions", "matches", "analyses"])
        await mkdir(path.join(destination, dir));
      return destination;
    }
    const limited = await clone("limited", 8);
    const run = await executeMatches({
      session: limited,
      out: path.join(limited, "evaluations/budget"),
      workers: "2",
    });
    assert.equal(run.exitCode, 2);
    assert.equal(run.completedGames, 8);
    const plan = await controlSession(limited, { action: "plan" });
    assert.equal(plan.completedGames, 8);
    assert.equal(plan.reservedGames, 0);
    assert.equal(plan.stoppingReason, "max-games");
    assert.deepEqual(plan.running, []);
    const ledger = await json(path.join(limited, "control.json"));
    assert.equal(ledger.attempts.length, 2);
    assert.ok(
      ledger.attempts.every(
        (a: { status: string; games: unknown[] }) =>
          a.status === "complete" && a.games.length === 4,
      ),
    );
    const stopped = await clone("owner-stop");
    const child = spawn(
      process.execPath,
      [
        "scripts/bot-improvement/run-matches.ts",
        "--session",
        stopped,
        "--out",
        path.join(stopped, "evaluations/cancel"),
        "--workers",
        "2",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const done = new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    let started = false;
    for (let n = 0; n < 1000; n++) {
      try {
        if (
          (await json(path.join(stopped, "control.json"))).attempts.some(
            (a: { status: string }) => a.status === "running",
          )
        ) {
          started = true;
          break;
        }
      } catch {
        /* Wait for the initial durable reservation. */
      }
      await pause();
    }
    assert.ok(started, output);
    const begin = Date.now();
    await writeFile(path.join(stopped, "OWNER_STOP"), "test-owner-stop");
    assert.equal(await done, 2, output);
    assert.ok(Date.now() - begin < 15000, output);
    const cancelled = await controlSession(stopped, { action: "plan" });
    assert.equal(cancelled.stoppingReason, "owner-stop");
    assert.equal(cancelled.reservedGames, 0);
    assert.deepEqual(cancelled.running, []);
    const result = await json(
      path.join(stopped, "evaluations/cancel/result.json"),
    );
    assert.equal(cancelled.completedGames, result.completedGames);
    const file = path.join(stopped, "evaluations/cancel/result.json");
    await controlSession(stopped, {
      action: "finish",
      iteration: 1,
      status: "interrupted",
      evidence: {
        path: "evaluations/cancel/result.json",
        sha256: digest(await readFile(file)),
      },
    });
    const crashed = await clone("crash");
    const crashOutput = path.join(crashed, "evaluations/recovery");
    function crashRun(resume = false) {
      const child = spawn(
        process.execPath,
        [
          "scripts/bot-improvement/run-matches.ts",
          "--session",
          crashed,
          "--out",
          crashOutput,
          "--workers",
          "1",
          "--max-games",
          "24",
          ...(resume ? ["--resume"] : []),
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      return {
        child,
        done: new Promise<number | null>((resolve, reject) => {
          child.on("error", reject);
          child.on("close", resolve);
        }),
        log: () => log,
      };
    }
    const first = crashRun();
    let checkpoint = false;
    for (let n = 0; n < 2000; n++) {
      try {
        const text = await readFile(
          path.join(
            crashOutput,
            "matches/match-0001/matches/match-0001/match.xml",
          ),
          "utf8",
        );
        if (
          text.includes("<status>completed</status>") &&
          text.includes("<status>skipped</status>")
        ) {
          checkpoint = true;
          break;
        }
      } catch {
        /* Wait for a real durable game prefix. */
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(checkpoint, first.log());
    const owner = await json(path.join(crashOutput, "owners.json"));
    process.kill(owner.dispatcher.pid, "SIGKILL");
    assert.notEqual(await first.done, 0, first.log());
    // An operator may remove only the dead dispatcher's stale output lock.
    assert.throws(() => process.kill(owner.dispatcher.pid, 0));
    await rm(path.join(crashOutput, "runner.lock"), { recursive: true });
    const recovered = crashRun(true);
    assert.equal(await recovered.done, 2, recovered.log());
    const recoveredPlan = await controlSession(crashed, { action: "plan" });
    const recoveredResult = await json(path.join(crashOutput, "result.json"));
    assert.equal(recoveredPlan.reservedGames, 0);
    assert.ok(recoveredPlan.completedGames > recoveredResult.completedGames);
    const attempts = (await json(path.join(crashed, "control.json"))).attempts;
    assert.equal(attempts[0].status, "interrupted");
    assert.ok(attempts[0].games.length > 0);
    assert.equal(attempts[1].attempt, 2);
  },
);

test(
  "tuning repetitions use fresh equivalent ledgers and forward the source owner stop",
  { skip: !session, timeout: 60000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/frozen-tuning-test-"));
    const inputs = await benchmarkInputs(session!);
    inputs.stopSource = {
      path: path.join(root, "PARENT_STOP"),
      acknowledged: null,
    };
    const first = await createBenchmarkSession(
      inputs,
      path.join(root, "first"),
    );
    const second = await createBenchmarkSession(
      inputs,
      path.join(root, "second"),
    );
    assert.deepEqual(
      await json(path.join(first, "state.json")),
      await json(path.join(second, "state.json")),
    );
    const a = await executeMatches({
      session: first,
      out: path.join(first, "evaluation"),
      workers: "1",
      maxGames: 4,
      stopSource: inputs.stopSource,
    });
    const b = await executeMatches({
      session: second,
      out: path.join(second, "evaluation"),
      workers: "1",
      maxGames: 4,
      stopSource: inputs.stopSource,
    });
    assert.equal(a.completedGames, 4);
    assert.equal(b.completedGames, 4);
    assert.equal(a.replayIdentity, b.replayIdentity);
    assert.equal(
      (await json(path.join(first, "control.json"))).attempts.length,
      1,
    );
    assert.equal(
      (await json(path.join(second, "control.json"))).attempts.length,
      1,
    );
    await writeFile(inputs.stopSource.path, "parent-request");
    const stopped = await createBenchmarkSession(
      inputs,
      path.join(root, "stopped"),
    );
    const c = await executeMatches({
      session: stopped,
      out: path.join(stopped, "evaluation"),
      workers: "2",
      maxGames: 4,
      stopSource: inputs.stopSource,
    });
    assert.equal(c.completedGames, 0);
    assert.equal(c.stoppingReason, "owner-stop");
    assert.equal(
      (await controlSession(stopped, { action: "plan" })).reservedGames,
      0,
    );
  },
);

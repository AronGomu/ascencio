import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  appendFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { prepareMatches } from "../../scripts/bot-improvement/run-matches.ts";
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

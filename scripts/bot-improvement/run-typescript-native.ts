import { readBatchStorageLease } from "./batch-storage-lease.ts";
import { verifyNativeSchedule } from "./typescript-native-resume.ts";
export { verifyNativeCompletion } from "./typescript-native-completion.ts";
import { NativeEngineSlot } from "./typescript-native-executor.ts";
import { parseMatchLog } from "./game-log.ts";
/** Full-evidence migration test: standalone accounting, native logs and verified resume. */
import type { Worker } from "node:worker_threads";
import { mkdir, readFile, readdir, rm, lstat, rename } from "node:fs/promises";
import path from "node:path";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { digest, identity } from "./session-fixtures.ts";
import type { Job } from "./typescript-match-worker.ts";
import { prepareTypescriptJob } from "./run-typescript-matches.ts";
import { verifyNativeMatch } from "./typescript-native-evidence.ts";
import { configureOutputStorage } from "./output-storage.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "./batch-storage-lease.ts";
import {
  installLocalOutputAllowance,
  replayWriteOutput as write,
  clearReplayWriteGrants,
} from "./replay-output-budget.ts";
async function optional(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function nativeRuntimeIdentity() {
  const files: string[] = [];
  async function visit(root: string) {
    for (const e of await readdir(root, { withFileTypes: true })) {
      const p = path.join(root, e.name);
      if (e.isDirectory()) await visit(p);
      else if (e.isFile() && /\.(ts|js)$/.test(p)) files.push(p);
    }
  }
  for (const root of [
    "src/battle/worker",
    "scripts/bot-evaluation",
    "scripts/bot-experiment",
  ])
    await visit(root);
  for (const file of [
    "typescript-match-worker.ts",
    "typescript-native-worker.ts",
    "typescript-native-executor.ts",
    "typescript-native-completion.ts",
    "typescript-native-resume.ts",
    "typescript-native-evidence.ts",
    "run-typescript-native.ts",
    "replay-output-budget.ts",
    "game-log.ts",
    "output-storage.ts",
    "batch-storage-lease.ts",
  ])
    files.push(path.join("scripts/bot-improvement", file));
  return identity({
    node: process.version,
    flags: process.execArgv
      .filter((f) =>
        ["--no-lazy", "--no-wasm-lazy-compilation", "--no-liftoff"].includes(f),
      )
      .sort(),
    sources: await Promise.all(
      files.sort().map(async (f) => [f, digest(await readFile(f))]),
    ),
  });
}
export async function runTypescriptNative(options: {
  job: Job;
  out: string;
  workers: number;
  resume?: boolean;
  maxBytes?: number;
  maxWallMs?: number;
  maxGames?: number;
  stopFile?: string;
  sessionLease?: {
    root: string;
    token: string;
    maxBytes: number;
    publicExecutionPath: string;
    publicExecutionHash: string;
    deadlineMs: number;
    stopSource: { path: string; acknowledged: string | null };
  };
  runtimeIdentity?: string;
}) {
  const { job } = options,
    workers = options.workers,
    maxGames =
      options.maxGames ?? job.budget.maxGames ?? Number.MAX_SAFE_INTEGER,
    maxWallMs = options.maxWallMs ?? job.budget.maxWallMs ?? 600000;
  if (
    !Number.isSafeInteger(workers) ||
    workers < 1 ||
    workers > availableParallelism() ||
    !Number.isSafeInteger(maxGames) ||
    maxGames < 1 ||
    !Number.isSafeInteger(maxWallMs) ||
    maxWallMs < 1
  )
    throw Error("Invalid native execution limits");
  const matchIds = new Set(job.matches.map((item) => item.match.id));
  if (
    !job.matches.length ||
    matchIds.size !== job.matches.length ||
    job.matches.some(
      (item) =>
        !/^match-[0-9]+$/.test(item.match.id) || item.match.games.length !== 4,
    )
  )
    throw Error("Invalid native match schedule");
  const root = path.resolve(options.out),
    output = options.sessionLease ? root : path.join(root, "payload");
  if (!options.resume) await mkdir(root);
  else if (!(await optional(path.join(output, "binding.json"))))
    throw Error("Missing native resume binding");
  if (!options.sessionLease)
    await configureOutputStorage(root, options.maxBytes ?? 20_000_000_000);
  await mkdir(output, { recursive: true });
  const lock = path.join(output, ".running");
  try {
    await mkdir(lock);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const old = await optional(path.join(lock, "owner.json"));
    if (!old?.pid) throw Error("Unverifiable native owner lock");
    try {
      process.kill(old.pid, 0);
      throw Error("Native dispatcher is already alive");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    await rm(lock, { recursive: true });
    await mkdir(lock);
  }
  const threads: Worker[] = [],
    index: Record<string, string> = {},
    journals: { reservedGames: number; owned: string[]; batch: string[] }[] =
      [];
  let lease: Awaited<ReturnType<typeof leaseBatchStorage>> | undefined,
    reason: string | null = null,
    charged = 0,
    cursor = 0,
    peakRssBytes = process.memoryUsage().rss;
  const begin = performance.now(),
    started = Date.now();
  const stop = (why: string) => {
    if (reason === null || reason === "max-games") reason = why;
    for (const w of threads) void w.terminate();
  };
  const signal = () => stop("owner-stop");
  let timer: ReturnType<typeof setInterval> | undefined;
  const persist = (file: string, value: unknown) =>
    write(file, JSON.stringify(value));
  let indexWrites = Promise.resolve();
  const saveIndex = () => {
    const bytes = JSON.stringify(index);
    const next = indexWrites.then(() =>
      write(path.join(output, "matches.json"), bytes),
    );
    indexWrites = next;
    return next;
  };

  try {
    await write(
      path.join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid }),
    );
    const pinnedJob = structuredClone(job) as Job & {
      stopSource?: { acknowledged?: string | null };
      storageLease?: unknown;
      batchStorageBytes?: unknown;
    };
    if (options.sessionLease) {
      if (pinnedJob.stopSource) delete pinnedJob.stopSource.acknowledged;
      delete pinnedJob.storageLease;
      delete pinnedJob.batchStorageBytes;
    }
    const binding = {
      job: job.identity,
      prepared: identity(pinnedJob),
      runtime: options.runtimeIdentity ?? (await nativeRuntimeIdentity()),
      workers,
      maxGames,
      maxWallMs,
    };
    const old = await optional(path.join(output, "binding.json"));
    if (options.resume && identity(old) !== identity(binding))
      throw Error("Native resume inputs changed");
    process.once("SIGINT", signal);
    process.once("SIGTERM", signal);
    const verificationStart = performance.now();
    const verified = options.resume
      ? await verifyNativeSchedule({
          output,
          job,
          workers,
          runtime: binding.runtime,
          register: (worker) => threads.push(worker),
          aborted: () => reason !== null,
        })
      : job.matches.map(() => false);
    const resumeVerificationMs = options.resume
      ? performance.now() - verificationStart
      : 0;
    const reusedMatches = new Set(
      job.matches.filter((_, i) => verified[i]).map((item) => item.match.id),
    );
    const pending: Job["matches"] = [];
    for (const [position, item] of job.matches.entries()) {
      if (verified[position]) index[item.match.id] = `matches/${item.match.id}`;
      else pending.push(item);
    }
    for (let i = 0; i < workers; i++) {
      const folder = path.join(
        output,
        `workers/worker-${String(i + 1).padStart(4, "0")}`,
      );
      const journal = options.resume
        ? await optional(path.join(folder, "journal.json"))
        : null;
      if (options.resume && !journal)
        throw Error("Missing native worker journal");
      const row = journal ?? { reservedGames: 0, owned: [], batch: [] };
      if (
        !Number.isSafeInteger(row.reservedGames) ||
        row.reservedGames < 0 ||
        !Array.isArray(row.owned) ||
        row.reservedGames !== row.owned.length * 4 ||
        row.owned.some(
          (id: unknown) => typeof id !== "string" || !matchIds.has(id),
        ) ||
        !Array.isArray(row.batch) ||
        row.batch.length > 1 ||
        row.batch.some(
          (id: unknown) => typeof id !== "string" || !row.owned.includes(id),
        )
      )
        throw Error("Invalid native worker journal");
      journals.push(row);
      charged += row.reservedGames;
    }
    if (charged > maxGames)
      throw Error("Native reservations exceed game budget");
    for (const id of Object.keys(index))
      if (!journals.some((row) => row.owned.includes(id)))
        throw Error("Completed native match has no journal reservation");
    // Verify receipts and accounting before admission. A clean resume may shrink
    // its allowance after replay/analysis artifacts grow elsewhere in the root.
    if (options.sessionLease) {
      const provided = options.sessionLease,
        current = await readBatchStorageLease(provided.root, provided.token);
      if (
        !current?.active ||
        current.token !== provided.token ||
        path.resolve(provided.root, current.evaluation) !== output ||
        current.maxBytes !== provided.maxBytes
      )
        throw Error("Invalid session storage lease");
      lease = { ...current, root: provided.root };
    } else {
      const previousLease = await optional(
        path.join(root, ".batch-output-lease.json"),
      );
      lease = await leaseBatchStorage(
        root,
        output,
        !!options.resume && previousLease?.active === true,
        options.maxBytes,
      );
    }
    await installLocalOutputAllowance(output, lease!.maxBytes);
    if (!options.resume) {
      await persist(path.join(output, "binding.json"), binding);
      await persist(path.join(output, "run.json"), { startedAt: started });
      await persist(path.join(output, "owners.json"), {
        pid: process.pid,
        runner: "typescript-native/v1",
      });
      if (options.sessionLease) {
        const bytes = await readFile(options.sessionLease.publicExecutionPath);
        if (digest(bytes) !== options.sessionLease.publicExecutionHash)
          throw Error("Public execution metadata changed");
        await write(path.join(output, "execution.json"), bytes);
      } else await persist(path.join(output, "execution.json"), job);
    }
    const epoch = (await optional(path.join(output, "run.json")))?.startedAt;
    if (!Number.isSafeInteger(epoch) || epoch < 1)
      throw Error("Invalid native start time");
    for (const [i, journal] of journals.entries())
      await persist(
        path.join(
          output,
          `workers/worker-${String(i + 1).padStart(4, "0")}/journal.json`,
        ),
        journal,
      );
    await saveIndex();
    const checkStop = async () => {
      if (
        Date.now() >=
        Math.min(
          epoch + maxWallMs,
          options.sessionLease?.deadlineMs ?? Number.MAX_SAFE_INTEGER,
        )
      )
        stop("max-wall-ms");
      if (options.stopFile)
        try {
          await lstat(options.stopFile);
          stop("owner-stop");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      if (options.sessionLease) {
        try {
          const bytes = await readFile(options.sessionLease.stopSource.path);
          if (digest(bytes) !== options.sessionLease.stopSource.acknowledged)
            stop("owner-stop");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
    };
    await checkStop();
    timer = setInterval(() => {
      peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
      void checkStop().catch(() => stop("stop-check-failed"));
    }, 50);
    if (Date.now() >= epoch + maxWallMs) reason = "max-wall-ms";
    await Promise.allSettled(
      Array.from({ length: workers }, async (_, slot) => {
        if (reason || !pending.length) return;
        const engine = new NativeEngineSlot({
          job,
          runtime: binding.runtime,
          register: (w) => threads.push(w),
          aborted: () => reason !== null && reason !== "max-games",
        });
        try {
          while (cursor < pending.length && !reason) {
            if (charged + 4 > maxGames) {
              reason ??= "max-games";
              break;
            }
            const item = pending[cursor++]!,
              journal = journals[slot]!;
            charged += 4;
            journal.reservedGames += 4;
            journal.owned.push(item.match.id);
            journal.batch = [item.match.id];
            await persist(
              path.join(
                output,
                `workers/worker-${String(slot + 1).padStart(4, "0")}/journal.json`,
              ),
              journal,
            );
            const base = path.join(output, "matches", item.match.id),
              hashes: Record<string, string> = {};
            try {
              const info = await lstat(base);
              if (!info.isDirectory() || info.isSymbolicLink())
                throw Error("Invalid partial match directory");
              const attempts = path.join(output, "attempts");
              await mkdir(attempts, { recursive: true });
              const attempt = journals.reduce(
                (n, j) =>
                  n + j.owned.filter((id) => id === item.match.id).length,
                0,
              );
              await rename(
                base,
                path.join(
                  attempts,
                  `${item.match.id}-before-attempt-${attempt}`,
                ),
              );
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            }
            const match = await engine.match(
              item,
              async (number, text, lossView) => {
                const file = `native/games/game-${number}/game.log`;
                await write(path.join(base, file), text);
                hashes[file] = digest(text);
                if (lossView !== undefined) {
                  const viewFile = `native/games/game-${number}/loss.log`;
                  await write(path.join(base, viewFile), lossView);
                  hashes[viewFile] = digest(lossView);
                }
              },
              async (id, value) => {
                const file = `bugs/${id}.json`;
                await persist(path.join(base, file), value);
                hashes[file] = digest(JSON.stringify(value));
              },
            );
            verifyNativeMatch(match, job, item);
            await write(path.join(base, "native/match.log"), match);
            hashes["native/match.log"] = digest(match);
            await engine.verify(output, item, { files: hashes });
            await persist(path.join(base, "done.json"), { files: hashes });
            index[item.match.id] = `matches/${item.match.id}`;
            await saveIndex();
            journal.batch = [];
            await persist(
              path.join(
                output,
                `workers/worker-${String(slot + 1).padStart(4, "0")}/journal.json`,
              ),
              journal,
            );
          }
        } catch (e) {
          stop(
            String(e).includes("max-output-bytes")
              ? "max-output-bytes"
              : (reason ?? "failure"),
          );
          await persist(path.join(output, `worker-${slot + 1}-error.json`), {
            error: String(e),
          }).catch(() => {});
        } finally {
          await engine.close();
        }
      }),
    );
    await saveIndex();
    let completedGames = 0,
      reusedCompletedGames = 0,
      failedGames = 0,
      skippedGames = 0,
      timeoutGames = 0;
    for (const [matchId, relative] of Object.entries(index)) {
      const match = parseMatchLog(
        await readFile(path.join(output, relative, "native/match.log"), "utf8"),
      );
      for (const ref of match.refs) {
        const game = ref.checkpoint_game as Record<string, unknown>;
        if (game.status === "completed") {
          completedGames++;
          if (reusedMatches.has(matchId)) reusedCompletedGames++;
        } else if (game.status === "failed") {
          failedGames++;
          if (game.failure_category === "timeout") timeoutGames++;
        } else skippedGames++;
      }
    }
    const elapsedMs = performance.now() - begin,
      result = {
        runner: "typescript-native/v1",
        processTreePeakRssBytes: peakRssBytes,
        status:
          Object.keys(index).length === job.matches.length && reason === null
            ? "completed"
            : "interrupted",
        workers,
        matches: Object.keys(index).length,
        completedGames,
        failedGames,
        skippedGames,
        timeoutGames,
        reservedGames: charged,
        elapsedMs,
        reusedCompletedGames,
        executedCompletedGames: completedGames - reusedCompletedGames,
        resumeVerificationMs,
        gamesPerSecond:
          (completedGames - reusedCompletedGames) / (elapsedMs / 1000),
        stoppingReason: reason,
        output,
        exitCode:
          Object.keys(index).length === job.matches.length &&
          reason === null &&
          skippedGames === 0 &&
          failedGames === timeoutGames
            ? 0
            : 2,
      };
    await persist(path.join(output, "result.json"), result);
    return result;
  } finally {
    if (timer) clearInterval(timer);
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
    await Promise.all(threads.map((w) => w.terminate()));
    clearReplayWriteGrants();
    try {
      if (lease && !options.sessionLease)
        await releaseBatchStorage(lease.root, lease.token);
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({
    options: {
      session: { type: "string" },
      out: { type: "string" },
      workers: { type: "string", default: "2" },
      matches: { type: "string", default: "8" },
      resume: { type: "boolean" },
      "max-wall-ms": { type: "string", default: "60000" },
      "max-games": { type: "string" },
      "max-bytes": { type: "string" },
      "stop-file": { type: "string" },
    },
  });
  if (!v.session || !v.out) throw Error("--session and --out required");
  const { job } = await prepareTypescriptJob(v.session, Number(v.matches));
  const result = await runTypescriptNative({
    job,
    out: v.out,
    workers: Number(v.workers),
    resume: !!v.resume,
    maxWallMs: Number(v["max-wall-ms"]),
    ...(v["max-games"] ? { maxGames: Number(v["max-games"]) } : {}),
    ...(v["max-bytes"] ? { maxBytes: Number(v["max-bytes"]) } : {}),
    ...(v["stop-file"] ? { stopFile: path.resolve(v["stop-file"]) } : {}),
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

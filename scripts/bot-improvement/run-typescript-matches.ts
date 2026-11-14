/** Standalone experiment. No improvement ledger writes or production recommendations. */
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { prepareMatches } from "./prepare-match-job.ts";
import type { integratedMatch } from "./typescript-match-worker.ts";
import { identity } from "./session-fixtures.ts";
type Job = Awaited<ReturnType<typeof prepareMatches>>["job"];
type Result = Awaited<ReturnType<typeof integratedMatch>>;
/** Resolve the same accepted candidate as the Rust batch entry point. */
export async function prepareTypescriptJob(session: string, matches: number) {
  const { prepareMatches } = await import("./prepare-match-job.ts");
  const config = JSON.parse(
    await readFile(path.join(session, "config.json"), "utf8"),
  );
  const state = JSON.parse(
    await readFile(path.join(session, "state.json"), "utf8"),
  );
  const initial = path.resolve(config.fixture.path, "versions/initial");
  const bot =
    path.resolve(state.accepted.path) === initial
      ? JSON.parse(
          await readFile(
            path.join(config.fixture.path, "manifest.json"),
            "utf8",
          ),
        ).target
      : JSON.parse(
          await readFile(
            path.join(state.accepted.path, "frozen-bot.json"),
            "utf8",
          ),
        );
  if (bot.identity !== state.accepted.identity)
    throw Error("Accepted snapshot identity changed");
  return prepareMatches({
    session,
    matchCount: matches,
    accepted: { schemaVersion: 1, path: state.accepted.path, bot },
  });
}
export async function runTypescriptMatches(options: {
  job: Job;
  out: string;
  workers: number;
  evidence?: boolean;
  maxWallMs?: number;
}) {
  if (
    !Number.isSafeInteger(options.workers) ||
    options.workers < 1 ||
    options.workers > availableParallelism()
  )
    throw Error("Invalid worker count");
  if (
    options.maxWallMs !== undefined &&
    (!Number.isSafeInteger(options.maxWallMs) || options.maxWallMs < 1)
  )
    throw Error("Invalid wall deadline");
  if (!options.job.matches.length) throw Error("No matches");
  const out = path.resolve(options.out);
  await mkdir(out);
  const begin = performance.now(),
    workers: Worker[] = [],
    rows: Result[] = [];
  let cursor = 0,
    cancelled = false;
  const abort = () => {
    cancelled = true;
    for (const w of workers) void w.terminate();
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  const timer = setTimeout(abort, options.maxWallMs ?? 600_000);
  try {
    await Promise.all(
      Array.from(
        { length: Math.min(options.workers, options.job.matches.length) },
        async () => {
          const worker = new Worker(
            new URL("./typescript-match-worker.ts", import.meta.url),
            {
              execArgv: [
                "--experimental-vm-modules",
                "--disable-warning=ExperimentalWarning",
              ],
            },
          );
          workers.push(worker);
          try {
            while (cursor < options.job.matches.length) {
              if (cancelled)
                throw Error(
                  "TypeScript experiment interrupted or exceeded wall deadline",
                );
              const item = options.job.matches[cursor++]!;
              const result = await new Promise<Result>((resolve, reject) => {
                const cleanup = () => {
                  worker.off("message", message);
                  worker.off("error", error);
                  worker.off("exit", exit);
                };
                const message = (value: { result: Result; error?: string }) => {
                  cleanup();
                  if (value.error) reject(Error(value.error));
                  else resolve(value.result);
                };
                const error = (e: Error) => {
                  cleanup();
                  reject(e);
                };
                const exit = (code: number) => {
                  cleanup();
                  reject(
                    Error(`Worker exited before completing match (${code})`),
                  );
                };
                worker.once("message", message);
                worker.once("error", error);
                worker.once("exit", exit);
                worker.postMessage({
                  job: options.job,
                  item,
                  evidence: options.evidence ?? false,
                });
              });
              if (result.id !== item.match.id || result.games.length !== 4)
                throw Error("Invalid worker result");
              await writeFile(
                path.join(out, `${result.id}.json`),
                JSON.stringify(result),
              );
              // Keep frame evidence on disk, outside the compact aggregate.
              const compact = { ...result };
              delete compact.frames;
              rows.push(compact);
            }
          } finally {
            await worker.terminate();
          }
        },
      ),
    ).catch((e) => {
      abort();
      throw e;
    });
    const elapsedMs = performance.now() - begin;
    rows.sort((a, b) => a.id.localeCompare(b.id));
    const result = {
      runner: "typescript-integrated-experimental",
      workers: options.workers,
      matches: rows.length,
      games: rows.length * 4,
      elapsedMs,
      gamesPerSecond: (rows.length * 4) / (elapsedMs / 1000),
      fingerprint: identity(rows.map((r) => [r.id, r.fingerprint])),
      evidence: options.evidence ? "raw-host-frames" : "compact-gameplay",
      rows,
    };
    await writeFile(
      path.join(out, "result.json"),
      JSON.stringify(result, null, 2),
    );
    return result;
  } finally {
    clearTimeout(timer);
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
    await Promise.all(workers.map((w) => w.terminate()));
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
      evidence: { type: "boolean", default: false },
      "max-wall-ms": { type: "string", default: "60000" },
    },
  });
  if (!v.session || !v.out) throw Error("--session and --out required");
  const { job } = await prepareTypescriptJob(v.session, Number(v.matches));
  console.log(
    JSON.stringify(
      await runTypescriptMatches({
        job,
        out: v.out,
        workers: Number(v.workers),
        evidence: v.evidence,
        maxWallMs: Number(v["max-wall-ms"]),
      }),
      (_k, v) => (_k === "rows" ? undefined : v),
    ),
  );
}

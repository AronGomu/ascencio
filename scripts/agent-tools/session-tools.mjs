import process from "node:process";
import { Buffer } from "node:buffer";
import console from "node:console";
/** Read-only inspection and explicit, bounded performance fixtures. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function optional(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export async function snapshot(files) {
  return {
    observedAt: new Date().toISOString(),
    files: await Promise.all(
      files.map(async (file) => ({ file, sha256: hash(await readFile(file)) })),
    ),
  };
}
export async function changedFiles(saved) {
  return (
    await Promise.all(
      saved.files.map(async (pin) => {
        try {
          return hash(await readFile(pin.file)) === pin.sha256
            ? null
            : pin.file;
        } catch (e) {
          if (e.code === "ENOENT") return pin.file;
          throw e;
        }
      }),
    )
  ).filter(Boolean);
}
export function section(text, heading) {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line) => line.replace(/^#+\s*/, "") === heading,
  );
  if (start < 0) throw Error(`Heading not found: ${heading}`);
  const depth = /^#+/.exec(lines[start])?.[0].length ?? 0;
  let end = start + 1;
  while (
    end < lines.length &&
    !(
      depth &&
      /^#+\s/.test(lines[end]) &&
      /^#+/.exec(lines[end])[0].length <= depth
    )
  )
    end++;
  return lines
    .slice(start, end)
    .map((line, i) => `${start + i + 1}: ${line}`)
    .join("\n");
}
export async function status(root) {
  const ledger = await optional(path.join(root, "control.json"));
  if (!ledger)
    throw Error("Expected a session directory containing control.json");
  const config = await optional(path.join(root, "config.json"));
  const attempts = ledger.attempts ?? [];
  const unique = new Map();
  for (const a of attempts)
    if (a.status === "complete")
      unique.set(`${a.iteration}/${a.role}/${a.match}`, a);
  const scopes = [];
  for (const dir of await readdir(path.join(root, "iterations")).catch((e) => {
    if (e.code === "ENOENT") return [];
    throw e;
  })) {
    for (const role of ["control", "candidate"]) {
      const base = path.join(root, "iterations", dir, "analyses", role);
      const slices = await optional(path.join(base, "slices.json"));
      const queue = await optional(path.join(base, "queue.json"));
      if (!slices && !queue) continue;
      scopes.push({
        iteration: dir,
        role,
        preparedSlices: slices?.slices.length ?? 0,
        completedSlices:
          slices?.slices.filter((s) => s.status === "complete").length ?? 0,
        lossViewsPublished: slices
          ? (
              await Promise.all(
                slices.slices.map(async (s) => {
                  const packet = await optional(path.join(root, s.packet.path));
                  return (
                    packet?.jobs.reduce((n, j) => n + j.losses.length, 0) ?? 0
                  );
                }),
              )
            ).reduce((a, b) => a + b, 0)
          : null,
        reviewedLosses: queue
          ? (
              await Promise.all(
                queue.jobs
                  .filter((j) => j.status === "complete" && j.report)
                  .map(async (j) => {
                    const report = await optional(
                      path.join(root, j.report.path),
                    );
                    return report?.findings?.length ?? 0;
                  }),
              )
            ).reduce((a, b) => a + b, 0)
          : null,
      });
    }
  }
  return {
    observedAt: new Date().toISOString(),
    session: path.resolve(root),
    source: "control.json and published analysis metadata; no gameplay scan",
    effectiveLimits: ledger.limits ?? config?.limits?.stop,
    stoppingReason: ledger.stoppingReason,
    chargedGames: attempts.reduce((n, a) => n + (a.reservedGames ?? 0), 0),
    completedGames: [...unique.values()].reduce(
      (n, a) => n + (a.games?.length ?? 0),
      0,
    ),
    runningAttempts: attempts
      .filter((a) => a.status === "running")
      .map((a) => ({ iteration: a.iteration, role: a.role, match: a.match })),
    analysis: scopes,
    replay: {
      settledCases: null,
      note: "Supply the replay pool output to replay-status; pools are not inferred by scanning the session.",
    },
    timing: {
      recordedElapsedMs: ledger.elapsedMs,
      activeSince: ledger.activeSince,
    },
    ownership: await optional(
      path.join(root, ".session-state.lock/owner.json"),
    ),
    note: "Published metadata snapshot, not an integrity audit. During preparation unpublished views are reported as unknown.",
  };
}
export const workloads = {
  smoke: { matches: 4, workers: 2, repeats: 1 },
  confirm: { matches: 12, workers: 2, repeats: 2 },
  integrated: { matches: 25, workers: 2, repeats: 1 },
};
export async function main([command, ...args]) {
  if (command === "status") return status(args[0]);
  if (command === "replay-status") {
    const progress = await optional(path.join(args[0], "progress.json"));
    const result = await optional(path.join(args[0], "result.json"));
    if (!progress && !result) throw Error("No replay pool progress/result");
    return { observedAt: new Date().toISOString(), progress, result };
  }
  if (command === "read") {
    const [file, heading] = args;
    const text = await readFile(file, "utf8");
    const output = heading
      ? section(text, heading)
      : text
          .split("\n")
          .flatMap((l, i) => (/^#{1,6}\s/.test(l) ? [`${i + 1}: ${l}`] : []))
          .join("\n");
    if (Buffer.byteLength(output) > 24000)
      throw Error(
        "Section exceeds 24 KB; select a smaller heading or line range with rg/sed",
      );
    return output;
  }
  if (command === "snapshot") {
    const [out, ...files] = args;
    if (!files.length) throw Error("snapshot OUTPUT FILE...");
    await writeFile(
      out,
      JSON.stringify(await snapshot(files), null, 2) + "\n",
      { flag: "wx" },
    );
    return { snapshot: out };
  }
  if (command === "recheck") {
    const changed = await changedFiles(await optional(args[0]));
    if (changed.length) process.exitCode = 2;
    return { changed };
  }
  if (command === "perf") {
    const [tier, session, out] = args,
      preset = workloads[tier];
    if (!preset || !session || !out)
      throw Error("perf smoke|confirm|integrated SESSION FRESH_OUTPUT");
    for (let i = 0; i < preset.repeats; i++) {
      const argv = [
        "--no-lazy",
        "--no-wasm-lazy-compilation",
        "--no-liftoff",
        "scripts/bot-improvement/benchmark-typescript-matches.ts",
        "--full-only",
        "--session",
        session,
        "--out",
        `${out}-${i + 1}`,
        "--workers",
        String(preset.workers),
        "--matches",
        String(preset.matches),
        "--max-wall-ms",
        "120000",
        ...(i % 2 ? ["--native-first"] : []),
      ];
      const result = spawnSync(process.execPath, argv, { stdio: "inherit" });
      if (result.error || result.status !== 0)
        throw result.error ?? Error("Performance fixture failed");
    }
    return {
      tier,
      ...preset,
      note: "Comparison includes the Rust reference. Integrated tier still requires separate preparation/report ingestion; see plan.",
    };
  }
  throw Error(
    "Commands: status SESSION | replay-status POOL | read FILE [HEADING] | snapshot OUTPUT FILE... | recheck SNAPSHOT | perf smoke|confirm|integrated SESSION OUTPUT",
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await main(process.argv.slice(2));
    console.log(
      typeof result === "string" ? result : JSON.stringify(result, null, 2),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

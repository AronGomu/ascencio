import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";

/** Capture once before measured work; never include collection cost in stage timings. */
export function benchmarkProvenance(
  frozenInputs: unknown,
  options: {
    workers: number[];
    evidenceMode: string;
    childRuntimeFlags?: string[];
  },
) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
  const hash = createHash("sha256");
  const files = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "scripts",
    "src",
    "tools",
    "vendor",
    "config",
    "assets/ai-bots",
    "package.json",
    "package-lock.json",
  )
    .toString()
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const file of files) {
    hash.update(file).update("\0");
    try {
      hash.update(readFileSync(file));
    } catch {
      hash.update("<deleted>");
    }
    hash.update("\0");
  }
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    source: {
      revision: git("rev-parse", "HEAD").toString().trim(),
      trackedAndUntrackedSourceSha256: hash.digest("hex"),
      dirty: git("status", "--porcelain").length > 0,
    },
    frozenInputsSha256: createHash("sha256")
      .update(JSON.stringify(frozenInputs))
      .digest("hex"),
    runtime: {
      node: process.version,
      executable: process.execPath,
      flags: process.execArgv,
      nodeOptions: process.env.NODE_OPTIONS ?? "",
      childRuntimeFlags: options.childRuntimeFlags ?? [],
      platform: process.platform,
      arch: process.arch,
    },
    machine: {
      cpu: os.cpus()[0]?.model,
      availableParallelism: os.availableParallelism(),
      loadAverage: os.loadavg(),
    },
    workers: options.workers,
    evidenceMode: options.evidenceMode,
    measurements:
      "Raw runs and actual completed work are retained in this report; requested work is not a completion count.",
    limitations:
      "Applies to these frozen inputs, evidence mode, worker counts and background load. Short runs establish directional performance, not sustained throughput. Source digest covers runner, application, engine, config and bot sources; frozen input digest identifies the supplied job/config/request, including its existing pins.",
  };
}

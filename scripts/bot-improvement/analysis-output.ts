/** Single-owner analysis writes backed by the shared run quota reservation. */
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { findOutputRoot, outputUsage, writeOutput } from "./output-storage.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "./batch-storage-lease.ts";
import {
  installLocalOutputAllowance,
  clearLocalOutputAllowance,
  replayWriteOutput,
} from "./replay-output-budget.ts";
import { save } from "./session-checkpoint.ts";
import { analysisPath } from "./analysis-evidence.ts";

const active = new AsyncLocalStorage<{
  root: string;
  output: string;
  open: boolean;
  suspended: boolean;
}>();
export async function analysisWriteOutput(
  file: string,
  bytes: string | Uint8Array,
  exclusive = false,
) {
  const scope = active.getStore();
  const relative = scope && path.relative(scope.output, path.resolve(file));
  if (
    !scope ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).includes("..")
  )
    return writeOutput(file, bytes, exclusive);
  if (!scope.open) throw Error("Analysis output owner has settled");
  if (scope.suspended)
    throw Error("max-output-bytes: analysis storage is suspended");
  try {
    return await replayWriteOutput(file, bytes, exclusive);
  } catch (error) {
    if (String(error).includes("max-output-bytes")) {
      scope.suspended = true;
      try {
        await writeOutput(
          path.join(scope.root, ".storage-stop"),
          "max-output-bytes\n",
          true,
        );
      } catch (markerError) {
        if ((markerError as NodeJS.ErrnoException).code !== "EEXIST")
          throw markerError;
      }
    }
    throw error;
  }
}
export function saveAnalysis(file: string, value: unknown) {
  return save(file, value, analysisWriteOutput);
}
/** Caller holds the session lock and awaits all writes before returning. */
export async function withAnalysisOutput<T>(
  session: string,
  relative: string,
  run: () => Promise<T>,
): Promise<T> {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative
      .split(/[\\/]/)
      .some((part) => !part || part === "." || part === "..")
  )
    throw Error("Unsafe analysis output scope");
  const output = path.resolve(session, relative);
  await analysisPath(session, ".session-state.lock");
  const root = await findOutputRoot(path.join(output, ".probe"));
  if (!root) return run();
  // Refuse every active reservation, including one for this exact directory.
  // Crash recovery must establish that the prior owner stopped; never steal it.
  const lease = await leaseBatchStorage(
    root,
    output,
    false,
    undefined,
    8_000_000,
    true,
  );
  const scope = { root, output, open: true, suspended: false };
  async function settle() {
    scope.open = false;
    clearLocalOutputAllowance(output);
    try {
      const usage = await outputUsage(output, true);
      if (usage.totalBytes > lease.maxBytes)
        throw Error("Analysis output exceeded its reserved allowance");
    } finally {
      await releaseBatchStorage(scope.root, lease.token);
    }
  }
  try {
    await installLocalOutputAllowance(output, lease.maxBytes);
    return await active.run(scope, run);
  } finally {
    await settle();
  }
}

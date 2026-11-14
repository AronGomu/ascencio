/** Shared exhaustive CPU stages and repeat-aware recommendation policy. */
import { availableParallelism } from "node:os";
export function workerCounts(value?: string, logical = availableParallelism()) {
  if (!Number.isSafeInteger(logical) || logical < 2)
    throw Error(
      "Worker calibration requires at least two available logical CPUs",
    );
  const counts =
    value === undefined
      ? Array.from({ length: logical - 1 }, (_, i) => i + 2)
      : value.split(",").map(Number);
  if (
    !counts.length ||
    new Set(counts).size !== counts.length ||
    counts.some((n) => !Number.isSafeInteger(n) || n < 2 || n > logical)
  )
    throw Error(
      "Worker counts must be unique integers from 2 through available logical CPUs",
    );
  return counts;
}
export function workerRecommendation(
  runs: { workers: number; elapsedMs: number }[],
) {
  if (
    !runs.length ||
    runs.some((r) => !Number.isFinite(r.elapsedMs) || r.elapsedMs <= 0)
  )
    throw Error("Positive calibration measurements required");
  const stages = [...new Set(runs.map((r) => r.workers))].map((workers) => {
    const times = runs
      .filter((r) => r.workers === workers)
      .map((r) => r.elapsedMs)
      .sort((a, b) => a - b);
    return {
      workers,
      medianMs:
        (times[Math.floor((times.length - 1) / 2)]! +
          times[Math.floor(times.length / 2)]!) /
        2,
    };
  });
  const fastest = Math.min(...stages.map((s) => s.medianMs));
  return {
    stages,
    workers: Math.min(
      ...stages
        .filter((s) => s.medianMs <= fastest * 1.03)
        .map((s) => s.workers),
    ),
  };
}

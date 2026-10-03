import type { StartupProgress } from "../../storage/index.ts";

/** Overall work estimate. Conditional phases are skipped; READY alone admits 100%. */
const PHASE_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  startup: [0, 5],
  installation: [5, 15],
  "source-and-media-copy": [15, 25],
  verification: [25, 45],
  "engine-preparation": [45, 55],
  "user-state": [55, 60],
  "mod-composition": [60, 70],
  "domain-projections": [70, 75],
  "gameplay-preparation": [75, 100],
};

export function startupPercentage(
  progress: Pick<StartupProgress, "phase" | "completed" | "total">,
): number {
  const range = PHASE_RANGES[progress.phase];
  if (!range) return 0;
  const fraction =
    Number.isFinite(progress.completed) &&
    Number.isFinite(progress.total) &&
    progress.total > 0
      ? Math.min(1, Math.max(0, progress.completed / progress.total))
      : 0;
  return Math.min(99, Math.floor(range[0] + (range[1] - range[0]) * fraction));
}

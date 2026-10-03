/** Menu/package availability alone is not ADR-104 READY. */
export const READY_REQUIREMENTS = [
  "critical-content",
  "user-state",
  "mod-composition",
  "domain-projections",
  "engine-preparation",
  "screen-modules",
] as const;

export type ReadyRequirement = (typeof READY_REQUIREMENTS)[number];

export const STARTUP_PHASES = [
  "startup",
  "verification",
  "user-state",
  "mod-composition",
  "domain-projections",
  "engine-preparation",
  "baseline-ready",
  "ready",
  "failed",
  "cancelled",
  "maintenance",
] as const;
export type StartupPhase = (typeof STARTUP_PHASES)[number];

export function assertStartupReady(
  prepared: readonly ReadyRequirement[],
): void {
  const missing = READY_REQUIREMENTS.filter((step) => !prepared.includes(step));
  if (missing.length > 0)
    throw new Error(`STARTUP_NOT_PREPARED:${missing.join(",")}`);
}

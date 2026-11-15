import { validateReasonVocabulary } from "./reason-vocabulary.ts";
/** Explicit alternative review policies; selection never asserts unread loss coverage. */
import { digest } from "./session-fixtures.ts";
export interface AnalysisPolicy {
  mode: "full" | "sample" | "two-pass";
  sliceMatches: number;
  analystSlots: number;
  preparationSlots: number;
  sampleMatches?: number;
  seed?: string;
  earlyResearch: boolean;
  maxWallMs?: number;
  maxBytes?: number;
  pipeline?: { evaluationBytes: number; analysisBytes: number };
  resources?: {
    runtimeSlots: number;
    reserveBytes: number;
    bytesPerAnalyst: number;
    bytesPerPreparer: number;
  };
  scheduling?: "ordered" | "cost-balanced";
  feasibility?: {
    samples: {
      stratum: string;
      losses: number;
      elapsedMs: number;
      bytes: number;
    }[];
    remaining: Record<string, number>;
    remainingMs: number;
  };
  vocabulary?: { version: string; aliases: Record<string, string> };
}
export function resolveAnalysisPolicy(
  value: Partial<AnalysisPolicy> = {},
  legacySlots = 1,
): AnalysisPolicy {
  const policy = {
    mode: "full" as const,
    sliceMatches: 250,
    analystSlots: legacySlots,
    preparationSlots: 1,
    earlyResearch: false,
    ...value,
  };
  if (!["full", "sample", "two-pass"].includes(policy.mode))
    throw Error("Unknown analysis mode");
  for (const key of [
    "sliceMatches",
    "analystSlots",
    "preparationSlots",
  ] as const)
    if (
      !Number.isSafeInteger(policy[key]) ||
      policy[key] < 1 ||
      policy[key] > (key === "sliceMatches" ? 250 : 64)
    )
      throw Error(`Invalid ${key}`);
  if (
    policy.mode !== "full" &&
    (!Number.isSafeInteger(policy.sampleMatches) ||
      policy.sampleMatches! < 1 ||
      !policy.seed)
  )
    throw Error("Alternative review requires explicit sampleMatches and seed");
  for (const key of ["maxWallMs", "maxBytes"] as const)
    if (
      policy[key] !== undefined &&
      (!Number.isSafeInteger(policy[key]) || policy[key]! < 1)
    )
      throw Error(`Invalid ${key}`);
  if (policy.pipeline)
    for (const n of Object.values(policy.pipeline))
      if (!Number.isSafeInteger(n) || n <= 16_000_000)
        throw Error("Explicit pipeline envelopes must exceed control reserve");
  if (policy.resources)
    for (const n of Object.values(policy.resources))
      if (!Number.isSafeInteger(n) || n < 1)
        throw Error("Invalid resource capability");
  if (policy.pipeline && !policy.resources)
    throw Error("Pipeline requires explicit runtime/resource capabilities");
  if (
    policy.scheduling &&
    !["ordered", "cost-balanced"].includes(policy.scheduling)
  )
    throw Error("Unknown scheduling policy");
  if (policy.resources && policy.analystSlots > policy.resources.runtimeSlots)
    throw Error("Analyst slots exceed declared runtime capabilities");
  if (policy.vocabulary) validateReasonVocabulary(policy.vocabulary);
  if (policy.feasibility) {
    if (
      !Number.isFinite(policy.feasibility.remainingMs) ||
      policy.feasibility.remainingMs < 0 ||
      Object.values(policy.feasibility.remaining).some(
        (n) => !Number.isSafeInteger(n) || n < 0,
      ) ||
      policy.feasibility.samples.some(
        (s) =>
          !s.stratum ||
          !Number.isSafeInteger(s.losses) ||
          s.losses < 1 ||
          !Number.isFinite(s.elapsedMs) ||
          s.elapsedMs <= 0 ||
          !Number.isFinite(s.bytes) ||
          s.bytes < 0,
      )
    )
      throw Error("Invalid feasibility sample");
  }
  return policy;
}
export function policyIdentity(policy: AnalysisPolicy) {
  return digest(JSON.stringify(policy));
}
export function selectedMatches(
  ids: string[],
  policy: AnalysisPolicy,
  costs: Record<string, number> = {},
) {
  if (policy.mode === "full") return new Set(ids);
  const ordered = [...ids].sort((a, b) =>
    digest(`${policy.seed}/${a}`).localeCompare(digest(`${policy.seed}/${b}`)),
  );
  if (policy.mode === "two-pass") {
    if (ids.some((id) => !Number.isFinite(costs[id])))
      throw Error("Complete triage metadata required");
    // One fixed interleaved order makes every larger cohort a strict prefix expansion.
    const ranked = [...ordered].sort((a, b) => costs[b]! - costs[a]!);
    const selectionOrder: string[] = [];
    const seen = new Set<string>();
    let rankCursor = 0,
      randomCursor = 0;
    while (selectionOrder.length < ids.length) {
      const representative = selectionOrder.length % 5 === 0;
      const list = representative ? ordered : ranked;
      let cursor = representative ? randomCursor : rankCursor;
      while (cursor < list.length && seen.has(list[cursor]!)) cursor++;
      const id = list[cursor];
      if (representative) randomCursor = cursor + 1;
      else rankCursor = cursor + 1;
      if (id !== undefined) {
        seen.add(id);
        selectionOrder.push(id);
      }
    }
    const selected = new Set(selectionOrder.slice(0, policy.sampleMatches));
    return selected;
  }
  return new Set(ordered.slice(0, policy.sampleMatches));
}
export function analystCapacity(
  policy: AnalysisPolicy,
  resources: {
    runtimeSlots: number;
    freeBytes: number;
    reserveBytes: number;
    bytesPerAnalyst: number;
    activeEvaluationBytes: number;
  },
) {
  if (
    Object.values(resources).some((n) => !Number.isFinite(n) || n < 0) ||
    resources.bytesPerAnalyst <= 0
  )
    throw Error("Invalid resource observation");
  return Math.max(
    0,
    Math.min(
      policy.analystSlots,
      Math.floor(resources.runtimeSlots),
      Math.floor(
        (resources.freeBytes -
          resources.reserveBytes -
          resources.activeEvaluationBytes) /
          resources.bytesPerAnalyst,
      ),
    ),
  );
}
export function reviewFeasibility(
  samples: {
    stratum: string;
    losses: number;
    elapsedMs: number;
    bytes: number;
  }[],
  remaining: Record<string, number>,
  slots: number,
  remainingMs: number,
) {
  if (!Number.isSafeInteger(slots) || slots < 1 || remainingMs < 0)
    throw Error("Invalid feasibility limits");
  let elapsedMs = 0,
    bytes = 0;
  for (const [stratum, losses] of Object.entries(remaining)) {
    const sample = samples.filter(
      (s) => s.stratum === stratum && s.losses > 0 && s.elapsedMs > 0,
    );
    if (losses > 0 && !sample.length)
      return {
        assessable: false,
        reason: `Missing representative ${stratum} sample`,
      };
    const n = sample.reduce((n, s) => n + s.losses, 0);
    if (n) {
      elapsedMs += (losses * sample.reduce((n, s) => n + s.elapsedMs, 0)) / n;
      bytes += (losses * sample.reduce((n, s) => n + s.bytes, 0)) / n;
    }
  }
  return {
    assessable: true,
    estimatedWallMs: elapsedMs / slots,
    estimatedBytes: bytes,
    feasible: elapsedMs / slots <= remainingMs,
    scope: "Measured strata extrapolation, not guaranteed analyst throughput",
  };
}

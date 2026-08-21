import type {
  ChoiceId,
  PromptId,
  SnapshotId,
} from "../../duel/contracts/ids.ts";
import type { PlayerIndex } from "../../duel/contracts/public-duel-state.ts";
import type { DuelSeed } from "../engine/duel-seed.ts";
import type { OpponentDecisionReason } from "../opponent/OpponentPolicy.ts";

export interface DuelTraceEntry {
  readonly sequence: number;
  readonly kind:
    | "process"
    | "message"
    | "presentation"
    | "prompt"
    | "response"
    | "result"
    | "error"
    | "engineDiagnostic"
    | "promptDiagnostic"
    | "lifecycle";
  readonly status?: number;
  readonly diagnosticType?: number;
  readonly messageType?: number;
  readonly promptId?: PromptId;
  readonly choiceIds?: readonly ChoiceId[];
  readonly player?: PlayerIndex;
  readonly opponentReason?: OpponentDecisionReason;
  readonly detail?: string;
}

export interface DuelTrace {
  readonly schemaVersion: 2;
  readonly presetId: string;
  readonly snapshotId: SnapshotId;
  readonly seed: readonly [string, string, string, string];
  readonly entries: readonly DuelTraceEntry[];
}

/** One answer the duel accepted, in the order it accepted it. Only the
    opponent's answers carry a reason, so its absence is what marks a response
    as the player's own decision. */
export interface RecordedDuelResponse {
  readonly promptId: PromptId;
  readonly choiceIds: readonly ChoiceId[];
  readonly player: PlayerIndex;
  readonly opponentReason?: OpponentDecisionReason;
}

/** Everything a fresh session needs to reproduce a duel up to the last
    decision the player owned: the same seed, the same snapshot, and the
    answers to feed back before the rebuilt duel is handed over. */
export interface RestorePlan {
  readonly seed: DuelSeed;
  readonly snapshotId: SnapshotId;
  readonly responses: readonly RecordedDuelResponse[];
  readonly stopAtPromptId: PromptId;
}

/**
 * Reads the trace back as the plan for rebuilding the duel, or `null` when
 * there is nothing to rebuild to.
 *
 * The stop point is the last response with no `opponentReason` — the last
 * prompt the player answered themselves. Everything recorded at or after it is
 * dropped: the player is about to make that decision again, so the opponent's
 * replies to the line they abandoned are no longer part of the position.
 */
export function buildRestorePlan(trace: DuelTrace): RestorePlan | null {
  /* A trace that has evicted its oldest entries no longer holds the whole
     duel, and replaying a suffix rebuilds a different position without
     saying so. The first entry is recorded before the core session exists,
     so a first sequence other than 1 is the evidence that the log is
     incomplete. */
  if (trace.entries[0]?.sequence !== 1) return null;
  const responses: RecordedDuelResponse[] = [];
  let lastHumanIndex = -1;
  for (const entry of trace.entries) {
    if (
      entry.kind !== "response" ||
      entry.promptId === undefined ||
      entry.choiceIds === undefined ||
      entry.player === undefined
    )
      continue;
    if (entry.opponentReason === undefined) lastHumanIndex = responses.length;
    responses.push(
      Object.freeze({
        promptId: entry.promptId,
        choiceIds: entry.choiceIds,
        player: entry.player,
        ...(entry.opponentReason === undefined
          ? {}
          : { opponentReason: entry.opponentReason }),
      }),
    );
  }
  const stopAt = responses[lastHumanIndex];
  if (stopAt === undefined) return null;
  const [first, second, third, fourth] = trace.seed;
  const seed: DuelSeed = [
    BigInt(first),
    BigInt(second),
    BigInt(third),
    BigInt(fourth),
  ];
  return Object.freeze({
    seed,
    snapshotId: trace.snapshotId,
    responses: Object.freeze(responses.slice(0, lastHumanIndex)),
    stopAtPromptId: stopAt.promptId,
  });
}

export class BoundedDuelTrace {
  readonly #presetId: string;
  readonly #snapshotId: SnapshotId;
  readonly #seed: DuelSeed;
  readonly #maximumEntries: number;
  readonly #maximumTextUnits: number;
  readonly #entries: DuelTraceEntry[] = [];
  #nextSequence = 1;
  #textUnits = 0;

  constructor(
    presetId: string,
    snapshotId: SnapshotId,
    seed: DuelSeed,
    maximumEntries = 10_000,
    maximumTextUnits = 900_000,
  ) {
    this.#presetId = presetId;
    this.#snapshotId = snapshotId;
    this.#seed = seed;
    this.#maximumEntries = maximumEntries;
    this.#maximumTextUnits = maximumTextUnits;
  }

  record(entry: Omit<DuelTraceEntry, "sequence">): void {
    const value = Object.freeze({
      sequence: this.#nextSequence++,
      ...entry,
      ...(entry.detail === undefined
        ? {}
        : { detail: entry.detail.slice(0, 4_096) }),
      ...(entry.choiceIds === undefined
        ? {}
        : { choiceIds: Object.freeze([...entry.choiceIds]) }),
    });
    const units = traceEntryTextUnits(value);
    while (
      this.#entries.length > 0 &&
      (this.#entries.length >= this.#maximumEntries ||
        this.#textUnits + units > this.#maximumTextUnits)
    ) {
      const removed = this.#entries.shift();
      if (removed !== undefined)
        this.#textUnits -= traceEntryTextUnits(removed);
    }
    this.#entries.push(value);
    this.#textUnits += units;
  }

  snapshot(): DuelTrace {
    return Object.freeze({
      schemaVersion: 2,
      presetId: this.#presetId,
      snapshotId: this.#snapshotId,
      seed: this.#seed.map(String) as [string, string, string, string],
      entries: Object.freeze([...this.#entries]),
    });
  }
}

function traceEntryTextUnits(entry: DuelTraceEntry): number {
  return (
    (entry.promptId?.length ?? 0) +
    (entry.opponentReason?.length ?? 0) +
    (entry.detail?.length ?? 0) +
    (entry.choiceIds?.reduce((total, id) => total + id.length, 0) ?? 0)
  );
}

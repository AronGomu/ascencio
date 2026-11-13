/** Strict actor-relative prefix verification; no private state is exposed to policies. */
import { isDeepStrictEqual } from "node:util";
import type {
  BotDecision,
  BotReason,
} from "../../src/battle/worker/bot/bot-contract.ts";
import type { ChoiceId } from "../../src/battle/duel/contracts/ids.ts";
import type { Artifact } from "./host-inputs.ts";
export interface ReplayEntry {
  kind: string;
  actor?: string;
  decision_id?: string;
  prompt?: unknown;
  selected_choice_ids?: { choice_id: ChoiceId[] };
  reason?: BotReason;
  [key: string]: unknown;
}
export interface ReplayRecord {
  initial?: unknown;
  timeline: { entry: ReplayEntry[] };
}
export interface ReplaySpec {
  actor: "a" | "b";
  decision: string;
  records: ReplayRecord[];
  replacement?: Artifact;
}
function actorRelative(value: unknown, order: number[]): unknown {
  if (Array.isArray(value)) return value.map((v) => actorRelative(v, order));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      key === "life_points" &&
      order[0] === 1 &&
      v &&
      typeof v === "object" &&
      "a" in v &&
      "b" in v
        ? { a: v.b, b: v.a }
        : ["actor", "player", "controller", "owner", "turn_player"].includes(
              key,
            ) &&
            (v === 0 || v === 1)
          ? order[v] === 0
            ? "a"
            : "b"
          : actorRelative(v, order),
    ]),
  );
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object")
    return value === null ? null : String(value);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== "duration_ms")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, stable(v)]),
  );
}
function descriptionHint(value: unknown): value is ReplayEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as ReplayEntry;
  const changes = entry.changes as { change?: unknown[] } | undefined;
  const details = entry.details as
    { item?: { type?: string; message?: string }[] } | undefined;
  return (
    entry.kind === "event" &&
    ["card_hint", "player_hint"].includes(String(entry.event)) &&
    Array.isArray(changes?.change) &&
    changes.change.length === 0 &&
    Array.isArray(details?.item) &&
    details.item.length === 1 &&
    details.item[0]?.type === "hint" &&
    (entry.event === "card_hint"
      ? /^Card hint [67]: \d+$/
      : /^Player [12] hint [67]: \d+$/
    ).test(details.item[0]?.message ?? "")
  );
}
function comparableHints(entries: ReplayEntry[]): string[] {
  return entries
    .map(({ sequence: omitted, ...entry }) => {
      void omitted;
      return JSON.stringify(stable(entry));
    })
    .sort();
}
export class ReplayMismatchError extends Error {
  readonly difference: {
    actor: number;
    index: number;
    expected: unknown;
    actual: unknown;
  };
  constructor(
    actor: number,
    index: number,
    expected: unknown,
    actual: unknown,
  ) {
    super(`replay_mismatch: actor ${actor === 0 ? "a" : "b"}, entry ${index}`);
    this.difference = { actor, index, expected, actual };
  }
}
export class DecisionReplay {
  private cursors = [0, 0];
  private hintBatches: ReplayEntry[][] = [[], []];
  reached = false;
  readonly spec: ReplaySpec;
  readonly order: number[];
  constructor(spec: ReplaySpec, order: number[]) {
    this.spec = spec;
    this.order = order;
    const decisions = spec.records
      .flatMap((r) => r.timeline.entry)
      .filter(
        (e) =>
          e.kind === "decision" &&
          e.decision_id === spec.decision &&
          e.actor === spec.actor,
      );
    if (decisions.length !== 1)
      throw Error("replay_mismatch: decision not uniquely present for actor");
  }
  initial(seat: number, initial: unknown) {
    if (
      !isDeepStrictEqual(
        stable(actorRelative(initial, this.order)),
        stable(this.spec.records[this.order[seat]!]!.initial),
      )
    )
      throw Error("replay_mismatch: initial state or deck orders");
  }
  event(seat: number, entry: unknown) {
    if (this.reached) return;
    const actual = actorRelative(entry, this.order);
    const actor = this.order[seat]!;
    const entries = this.spec.records[actor]!.timeline.entry;
    const start = this.cursors[actor]!;
    if (descriptionHint(actual) && descriptionHint(entries[start])) {
      const expected: ReplayEntry[] = [];
      for (let i = start; descriptionHint(entries[i]); i++)
        expected.push(entries[i]!);
      const batch = this.hintBatches[actor]!;
      batch.push(actual);
      if (batch.length === expected.length) {
        if (
          !isDeepStrictEqual(
            stable(batch.map((e) => e.sequence)),
            stable(expected.map((e) => e.sequence)),
          ) ||
          !isDeepStrictEqual(comparableHints(batch), comparableHints(expected))
        )
          throw new ReplayMismatchError(actor, start, expected, batch);
        this.cursors[actor]! += batch.length;
        this.hintBatches[actor] = [];
      }
      return;
    }
    this.requireCompleteHints(actor);
    this.consume(seat, actual);
  }
  private requireCompleteHints(actor: number) {
    if (this.hintBatches[actor]!.length)
      throw new ReplayMismatchError(
        actor,
        this.cursors[actor]!,
        this.spec.records[actor]!.timeline.entry[this.cursors[actor]!],
        this.hintBatches[actor],
      );
  }
  private consume(seat: number, actual: unknown) {
    const actor = this.order[seat]!;
    const expected =
      this.spec.records[actor]!.timeline.entry[this.cursors[actor]!];
    if (!isDeepStrictEqual(stable(actual), stable(expected)))
      throw new ReplayMismatchError(
        actor,
        this.cursors[actor]!,
        expected,
        actual,
      );
    this.cursors[actor]!++;
  }
  decision(
    seat: number,
    id: string,
    prompt: unknown,
    turn: number,
    phase: string,
  ): BotDecision | undefined {
    if (this.reached) return;
    for (const actor of [0, 1]) this.requireCompleteHints(actor);
    const actor = this.order[seat]!;
    const expected =
      this.spec.records[actor]!.timeline.entry[this.cursors[actor]!];
    const actual = actorRelative(
      { actor: seat, decision_id: id, prompt, turn, phase },
      this.order,
    );
    if (
      !expected ||
      expected.kind !== "decision" ||
      !isDeepStrictEqual(
        stable(actual),
        stable(
          Object.fromEntries(
            ["actor", "decision_id", "prompt", "turn", "phase"].map((k) => [
              k,
              expected[k],
            ]),
          ),
        ),
      )
    )
      throw Error(`replay_mismatch: prompt at ${id}`);
    if (
      id === this.spec.decision &&
      (actor === 0 ? "a" : "b") === this.spec.actor
    ) {
      this.reached = true;
      return;
    }
    this.cursors[actor]!++;
    return {
      choiceIds: expected.selected_choice_ids!.choice_id,
      reason: expected.reason!,
    };
  }
}

import type {
  PublicDuelState,
  PublicCard,
  PlayerIndex,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
export type RecordValue =
  null | string | number | boolean | RecordObject | RecordValue[];
export interface RecordObject {
  [key: string]: RecordValue;
}
export function record(value: unknown): RecordValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (Array.isArray(value)) return { item: value.map(record) };
  return Object.fromEntries(
    Object.entries(value as object).map(([k, v]) => [
      k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
      k === "code" ? String(v) : record(v),
    ]),
  );
}
export function deckRecord(deck: ParsedDeck): RecordObject {
  return Object.fromEntries(
    (["main", "extra", "side"] as const).map((section) => {
      const counts = new Map<string, number>();
      for (const code of deck[section])
        counts.set(String(code), (counts.get(String(code)) ?? 0) + 1);
      return [
        section,
        {
          card: [...counts]
            .sort()
            .map(([card_code, copies]) => ({ card_code, copies })),
        },
      ];
    }),
  );
}
export function promptRecord(prompt: PlayerPrompt): RecordObject {
  return {
    id: prompt.id,
    kind: prompt.kind,
    player: prompt.player,
    title: prompt.title,
    message: prompt.message ?? null,
    minimum: prompt.minimum,
    maximum: prompt.maximum,
    ordered: prompt.ordered,
    cancelable: prompt.cancelable,
    constraints: {
      required_total: prompt.requiredTotal ?? null,
      sum_mode: prompt.sumMode ?? null,
      mandatory_contributions: {
        contribution: (prompt.mandatoryContributions ?? []).map((c) =>
          record(c),
        ),
      },
    },
    choices: {
      choice: prompt.choices.map((c) => ({
        id: c.id,
        action: c.action,
        label: c.label,
        ...(c.card
          ? {
              card_instance_id: c.card.instanceId,
              card_code: c.card.code === undefined ? null : String(c.card.code),
              card: record({
                controller: c.card.controller,
                location: c.card.location,
                sequence: c.card.sequence,
                position: c.card.position,
                contribution: c.card.contribution,
                alternativeContribution: c.card.alternativeContribution,
              }),
            }
          : {}),
        allocation_maximum: c.allocationMaximum ?? null,
        value: c.value ?? null,
        place: c.place ? record(c.place) : null,
        selected: c.selected ?? false,
      })),
    },
  };
}
function cards(state: PublicDuelState): Map<string, PublicCard> {
  const out = new Map<string, PublicCard>();
  for (const p of state.players)
    for (const c of [
      ...p.hand,
      ...p.extraDeck,
      ...p.monsters,
      ...p.spellsAndTraps,
      ...p.graveyard,
      ...p.banished,
    ])
      out.set(c.instanceId, c);
  return out;
}
function equalField(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (typeof a === "object" &&
      typeof b === "object" &&
      JSON.stringify(a) === JSON.stringify(b))
  );
}
export function changes(
  before: PublicDuelState,
  after: PublicDuelState,
): RecordObject[] {
  const a = cards(before),
    b = cards(after),
    out: RecordObject[] = [];
  for (const [id, value] of a)
    if (!b.has(id))
      out.push({
        type: "card_left_observation",
        instance_id: id,
        from: record({
          controller: value.controller,
          location: value.location,
          sequence: value.sequence,
        }),
      });
  for (const [id, value] of b) {
    const old = a.get(id);
    const changed = old
      ? Object.fromEntries(
          Object.entries(value).filter(
            ([k, v]) =>
              !equalField(v, (old as unknown as Record<string, unknown>)[k]),
          ),
        )
      : value;
    if (!old || Object.keys(changed).length)
      out.push({
        type: old ? "card_changed" : "card_entered_observation",
        instance_id: id,
        from: old
          ? record({
              controller: old.controller,
              location: old.location,
              sequence: old.sequence,
            })
          : null,
        to: record(changed),
      });
  }
  for (const p of after.players) {
    const old = before.players[p.player];
    for (const key of [
      "lifePoints",
      "handCount",
      "deckCount",
      "extraDeckCount",
    ] as const)
      if (p[key] !== old[key])
        out.push({
          type: key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
          player: p.player,
          value: p[key],
        });
  }
  if (JSON.stringify(before.chain) !== JSON.stringify(after.chain))
    out.push({ type: "chain_changed", chain: record(after.chain) });
  return out;
}
export function initialRecord(
  state: PublicDuelState,
  actor: PlayerIndex,
  deck: ParsedDeck,
  main: readonly number[],
  extra: readonly number[],
  rules: string,
): RecordObject {
  return {
    rules_profile: rules,
    own_configuration: deckRecord(deck),
    own_starting_order: {
      main: { card: main.map(String) },
      extra: { card: extra.map(String) },
    },
    own_opening_hand: {
      card: state.players[actor].hand.map((c) => ({
        instance_id: c.instanceId,
        card_code: String(c.code),
      })),
    },
    public_state: {
      life_points: {
        a: state.players[0].lifePoints,
        b: state.players[1].lifePoints,
      },
      turn: state.turn,
      turn_player: state.turnPlayer,
      phase: state.phase,
      opponent_hand_count: state.players[actor === 0 ? 1 : 0].handCount,
      opponent_deck_count: state.players[actor === 0 ? 1 : 0].deckCount,
    },
  };
}

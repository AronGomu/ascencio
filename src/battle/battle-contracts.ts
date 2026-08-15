import { deckId, type ValidatedDeckSnapshot } from "../decks/index.ts";
import {
  parseDuelDeckSelection,
  type DuelDeckSelection,
} from "./duel/contracts/duel-deck-selection.ts";
import type { DuelResult } from "./duel/contracts/duel-result.ts";
import { isDeckId, type DeckId } from "./duel/presets/deck-catalog.ts";

/** Which deck a seat brings: a bundled preset, or a deck the player built. */
export type BattleDeckSelection =
  | { readonly kind: "preset"; readonly deckId: DeckId }
  | { readonly kind: "local"; readonly deck: ValidatedDeckSnapshot };

export interface BattleRequest {
  readonly player: BattleDeckSelection;
  readonly opponent: BattleDeckSelection;
}

export type BattleOutcome = "player-win" | "player-loss" | "draw";

/** What a host learns about a duel it started. Deliberately free of engine
    values — no `DuelResult`, no seed, no protocol index, no deck order — so a
    caller can branch on it without depending on the duel's internals. */
export type BattleFacadeResult =
  | { readonly kind: "resolved"; readonly outcome: BattleOutcome }
  | { readonly kind: "aborted"; readonly reason: "surrender" | "exit" }
  | { readonly kind: "failed"; readonly message: string };

export class BattleRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BattleRequestError";
  }
}

/* Zone bounds are the facade's own guard: a request can arrive from a stored
   handoff or another domain, and neither is trusted to have stayed within the
   ruleset the deck was validated against. */
const ZONE_LIMITS = { main: 60, extra: 15, side: 15 } as const;

export function parseBattleRequest(value: unknown): BattleRequest {
  const request = exactKeys(value, ["player", "opponent"], "request");
  return Object.freeze({
    player: parseSelection(request.player, "player"),
    opponent: parseSelection(request.opponent, "opponent"),
  });
}

/** Maps the engine's own result onto the facade's vocabulary. A technical
    stop stays `failed`: a fabricated loss would advance a host past a duel
    that never finished. Player 0 is the local seat. */
export function battleResultForDuelResult(
  result: DuelResult,
): BattleFacadeResult {
  switch (result.type) {
    case "completed":
      return Object.freeze({
        kind: "resolved" as const,
        outcome: result.winner === 0 ? "player-win" : "player-loss",
      });
    case "surrendered":
      return Object.freeze({ kind: "aborted" as const, reason: "surrender" });
    case "unsupported":
    case "engineError":
      return battleFacadeFailure(result.detail);
  }
}

export function battleFacadeFailure(message: string): BattleFacadeResult {
  return Object.freeze({ kind: "failed" as const, message });
}

/** Maps a host's seat choice onto the Worker's start contract: a preset stays
    a preset, a deck the player built becomes an explicit card list.

    Routing both through the Worker's own parser is the point. A stored deck
    can have been written under an older ruleset, or edited to 39 cards after
    the handoff was recorded, and the caller learns that here — with the rule
    it broke named — instead of watching a duel start and then die. */
export function toDuelDeckSelection(
  selection: BattleDeckSelection,
): DuelDeckSelection {
  if (selection.kind === "preset")
    return parseDuelDeckSelection({
      kind: "preset",
      deckId: selection.deckId,
    });
  const { main, extra, side } = selection.deck;
  return parseDuelDeckSelection({
    kind: "cards",
    main: [...main],
    extra: [...extra],
    side: [...side],
  });
}

function parseSelection(value: unknown, field: string): BattleDeckSelection {
  const kind = plainObject(value, field).kind;
  if (kind === "preset") {
    const selection = exactKeys(value, ["kind", "deckId"], field);
    const id = selection.deckId;
    if (typeof id !== "string" || !isDeckId(id))
      throw new BattleRequestError(`${field}.deckId is not a bundled deck`);
    return Object.freeze({ kind: "preset" as const, deckId: id });
  }
  if (kind === "local") {
    const selection = exactKeys(value, ["kind", "deck"], field);
    return Object.freeze({
      kind: "local" as const,
      deck: parseDeck(selection.deck, `${field}.deck`),
    });
  }
  throw new BattleRequestError(`${field}.kind is not a deck selection`);
}

function parseDeck(value: unknown, field: string): ValidatedDeckSnapshot {
  const deck = exactKeys(
    value,
    ["ref", "name", "validationDigest", "main", "extra", "side"],
    field,
  );
  return Object.freeze({
    ref: parseDeckReference(deck.ref, `${field}.ref`),
    name: text(deck.name, `${field}.name`),
    validationDigest: text(deck.validationDigest, `${field}.validationDigest`),
    main: cardList(deck.main, `${field}.main`, ZONE_LIMITS.main),
    extra: cardList(deck.extra, `${field}.extra`, ZONE_LIMITS.extra),
    side: cardList(deck.side, `${field}.side`, ZONE_LIMITS.side),
  });
}

function parseDeckReference(
  value: unknown,
  field: string,
): ValidatedDeckSnapshot["ref"] {
  const ref = exactKeys(value, ["type", "deckId", "revision"], field);
  if (ref.type !== "local")
    throw new BattleRequestError(`${field}.type is not "local"`);
  if (typeof ref.deckId !== "string")
    throw new BattleRequestError(`${field}.deckId is not a string`);
  if (!Number.isSafeInteger(ref.revision) || (ref.revision as number) < 0)
    throw new BattleRequestError(`${field}.revision is not a revision number`);
  try {
    return Object.freeze({
      type: "local" as const,
      deckId: deckId(ref.deckId),
      revision: ref.revision as number,
    });
  } catch {
    throw new BattleRequestError(`${field}.deckId is not a deck id`);
  }
}

function cardList(
  value: unknown,
  field: string,
  limit: number,
): readonly number[] {
  if (!Array.isArray(value))
    throw new BattleRequestError(`${field} is not a card list`);
  if (value.length > limit)
    throw new BattleRequestError(`${field} holds more than ${limit} cards`);
  for (const code of value) {
    if (!Number.isSafeInteger(code) || (code as number) < 0)
      throw new BattleRequestError(`${field} holds a value that is not a card`);
  }
  return Object.freeze([...(value as number[])]);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new BattleRequestError(`${field} is not a string`);
  return value;
}

function plainObject(
  value: unknown,
  field: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) === null
  ) {
    throw new BattleRequestError(`${field} is not an object`);
  }
  return value as Record<string, unknown>;
}

/* Exact-key parsing rather than "has at least": an unexpected key means the
   sender speaks a contract this build does not, and silently dropping it
   would start a duel with settings nobody applied. */
function exactKeys(
  value: unknown,
  keys: readonly string[],
  field: string,
): Readonly<Record<string, unknown>> {
  const record = plainObject(value, field);
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new BattleRequestError(
      `${field} must hold exactly ${expected.join(", ")}`,
    );
  }
  return record;
}

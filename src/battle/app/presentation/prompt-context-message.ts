import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import type { CardCode } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type {
  CardPosition,
  PlayerIndex,
  PublicChainLink,
  PublicChainTarget,
  PublicDuelState,
  PublicLocation,
} from "../../duel/contracts/public-duel-state.ts";

/** One styled run of the prompt's context line. Typed rather than pre-formatted
    so the dialog can weight the actor and italicise the card without parsing a
    sentence back apart. */
export type PromptMessageSegment =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "actor"; readonly value: string }
  | { readonly kind: "card"; readonly value: string }
  | { readonly kind: "zone"; readonly value: string };

/** The card fields this module needs from the active text snapshot. */
export interface PromptMessageCardText {
  readonly name: string;
}

export interface PromptContextMessageInput {
  readonly prompt: PlayerPrompt | null;
  readonly snapshot: PublicDuelState | null;
  readonly events: readonly DuelPresentationEvent[];
  readonly cardTexts: ReadonlyMap<number, PromptMessageCardText>;
}

const ZONE_LABELS: Readonly<Record<PublicLocation, string>> = {
  deck: "Deck",
  hand: "Hand",
  monster: "Monster Zone",
  spellTrap: "Spell/Trap Zone",
  field: "Field Zone",
  graveyard: "Graveyard",
  banished: "Banished",
  extra: "Extra Deck",
};

const POSITION_LABELS: Readonly<Record<CardPosition, string>> = {
  faceUpAttack: "face-up Attack Position",
  faceDownAttack: "face-down Attack Position",
  faceUpDefense: "face-up Defense Position",
  faceDownDefense: "face-down Defense Position",
};

/* Naming every target turns one line into a paragraph, so two are named and
   the rest counted. The count comes from the projected list, which the worker
   caps, so a pathological effect reads "and N more" with the cap's N. */
const NAMED_TARGET_LIMIT = 2;

/**
 * The line describing what the duel is asking about, or `null` when nothing
 * truthful can be said. Chain windows only: every other prompt names its own
 * subject in its title, and a context line there would repeat it.
 */
export function promptContextMessage(
  input: PromptContextMessageInput,
): readonly PromptMessageSegment[] | null {
  const { prompt, snapshot } = input;
  if (prompt === null || prompt.kind !== "chain" || snapshot === null)
    return null;
  const body =
    chainSegments(snapshot.chain, input.cardTexts) ??
    eventSegments(input.events, input.cardTexts);
  if (body === null) return null;
  /* A forced window has no pass choice, so the player is told they are
     answering rather than choosing before they read what happened. */
  const segments: readonly PromptMessageSegment[] = prompt.cancelable
    ? body
    : [text("You must respond. "), ...body];
  return Object.freeze(segments.map((segment) => Object.freeze(segment)));
}

/** The same message as one plain string, for surfaces without styled runs. */
export function promptContextPlainText(
  segments: readonly PromptMessageSegment[],
): string {
  return segments.map((segment) => segment.value).join("");
}

function chainSegments(
  chain: readonly PublicChainLink[],
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): readonly PromptMessageSegment[] | null {
  const link = chain.at(-1);
  if (link === undefined) return null;
  const actor = seatSegments(link.controller, "activated");
  const source: readonly PromptMessageSegment[] = link.sourceIdentityVisible
    ? [card(link.label)]
    : [text("a face-down card")];
  const suffix =
    chain.length >= 2 ? [text(` Chain link ${chain.length}.`)] : [];
  return [
    ...actor,
    ...source,
    ...targetSegments(link.targets ?? [], cardTexts),
    text("."),
    ...suffix,
  ];
}

function targetSegments(
  targets: readonly PublicChainTarget[],
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): readonly PromptMessageSegment[] {
  if (targets.length === 0) return [];
  const named = targets.slice(0, NAMED_TARGET_LIMIT);
  const remaining = targets.length - named.length;
  const segments: PromptMessageSegment[] = [text(", targeting ")];
  named.forEach((entry, index) => {
    if (index > 0) segments.push(text(remaining === 0 ? " and " : ", "));
    segments.push(
      entry.identityVisible && entry.card !== undefined
        ? card(cardName(entry.card, cardTexts))
        : text("a face-down card"),
      text(" in the "),
      zone(ZONE_LABELS[entry.location]),
    );
  });
  if (remaining > 0) segments.push(text(` and ${remaining} more`));
  return segments;
}

function eventSegments(
  events: readonly DuelPresentationEvent[],
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): readonly PromptMessageSegment[] | null {
  /* Newest first, and a turn boundary ends the search: the previous turn's
     summon is not what this window is responding to. Mirrors the scan
     `lastActionActor` performs for the same reason. */
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined || event.type === "turnStarted") return null;
    const segments = actionSegments(event, cardTexts);
    if (segments !== null) return segments;
  }
  return null;
}

function actionSegments(
  event: DuelPresentationEvent,
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): readonly PromptMessageSegment[] | null {
  switch (event.type) {
    case "summon":
      return namedCardAction(event.player, "summoned", event.card, cardTexts);
    case "specialSummon":
      return namedCardAction(
        event.player,
        "Special Summoned",
        event.card,
        cardTexts,
      );
    case "flipSummon":
      return namedCardAction(
        event.player,
        "Flip Summoned",
        event.card,
        cardTexts,
      );
    case "set":
      return namedCardAction(event.player, "set", event.card, cardTexts);
    case "attack":
      return [
        ...seatSegments(event.player, "declared"),
        text(event.direct ? "a direct attack." : "an attack."),
      ];
    case "cardDrawn":
      return [
        ...seatSegments(event.player, "drawn"),
        text(event.count === 1 ? "a card." : `${event.count} cards.`),
      ];
    case "damage":
      return [
        ...seatSegments(event.player, "taken"),
        text(`${event.amount} damage.`),
      ];
    case "recover":
      return [
        ...seatSegments(event.player, "recovered"),
        text(`${event.amount} LP.`),
      ];
    case "positionChanged":
      return event.card === undefined
        ? [text("A card changed position.")]
        : [
            card(cardName(event.card, cardTexts)),
            text(` changed to ${POSITION_LABELS[event.position]}.`),
          ];
    case "cardMoved":
      return event.card === undefined
        ? null
        : [
            card(cardName(event.card, cardTexts)),
            text(" moved from the "),
            zone(ZONE_LABELS[event.from]),
            text(" to the "),
            zone(ZONE_LABELS[event.to]),
            text("."),
          ];
    default:
      /* Bookkeeping — turn, phase, shuffle, life-point totals, chain size,
         hints. None of them is an action a player responds to. */
      return null;
  }
}

function namedCardAction(
  player: PlayerIndex,
  verb: string,
  code: CardCode | undefined,
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): readonly PromptMessageSegment[] {
  return code === undefined
    ? [...seatSegments(player, verb), text("a card.")]
    : [
        ...seatSegments(player, verb),
        card(cardName(code, cardTexts)),
        text("."),
      ];
}

/** `You have …` / `Opponent has …`. The battle domain carries no duelist
    names, so the seat label is the name until one exists — and this is the one
    place a real name would be read from. */
function seatSegments(
  player: PlayerIndex,
  verb: string,
): readonly PromptMessageSegment[] {
  return [
    { kind: "actor", value: player === 0 ? "You" : "Opponent" },
    text(player === 0 ? ` have ${verb} ` : ` has ${verb} `),
  ];
}

function cardName(
  code: CardCode,
  cardTexts: ReadonlyMap<number, PromptMessageCardText>,
): string {
  return cardTexts.get(code)?.name ?? `Card ${code}`;
}

function text(value: string): PromptMessageSegment {
  return { kind: "text", value };
}

function card(value: string): PromptMessageSegment {
  return { kind: "card", value };
}

function zone(value: string): PromptMessageSegment {
  return { kind: "zone", value };
}

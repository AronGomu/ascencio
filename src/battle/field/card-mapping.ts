import type { ChoiceId } from "../duel/contracts/ids.ts";
import type { PromptChoice } from "../duel/contracts/player-prompt.ts";
import type {
  PublicCard,
  PublicDuelState,
  PublicLocation,
} from "../duel/contracts/public-duel-state.ts";
import type { BoardTargetId, BoardViewModel } from "./board-view-model.ts";
import {
  mapEngineFieldAddress,
  type PhysicalZoneId,
} from "./duel-field-layout.ts";

export type PromptChoiceBoardTargetResolution =
  | { readonly kind: "board"; readonly targetId: BoardTargetId }
  | { readonly kind: "stack"; readonly targetId: `stack:${PhysicalZoneId}` }
  | {
      readonly kind: "nonField";
      readonly reason:
        | "choice_has_no_field_target"
        | "unsupported_field_address"
        | "target_not_mounted";
    };

const STACK_ZONE_BY_LOCATION: Partial<
  Record<PublicLocation, "deck" | "extra" | "graveyard" | "banished">
> = Object.freeze({
  deck: "deck",
  extra: "extra",
  graveyard: "graveyard",
  banished: "banished",
});

export function resolvePromptChoiceBoardTarget(
  choice: PromptChoice,
  snapshot: PublicDuelState | null,
  board: BoardViewModel,
): PromptChoiceBoardTargetResolution {
  if (choice.place !== undefined) {
    const mapping = mapEngineFieldAddress(choice.place);
    if (!mapping.ok)
      return Object.freeze({
        kind: "nonField",
        reason: "unsupported_field_address",
      });
    const zone = board.zones.find(({ id }) => id === mapping.zoneId);
    return zone === undefined
      ? Object.freeze({ kind: "nonField", reason: "target_not_mounted" })
      : Object.freeze({ kind: "board", targetId: zone.targetId });
  }
  if (choice.card !== undefined) {
    const stackZone = STACK_ZONE_BY_LOCATION[choice.card.location];
    if (stackZone !== undefined) {
      const stack = board.stacks.find(
        (value) =>
          value.player === choice.card!.controller && value.zone === stackZone,
      );
      return stack === undefined
        ? Object.freeze({ kind: "nonField", reason: "target_not_mounted" })
        : Object.freeze({ kind: "stack", targetId: stack.targetId });
    }
    const publicCard = findPublicCard(snapshot, choice.card);
    const instanceId = publicCard?.instanceId ?? choice.card.instanceId;
    const card = board.cards.find(({ id }) => id === instanceId);
    return card === undefined
      ? Object.freeze({ kind: "nonField", reason: "target_not_mounted" })
      : Object.freeze({ kind: "board", targetId: card.targetId });
  }
  return Object.freeze({
    kind: "nonField",
    reason: "choice_has_no_field_target",
  });
}

export function choiceIdsForFieldIntent(
  choice: PromptChoice | undefined,
): readonly ChoiceId[] {
  return choice === undefined ? [] : [choice.id];
}

function findPublicCard(
  snapshot: PublicDuelState | null,
  candidate: {
    readonly controller: PublicDuelState["players"][number]["player"];
    readonly location: PublicLocation;
    readonly sequence: number;
  },
): PublicCard | undefined {
  if (snapshot === null) return undefined;
  const player = snapshot.players[candidate.controller];
  const zone = publicCards(player, candidate.location);
  return zone?.find(
    (card) =>
      card.location === candidate.location &&
      card.sequence === candidate.sequence,
  );
}

function publicCards(
  player: PublicDuelState["players"][number],
  location: PublicLocation,
): readonly PublicCard[] | undefined {
  switch (location) {
    case "hand":
      return player.hand;
    case "monster":
      return player.monsters;
    case "spellTrap":
    case "field":
      return player.spellsAndTraps;
    case "graveyard":
      return player.graveyard;
    case "banished":
      return player.banished;
    case "deck":
    case "extra":
      return undefined;
  }
}

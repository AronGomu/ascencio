import type { EngineMessage } from "../engine/OcgCoreAdapter.ts";
import type {
  PlayerIndex,
  PublicDuelState,
} from "../../duel/contracts/public-duel-state.ts";
import {
  EngineMessageType as M,
  EngineLocation as L,
} from "../engine/engine-constants.ts";

// Additional discriminants from the frozen ocgcore-wasm@0.1.2 protocol.
const E = {
  CONFIRM_EXTRATOP: 42,
  CARD_SELECTED: 80,
  RANDOM_SELECTED: 81,
  EQUIP: 93,
  CARD_TARGET: 96,
  CANCEL_TARGET: 97,
} as const;

/** Public protocol details absent from zone deltas, filtered for the observer. */
export function eventDetails(
  message: EngineMessage,
  state: PublicDuelState,
  actor: PlayerIndex,
): unknown[] {
  const address = (v: {
    controller: number;
    location: number;
    sequence: number;
    overlay_sequence?: number;
  }) => {
    const location = v.location & ~L.OVERLAY;
    const p = state.players[v.controller as PlayerIndex];
    const zone = {
      [L.HAND]: p?.hand,
      [L.MONSTER]: p?.monsters,
      [L.SPELL_TRAP]: p?.spellsAndTraps,
      [L.GRAVEYARD]: p?.graveyard,
      [L.BANISHED]: p?.banished,
      [L.EXTRA]: p?.extraDeck,
    }[location];
    const card = zone?.find((c) => c.sequence === v.sequence);
    const own = v.controller === actor;
    const fixedSlot = location === L.MONSTER || location === L.SPELL_TRAP;
    const publicIdentity = location === L.GRAVEYARD || card?.faceUp === true;
    const visible = own || publicIdentity;
    // A private pile address must not become a stable tracking identifier.
    const base = {
      controller: v.controller,
      location: v.location,
      ...(location !== L.DECK && (fixedSlot || visible)
        ? { sequence: v.sequence }
        : {}),
    };
    if ((v.location & L.OVERLAY) !== 0 || v.overlay_sequence !== undefined) {
      const material = card?.overlayMaterials.find(
        (entry) => entry.sequence === v.overlay_sequence,
      );
      return {
        ...base,
        ...(material && (own || material.identityVisible)
          ? {
              instanceId: material.instanceId,
              code: String(material.code),
              overlaySequence: material.sequence,
            }
          : {}),
      };
    }
    return {
      ...base,
      ...(card && (fixedSlot || visible)
        ? {
            instanceId: card.instanceId,
            ...(visible && card.code !== undefined
              ? { code: String(card.code) }
              : {}),
          }
        : {}),
    };
  };
  switch (message.type) {
    case M.DRAW:
      return message.player === actor
        ? [
            {
              type: "own_draw",
              cards: message.drawn.map((c) => String(c.code)),
            },
          ]
        : [];
    case M.CONFIRM_CARDS:
      return message.player === actor
        ? [
            {
              type: "cards_revealed",
              cards: message.cards.map((c) => ({
                code: String(c.code),
                controller: c.controller,
                location: c.location,
                sequence: c.sequence,
              })),
            },
          ]
        : [];
    case M.BECOME_TARGET:
    case E.CARD_SELECTED:
    case E.RANDOM_SELECTED:
      return [{ type: "observed_targets", cards: message.cards.map(address) }];
    case E.CARD_TARGET:
    case E.CANCEL_TARGET:
    case E.EQUIP:
      return [
        {
          type: "target_relation",
          card: address(message.card),
          target: address(message.target),
        },
      ];
    case M.ATTACK:
    case M.BATTLE:
      return [
        {
          type: "combat_participants",
          card: address(message.card),
          target: message.target ? address(message.target) : null,
        },
      ];
    case M.CHAIN_SOLVING:
    case M.CHAIN_NEGATED:
    case M.CHAIN_DISABLED:
    case M.CHAINED:
      return [{ type: "chain_progress", chainIndex: message.chain_size }];
    case M.CHAIN_SOLVED: {
      const link = state.chain.find((c) => c.index === message.chain_size);
      return [
        { type: "chain_progress", chainIndex: message.chain_size },
        ...(link
          ? [
              {
                type:
                  link.outcome === "normal"
                    ? "effect_resolved"
                    : "effect_not_resolved",
                player: link.controller,
                cardCode:
                  link.sourceIdentityVisible && link.sourceCard !== undefined
                    ? String(link.sourceCard)
                    : null,
                outcome: link.outcome,
              },
            ]
          : []),
      ];
    }
    case M.MOVE:
      if (
        message.to.overlay_sequence !== undefined ||
        (message.to.location & L.OVERLAY) !== 0
      )
        return [{ type: "material_attached", card: address(message.to) }];
      if (
        message.from.overlay_sequence !== undefined ||
        (message.from.location & L.OVERLAY) !== 0
      )
        return [{ type: "material_detached", card: address(message.to) }];
      return [];
    case M.PAY_LIFE_POINTS:
      return [
        {
          type: "life_point_cost",
          player: message.player,
          amount: message.amount,
        },
      ];
    case M.CONFIRM_DECKTOP:
    case E.CONFIRM_EXTRATOP: {
      const location = message.type === M.CONFIRM_DECKTOP ? L.DECK : L.EXTRA;
      // These are explicit public excavations, unlike recipient-only CONFIRM_CARDS.
      if (
        !message.cards.every(
          (card) =>
            card.controller === message.player &&
            card.location === location &&
            card.code > 0,
        )
      ) {
        return [];
      }
      return [
        {
          type: "public_reveal",
          cards: message.cards.map((card) => ({
            ...address(card),
            code: String(card.code),
          })),
        },
      ];
    }
    case M.WIN:
      return [
        {
          type: "terminal_result",
          player: message.player,
          reason: String(message.reason),
        },
      ];
    default:
      return [];
  }
}

export interface BotObservedEvent {
  readonly event: string;
  readonly turn: number;
  readonly phase: PublicDuelState["phase"];
  readonly details: readonly unknown[];
}
export function isPromptMessage(type: number): boolean {
  return (
    (type >= 10 && type <= 26) || (type >= 140 && type <= 143) || type === 132
  );
}
const names = new Map<number, string>(
  Object.entries(M).map(([name, type]) => [type, name.toLowerCase()]),
);
names.set(61, "summon_succeeded");
names.set(63, "special_summon_succeeded");
names.set(65, "flip_summon_succeeded");
export function observedEventName(type: number): string {
  return names.get(type) ?? `engine_${type}`;
}

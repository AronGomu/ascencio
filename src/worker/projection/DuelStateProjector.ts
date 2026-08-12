import { isCardIdentityVisible } from "../../duel/card-visibility.ts";
import {
  cardCode,
  cardInstanceId,
  type CardCode,
  type CardInstanceId,
  type SnapshotId,
} from "../../duel/contracts/ids.ts";
import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import type { DuelResult } from "../../duel/contracts/duel-result.ts";
import type {
  CardPosition,
  DuelPhase,
  PlayerIndex,
  PublicCard,
  PublicChainLink,
  PublicChainOutcome,
  PublicChainPhase,
  PublicCounter,
  PublicDuelState,
  PublicLocation,
  PublicOverlayMaterial,
  PublicPlayerState,
} from "../../duel/contracts/public-duel-state.ts";
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePhase,
  EnginePosition,
} from "../engine/engine-constants.ts";
import type { EngineMessage } from "../engine/OcgCoreAdapter.ts";
import { resolveEffectDescription } from "../protocol/effect-description.ts";

interface MutableOverlayMaterial {
  instanceId: CardInstanceId;
  code: CardCode;
  identityVisible: boolean;
  sequence: number;
  owner?: PlayerIndex;
}

interface MutableCounter {
  type: number;
  name: string;
  count: number;
}

interface MutableCard {
  instanceId: CardInstanceId;
  code?: CardCode;
  owner: PlayerIndex;
  controller: PlayerIndex;
  location: PublicLocation;
  sequence: number;
  position: CardPosition;
  faceUp: boolean;
  counters: MutableCounter[];
  overlayMaterials: MutableOverlayMaterial[];
}

interface MutableChainLink {
  index: number;
  controller: PlayerIndex;
  sourceIdentityVisible: boolean;
  sourceInstanceId?: CardInstanceId;
  sourceCard?: CardCode;
  label: string;
  description?: string;
  phase: PublicChainPhase;
  outcome: PublicChainOutcome;
}

interface MovedCard {
  readonly card?: CardCode;
  readonly instanceId?: CardInstanceId;
}

interface PendingPublicReveal {
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
  readonly code: CardCode;
}

interface OverlayMoveUpdate {
  readonly moved: MovedCard;
  readonly failure?:
    "source_unavailable" | "destination_unavailable" | "nested_materials";
}

interface MutablePlayer {
  lifePoints: number;
  deckCount: number;
  deckReveals: Map<number, CardCode>;
  extraDeckCount: number;
  handCount: number;
  hand: MutableCard[];
  extraDeck: MutableCard[];
  monsters: MutableCard[];
  spellsAndTraps: MutableCard[];
  graveyard: MutableCard[];
  banished: MutableCard[];
}

export interface EngineCardAddress {
  readonly controller: PlayerIndex;
  readonly location: number;
  readonly sequence: number;
}

export interface QueriedPublicCard {
  readonly code?: number;
  readonly owner: PlayerIndex;
  readonly position: number;
  readonly isPublic: boolean;
  readonly isHidden: boolean;
}

export interface QueriedOverlayMaterial {
  readonly code: number;
  readonly identityVisible?: boolean;
}

export interface QueriedCounter {
  readonly type: number;
  readonly count: number;
}

export type ProjectionReconciliationRequest =
  | { readonly type: "extraDeck"; readonly player: PlayerIndex }
  | ({ readonly type: "overlayMaterials" } & EngineCardAddress)
  | ({ readonly type: "counters" } & EngineCardAddress);

export interface ProjectionUpdate {
  readonly events: readonly DuelPresentationEvent[];
  readonly reconciliationRequests: readonly ProjectionReconciliationRequest[];
  readonly reconciliationFailure?: OverlayMoveUpdate["failure"];
  readonly result?: DuelResult;
}

interface ProjectionCheckpoint {
  readonly players: [MutablePlayer, MutablePlayer];
  readonly revision: number;
  readonly turn: number;
  readonly turnPlayer: PlayerIndex;
  readonly phase: DuelPhase;
  readonly chain: MutableChainLink[];
  readonly cardSequence: number;
  readonly pendingPublicReveals: Map<string, PendingPublicReveal>;
}

export class DuelStateProjector {
  readonly #snapshotId: SnapshotId;
  readonly #players: [MutablePlayer, MutablePlayer];
  #revision = 0;
  #turn = 0;
  #turnPlayer: PlayerIndex = 0;
  #phase: DuelPhase = "unknown";
  #chain: MutableChainLink[] = [];
  #cardSequence = 0;
  #pendingPublicReveals = new Map<string, PendingPublicReveal>();
  readonly #textDependencies:
    Pick<ActiveDuelDependencies, "texts" | "strings"> | undefined;

  constructor(
    snapshotId: SnapshotId,
    deckCounts: readonly [number, number],
    extraDeckCounts: readonly [number, number],
    initialExtraDeckOrders: readonly [
      readonly CardCode[],
      readonly CardCode[],
    ] = [[], []],
    textDependencies?: Pick<ActiveDuelDependencies, "texts" | "strings">,
  ) {
    this.#snapshotId = snapshotId;
    this.#textDependencies = textDependencies;
    this.#players = [
      mutablePlayer(deckCounts[0], extraDeckCounts[0]),
      mutablePlayer(deckCounts[1], extraDeckCounts[1]),
    ];
    if (initialExtraDeckOrders[0].length !== extraDeckCounts[0])
      throw new Error("Own Extra Deck seed does not match its count");
    this.#seedOwnExtraDeck(initialExtraDeckOrders[0]);
  }

  checkpoint(): ProjectionCheckpoint {
    return structuredClone({
      players: this.#players,
      revision: this.#revision,
      turn: this.#turn,
      turnPlayer: this.#turnPlayer,
      phase: this.#phase,
      chain: this.#chain,
      cardSequence: this.#cardSequence,
      pendingPublicReveals: this.#pendingPublicReveals,
    });
  }

  restore(checkpoint: ProjectionCheckpoint): void {
    const restored = structuredClone(checkpoint);
    this.#players[0] = restored.players[0];
    this.#players[1] = restored.players[1];
    this.#revision = restored.revision;
    this.#turn = restored.turn;
    this.#turnPlayer = restored.turnPlayer;
    this.#phase = restored.phase;
    this.#chain = restored.chain;
    this.#cardSequence = restored.cardSequence;
    this.#pendingPublicReveals = restored.pendingPublicReveals;
  }

  apply(message: EngineMessage): ProjectionUpdate {
    const events: DuelPresentationEvent[] = [];
    const reconciliationRequests: ProjectionReconciliationRequest[] = [];
    let reconciliationFailure: OverlayMoveUpdate["failure"];
    let deferRevision = false;
    let result: DuelResult | undefined;

    switch (message.type) {
      case EngineMessageType.START:
        events.push({ type: "duelStarted" });
        break;
      case EngineMessageType.NEW_TURN:
        this.#pendingPublicReveals.clear();
        this.#turn += 1;
        this.#turnPlayer = asPlayer(message.player);
        events.push({
          type: "turnStarted",
          player: this.#turnPlayer,
          turn: this.#turn,
        });
        break;
      case EngineMessageType.NEW_PHASE:
        this.#pendingPublicReveals.clear();
        this.#phase = phase(message.phase);
        events.push({ type: "phaseChanged", phase: this.#phase });
        break;
      case EngineMessageType.CONFIRM_CARDS:
        this.#recordPendingPublicReveals(message.player, message.cards);
        break;
      case EngineMessageType.CONFIRM_DECKTOP: {
        const owner = asPlayer(message.player);
        if (
          message.cards.every(
            (entry) =>
              entry.controller === owner &&
              (entry.location & ~EngineLocation.OVERLAY) ===
                EngineLocation.DECK &&
              entry.code > 0,
          )
        ) {
          this.#revealDeckTop(
            owner,
            message.cards.map((entry) => cardCode(entry.code)),
          );
        }
        break;
      }
      case EngineMessageType.DECK_TOP:
        if (message.code > 0)
          this.#revealDeckPosition(
            asPlayer(message.player),
            message.count,
            cardCode(message.code),
          );
        break;
      case EngineMessageType.SWAP_GRAVE_DECK:
        this.#pendingPublicReveals.clear();
        this.#clearDeckReveals(asPlayer(message.player));
        break;
      case EngineMessageType.REVERSE_DECK:
        this.#pendingPublicReveals.clear();
        this.#clearDeckReveals(0);
        this.#clearDeckReveals(1);
        break;
      case EngineMessageType.DRAW:
        this.#draw(asPlayer(message.player), message.drawn);
        this.#shiftDeckRevealsAfterDraw(
          asPlayer(message.player),
          message.drawn.length,
        );
        events.push({
          type: "cardDrawn",
          player: asPlayer(message.player),
          count: message.drawn.length,
        });
        break;
      case EngineMessageType.SHUFFLE_DECK:
      case EngineMessageType.SHUFFLE_HAND: {
        const player = asPlayer(message.player);
        if (message.type === EngineMessageType.SHUFFLE_HAND)
          this.#shuffleHand(player, message.cards);
        else {
          this.#clearPendingPublicReveals(player, "deck");
          this.#clearDeckReveals(player);
        }
        events.push({
          type: "cardsShuffled",
          player,
          location:
            message.type === EngineMessageType.SHUFFLE_DECK ? "deck" : "hand",
        });
        break;
      }
      case EngineMessageType.SHUFFLE_SET_CARD:
        this.#shuffleSetCards(message.cards);
        break;
      case EngineMessageType.MOVE: {
        const overlayMove =
          isOverlayAddress(message.from) || isOverlayAddress(message.to);
        const overlayUpdate = overlayMove
          ? this.#moveOverlay(message.card, message.from, message.to)
          : undefined;
        const moved =
          overlayUpdate?.moved ??
          this.#move(message.card, message.from, message.to);
        if (overlayMove)
          this.#clearPendingPublicRevealsForMove(message.from, message.to);
        if (engineLocation(message.from.location) === "deck")
          this.#clearDeckReveals(asPlayer(message.from.controller));
        if (engineLocation(message.to.location) === "deck")
          this.#clearDeckReveals(asPlayer(message.to.controller));
        reconciliationFailure = overlayUpdate?.failure;
        reconciliationRequests.push(
          ...reconciliationRequestsForMove(message.from, message.to),
        );
        events.push({
          type: "cardMoved",
          ...(moved.card === undefined ? {} : { card: moved.card }),
          ...(moved.instanceId === undefined
            ? {}
            : { instanceId: moved.instanceId }),
          from: engineLocation(message.from.location),
          to: engineLocation(message.to.location),
        });
        break;
      }
      case EngineMessageType.SUMMONING:
        events.push({
          type: "summon",
          player: asPlayer(message.controller),
          card: cardCode(message.code),
        });
        break;
      case EngineMessageType.SPECIAL_SUMMONING:
        events.push({
          type: "specialSummon",
          player: asPlayer(message.controller),
          card: cardCode(message.code),
        });
        break;
      case EngineMessageType.FLIP_SUMMONING:
        events.push({
          type: "flipSummon",
          player: asPlayer(message.controller),
          card: cardCode(message.code),
        });
        break;
      case EngineMessageType.SET: {
        const player = asPlayer(message.controller);
        events.push({
          type: "set",
          player,
          ...(player === 0 ? { card: cardCode(message.code) } : {}),
        });
        break;
      }
      case EngineMessageType.POSITION_CHANGE: {
        const position = enginePosition(message.position);
        this.#changePosition(
          message.code,
          message.controller,
          message.location,
          message.sequence,
          message.position,
        );
        events.push({
          type: "positionChanged",
          ...(message.controller === 0 || isFaceUp(message.position)
            ? { card: cardCode(message.code) }
            : {}),
          position,
        });
        break;
      }
      case EngineMessageType.ATTACK:
        events.push({
          type: "attack",
          player: asPlayer(message.card.controller),
          direct: message.target === null,
        });
        break;
      case EngineMessageType.DAMAGE:
        this.#players[asPlayer(message.player)].lifePoints = Math.max(
          0,
          this.#players[asPlayer(message.player)].lifePoints - message.amount,
        );
        events.push({
          type: "damage",
          player: asPlayer(message.player),
          amount: message.amount,
        });
        break;
      case EngineMessageType.RECOVER:
        this.#players[asPlayer(message.player)].lifePoints += message.amount;
        events.push({
          type: "recover",
          player: asPlayer(message.player),
          amount: message.amount,
        });
        break;
      case EngineMessageType.LIFE_POINTS_UPDATE:
        this.#players[asPlayer(message.player)].lifePoints = message.lp;
        events.push({
          type: "lifePointsChanged",
          player: asPlayer(message.player),
          lifePoints: message.lp,
        });
        break;
      case EngineMessageType.ADD_COUNTER:
      case EngineMessageType.REMOVE_COUNTER: {
        const request = this.#updateCounter(
          message.type === EngineMessageType.ADD_COUNTER ? "add" : "remove",
          message.counter_type,
          message.controller,
          message.location,
          message.sequence,
          message.count,
        );
        if (request !== undefined) {
          reconciliationRequests.push(request);
          deferRevision = true;
        }
        break;
      }
      case EngineMessageType.CHAINING:
        this.#appendChainLink(message);
        events.push({ type: "chainChanged", size: this.#chain.length });
        break;
      case EngineMessageType.CHAINED:
        if (
          this.#requireChainLink(message.chain_size).index !==
          this.#chain.length
        )
          throw new Error("CHAINED does not reference the latest link");
        break;
      case EngineMessageType.CHAIN_SOLVING:
        this.#setChainPhase(message.chain_size, "solving");
        break;
      case EngineMessageType.CHAIN_SOLVED:
        this.#setChainPhase(message.chain_size, "solved");
        break;
      case EngineMessageType.CHAIN_NEGATED:
        this.#setChainOutcome(message.chain_size, "negated");
        break;
      case EngineMessageType.CHAIN_DISABLED:
        this.#setChainOutcome(message.chain_size, "disabled");
        break;
      case EngineMessageType.CHAIN_END: {
        const hadChain = this.#chain.length > 0;
        this.#chain = [];
        if (hadChain) events.push({ type: "chainChanged", size: 0 });
        break;
      }
      case EngineMessageType.HINT:
        events.push({ type: "hint", message: `System hint ${message.hint}` });
        break;
      case EngineMessageType.CARD_HINT:
        events.push({
          type: "hint",
          message: `Card hint ${message.card_hint}: ${message.description}`,
        });
        break;
      case EngineMessageType.SHOW_HINT:
        events.push({ type: "hint", message: message.hint });
        break;
      case EngineMessageType.PLAYER_HINT:
        events.push({
          type: "hint",
          message: `Player ${message.player + 1} hint ${message.player_hint}: ${message.description}`,
        });
        break;
      case EngineMessageType.WIN: {
        const winner = asPlayer(message.player);
        result = {
          type: "completed",
          winner,
          loser: winner === 0 ? 1 : 0,
          reason: message.reason,
        };
        break;
      }
      case EngineMessageType.RETRY:
        throw new Error("ocgcore rejected the previous response");
      default:
        break;
    }

    this.#truncateDeckReveals(0);
    this.#truncateDeckReveals(1);
    if (reconciliationFailure === undefined && !deferRevision)
      this.#revision += 1;
    const requests = Object.freeze(reconciliationRequests);
    return result === undefined
      ? {
          events,
          reconciliationRequests: requests,
          ...(reconciliationFailure === undefined
            ? {}
            : { reconciliationFailure }),
        }
      : {
          events,
          reconciliationRequests: requests,
          ...(reconciliationFailure === undefined
            ? {}
            : { reconciliationFailure }),
          result,
        };
  }

  reconcileExtraDeck(
    player: PlayerIndex,
    records: readonly QueriedPublicCard[],
  ): void {
    const state = this.#players[player];
    const previous = state.extraDeck;
    const previousCount = state.extraDeckCount;
    const previousCardSequence = this.#cardSequence;
    try {
      if (records.length > 256)
        throw new Error("Extra Deck query exceeds physical instance limit");
      const remaining = [...state.extraDeck];
      const next: MutableCard[] = [];
      for (const [sequence, record] of records.entries()) {
        if (record.owner !== player)
          throw new Error("Extra Deck query owner does not match player");
        const position = enginePosition(record.position);
        const publicOpponentCard =
          player === 1 && record.isPublic && isFaceUp(record.position);
        if (player === 1 && !publicOpponentCard) continue;
        if (record.code === undefined || record.code <= 0) {
          if (player === 0)
            throw new Error("Own Extra Deck query omitted card code");
          throw new Error("Public opponent Extra Deck query omitted card code");
        }
        const code = cardCode(record.code);
        const previousIndex = remaining.findIndex((card) => card.code === code);
        const [matched] =
          previousIndex < 0 ? [] : remaining.splice(previousIndex, 1);
        next.push({
          instanceId: matched?.instanceId ?? this.#nextInstanceId(),
          code,
          owner: record.owner,
          controller: player,
          location: "extra",
          sequence,
          position,
          faceUp: isFaceUp(record.position),
          counters: matched?.counters ?? [],
          overlayMaterials: [],
        });
      }
      state.extraDeck = next;
      state.extraDeckCount = records.length;
      this.snapshot();
    } catch (error) {
      state.extraDeck = previous;
      state.extraDeckCount = previousCount;
      this.#cardSequence = previousCardSequence;
      throw error;
    }
  }

  reconcileOverlayMaterials(
    address: EngineCardAddress,
    records: readonly QueriedOverlayMaterial[],
  ): void {
    const player = this.#players[address.controller];
    const location = engineLocation(address.location);
    const host = findPublicCard(player, location, address.sequence);
    if (host === undefined || location !== "monster")
      throw new Error("Overlay reconciliation host is unavailable");
    const previous = host.overlayMaterials;
    const previousCardSequence = this.#cardSequence;
    try {
      if (records.length > 256)
        throw new Error("Overlay query exceeds physical instance limit");
      const remaining = [...host.overlayMaterials];
      const next: MutableOverlayMaterial[] = records.map((record, sequence) => {
        if (!Number.isSafeInteger(record.code) || record.code <= 0)
          throw new Error(
            "Overlay host query returned an invalid material code",
          );
        const code = cardCode(record.code);
        const previousIndex = remaining.findIndex(
          (material) => material.code === code,
        );
        const [matched] =
          previousIndex < 0 ? [] : remaining.splice(previousIndex, 1);
        return {
          instanceId: matched?.instanceId ?? this.#nextInstanceId(),
          code,
          identityVisible:
            record.identityVisible ??
            matched?.identityVisible ??
            address.controller === 0,
          sequence,
          ...(matched?.owner === undefined ? {} : { owner: matched.owner }),
        };
      });
      host.overlayMaterials = next;
      this.snapshot();
    } catch (error) {
      host.overlayMaterials = previous;
      this.#cardSequence = previousCardSequence;
      throw error;
    }
  }

  reconcileCounters(
    address: EngineCardAddress,
    records: readonly QueriedCounter[],
  ): void {
    const player = this.#players[address.controller];
    const location = engineLocation(address.location);
    const host = findPublicCard(player, location, address.sequence);
    if (host === undefined)
      throw new Error("Counter reconciliation host is unavailable");
    const previous = host.counters;
    const previousRevision = this.#revision;
    try {
      if (records.length > 256)
        throw new Error("Counter query exceeds per-card limit");
      let priorType = 0;
      host.counters = records.map((record) => {
        validateCounterType(record.type);
        validateCounterCount(record.count);
        if (record.type <= priorType)
          throw new Error("Counter query types are not sorted and unique");
        priorType = record.type;
        return {
          type: record.type,
          name: this.#counterName(record.type),
          count: record.count,
        };
      });
      this.#revision += 1;
      this.snapshot();
    } catch (error) {
      host.counters = previous;
      this.#revision = previousRevision;
      throw error;
    }
  }

  snapshot(): PublicDuelState {
    const players: [PublicPlayerState, PublicPlayerState] = [
      immutablePlayer(0, this.#players[0], true),
      immutablePlayer(1, this.#players[1], false),
    ];
    const allVisibleCards = players.flatMap((player) => [
      ...player.hand,
      ...player.extraDeck,
      ...player.monsters,
      ...player.spellsAndTraps,
      ...player.graveyard,
      ...player.banished,
    ]);
    const allInstanceIds = allVisibleCards.flatMap((card) => [
      card.instanceId,
      ...card.overlayMaterials.map((material) => material.instanceId),
    ]);
    if (allInstanceIds.length > 256)
      throw new Error("Public state exceeds 256 physical card instances");
    const ids = new Set(allInstanceIds);
    if (ids.size !== allInstanceIds.length)
      throw new Error("A card instance occupies multiple public zones");
    const counterEntries = allVisibleCards.reduce(
      (total, card) => total + card.counters.length,
      0,
    );
    if (counterEntries > 1_024)
      throw new Error("Public state exceeds 1024 counter entries");
    if (this.#stateTextUnits() > 262_144)
      throw new Error("Public state exceeds text limit");

    return Object.freeze({
      snapshotId: this.#snapshotId,
      revision: this.#revision,
      turn: this.#turn,
      turnPlayer: this.#turnPlayer,
      phase: this.#phase,
      players: Object.freeze(players),
      chain: Object.freeze(
        this.#chain.map((link): PublicChainLink => Object.freeze({ ...link })),
      ),
    });
  }

  #recordPendingPublicReveals(
    recipient: number,
    cards: readonly {
      readonly code: number;
      readonly controller: 0 | 1;
      readonly location: number;
      readonly sequence: number;
    }[],
  ): void {
    if (recipient !== 0) return;
    for (const entry of cards) {
      if (
        !Number.isSafeInteger(entry.code) ||
        entry.code <= 0 ||
        !Number.isSafeInteger(entry.sequence) ||
        entry.sequence < 0 ||
        entry.sequence > 255 ||
        (entry.location & EngineLocation.OVERLAY) !== 0
      )
        continue;
      const controller = asPlayer(entry.controller);
      const location = engineLocation(entry.location);
      if (location === "deck") continue;
      const reveal = {
        controller,
        location,
        sequence: entry.sequence,
        code: cardCode(entry.code),
      } satisfies PendingPublicReveal;
      this.#pendingPublicReveals.set(publicRevealKey(reveal), reveal);
      const stored = findPublicCard(
        this.#players[controller],
        location,
        entry.sequence,
      );
      /* A reveal token is projector-private. Only a fixed field slot may carry
         attested knowledge into the opponent's projected state; every other
         concealed opponent zone rejects a code by contract, so there the token
         alone preserves identity through a later set. */
      if (
        stored !== undefined &&
        (controller === 0 || isFixedLocation(location))
      )
        stored.code = reveal.code;
    }
  }

  #consumePendingPublicReveal(
    address: {
      readonly controller: 0 | 1;
      readonly location: number;
      readonly sequence: number;
    },
    rawCode: number,
  ): CardCode | undefined {
    const revealAddress = {
      controller: asPlayer(address.controller),
      location: engineLocation(address.location),
      sequence: address.sequence,
    };
    const key = publicRevealKey(revealAddress);
    const reveal = this.#pendingPublicReveals.get(key);
    if (reveal === undefined) return undefined;
    this.#pendingPublicReveals.delete(key);
    return reveal.code === rawCode ? reveal.code : undefined;
  }

  #clearPendingPublicReveals(
    controller: PlayerIndex,
    location: PublicLocation,
  ): void {
    for (const [key, reveal] of this.#pendingPublicReveals) {
      if (reveal.controller === controller && reveal.location === location)
        this.#pendingPublicReveals.delete(key);
    }
  }

  #clearPendingPublicRevealsForMove(
    from: {
      readonly controller: 0 | 1;
      readonly location: number;
      readonly sequence: number;
    },
    to: {
      readonly controller: 0 | 1;
      readonly location: number;
      readonly sequence: number;
    },
  ): void {
    for (const endpoint of [from, to]) {
      const controller = asPlayer(endpoint.controller);
      const location = engineLocation(endpoint.location);
      if (isFixedLocation(location)) {
        this.#pendingPublicReveals.delete(
          publicRevealKey({
            controller,
            location,
            sequence: endpoint.sequence,
          }),
        );
      } else this.#clearPendingPublicReveals(controller, location);
    }
  }

  #clearDeckReveals(player: PlayerIndex): void {
    this.#players[player].deckReveals.clear();
  }

  #shiftDeckRevealsAfterDraw(player: PlayerIndex, drawn: number): void {
    const state = this.#players[player];
    state.deckReveals = new Map(
      [...state.deckReveals].flatMap(([offset, code]) =>
        offset >= drawn ? [[offset - drawn, code] as const] : [],
      ),
    );
  }

  #revealDeckTop(player: PlayerIndex, codes: readonly CardCode[]): void {
    const state = this.#players[player];
    codes.forEach((code, offset) => state.deckReveals.set(offset, code));
  }

  #revealDeckPosition(
    player: PlayerIndex,
    offset: number,
    code: CardCode,
  ): void {
    const state = this.#players[player];
    if (offset >= 0 && offset < state.deckCount)
      state.deckReveals.set(offset, code);
  }

  #truncateDeckReveals(player: PlayerIndex): void {
    const state = this.#players[player];
    for (const offset of state.deckReveals.keys()) {
      if (offset < 0 || offset >= state.deckCount)
        state.deckReveals.delete(offset);
    }
  }

  #draw(
    player: PlayerIndex,
    drawn: readonly { code: number; position: number }[],
  ): void {
    const state = this.#players[player];
    state.deckCount = Math.max(0, state.deckCount - drawn.length);
    for (const draw of drawn) {
      state.hand.push(
        this.#createCard(
          player,
          "hand",
          state.hand.length,
          draw.position,
          player === 0 ? draw.code : undefined,
        ),
      );
    }
    state.handCount = state.hand.length;
  }

  #shuffleHand(player: PlayerIndex, codes: readonly number[]): void {
    this.#clearPendingPublicReveals(player, "hand");
    if (player !== 0) {
      for (const card of this.#players[player].hand) {
        this.#rotatePublicIdentity(card);
        delete card.code;
      }
      return;
    }
    const hand = this.#players[player].hand;
    if (codes.length !== hand.length) return;

    const remaining = [...hand];
    const reordered: MutableCard[] = [];
    for (const code of codes) {
      let index = remaining.findIndex((card) => card.code === code);
      if (index < 0)
        index = remaining.findIndex((card) => card.code === undefined);
      const [card] = index < 0 ? [] : remaining.splice(index, 1);
      if (card === undefined) return;
      reordered.push(card);
    }
    reordered.forEach((card, index) => {
      const code = codes[index];
      if (code !== undefined && code > 0) card.code = cardCode(code);
    });
    hand.splice(0, hand.length, ...reordered);
    resequence(hand);
  }

  #shuffleSetCards(
    permutations: readonly {
      readonly from: {
        readonly controller: 0 | 1;
        readonly location: number;
        readonly sequence: number;
        readonly position: number;
      };
      readonly to: {
        readonly controller: 0 | 1;
        readonly location: number;
        readonly sequence: number;
        readonly position: number;
      };
    }[],
  ): void {
    const entries = permutations.map(({ from, to }) => {
      const fromAddress = {
        controller: asPlayer(from.controller),
        location: engineLocation(from.location),
        sequence: from.sequence,
      };
      const toAddress = {
        controller: asPlayer(to.controller),
        location: engineLocation(to.location),
        sequence: to.sequence,
      };
      if (
        !isFixedLocation(fromAddress.location) ||
        !isFixedLocation(toAddress.location)
      )
        throw new Error("SHUFFLE_SET_CARD endpoint is not a fixed field slot");
      const card = findPublicCard(
        this.#players[fromAddress.controller],
        fromAddress.location,
        fromAddress.sequence,
      );
      if (card === undefined)
        throw new Error("SHUFFLE_SET_CARD source slot is empty");
      return { to, fromAddress, toAddress, card };
    });
    const sourceKeys = entries.map(({ fromAddress }) =>
      publicRevealKey(fromAddress),
    );
    if (new Set(sourceKeys).size !== sourceKeys.length)
      throw new Error("SHUFFLE_SET_CARD source slot is duplicated");
    const destinationKeys = entries.map(({ toAddress }) =>
      publicRevealKey(toAddress),
    );
    if (new Set(destinationKeys).size !== destinationKeys.length)
      throw new Error("SHUFFLE_SET_CARD destination slot is duplicated");
    const sourceKeySet = new Set(sourceKeys);
    for (const { toAddress } of entries) {
      const occupant = findPublicCard(
        this.#players[toAddress.controller],
        toAddress.location,
        toAddress.sequence,
      );
      if (
        occupant !== undefined &&
        !sourceKeySet.has(publicRevealKey(toAddress))
      )
        throw new Error("SHUFFLE_SET_CARD destination slot is occupied");
    }

    for (const { fromAddress } of entries) {
      removePublicCard(
        this.#players[fromAddress.controller],
        fromAddress.location,
        fromAddress.sequence,
      );
    }
    for (const { to, fromAddress, toAddress, card } of entries) {
      this.#pendingPublicReveals.delete(publicRevealKey(fromAddress));
      this.#pendingPublicReveals.delete(publicRevealKey(toAddress));
      if (toAddress.controller === 1) {
        this.#rotatePublicIdentity(card);
        delete card.code;
      }
      card.controller = toAddress.controller;
      card.location = toAddress.location;
      card.sequence = toAddress.sequence;
      card.position = enginePosition(to.position);
      card.faceUp = isFaceUp(to.position);
      insertPublicCard(
        this.#players[toAddress.controller],
        toAddress.location,
        toAddress.sequence,
        card,
      );
    }
  }

  #move(
    rawCode: number,
    from: {
      controller: 0 | 1;
      location: number;
      sequence: number;
      position: number;
    },
    to: {
      controller: 0 | 1;
      location: number;
      sequence: number;
      position: number;
    },
  ): MovedCard {
    const fromPlayer = this.#players[from.controller];
    const fromLocation = engineLocation(from.location);
    const fromVisible = isPublicCard(
      from.controller,
      fromLocation,
      from.position,
    );
    const toPlayer = this.#players[to.controller];
    const toLocation = engineLocation(to.location);
    const toVisible = isPublicCard(to.controller, toLocation, to.position);
    assertFixedDestinationAvailable(
      toPlayer,
      to.controller,
      toLocation,
      to.sequence,
      {
        controller: from.controller,
        location: fromLocation,
        sequence: from.sequence,
      },
    );

    let card = removePublicCard(fromPlayer, fromLocation, from.sequence);
    if (card === undefined) {
      if (isFixedLocation(fromLocation))
        throw new Error(
          `Fixed slot ${fromLocation} ${from.sequence} for player ${from.controller} is empty`,
        );
      card = this.#createCard(
        from.controller,
        fromLocation,
        from.sequence,
        from.position,
        fromVisible ? rawCode : undefined,
      );
      if (fromLocation === "deck")
        fromPlayer.deckCount = Math.max(0, fromPlayer.deckCount - 1);
    }
    if (fromLocation === "extra")
      fromPlayer.extraDeckCount = Math.max(0, fromPlayer.extraDeckCount - 1);
    const confirmedCode = this.#consumePendingPublicReveal(from, rawCode);
    const confirmedForMove = confirmedCode !== undefined;
    if (confirmedCode !== undefined) card.code = confirmedCode;
    this.#clearPendingPublicRevealsForMove(from, to);

    const priorInstanceId = card.instanceId;
    const priorCode = card.code;
    const sourceWasKnown = card.code !== undefined;
    const preservesKnownIdentity =
      (fromVisible || confirmedForMove) &&
      !toVisible &&
      sourceWasKnown &&
      isFixedLocation(toLocation) &&
      isFaceDown(to.position);
    const staleHiddenCorrelation =
      !fromVisible && sourceWasKnown && !confirmedForMove;

    if (
      staleHiddenCorrelation ||
      ((fromVisible || confirmedForMove) &&
        !toVisible &&
        !preservesKnownIdentity)
    ) {
      this.#rotatePublicIdentity(card);
      delete card.code;
    }
    if (countersResetOnMove(fromLocation, toLocation)) card.counters = [];
    card.controller = to.controller;
    card.location = toLocation;
    card.sequence = to.sequence;
    card.position = enginePosition(to.position);
    card.faceUp = isFaceUp(to.position);
    if (toVisible && rawCode > 0) card.code = cardCode(rawCode);
    else if (!preservesKnownIdentity) delete card.code;

    const stored = insertPublicCard(toPlayer, toLocation, to.sequence, card);
    if (!stored && toLocation === "deck") toPlayer.deckCount += 1;
    if (toLocation === "extra") toPlayer.extraDeckCount += 1;
    fromPlayer.handCount = fromPlayer.hand.length;
    toPlayer.handCount = toPlayer.hand.length;
    return {
      ...(toVisible
        ? card.code === undefined
          ? {}
          : { card: card.code }
        : (fromVisible || confirmedForMove) && priorCode !== undefined
          ? { card: priorCode }
          : {}),
      ...(fromVisible || confirmedForMove
        ? { instanceId: priorInstanceId }
        : toVisible
          ? { instanceId: card.instanceId }
          : {}),
    };
  }

  #moveOverlay(
    rawCode: number,
    from: {
      controller: 0 | 1;
      location: number;
      sequence: number;
      position: number;
      overlay_sequence?: number;
    },
    to: {
      controller: 0 | 1;
      location: number;
      sequence: number;
      position: number;
      overlay_sequence?: number;
    },
  ): OverlayMoveUpdate {
    const fromOverlay = isOverlayAddress(from);
    const toOverlay = isOverlayAddress(to);
    if (toOverlay && (!Number.isSafeInteger(rawCode) || rawCode <= 0))
      throw new Error("Overlay MOVE omitted material card code");
    const fromLocation = engineLocation(from.location);
    const toLocation = engineLocation(to.location);
    const endpointFromVisible = isPublicOverlayMoveEndpoint(from, fromLocation);
    const toVisible = isPublicOverlayMoveEndpoint(to, toLocation);
    const sourceHost = fromOverlay
      ? findPublicCard(
          this.#players[from.controller],
          fromLocation,
          from.sequence,
        )
      : undefined;
    const sourceOrdinal = from.overlay_sequence ?? 0;
    const sourceMaterial = sourceHost?.overlayMaterials[sourceOrdinal];
    const fromVisible = fromOverlay
      ? sourceMaterial?.identityVisible === true
      : endpointFromVisible;
    const fallbackMoved: MovedCard =
      rawCode > 0 && (fromVisible || toVisible)
        ? { card: cardCode(rawCode) }
        : {};
    if (
      fromOverlay &&
      (sourceMaterial === undefined ||
        fromLocation !== "monster" ||
        (!toOverlay && sourceMaterial.owner === undefined))
    )
      return { moved: fallbackMoved, failure: "source_unavailable" };
    const sourceCard = fromOverlay
      ? undefined
      : findPublicCard(
          this.#players[from.controller],
          fromLocation,
          from.sequence,
        );
    const destinationHost = toOverlay
      ? findPublicCard(this.#players[to.controller], toLocation, to.sequence)
      : undefined;
    if (
      toOverlay &&
      (destinationHost === undefined || toLocation !== "monster")
    )
      return { moved: fallbackMoved, failure: "destination_unavailable" };
    if (toOverlay && sourceCard !== undefined) {
      if (sourceCard.overlayMaterials.length > 0)
        return { moved: fallbackMoved, failure: "nested_materials" };
    } else if (!toOverlay) {
      assertFixedDestinationAvailable(
        this.#players[to.controller],
        to.controller,
        toLocation,
        to.sequence,
        fromOverlay
          ? { controller: from.controller, location: "deck", sequence: 0 }
          : {
              controller: from.controller,
              location: fromLocation,
              sequence: from.sequence,
            },
      );
    }

    let card: MutableCard | undefined;
    let detachedMaterial: MutableOverlayMaterial | undefined;
    if (fromOverlay) {
      detachedMaterial = sourceHost!.overlayMaterials.splice(
        sourceOrdinal,
        1,
      )[0];
      sourceHost!.overlayMaterials.forEach((entry, sequence) => {
        entry.sequence = sequence;
      });
    } else {
      const fromPlayer = this.#players[from.controller];
      card = removePublicCard(fromPlayer, fromLocation, from.sequence);
      if (card === undefined) {
        if (isFixedLocation(fromLocation))
          throw new Error(
            `Fixed slot ${fromLocation} ${from.sequence} for player ${from.controller} is empty`,
          );
        card = this.#createCard(
          from.controller,
          fromLocation,
          from.sequence,
          from.position,
          fromVisible && rawCode > 0 ? rawCode : undefined,
        );
      }
      if (fromLocation === "deck")
        fromPlayer.deckCount = Math.max(0, fromPlayer.deckCount - 1);
      if (fromLocation === "extra")
        fromPlayer.extraDeckCount = Math.max(0, fromPlayer.extraDeckCount - 1);
    }

    const priorInstanceId = card?.instanceId ?? detachedMaterial?.instanceId;
    const priorCode = card?.code ?? detachedMaterial?.code;
    if (fromVisible && !toVisible && card !== undefined)
      this.#rotatePublicIdentity(card);
    const currentInstanceId = card?.instanceId ?? detachedMaterial?.instanceId;
    if (toOverlay) {
      const host = destinationHost!;
      const material: MutableOverlayMaterial = detachedMaterial ?? {
        instanceId: card!.instanceId,
        code: cardCode(rawCode),
        identityVisible: toVisible,
        sequence: to.overlay_sequence ?? host.overlayMaterials.length,
        owner: card!.owner,
      };
      material.code = cardCode(rawCode);
      material.identityVisible = toVisible;
      const ordinal = Math.min(
        to.overlay_sequence ?? host.overlayMaterials.length,
        host.overlayMaterials.length,
      );
      host.overlayMaterials.splice(ordinal, 0, material);
      host.overlayMaterials.forEach((entry, sequence) => {
        entry.sequence = sequence;
      });
    } else {
      const toPlayer = this.#players[to.controller];
      const moved =
        card ??
        ({
          instanceId: detachedMaterial!.instanceId,
          owner: detachedMaterial!.owner!,
          controller: to.controller,
          location: toLocation,
          sequence: to.sequence,
          position: enginePosition(to.position),
          faceUp: isFaceUp(to.position),
          counters: [],
          overlayMaterials: [],
        } satisfies MutableCard);
      moved.controller = to.controller;
      moved.location = toLocation;
      moved.sequence = to.sequence;
      moved.position = enginePosition(to.position);
      moved.faceUp = isFaceUp(to.position);
      if (toVisible && rawCode > 0) moved.code = cardCode(rawCode);
      else if (!toVisible) delete moved.code;
      const stored = insertPublicCard(toPlayer, toLocation, to.sequence, moved);
      if (!stored && toLocation === "deck") toPlayer.deckCount += 1;
      if (toLocation === "extra") toPlayer.extraDeckCount += 1;
    }

    this.#players[from.controller].handCount =
      this.#players[from.controller].hand.length;
    this.#players[to.controller].handCount =
      this.#players[to.controller].hand.length;
    const eventCode =
      toVisible && rawCode > 0
        ? cardCode(rawCode)
        : fromVisible
          ? priorCode
          : undefined;
    const eventInstanceId = fromVisible
      ? priorInstanceId
      : toVisible
        ? currentInstanceId
        : undefined;
    return {
      moved: {
        ...(eventCode === undefined ? {} : { card: eventCode }),
        ...(eventInstanceId === undefined
          ? {}
          : { instanceId: eventInstanceId }),
      },
    };
  }

  #changePosition(
    rawCode: number,
    controller: number,
    location: number,
    sequence: number,
    position: number,
  ): void {
    const playerIndex = asPlayer(controller);
    const publicLocation = engineLocation(location);
    const player = this.#players[playerIndex];
    const card = findPublicCard(player, publicLocation, sequence);
    if (card === undefined) {
      if (isFixedLocation(publicLocation))
        throw new Error(
          `Fixed slot ${publicLocation} ${sequence} for player ${playerIndex} is empty`,
        );
      return;
    }
    const nextPosition = enginePosition(position);
    const visible = isCardIdentityVisible(
      0,
      playerIndex,
      publicLocation,
      nextPosition,
    );
    card.position = nextPosition;
    card.faceUp = isFaceUp(position);
    if (visible && rawCode > 0) card.code = cardCode(rawCode);
  }

  #updateCounter(
    operation: "add" | "remove",
    type: number,
    controller: number,
    rawLocation: number,
    sequence: number,
    count: number,
  ):
    | Extract<ProjectionReconciliationRequest, { readonly type: "counters" }>
    | undefined {
    const player = asPlayer(controller);
    const location = engineLocation(rawLocation);
    validateCounterType(type);
    if (!Number.isSafeInteger(count) || count < 0 || count > 0xffff)
      throw new Error("Counter delta is outside uint16 bounds");
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 255)
      throw new Error("Counter address sequence is invalid");
    if (count === 0) return undefined;
    const request = {
      type: "counters" as const,
      controller: player,
      location: rawLocation,
      sequence,
    };
    const host = findPublicCard(this.#players[player], location, sequence);
    if (host === undefined) return request;
    const index = host.counters.findIndex((counter) => counter.type === type);
    const current = index < 0 ? undefined : host.counters[index];
    if (operation === "remove") {
      if (current === undefined || current.count < count) return request;
      const next = current.count - count;
      if (next === 0) host.counters.splice(index, 1);
      else current.count = next;
      return undefined;
    }
    const next = (current?.count ?? 0) + count;
    if (next > 0xffff) return request;
    if (current === undefined) {
      const name = this.#counterName(type);
      if (
        host.counters.length >= 256 ||
        this.#counterEntryCount() >= 1_024 ||
        this.#stateTextUnits() + name.length > 262_144
      )
        return request;
      host.counters.push({ type, name, count: next });
      host.counters.sort((left, right) => left.type - right.type);
    } else current.count = next;
    return undefined;
  }

  #counterEntryCount(): number {
    return this.#players.reduce(
      (stateTotal, player) =>
        stateTotal +
        [
          ...player.hand,
          ...player.extraDeck,
          ...player.monsters,
          ...player.spellsAndTraps,
          ...player.graveyard,
          ...player.banished,
        ].reduce((total, card) => total + card.counters.length, 0),
      0,
    );
  }

  #stateTextUnits(): number {
    const counterText = this.#players.reduce(
      (stateTotal, player) =>
        stateTotal +
        [
          ...player.hand,
          ...player.extraDeck,
          ...player.monsters,
          ...player.spellsAndTraps,
          ...player.graveyard,
          ...player.banished,
        ].reduce(
          (total, card) =>
            total +
            card.counters.reduce(
              (cardTotal, counter) => cardTotal + counter.name.length,
              0,
            ),
          0,
        ),
      0,
    );
    return (
      counterText +
      this.#chain.reduce(
        (total, link) =>
          total + link.label.length + (link.description?.length ?? 0),
        0,
      )
    );
  }

  #appendChainLink(message: {
    readonly code: number;
    readonly controller: number;
    readonly location: number;
    readonly sequence: number;
    readonly position: number;
    readonly overlay_sequence?: number;
    readonly triggering_controller: number;
    readonly description: bigint;
    readonly chain_size: number;
  }): void {
    if (
      !Number.isSafeInteger(message.chain_size) ||
      message.chain_size !== this.#chain.length + 1 ||
      message.chain_size > 255
    )
      throw new Error("CHAINING link index is invalid");
    const controller = asPlayer(message.triggering_controller);
    const source = this.#chainSource(message);
    const visible = source !== undefined;
    const description = visible
      ? cleanProjectionText(
          this.#textDependencies === undefined
            ? undefined
            : resolveEffectDescription(
                message.description,
                this.#textDependencies,
              ),
        )
      : undefined;
    const label = visible
      ? (cleanProjectionText(
          this.#textDependencies?.texts.get(source.card)?.name,
        ) ?? "Card effect")
      : "Card effect";
    if (
      this.#stateTextUnits() + label.length + (description?.length ?? 0) >
      262_144
    )
      throw new Error("Chain text exceeds public state limit");
    this.#chain.push({
      index: message.chain_size,
      controller,
      sourceIdentityVisible: visible,
      ...(source === undefined
        ? {}
        : {
            sourceInstanceId: source.instanceId,
            sourceCard: source.card,
          }),
      label,
      ...(description === undefined ? {} : { description }),
      phase: "pending",
      outcome: "normal",
    });
  }

  #chainSource(message: {
    readonly code: number;
    readonly controller: number;
    readonly location: number;
    readonly sequence: number;
    readonly position: number;
    readonly overlay_sequence?: number;
  }):
    | { readonly instanceId: CardInstanceId; readonly card: CardCode }
    | undefined {
    const controller = asPlayer(message.controller);
    const location = engineLocation(message.location);
    if (isOverlayAddress(message)) {
      const host = findPublicCard(
        this.#players[controller],
        location,
        message.sequence,
      );
      const material = host?.overlayMaterials[message.overlay_sequence ?? 0];
      return material?.identityVisible === true &&
        material.code === message.code
        ? { instanceId: material.instanceId, card: material.code }
        : undefined;
    }
    const card = findPublicCard(
      this.#players[controller],
      location,
      message.sequence,
    );
    if (
      card?.code === undefined ||
      card.code !== message.code ||
      !isPublicCard(controller, location, message.position)
    )
      return undefined;
    return { instanceId: card.instanceId, card: card.code };
  }

  #requireChainLink(index: number): MutableChainLink {
    if (!Number.isSafeInteger(index) || index < 1 || index > 255)
      throw new Error("Chain link index is invalid");
    const link = this.#chain[index - 1];
    if (link === undefined || link.index !== index)
      throw new Error("Chain status references an unknown link");
    return link;
  }

  #setChainPhase(index: number, phase: PublicChainPhase): void {
    this.#requireChainLink(index).phase = phase;
  }

  #setChainOutcome(
    index: number,
    outcome: Exclude<PublicChainOutcome, "normal">,
  ): void {
    const link = this.#requireChainLink(index);
    if (link.outcome !== "negated" || outcome === "negated")
      link.outcome = outcome;
  }

  #counterName(type: number): string {
    const value = cleanProjectionText(
      this.#textDependencies?.strings.counter[`0x${type.toString(16)}`],
      1_024,
    );
    return value ?? `Counter 0x${type.toString(16).toUpperCase()}`;
  }

  #seedOwnExtraDeck(codes: readonly CardCode[]): void {
    const state = this.#players[0];
    state.extraDeck = codes.map((code, sequence) => ({
      instanceId: this.#nextInstanceId(),
      code,
      owner: 0,
      controller: 0,
      location: "extra",
      sequence,
      position: "faceDownDefense",
      faceUp: false,
      counters: [],
      overlayMaterials: [],
    }));
  }

  #nextInstanceId(): CardInstanceId {
    this.#cardSequence += 1;
    return cardInstanceId(`card-${this.#cardSequence}`);
  }

  #rotatePublicIdentity(card: MutableCard): void {
    card.instanceId = this.#nextInstanceId();
  }

  #createCard(
    owner: PlayerIndex,
    location: PublicLocation,
    sequence: number,
    position: number,
    code?: number,
  ): MutableCard {
    return {
      instanceId: this.#nextInstanceId(),
      ...(code === undefined || code <= 0 ? {} : { code: cardCode(code) }),
      owner,
      controller: owner,
      location,
      sequence,
      position: enginePosition(position),
      faceUp: isFaceUp(position),
      counters: [],
      overlayMaterials: [],
    };
  }
}

function mutablePlayer(
  deckCount: number,
  extraDeckCount: number,
): MutablePlayer {
  return {
    lifePoints: 8000,
    deckCount,
    deckReveals: new Map(),
    extraDeckCount,
    handCount: 0,
    hand: [],
    extraDeck: [],
    monsters: [],
    spellsAndTraps: [],
    graveyard: [],
    banished: [],
  };
}

function projectDeck(
  player: MutablePlayer,
  index: PlayerIndex,
): readonly PublicCard[] {
  const slots: PublicCard[] = [];
  for (let offset = 0; offset < player.deckCount; offset += 1) {
    const code = player.deckReveals.get(offset);
    slots.push(
      Object.freeze({
        instanceId: cardInstanceId(`deck-p${index}-${offset}`),
        ...(code === undefined ? {} : { code }),
        owner: index,
        controller: index,
        location: "deck" as const,
        sequence: offset,
        position: (code === undefined
          ? "faceDownAttack"
          : "faceUpAttack") as CardPosition,
        faceUp: code !== undefined,
        counters: Object.freeze([]),
        overlayMaterials: Object.freeze([]),
      }),
    );
  }
  return Object.freeze(slots);
}

function immutablePlayer(
  player: PlayerIndex,
  value: MutablePlayer,
  includeHandIdentities: boolean,
): PublicPlayerState {
  return Object.freeze({
    player,
    lifePoints: value.lifePoints,
    deckCount: value.deckCount,
    deck: projectDeck(value, player),
    extraDeckCount: value.extraDeckCount,
    handCount: value.handCount,
    hand: Object.freeze(
      includeHandIdentities ? value.hand.map(immutableCard) : [],
    ),
    extraDeck: Object.freeze(value.extraDeck.map(immutableCard)),
    monsters: Object.freeze(value.monsters.map(immutableCard)),
    spellsAndTraps: Object.freeze(value.spellsAndTraps.map(immutableCard)),
    graveyard: Object.freeze(value.graveyard.map(immutableCard)),
    banished: Object.freeze(value.banished.map(immutableCard)),
  });
}

function immutableCard(value: MutableCard): PublicCard {
  return Object.freeze({
    ...value,
    counters: Object.freeze(
      value.counters.map((counter): PublicCounter =>
        Object.freeze({ ...counter }),
      ),
    ),
    overlayMaterials: Object.freeze(
      value.overlayMaterials.map((material): PublicOverlayMaterial =>
        Object.freeze({
          instanceId: material.instanceId,
          code: material.code,
          identityVisible: material.identityVisible,
          sequence: material.sequence,
        }),
      ),
    ),
  });
}

function publicZone(
  player: MutablePlayer,
  location: PublicLocation,
): MutableCard[] | null {
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
    case "extra":
      return player.extraDeck;
    case "deck":
      return null;
  }
}

interface FixedAddress {
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
}

function findPublicCard(
  player: MutablePlayer,
  location: PublicLocation,
  sequence: number,
): MutableCard | undefined {
  const zone = publicZone(player, location);
  if (zone === null) return undefined;
  if (isFixedLocation(location) || location === "extra")
    return zone.find(
      (card) => card.location === location && card.sequence === sequence,
    );
  return zone[sequence];
}

function removePublicCard(
  player: MutablePlayer,
  location: PublicLocation,
  sequence: number,
): MutableCard | undefined {
  const zone = publicZone(player, location);
  if (zone === null) return undefined;
  if (isFixedLocation(location) || location === "extra") {
    const index = zone.findIndex(
      (card) => card.location === location && card.sequence === sequence,
    );
    if (index < 0) return undefined;
    return zone.splice(index, 1)[0];
  }
  const [card] = zone.splice(sequence, 1);
  resequence(zone);
  return card;
}

function insertPublicCard(
  player: MutablePlayer,
  location: PublicLocation,
  sequence: number,
  card: MutableCard,
): boolean {
  const zone = publicZone(player, location);
  if (zone === null) return false;
  if (isFixedLocation(location)) {
    zone.push(card);
    return true;
  }
  if (location === "extra") {
    const index = zone.findIndex((entry) => entry.sequence >= sequence);
    zone.splice(index < 0 ? zone.length : index, 0, card);
    return true;
  }
  zone.splice(Math.min(sequence, zone.length), 0, card);
  resequence(zone);
  return true;
}

function assertFixedDestinationAvailable(
  player: MutablePlayer,
  controller: PlayerIndex,
  location: PublicLocation,
  sequence: number,
  from: FixedAddress,
): void {
  if (!isFixedLocation(location)) return;
  const occupant = findPublicCard(player, location, sequence);
  if (occupant === undefined) return;
  if (
    from.controller === controller &&
    from.location === location &&
    from.sequence === sequence
  )
    return;
  throw new Error(
    `Fixed slot ${location} ${sequence} for player ${controller} is already occupied`,
  );
}

function isFixedLocation(location: PublicLocation): boolean {
  return (
    location === "monster" || location === "spellTrap" || location === "field"
  );
}

function publicRevealKey(address: {
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
}): string {
  return `${address.controller}:${address.location}:${address.sequence}`;
}

function countersResetOnMove(
  from: PublicLocation,
  to: PublicLocation,
): boolean {
  return isFixedLocation(from) && from !== to;
}

function reconciliationRequestsForMove(
  from: {
    readonly controller: 0 | 1;
    readonly location: number;
    readonly sequence: number;
    readonly overlay_sequence?: number;
  },
  to: {
    readonly controller: 0 | 1;
    readonly location: number;
    readonly sequence: number;
    readonly overlay_sequence?: number;
  },
): readonly ProjectionReconciliationRequest[] {
  const requests: ProjectionReconciliationRequest[] = [];
  for (const endpoint of [from, to]) {
    if (isOverlayAddress(endpoint)) {
      requests.push({
        type: "overlayMaterials",
        controller: endpoint.controller,
        location: endpoint.location & ~EngineLocation.OVERLAY,
        sequence: endpoint.sequence,
      });
    }
    if (engineLocation(endpoint.location) === "extra")
      requests.push({ type: "extraDeck", player: endpoint.controller });
  }
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key =
      request.type === "extraDeck"
        ? `extra:${request.player}`
        : request.type === "overlayMaterials"
          ? `overlay:${request.controller}:${request.location}:${request.sequence}`
          : `counter:${request.controller}:${request.location}:${request.sequence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function engineLocation(value: number): PublicLocation {
  switch (value & ~EngineLocation.OVERLAY) {
    case EngineLocation.DECK:
      return "deck";
    case EngineLocation.HAND:
      return "hand";
    case EngineLocation.MONSTER:
      return "monster";
    case EngineLocation.SPELL_TRAP:
      return "spellTrap";
    case EngineLocation.FIELD:
      return "field";
    case EngineLocation.GRAVEYARD:
      return "graveyard";
    case EngineLocation.BANISHED:
      return "banished";
    case EngineLocation.EXTRA:
      return "extra";
    default:
      throw new Error(`Unsupported card location: ${value}`);
  }
}

function enginePosition(value: number): CardPosition {
  if ((value & EnginePosition.FACE_UP_ATTACK) !== 0) return "faceUpAttack";
  if ((value & EnginePosition.FACE_DOWN_ATTACK) !== 0) return "faceDownAttack";
  if ((value & EnginePosition.FACE_UP_DEFENSE) !== 0) return "faceUpDefense";
  return "faceDownDefense";
}

function isFaceUp(value: number): boolean {
  return (
    (value &
      (EnginePosition.FACE_UP_ATTACK | EnginePosition.FACE_UP_DEFENSE)) !==
    0
  );
}

function isFaceDown(value: number): boolean {
  return (
    (value &
      (EnginePosition.FACE_DOWN_ATTACK | EnginePosition.FACE_DOWN_DEFENSE)) !==
    0
  );
}

function isPublicCard(
  controller: number,
  location: PublicLocation,
  position: number,
): boolean {
  return isCardIdentityVisible(
    0,
    asPlayer(controller),
    location,
    enginePosition(position),
  );
}

function isPublicOverlayMoveEndpoint(
  endpoint: {
    readonly controller: 0 | 1;
    readonly location: number;
    readonly position: number;
    readonly overlay_sequence?: number;
  },
  location: PublicLocation,
): boolean {
  if (isOverlayAddress(endpoint)) return endpoint.controller === 0;
  return isPublicCard(endpoint.controller, location, endpoint.position);
}

function isOverlayAddress(value: {
  readonly location: number;
  readonly overlay_sequence?: number;
}): boolean {
  return (
    value.overlay_sequence !== undefined ||
    (value.location & EngineLocation.OVERLAY) !== 0
  );
}

function phase(value: number): DuelPhase {
  switch (value) {
    case EnginePhase.DRAW:
      return "draw";
    case EnginePhase.STANDBY:
      return "standby";
    case EnginePhase.MAIN_1:
      return "main1";
    case EnginePhase.BATTLE_START:
      return "battleStart";
    case EnginePhase.BATTLE_STEP:
      return "battleStep";
    case EnginePhase.DAMAGE:
      return "damage";
    case EnginePhase.DAMAGE_CALCULATION:
      return "damageCalculation";
    case EnginePhase.BATTLE:
      return "battle";
    case EnginePhase.MAIN_2:
      return "main2";
    case EnginePhase.END:
      return "end";
    default:
      return "unknown";
  }
}

function validateCounterType(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0xffff)
    throw new Error("Counter type is outside uint16 bounds");
}

function validateCounterCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0xffff)
    throw new Error("Counter count is outside uint16 bounds");
}

function cleanProjectionText(
  value: string | undefined,
  maximumLength = 32_768,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximumLength
    ? trimmed
    : undefined;
}

function resequence(cards: MutableCard[] | null | undefined): void {
  cards?.forEach((card, index) => {
    card.sequence = index;
  });
}

function asPlayer(value: number): PlayerIndex {
  if (value !== 0 && value !== 1)
    throw new Error(`Unsupported player index: ${value}`);
  return value;
}

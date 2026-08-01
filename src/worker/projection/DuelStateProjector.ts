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
  PublicDuelState,
  PublicLocation,
  PublicOverlayMaterial,
  PublicPlayerState,
} from "../../duel/contracts/public-duel-state.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePhase,
  EnginePosition,
} from "../engine/engine-constants.ts";
import type { EngineMessage } from "../engine/OcgCoreAdapter.ts";

interface MutableOverlayMaterial {
  instanceId: CardInstanceId;
  code: CardCode;
  identityVisible: boolean;
  sequence: number;
  owner?: PlayerIndex;
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
  overlayMaterials: MutableOverlayMaterial[];
}

interface MovedCard {
  readonly card?: CardCode;
  readonly instanceId?: CardInstanceId;
}

interface OverlayMoveUpdate {
  readonly moved: MovedCard;
  readonly failure?:
    "source_unavailable" | "destination_unavailable" | "nested_materials";
}

interface MutablePlayer {
  lifePoints: number;
  deckCount: number;
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

export type ProjectionReconciliationRequest =
  | { readonly type: "extraDeck"; readonly player: PlayerIndex }
  | ({ readonly type: "overlayMaterials" } & EngineCardAddress);

export interface ProjectionUpdate {
  readonly events: readonly DuelPresentationEvent[];
  readonly reconciliationRequests: readonly ProjectionReconciliationRequest[];
  readonly reconciliationFailure?: OverlayMoveUpdate["failure"];
  readonly result?: DuelResult;
}

export class DuelStateProjector {
  readonly #snapshotId: SnapshotId;
  readonly #players: [MutablePlayer, MutablePlayer];
  #revision = 0;
  #turn = 0;
  #turnPlayer: PlayerIndex = 0;
  #phase: DuelPhase = "unknown";
  #chainSize = 0;
  #cardSequence = 0;

  constructor(
    snapshotId: SnapshotId,
    deckCounts: readonly [number, number],
    extraDeckCounts: readonly [number, number],
    initialExtraDeckOrders: readonly [
      readonly CardCode[],
      readonly CardCode[],
    ] = [[], []],
  ) {
    this.#snapshotId = snapshotId;
    this.#players = [
      mutablePlayer(deckCounts[0], extraDeckCounts[0]),
      mutablePlayer(deckCounts[1], extraDeckCounts[1]),
    ];
    if (initialExtraDeckOrders[0].length !== extraDeckCounts[0])
      throw new Error("Own Extra Deck seed does not match its count");
    this.#seedOwnExtraDeck(initialExtraDeckOrders[0]);
  }

  apply(message: EngineMessage): ProjectionUpdate {
    const events: DuelPresentationEvent[] = [];
    const reconciliationRequests: ProjectionReconciliationRequest[] = [];
    let reconciliationFailure: OverlayMoveUpdate["failure"];
    let result: DuelResult | undefined;

    switch (message.type) {
      case EngineMessageType.START:
        events.push({ type: "duelStarted" });
        break;
      case EngineMessageType.NEW_TURN:
        this.#turn += 1;
        this.#turnPlayer = asPlayer(message.player);
        events.push({
          type: "turnStarted",
          player: this.#turnPlayer,
          turn: this.#turn,
        });
        break;
      case EngineMessageType.NEW_PHASE:
        this.#phase = phase(message.phase);
        events.push({ type: "phaseChanged", phase: this.#phase });
        break;
      case EngineMessageType.DRAW:
        this.#draw(asPlayer(message.player), message.drawn);
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
        events.push({
          type: "cardsShuffled",
          player,
          location:
            message.type === EngineMessageType.SHUFFLE_DECK ? "deck" : "hand",
        });
        break;
      }
      case EngineMessageType.MOVE: {
        const overlayMove =
          isOverlayAddress(message.from) || isOverlayAddress(message.to);
        const overlayUpdate = overlayMove
          ? this.#moveOverlay(message.card, message.from, message.to)
          : undefined;
        const moved =
          overlayUpdate?.moved ??
          this.#move(message.card, message.from, message.to);
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
      case EngineMessageType.CHAINING:
        this.#chainSize = message.chain_size;
        events.push({ type: "chainChanged", size: this.#chainSize });
        break;
      case EngineMessageType.CHAINED:
      case EngineMessageType.CHAIN_SOLVING:
      case EngineMessageType.CHAIN_SOLVED:
      case EngineMessageType.CHAIN_NEGATED:
      case EngineMessageType.CHAIN_DISABLED:
        this.#chainSize = message.chain_size;
        events.push({ type: "chainChanged", size: this.#chainSize });
        break;
      case EngineMessageType.CHAIN_END:
        this.#chainSize = 0;
        events.push({ type: "chainChanged", size: 0 });
        break;
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

    if (reconciliationFailure === undefined) this.#revision += 1;
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

    return Object.freeze({
      snapshotId: this.#snapshotId,
      revision: this.#revision,
      turn: this.#turn,
      turnPlayer: this.#turnPlayer,
      phase: this.#phase,
      players: Object.freeze(players),
      chain: Object.freeze(
        Array.from({ length: this.#chainSize }, (_, index) =>
          Object.freeze({
            index,
            controller: this.#turnPlayer,
            label: `Chain Link ${index + 1}`,
          }),
        ),
      ),
    });
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
    if (player !== 0) return;
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
    const priorInstanceId = card.instanceId;
    const priorCode = card.code;

    if (fromVisible && !toVisible) this.#rotatePublicIdentity(card);
    card.controller = to.controller;
    card.location = toLocation;
    card.sequence = to.sequence;
    card.position = enginePosition(to.position);
    card.faceUp = isFaceUp(to.position);
    if (rawCode > 0 && toVisible) card.code = cardCode(rawCode);
    else delete card.code;

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
        : fromVisible && priorCode !== undefined
          ? { card: priorCode }
          : {}),
      ...(fromVisible
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
    const wasVisible = isCardIdentityVisible(
      0,
      playerIndex,
      publicLocation,
      card.position,
    );
    const nextPosition = enginePosition(position);
    const visible = isCardIdentityVisible(
      0,
      playerIndex,
      publicLocation,
      nextPosition,
    );
    if (wasVisible && !visible) this.#rotatePublicIdentity(card);
    card.position = nextPosition;
    card.faceUp = isFaceUp(position);
    if (visible && rawCode > 0) card.code = cardCode(rawCode);
    else if (!visible) delete card.code;
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

function immutablePlayer(
  player: PlayerIndex,
  value: MutablePlayer,
  includeHandIdentities: boolean,
): PublicPlayerState {
  return Object.freeze({
    player,
    lifePoints: value.lifePoints,
    deckCount: value.deckCount,
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
        : `overlay:${request.controller}:${request.location}:${request.sequence}`;
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

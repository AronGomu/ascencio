import type { CardCode, CardInstanceId } from "../duel/contracts/ids.ts";
import type {
  CardPosition,
  PlayerIndex,
  PublicCard,
  PublicChainLink,
  PublicCounter,
  PublicDuelState,
  PublicPlayerState,
} from "../duel/contracts/public-duel-state.ts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  DUEL_FIELD_HEIGHT,
  DUEL_FIELD_WIDTH,
  mapEngineFieldAddress,
  STANDARD_DUEL_FIELD_LAYOUT,
  type FieldZoneKind,
  type PhysicalZoneId,
  type StandardFieldZoneLayout,
} from "./duel-field-layout.ts";

export type BoardTargetId =
  `zone:${PhysicalZoneId}` | `card:${string}` | `stack:${PhysicalZoneId}`;

export interface BoardCardText {
  readonly name: string;
}

export interface BoardZoneView {
  readonly id: PhysicalZoneId;
  readonly targetId: `zone:${PhysicalZoneId}`;
  readonly player: PlayerIndex | "shared";
  readonly kind: FieldZoneKind;
  readonly sequence: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardMaterialView {
  readonly id: string;
  readonly instanceId?: CardInstanceId;
  readonly sequence: number;
  readonly identityVisible: boolean;
  readonly code?: CardCode;
  readonly label: string;
}

export interface BoardChainLinkView {
  readonly id: `chain:${number}`;
  readonly index: number;
  readonly label: string;
  readonly phase: PublicChainLink["phase"];
  readonly outcome: PublicChainLink["outcome"];
}

export interface BoardCardView {
  readonly id: string;
  readonly targetId: `card:${string}`;
  readonly instanceId?: CardInstanceId;
  readonly code?: CardCode;
  readonly player: PlayerIndex;
  readonly owner?: PlayerIndex;
  readonly zoneId: PhysicalZoneId;
  readonly position: CardPosition;
  readonly orientation: "upright" | "sideways";
  readonly facing: "self" | "opponent";
  readonly hidden: boolean;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly counters: readonly PublicCounter[];
  readonly materials: readonly BoardMaterialView[];
  readonly chainLinks: readonly BoardChainLinkView[];
  readonly image: Readonly<
    | { readonly kind: "back" }
    | { readonly kind: "face"; readonly code: CardCode }
  >;
}

export interface BoardStackView {
  readonly id: PhysicalZoneId;
  readonly targetId: `stack:${PhysicalZoneId}`;
  readonly player: PlayerIndex;
  readonly zone: "deck" | "extra" | "graveyard" | "banished";
  readonly count: number;
  readonly publicCount: number;
  readonly label: string;
  readonly topCardLabel?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SpatialNeighbors {
  readonly left?: BoardTargetId;
  readonly right?: BoardTargetId;
  readonly up?: BoardTargetId;
  readonly down?: BoardTargetId;
}

export interface BoardViewModel {
  readonly zones: readonly BoardZoneView[];
  readonly cards: readonly BoardCardView[];
  readonly stacks: readonly BoardStackView[];
  readonly nav: ReadonlyMap<BoardTargetId, SpatialNeighbors>;
}

export type BoardMappingError =
  | {
      readonly type: "duplicate_physical_occupancy";
      readonly zoneId: PhysicalZoneId;
      readonly cardIds: readonly [string, string];
    }
  | {
      readonly type: "unsupported_fixed_card";
      readonly cardId: string;
      readonly controller: PlayerIndex;
      readonly location: "monster" | "spellTrap" | "field";
      readonly sequence: number;
    }
  | {
      readonly type: "duplicate_card_instance";
      readonly cardId: string;
    };

export type BoardMappingResult =
  | { readonly ok: true; readonly value: BoardViewModel }
  | { readonly ok: false; readonly error: BoardMappingError };

interface NavControl {
  readonly targetId: BoardTargetId;
  readonly x: number;
  readonly y: number;
}

const LAYOUT_BY_ID = new Map(
  STANDARD_DUEL_FIELD_LAYOUT.map((zone) => [zone.id, zone] as const),
);
const STACK_KINDS = ["deck", "extra", "graveyard", "banished"] as const;
const CARD_WIDTH_NORMALIZED = CARD_WIDTH / DUEL_FIELD_WIDTH;
const CARD_HEIGHT_NORMALIZED = CARD_HEIGHT / DUEL_FIELD_HEIGHT;
const NAV_ALIGNMENT_EPSILON = 1 / Math.max(DUEL_FIELD_WIDTH, DUEL_FIELD_HEIGHT);

export function mapSnapshotToBoard(
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText> = new Map(),
): BoardMappingResult {
  const zones = Object.freeze(
    STANDARD_DUEL_FIELD_LAYOUT.map((layout) =>
      Object.freeze({
        ...layout,
        targetId: `zone:${layout.id}` as const,
      }),
    ),
  );
  const fixedCards = fixedCardsIn(snapshot);
  const occupancy = new Map<PhysicalZoneId, PublicCard>();
  for (const card of fixedCards) {
    const mapping = mapEngineFieldAddress({
      player: card.controller,
      location: card.location,
      sequence: card.sequence,
    });
    if (!mapping.ok)
      return failure({
        type: "unsupported_fixed_card",
        cardId: card.instanceId,
        controller: card.controller,
        location: card.location,
        sequence: card.sequence,
      });
    const occupied = occupancy.get(mapping.zoneId);
    if (occupied !== undefined)
      return failure({
        type: "duplicate_physical_occupancy",
        zoneId: mapping.zoneId,
        cardIds: Object.freeze([occupied.instanceId, card.instanceId]),
      });
    occupancy.set(mapping.zoneId, card);
  }

  const cards: BoardCardView[] = [];
  const cardIds = new Set<string>();
  for (const player of snapshot.players) {
    if (player.player === 0) {
      for (const card of player.hand) {
        const duplicate = addCard(
          cards,
          cardIds,
          card,
          LAYOUT_BY_ID.get("p0:hand"),
          snapshot,
          cardTexts,
          handOffset(card.sequence, player.handCount),
        );
        if (duplicate !== undefined) return failure(duplicate);
      }
      for (
        let sequence = player.hand.length;
        sequence < player.handCount;
        sequence += 1
      ) {
        addHiddenHandPlaceholder(
          cards,
          snapshot,
          player.player,
          sequence,
          player.handCount,
        );
      }
    } else {
      for (let sequence = 0; sequence < player.handCount; sequence += 1)
        addHiddenHandPlaceholder(
          cards,
          snapshot,
          player.player,
          sequence,
          player.handCount,
        );
    }
  }
  for (const [zoneId, card] of occupancy) {
    const duplicate = addCard(
      cards,
      cardIds,
      card,
      LAYOUT_BY_ID.get(zoneId),
      snapshot,
      cardTexts,
    );
    if (duplicate !== undefined) return failure(duplicate);
  }

  const immutableCards = Object.freeze(cards);
  const stacks = createStacks(snapshot, cardTexts);
  const board = Object.freeze({
    zones,
    cards: immutableCards,
    stacks,
    nav: createNavigation(zones, immutableCards, stacks),
  });
  return Object.freeze({ ok: true, value: board });
}

function fixedCardsIn(snapshot: PublicDuelState): readonly (PublicCard & {
  readonly location: "monster" | "spellTrap" | "field";
})[] {
  return snapshot.players.flatMap((player) => [
    ...player.monsters,
    ...player.spellsAndTraps.filter(
      (card): card is PublicCard & { location: "spellTrap" | "field" } =>
        card.location === "spellTrap" || card.location === "field",
    ),
  ]) as readonly (PublicCard & {
    readonly location: "monster" | "spellTrap" | "field";
  })[];
}

function addCard(
  cards: BoardCardView[],
  cardIds: Set<string>,
  card: PublicCard,
  layout: StandardFieldZoneLayout | undefined,
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
  xOffset = 0,
): BoardMappingError | undefined {
  if (layout === undefined) return undefined;
  if (cardIds.has(card.instanceId))
    return Object.freeze({
      type: "duplicate_card_instance",
      cardId: card.instanceId,
    });
  cardIds.add(card.instanceId);
  const identityVisible = cardIdentityVisible(card);
  const displayName = identityVisible
    ? cardName(card.code, cardTexts)
    : undefined;
  const counters = Object.freeze(
    card.counters.map((counter) => Object.freeze({ ...counter })),
  );
  const materials = Object.freeze(
    card.overlayMaterials.map((material) =>
      Object.freeze({
        id: material.identityVisible
          ? `material:${material.instanceId}`
          : `hidden-material:${snapshot.snapshotId}:${card.instanceId}:${material.sequence}`,
        sequence: material.sequence,
        identityVisible: material.identityVisible,
        ...(material.identityVisible
          ? { instanceId: material.instanceId, code: material.code }
          : {}),
        label: material.identityVisible
          ? cardName(material.code, cardTexts)
          : "Hidden material",
      }),
    ),
  );
  const chainLinks = Object.freeze(
    snapshot.chain
      .filter(
        (link) =>
          link.sourceIdentityVisible &&
          link.sourceInstanceId === card.instanceId,
      )
      .map((link) =>
        Object.freeze({
          id: `chain:${link.index}` as const,
          index: link.index,
          label: link.label,
          phase: link.phase,
          outcome: link.outcome,
        }),
      ),
  );
  const label = cardAccessibleLabel(
    displayName,
    layout.label,
    card.position,
    counters,
    materials.length,
  );
  cards.push(
    Object.freeze({
      id: card.instanceId,
      targetId: `card:${card.instanceId}` as const,
      instanceId: card.instanceId,
      ...(identityVisible && card.code !== undefined
        ? { code: card.code }
        : {}),
      player: card.controller,
      owner: card.owner,
      zoneId: layout.id,
      position: card.position,
      orientation: orientationFor(card.position),
      facing: card.controller === 0 ? "self" : "opponent",
      hidden: !identityVisible,
      label,
      x: layout.x + xOffset,
      y: layout.y,
      width: CARD_WIDTH_NORMALIZED,
      height: CARD_HEIGHT_NORMALIZED,
      counters,
      materials,
      chainLinks,
      image: Object.freeze(
        identityVisible && card.code !== undefined
          ? { kind: "face" as const, code: card.code }
          : { kind: "back" as const },
      ),
    }),
  );
  return undefined;
}

function addHiddenHandPlaceholder(
  cards: BoardCardView[],
  snapshot: PublicDuelState,
  player: PlayerIndex,
  sequence: number,
  count: number,
): void {
  const layout = LAYOUT_BY_ID.get(`p${player}:hand`);
  if (layout === undefined) return;
  const id = `hidden:${snapshot.snapshotId}:p${player}:hand:${sequence}`;
  cards.push(
    Object.freeze({
      id,
      targetId: `card:${id}` as const,
      player,
      zoneId: layout.id,
      position: "faceDownDefense" as const,
      orientation: "sideways" as const,
      facing: player === 0 ? ("self" as const) : ("opponent" as const),
      hidden: true,
      label:
        player === 0 ? "Hidden card in your hand" : "Hidden opponent hand card",
      x: layout.x + handOffset(sequence, count),
      y: layout.y,
      width: CARD_WIDTH_NORMALIZED,
      height: CARD_HEIGHT_NORMALIZED,
      counters: Object.freeze([]),
      materials: Object.freeze([]),
      chainLinks: Object.freeze([]),
      image: Object.freeze({ kind: "back" as const }),
    }),
  );
}

function createStacks(
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): readonly BoardStackView[] {
  const stacks: BoardStackView[] = [];
  for (const player of snapshot.players) {
    for (const zone of STACK_KINDS) {
      const layout = LAYOUT_BY_ID.get(`p${player.player}:${zone}`);
      if (layout === undefined) continue;
      const collection = stackCollection(player, zone);
      const count = stackCount(player, zone, collection);
      const publicCards = collection.filter(cardIdentityVisible);
      const top = publicCards.at(-1);
      const topCardLabel =
        top === undefined ? undefined : cardName(top.code, cardTexts);
      stacks.push(
        Object.freeze({
          id: layout.id,
          targetId: `stack:${layout.id}` as const,
          player: player.player,
          zone,
          count,
          publicCount: publicCards.length,
          label: `${layout.label}, ${count} ${count === 1 ? "card" : "cards"}${topCardLabel === undefined ? "" : `, top card ${topCardLabel}`}`,
          ...(topCardLabel === undefined ? {} : { topCardLabel }),
          x: layout.x,
          y: layout.y,
          width: CARD_WIDTH_NORMALIZED,
          height: CARD_HEIGHT_NORMALIZED,
        }),
      );
    }
  }
  return Object.freeze(stacks);
}

function stackCollection(
  player: PublicPlayerState,
  zone: BoardStackView["zone"],
): readonly PublicCard[] {
  switch (zone) {
    case "deck":
      return [];
    case "extra":
      return player.extraDeck;
    case "graveyard":
      return player.graveyard;
    case "banished":
      return player.banished;
  }
}

function stackCount(
  player: PublicPlayerState,
  zone: BoardStackView["zone"],
  collection: readonly PublicCard[],
): number {
  switch (zone) {
    case "deck":
      return player.deckCount;
    case "extra":
      return player.extraDeckCount;
    case "graveyard":
    case "banished":
      return collection.length;
  }
}

function createNavigation(
  zones: readonly BoardZoneView[],
  cards: readonly BoardCardView[],
  stacks: readonly BoardStackView[],
): ReadonlyMap<BoardTargetId, SpatialNeighbors> {
  const cardByZone = new Map(cards.map((card) => [card.zoneId, card] as const));
  const stackByZone = new Map(
    stacks.map((stack) => [stack.id, stack] as const),
  );
  const controls: NavControl[] = [];
  for (const zone of zones) {
    const stack = stackByZone.get(zone.id);
    if (stack !== undefined) {
      controls.push(stack);
      continue;
    }
    if (zone.kind === "hand") {
      const handCards = cards.filter((card) => card.zoneId === zone.id);
      if (handCards.length > 0) controls.push(...handCards);
      else controls.push(zone);
      continue;
    }
    controls.push(cardByZone.get(zone.id) ?? zone);
  }
  return new ImmutableReadonlyMap(
    controls.map((control) => [
      control.targetId,
      Object.freeze({
        ...neighborInDirection(control, controls, "left"),
        ...neighborInDirection(control, controls, "right"),
        ...neighborInDirection(control, controls, "up"),
        ...neighborInDirection(control, controls, "down"),
      }),
    ]),
  );
}

function neighborInDirection(
  origin: NavControl,
  controls: readonly NavControl[],
  direction: keyof SpatialNeighbors,
): Partial<SpatialNeighbors> {
  const horizontal = direction === "left" || direction === "right";
  const candidates = controls.filter((candidate) => {
    if (candidate.targetId === origin.targetId) return false;
    if (direction === "left") return candidate.x < origin.x;
    if (direction === "right") return candidate.x > origin.x;
    if (direction === "up") return candidate.y < origin.y;
    return candidate.y > origin.y;
  });
  if (candidates.length === 0) return {};
  const aligned = candidates.filter((candidate) =>
    horizontal
      ? Math.abs(candidate.y - origin.y) < NAV_ALIGNMENT_EPSILON
      : Math.abs(candidate.x - origin.x) < NAV_ALIGNMENT_EPSILON,
  );
  const pool = aligned.length > 0 ? aligned : candidates;
  const neighbor = pool.toSorted((left, right) => {
    const leftPrimary = horizontal
      ? Math.abs(left.x - origin.x)
      : Math.abs(left.y - origin.y);
    const rightPrimary = horizontal
      ? Math.abs(right.x - origin.x)
      : Math.abs(right.y - origin.y);
    const leftSecondary = horizontal
      ? Math.abs(left.y - origin.y)
      : Math.abs(left.x - origin.x);
    const rightSecondary = horizontal
      ? Math.abs(right.y - origin.y)
      : Math.abs(right.x - origin.x);
    return (
      leftPrimary + leftSecondary * 2 - (rightPrimary + rightSecondary * 2) ||
      left.targetId.localeCompare(right.targetId)
    );
  })[0];
  return neighbor === undefined ? {} : { [direction]: neighbor.targetId };
}

function cardIdentityVisible(card: PublicCard): boolean {
  if (card.code === undefined) return false;
  if (card.location === "hand") return card.controller === 0;
  if (card.location === "extra") return card.controller === 0 || card.faceUp;
  return card.faceUp;
}

function cardName(
  code: CardCode | undefined,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): string {
  if (code === undefined) return "Visible card";
  return cardTexts.get(code)?.name ?? `Card ${code}`;
}

function cardAccessibleLabel(
  name: string | undefined,
  zoneLabel: string,
  position: CardPosition,
  counters: readonly PublicCounter[],
  materialCount: number,
): string {
  const state = positionLabel(position);
  const base = `${name ?? "Hidden card"} in ${zoneLabel}${zoneLabel.endsWith("Hand") ? "" : `, ${state}`}`;
  const summaries = counters.map(
    ({ name: counterName, count }) =>
      `${count} ${counterName}${count === 1 ? "" : "s"}`,
  );
  if (materialCount > 0)
    summaries.push(
      `${materialCount} ${materialCount === 1 ? "material" : "materials"}`,
    );
  return summaries.length === 0 ? base : `${base}, ${summaries.join(", ")}`;
}

function positionLabel(position: CardPosition): string {
  switch (position) {
    case "faceUpAttack":
      return "face-up attack";
    case "faceDownAttack":
      return "face-down attack";
    case "faceUpDefense":
      return "face-up defense";
    case "faceDownDefense":
      return "face-down defense";
  }
}

function orientationFor(position: CardPosition): "upright" | "sideways" {
  return position === "faceUpDefense" || position === "faceDownDefense"
    ? "sideways"
    : "upright";
}

function handOffset(sequence: number, count: number): number {
  const pixels =
    (sequence - (count - 1) / 2) * Math.min(58, 600 / Math.max(count, 1));
  return pixels / DUEL_FIELD_WIDTH;
}

function failure(error: BoardMappingError): BoardMappingResult {
  return Object.freeze({ ok: false, error: Object.freeze(error) });
}

class ImmutableReadonlyMap<K, V> implements ReadonlyMap<K, V> {
  readonly #values: ReadonlyMap<K, V>;

  constructor(entries: readonly (readonly [K, V])[]) {
    this.#values = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  get(key: K): V | undefined {
    return this.#values.get(key);
  }

  has(key: K): boolean {
    return this.#values.has(key);
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.#values.forEach((value, key) =>
      callbackfn.call(thisArg, value, key, this),
    );
  }

  entries(): MapIterator<[K, V]> {
    return this.#values.entries();
  }

  keys(): MapIterator<K> {
    return this.#values.keys();
  }

  values(): MapIterator<V> {
    return this.#values.values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
}

import type { PlayerIndex } from "../duel/contracts/public-duel-state.ts";

export const DUEL_FIELD_WIDTH = 1280;
export const DUEL_FIELD_HEIGHT = 720;
export const CARD_WIDTH = 72;
export const CARD_HEIGHT = 104;

export type FieldZoneKind =
  | "hand"
  | "monster"
  | "spellTrap"
  | "field"
  | "deck"
  | "extra"
  | "graveyard"
  | "banished";

export type PhysicalZoneId =
  | `p${PlayerIndex}:mainMonster:${0 | 1 | 2 | 3 | 4}`
  | "shared:extraMonster:left"
  | "shared:extraMonster:right"
  | `p${PlayerIndex}:spellTrap:${0 | 1 | 2 | 3 | 4}`
  | `p${PlayerIndex}:field`
  | `p${PlayerIndex}:deck`
  | `p${PlayerIndex}:extra`
  | `p${PlayerIndex}:graveyard`
  | `p${PlayerIndex}:banished`
  | `p${PlayerIndex}:hand`;

export interface EngineFieldAddress {
  readonly player: PlayerIndex;
  readonly location: "monster" | "spellTrap" | "field" | "pendulum";
  readonly sequence: number;
}

export type PhysicalZoneMappingResult =
  | { readonly ok: true; readonly zoneId: PhysicalZoneId }
  | {
      readonly ok: false;
      readonly error: {
        readonly type: "unsupported_field_address";
        readonly address: EngineFieldAddress;
      };
    };

export interface StandardFieldZoneLayout {
  readonly id: PhysicalZoneId;
  readonly player: PlayerIndex | "shared";
  readonly kind: FieldZoneKind;
  readonly sequence: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

export function mapEngineFieldAddress(
  address: EngineFieldAddress,
): PhysicalZoneMappingResult {
  const { player, location, sequence } = address;
  if ((player !== 0 && player !== 1) || !Number.isInteger(sequence))
    return unsupported(address);

  switch (location) {
    case "monster":
      if (sequence >= 0 && sequence <= 4)
        return supported(
          `p${player}:mainMonster:${sequence as 0 | 1 | 2 | 3 | 4}`,
        );
      if (sequence === 5)
        return supported(
          player === 0
            ? "shared:extraMonster:left"
            : "shared:extraMonster:right",
        );
      if (sequence === 6)
        return supported(
          player === 0
            ? "shared:extraMonster:right"
            : "shared:extraMonster:left",
        );
      return unsupported(address);
    case "spellTrap":
      /* ocgcore keeps the Field Zone in the Spell & Trap list at sequence 5,
         so an activated field spell arrives here rather than as `field` 0. */
      if (sequence === 5) return supported(`p${player}:field`);
      if (sequence < 0 || sequence > 4) return unsupported(address);
      return supported(`p${player}:spellTrap:${sequence as 0 | 1 | 2 | 3 | 4}`);
    case "field":
      return sequence === 0
        ? supported(`p${player}:field`)
        : unsupported(address);
    case "pendulum":
      if (sequence !== 0 && sequence !== 1) return unsupported(address);
      return supported(`p${player}:spellTrap:${sequence === 0 ? 0 : 4}`);
  }
}

export function fieldZoneId(
  player: PlayerIndex,
  kind: FieldZoneKind,
  sequence = 0,
): PhysicalZoneId {
  if (kind === "monster" || kind === "spellTrap" || kind === "field") {
    const result = mapEngineFieldAddress({ player, location: kind, sequence });
    if (result.ok) return result.zoneId;
    throw new Error(`Unsupported field zone: ${kind} ${sequence}`);
  }
  return `p${player}:${kind}`;
}

/* Viewport-independent semantic nav grid. Rendering uses pixel geometry. */
const CENTRAL_COLUMN_X = [450, 545, 640, 735, 830] as const;

export const STANDARD_DUEL_FIELD_LAYOUT: readonly StandardFieldZoneLayout[] =
  createStandardDuelFieldLayout();

function createStandardDuelFieldLayout(): readonly StandardFieldZoneLayout[] {
  const zones: StandardFieldZoneLayout[] = [];
  for (const player of [0, 1] as const) {
    const mirrored = player === 1;
    const monsterY = mirrored ? 250 : 470;
    const spellY = mirrored ? 130 : 590;
    for (let sequence = 0; sequence < 5; sequence += 1) {
      const x = CENTRAL_COLUMN_X[sequence]!;
      zones.push(zone(player, "monster", sequence, x, monsterY));
      zones.push(zone(player, "spellTrap", sequence, x, spellY));
    }
    zones.push(zone(player, "field", 0, 330, monsterY));
    zones.push(zone(player, "deck", 0, 925, spellY));
    zones.push(zone(player, "extra", 0, 330, spellY));
    zones.push(zone(player, "graveyard", 0, 925, monsterY));
    zones.push(zone(player, "banished", 0, 1020, monsterY));
    zones.push({
      ...zone(player, "hand", 0, 640, mirrored ? 42 : 678),
      width: 462 / DUEL_FIELD_WIDTH,
      height: 72 / DUEL_FIELD_HEIGHT,
    });
  }
  zones.push(
    sharedExtraMonsterZone("left", 590),
    sharedExtraMonsterZone("right", 690),
  );
  return Object.freeze(zones.map((value) => Object.freeze(value)));
}

function zone(
  player: PlayerIndex,
  kind: FieldZoneKind,
  sequence: number,
  x: number,
  y: number,
): StandardFieldZoneLayout {
  return {
    id: fieldZoneId(player, kind, sequence),
    player,
    kind,
    sequence,
    x: x / DUEL_FIELD_WIDTH,
    y: y / DUEL_FIELD_HEIGHT,
    width: (CARD_WIDTH + 10) / DUEL_FIELD_WIDTH,
    height: (CARD_HEIGHT + 10) / DUEL_FIELD_HEIGHT,
    label: visibleZoneLabel(kind, sequence),
  };
}

function visibleZoneLabel(kind: FieldZoneKind, sequence: number): string {
  switch (kind) {
    case "monster":
      return `Monster Zone ${sequence + 1}`;
    case "spellTrap":
      return `Spell/Trap Zone ${sequence + 1}`;
    case "field":
      return "Field Zone";
    case "deck":
      return "Deck";
    case "extra":
      return "Extra Deck";
    case "graveyard":
      return "GY";
    case "banished":
      return "Banished";
    case "hand":
      return "Hand";
  }
}

export function fieldZoneAccessibleName(
  zone: Pick<StandardFieldZoneLayout, "player" | "kind" | "sequence" | "id">,
): string {
  if (zone.player === "shared")
    return zone.id === "shared:extraMonster:left"
      ? "Shared Extra Monster Zone left"
      : "Shared Extra Monster Zone right";
  const owner = zone.player === 0 ? "Your" : "Opponent";
  const spoken =
    zone.kind === "spellTrap"
      ? `Spell and Trap Zone ${zone.sequence + 1}`
      : zone.kind === "graveyard"
        ? "Graveyard"
        : visibleZoneLabel(zone.kind, zone.sequence);
  return `${owner} ${spoken}`;
}

function sharedExtraMonsterZone(
  side: "left" | "right",
  x: number,
): StandardFieldZoneLayout {
  return {
    id: `shared:extraMonster:${side}`,
    player: "shared",
    kind: "monster",
    sequence: side === "left" ? 5 : 6,
    x: x / DUEL_FIELD_WIDTH,
    y: 360 / DUEL_FIELD_HEIGHT,
    width: (CARD_WIDTH + 10) / DUEL_FIELD_WIDTH,
    height: (CARD_HEIGHT + 10) / DUEL_FIELD_HEIGHT,
    label: `Shared Extra Monster Zone ${side}`,
  };
}

function supported(zoneId: PhysicalZoneId): PhysicalZoneMappingResult {
  return Object.freeze({ ok: true, zoneId });
}

function unsupported(address: EngineFieldAddress): PhysicalZoneMappingResult {
  const addressCopy = Object.freeze({
    player: address.player,
    location: address.location,
    sequence: address.sequence,
  });
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      type: "unsupported_field_address",
      address: addressCopy,
    }),
  });
}

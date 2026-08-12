import type {
  CardPosition,
  PlayerIndex,
  PublicCard,
  PublicLocation,
} from "./contracts/public-duel-state.ts";

/** Projector is privacy boundary: projected code means local viewer knows it. */
export function isProjectedCardIdentityKnown(
  card: Pick<PublicCard, "code">,
): boolean {
  return card.code !== undefined;
}

export function isFaceUpPosition(position: CardPosition | undefined): boolean {
  return position === "faceUpAttack" || position === "faceUpDefense";
}

/** Identity visibility from the local human viewer's perspective. */
export function isCardIdentityVisible(
  viewer: PlayerIndex,
  controller: PlayerIndex,
  location: PublicLocation,
  position: CardPosition | undefined,
): boolean {
  return (
    controller === viewer ||
    location === "graveyard" ||
    isFaceUpPosition(position)
  );
}

import type { DeckId } from "./deck-catalog.ts";

/** Package SQLite supplies playable decks after ADR-099. No deck payloads are bundled in JS. */
export const DECK_SOURCES: ReadonlyMap<DeckId, string> = Object.freeze(
  new Map(),
);

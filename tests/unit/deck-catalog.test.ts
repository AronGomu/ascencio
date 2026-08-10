import { describe, expect, it } from "vitest";
import {
  DECK_CATALOG,
  DEFAULT_OPPONENT_DECK_ID,
  DEFAULT_PLAYER_DECK_ID,
  deckMetadata,
  isDeckId,
} from "../../src/duel/presets/deck-catalog.ts";

describe("deck catalog", () => {
  it("DECK_CATALOG lists six decks with unique ids and file names", () => {
    expect(DECK_CATALOG).toHaveLength(6);
    expect(new Set(DECK_CATALOG.map(({ id }) => id))).toHaveLength(6);
    expect(new Set(DECK_CATALOG.map(({ fileName }) => fileName))).toHaveLength(
      6,
    );
  });

  it("deckMetadata resolves every id in the catalog", () => {
    for (const metadata of DECK_CATALOG) {
      expect(deckMetadata(metadata.id)).toBe(metadata);
    }
  });

  it("isDeckId rejects an unknown id", () => {
    expect(isDeckId("not-a-deck")).toBe(false);
  });

  it("defaults point at the two MVP decks", () => {
    expect(DEFAULT_PLAYER_DECK_ID).toBe("mvp-player");
    expect(DEFAULT_OPPONENT_DECK_ID).toBe("mvp-opponent");
  });
});

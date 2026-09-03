import type { DeckTileModel } from "../../../src/deck-select/deck-select-contracts.ts";

/** One deck as any grid renders it. Shared rather than re-declared per test:
    the tile and the screen that hosts it must describe the same deck, or a
    change to the view model only breaks one of the two suites. */
export function tile(overrides: Partial<DeckTileModel> = {}): DeckTileModel {
  return {
    key: "k1",
    name: "Prototype Control",
    meta: "Local deck",
    coverImageUrl: null,
    legal: true,
    blockReason: null,
    bundled: false,
    lockedBy: null,
    isDefault: false,
    deletable: true,
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

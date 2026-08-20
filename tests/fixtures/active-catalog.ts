import { setRuntimeCatalogForTests } from "../../src/decks/catalog/runtime-catalog.ts";
import {
  PROTOTYPE_CATALOG,
  PROTOTYPE_CATALOG_ASSETS,
} from "../../src/deck-editor/fixtures/catalog.ts";

/**
 * Points `runtimeCatalog()` at the small hand-written fixture, and gives the
 * duel's image cache a manifest naming the same cards.
 *
 * Production fetches the card database from the runtime assets, which a jsdom
 * test has no server for. Mounting a component that reads the catalog without
 * this leaves the editor and the deck picker waiting on a fetch that will never
 * answer, so every such test calls it before it renders.
 */
export function installPrototypeActiveCatalog(): void {
  setRuntimeCatalogForTests(PROTOTYPE_CATALOG);
  Object.assign(globalThis, {
    __ACTIVE_IMAGE_MANIFEST__: {
      schemaVersion: 1 as const,
      snapshotId: "a".repeat(64),
      provider: "bundled-archive" as const,
      redistributionApproved: false as const,
      files: PROTOTYPE_CATALOG_ASSETS.map(({ code }) => ({
        code,
        path: `${code}.jpg`,
        bytes: 1,
        sha256: "0".repeat(64),
      })),
      missing: [] as number[],
    },
  });
}

/** Hands `runtimeCatalog()` back to the real loader, for a test that drives it. */
export function resetRuntimeCatalog(): void {
  setRuntimeCatalogForTests(null);
}

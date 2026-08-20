import { setRuntimeCatalogForTests } from "../../src/decks/catalog/runtime-catalog.ts";
import {
  PROTOTYPE_CATALOG,
  PROTOTYPE_CATALOG_ASSETS,
  PROTOTYPE_CATALOG_TEXTS,
} from "../../src/deck-editor/fixtures/catalog.ts";

/**
 * Points `activeCatalog()` and `runtimeCatalog()` at the small hand-written
 * fixture.
 *
 * Production substitutes the two globals from the packaged card set at build
 * time and fetches the rest of the database from the runtime assets, neither of
 * which a jsdom test has. Mounting a component that reads the catalog without
 * this leaves the editor and the deck picker looking at an empty build — or,
 * for the editor, waiting on a fetch that will never answer — so every such
 * test calls it before it renders.
 */
export function installPrototypeActiveCatalog(): void {
  setRuntimeCatalogForTests(PROTOTYPE_CATALOG);
  Object.assign(globalThis, {
    __ACTIVE_CARD_DATA__: PROTOTYPE_CATALOG_ASSETS,
    __ACTIVE_CARD_TEXTS__: PROTOTYPE_CATALOG_TEXTS,
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

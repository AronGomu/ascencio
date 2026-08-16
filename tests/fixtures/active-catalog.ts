import {
  PROTOTYPE_CATALOG_ASSETS,
  PROTOTYPE_CATALOG_TEXTS,
} from "../../src/deck-editor/fixtures/catalog.ts";

/**
 * Points `activeCatalog()` at the small hand-written fixture.
 *
 * Production substitutes the two globals from the packaged card set at build
 * time, which a jsdom test has no build to do. Mounting a component that reads
 * the catalog without this leaves the editor and the deck picker looking at an
 * empty build, so every such test calls it before it renders.
 */
export function installPrototypeActiveCatalog(): void {
  Object.assign(globalThis, {
    __ACTIVE_CARD_DATA__: PROTOTYPE_CATALOG_ASSETS,
    __ACTIVE_CARD_TEXTS__: PROTOTYPE_CATALOG_TEXTS,
  });
}

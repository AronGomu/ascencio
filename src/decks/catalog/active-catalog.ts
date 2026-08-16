import type { DeckBuilderCardView } from "./ocg-card-mapper.ts";
import { packagedCatalog } from "./packaged-catalog.ts";

/**
 * Every card this build can put in a deck.
 *
 * Derived from the build's own manifests rather than written by hand, so the
 * editor's catalog and the set of cards the duel can draw are the same set by
 * construction. A hand-written catalog drifts, and the way it drifts is that a
 * deck a player spent an evening on is silently never offered at `#/duel`.
 *
 * Read through a call rather than a module constant on purpose: Vite
 * substitutes both globals at build time, and a constant would capture
 * whatever a host had defined the moment this module was first imported —
 * which, in a component test that sets them up around a render, is nothing.
 */
function buildImageUrlMap(): ReadonlyMap<number, string> {
  if (typeof __ACTIVE_IMAGE_MANIFEST__ === "undefined") return new Map();
  const base = import.meta.env.BASE_URL;
  return new Map(
    __ACTIVE_IMAGE_MANIFEST__.files.map((file) => [
      file.code,
      `${base}runtime/images/${file.path}`,
    ]),
  );
}

export function activeCatalog(): readonly DeckBuilderCardView[] {
  return packagedCatalog(
    __ACTIVE_CARD_DATA__,
    __ACTIVE_CARD_TEXTS__,
    buildImageUrlMap(),
  );
}

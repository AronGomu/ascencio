// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardTile from "../../../src/deck-editor/components/CardTile.svelte";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";

afterEach(() => cleanup());

describe("card-tile data-cy uniqueness", () => {
  it("two tiles with the same code but different prefix+id have distinct data-cy", () => {
    const base = PROTOTYPE_CATALOG[0]!;
    const card = { ...base, imageUrl: null };
    /* Render both tiles into the same document, proving distinctness. */
    render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
      dataCyPrefix: "a",
      dataCyId: 1,
    });
    render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
      dataCyPrefix: "b",
      dataCyId: 2,
    });
    const tileA = document.querySelector('[data-cy="a-tile-1"]');
    const tileB = document.querySelector('[data-cy="b-tile-2"]');
    expect(tileA).not.toBeNull();
    expect(tileB).not.toBeNull();
    /* No collision — the old single-code `data-cy` would have failed here. */
    expect(tileA).not.toBe(tileB);
  });
});

describe("card-tile art fit", () => {
  it("the tile image is lazy and asynchronous", () => {
    const base = PROTOTYPE_CATALOG[0]!;
    const card = { ...base, imageUrl: "/runtime/images/1.jpg" };
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
      dataCyPrefix: "catalog",
      dataCyId: card.code,
    });
    const img = container.querySelector(
      `[data-cy="catalog-tile-image-${card.code}"]`,
    ) as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");
  });

  it("a card whose art this build has no image for falls back to the glyph", async () => {
    /* Every code gets a URL by convention now, so the 404 is the only signal
       that this build packages no image for the card. */
    const base = PROTOTYPE_CATALOG[0]!;
    const card = { ...base, imageUrl: `/runtime/images/${base.code}.jpg` };
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
      dataCyPrefix: "catalog",
      dataCyId: card.code,
    });
    const img = container.querySelector(
      `[data-cy="catalog-tile-image-${card.code}"]`,
    )!;
    await fireEvent.error(img);
    await waitFor(() =>
      expect(
        container.querySelector(`[data-cy="catalog-tile-art-${card.code}"]`),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector(`[data-cy="catalog-tile-image-${card.code}"]`),
    ).toBeNull();
  });

  it("a card without art keeps the placeholder glyph", () => {
    const base = PROTOTYPE_CATALOG[0]!;
    const card = { ...base, imageUrl: null };
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
      dataCyPrefix: "catalog",
      dataCyId: card.code,
    });
    expect(
      container.querySelector(`[data-cy="catalog-tile-art-${card.code}"]`),
    ).not.toBeNull();
    expect(
      container.querySelector(`[data-cy="catalog-tile-image-${card.code}"]`),
    ).toBeNull();
  });
});

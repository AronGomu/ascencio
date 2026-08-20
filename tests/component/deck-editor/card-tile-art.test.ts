// @vitest-environment jsdom

import { readFileSync } from "fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardTile from "../../../src/deck-editor/components/CardTile.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";

afterEach(() => cleanup());

describe("card-tile art fit", () => {
  it("the tile image is lazy and asynchronous", () => {
    const base = PROTOTYPE_CATALOG[0]!;
    const card = { ...base, imageUrl: "/runtime/images/1.jpg" };
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 0,
    });
    const img = container.querySelector(
      `[data-cy="deck-tile-image-${card.code}"]`,
    ) as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");
  });

  it("the tile image is styled to fill its rectangle", () => {
    const source = readFileSync(
      "src/deck-editor/components/CardTile.svelte",
      "utf8",
    );
    expect(source).toMatch(/width:\s*100%/);
    expect(source).toMatch(/height:\s*100%/);
    expect(source).toMatch(/object-fit:\s*cover/);
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
    });
    const img = container.querySelector(
      `[data-cy="deck-tile-image-${card.code}"]`,
    )!;
    await fireEvent.error(img);
    await waitFor(() =>
      expect(
        container.querySelector(`[data-cy="deck-tile-art-${card.code}"]`),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector(`[data-cy="deck-tile-image-${card.code}"]`),
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
    });
    expect(
      container.querySelector(`[data-cy="deck-tile-art-${card.code}"]`),
    ).not.toBeNull();
    expect(
      container.querySelector(`[data-cy="deck-tile-image-${card.code}"]`),
    ).toBeNull();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tick } from "svelte";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import {
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";
import { cardCode } from "../../../src/cards/index.ts";
import type {
  CardImageLease,
  CardImageSource,
} from "../../../src/cards/images/index.ts";

installPrototypeActiveCatalog();

afterEach(() => cleanup());

const unavailableImages: CardImageSource = {
  acquire: async () => null,
};

function renderEditor(
  mainCount = 0,
  cards = PROTOTYPE_CATALOG,
  catalog = prototypeCatalogMap,
  images: CardImageSource = unavailableImages,
) {
  return render(DeckEditor, {
    state: stateFixture(mainCount),
    cards,
    catalog,
    ruleset: PROTOTYPE_RULESET,
    images,
    returnLabel: "Deck Selection",
    onreturn: vi.fn(),
    onrename: vi.fn(),
    onmutate: vi.fn(),
    onundo: vi.fn(),
    onredo: vi.fn(),
    onretrysave: vi.fn(),
    onreload: vi.fn(),
    onpreservecopy: vi.fn(),
  });
}

function catalogTiles(): HTMLElement[] {
  const results = document.querySelector('[data-cy="deck-catalog-results"]')!;
  return Array.from(results.querySelectorAll('[data-cy^="catalog-tile-"]'));
}

describe("editor preview pane", () => {
  it("the preview pane renders the shared duel panel", () => {
    renderEditor();
    expect(
      document.querySelector('[data-cy="card-preview-panel"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="deck-card-details"]')).toBeNull();
  });

  it("hovering a catalog tile previews it", async () => {
    renderEditor();
    const [tile] = catalogTiles();
    const code = Number(tile!.dataset.cardCode);
    const card = prototypeCatalogMap.get(code)!;
    fireEvent.mouseEnter(tile!);
    await tick();
    expect(
      document.querySelector('[data-cy="card-preview-name"]')?.textContent,
    ).toContain(card.name);
  });

  it("leaving the catalog restores the selected card", async () => {
    const user = userEvent.setup();
    renderEditor();
    const results = document.querySelector('[data-cy="deck-catalog-results"]')!;
    const [tileA, tileB] = catalogTiles();
    const codeA = Number(tileA!.dataset.cardCode);
    const cardA = prototypeCatalogMap.get(codeA)!;

    await user.click(tileA!);
    fireEvent.mouseEnter(tileB!);
    await tick();
    fireEvent.mouseLeave(results);
    await tick();

    expect(
      document.querySelector('[data-cy="card-preview-name"]')?.textContent,
    ).toContain(cardA.name);
  });

  it("Lease race", async () => {
    const requests = new Map<
      number,
      ReturnType<typeof Promise.withResolvers<CardImageLease | null>>
    >();
    const signals = new Map<number, AbortSignal>();
    const acquire = vi.fn(
      (code: number, _variant: "full" | "cropped", signal: AbortSignal) => {
        const pending = Promise.withResolvers<CardImageLease | null>();
        requests.set(code, pending);
        signals.set(code, signal);
        return pending.promise;
      },
    );
    const images: CardImageSource = { acquire };
    renderEditor(0, PROTOTYPE_CATALOG, prototypeCatalogMap, images);
    const results = document.querySelector('[data-cy="deck-catalog-results"]')!;
    const tiles = Array.from(
      results.querySelectorAll<HTMLElement>("[data-card-code]"),
    );
    const [tileA, tileB] = tiles;
    const codeA = Number(tileA!.dataset.cardCode);
    const codeB = Number(tileB!.dataset.cardCode);

    fireEvent.mouseEnter(tileA!);
    await vi.waitFor(() =>
      expect(acquire).toHaveBeenCalledWith(
        cardCode(codeA),
        "full",
        expect.any(AbortSignal),
      ),
    );
    fireEvent.mouseEnter(tileB!);
    await vi.waitFor(() =>
      expect(acquire).toHaveBeenCalledWith(
        cardCode(codeB),
        "full",
        expect.any(AbortSignal),
      ),
    );
    expect(signals.get(codeA)?.aborted).toBe(true);

    const releaseB = vi.fn();
    requests.get(codeB)!.resolve({ url: "blob:card-b", release: releaseB });
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('[data-cy="card-preview-image"]')
          ?.getAttribute("src"),
      ).toBe("blob:card-b"),
    );

    const releaseA = vi.fn();
    requests.get(codeA)!.resolve({ url: "blob:card-a", release: releaseA });
    await vi.waitFor(() => expect(releaseA).toHaveBeenCalledOnce());
    expect(
      document
        .querySelector('[data-cy="card-preview-image"]')
        ?.getAttribute("src"),
    ).toBe("blob:card-b");
    expect(releaseB).not.toHaveBeenCalled();
  });

  it("panes read preview, deck, catalog left to right", () => {
    renderEditor();
    const preview = document.querySelector('[data-cy="card-preview-panel"]')!;
    const workspace = document.querySelector('[data-cy="deck-workspace"]')!;
    const catalog = document.querySelector('[data-cy="deck-catalog"]')!;
    expect(
      preview.compareDocumentPosition(workspace) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      workspace.compareDocumentPosition(catalog) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import DeckEditorApp from "../../../src/deck-editor/DeckEditorApp.svelte";
import type {
  CardImageLease,
  CardImageSource,
} from "../../../src/cards/images/index.ts";
import type { CardCode, CardImageVariant } from "../../../src/cards/index.ts";
import { deckId, type DeckRecord } from "../../../src/decks/contracts/index.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/repository/index.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";
import { installedEditorCatalog } from "../../../src/shell/adapters/installed-editor-catalog.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const A = 89631139;
const B = 46986414;
const C = 12580477;
const deck = (id: string, codes: number[]): DeckRecord => ({
  ...deckFixture(40),
  id: deckId(id),
  main: codes,
  extra: [],
  side: [],
  illustrationCardCode: codes[0]!,
});
const decks = [deck("a", [A, C, C]), deck("b", [B])];
const catalog = new Map(
  [...prototypeCatalogMap].map(([code, card]) => [
    code,
    { ...card, imageUrl: `https://legacy.example/${code}.jpg` },
  ]),
);
const callbacks = { oncreate: vi.fn(), onopen: vi.fn(), onimport: vi.fn() };
function cy(id: string) {
  return document.querySelector<HTMLElement>(`[data-cy="${id}"]`)!;
}
function immediateSource(prefix: string) {
  const leases: Array<{
    code: number;
    variant: CardImageVariant;
    release: ReturnType<typeof vi.fn>;
    url: string;
  }> = [];
  const acquire = vi.fn(
    async (code: CardCode, variant: CardImageVariant, signal: AbortSignal) => {
      signal.throwIfAborted();
      const lease = {
        code,
        variant,
        release: vi.fn(),
        url: `blob:${prefix}-${variant}-${code}`,
      };
      leases.push(lease);
      return lease;
    },
  );
  return { source: { acquire } satisfies CardImageSource, acquire, leases };
}
afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("Deck Library source-backed image ownership", () => {
  it("routes the domain catalogInput.images into the library", async () => {
    const { source, acquire } = immediateSource("host");
    render(DeckEditorApp, {
      catalogInput: installedEditorCatalog(
        installedDuelGameplayFixture(),
        source,
      ),
    });
    await waitFor(() => expect(acquire).toHaveBeenCalled());
    expect(
      acquire.mock.calls.every(([, variant]) => variant === "cropped"),
    ).toBe(true);
  });

  it("deduplicates covers and selected rows; selected full leases feed synchronous hover", async () => {
    const { source, acquire } = immediateSource("first");
    render(DeckLibrary, { decks, catalog, images: source, ...callbacks });
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
    expect(cy("deck-tile-art-a").getAttribute("src")).toBe(
      `blob:first-cropped-${A}`,
    );
    expect(
      acquire.mock.calls.map(([code, variant]) => [code, variant]),
    ).toEqual([
      [A, "cropped"],
      [B, "cropped"],
    ]);
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(5));
    await waitFor(() =>
      expect(
        cy(`deck-select-docked-list-row-${C}`).style.getPropertyValue("--img"),
      ).toContain(`blob:first-cropped-${C}`),
    );
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${A}`));
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:first-full-${A}`,
    );
    expect(
      document.querySelectorAll('img[src^="https://legacy.example/"]'),
    ).toHaveLength(0);
  });

  it("refreshes hovered deck rows when selected image acquisitions finish", async () => {
    const { source, acquire } = immediateSource("hovered");
    render(DeckLibrary, { decks, catalog, images: source, ...callbacks });
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
    await fireEvent.pointerEnter(cy("deck-tile-press-a"));
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(5));
    await waitFor(() =>
      expect(
        cy(`deck-select-docked-list-row-${C}`).style.getPropertyValue("--img"),
      ).toContain(`blob:hovered-cropped-${C}`),
    );
  });

  it("retains needed identities, releases obsolete selection images, replaces sources and disposes exactly once", async () => {
    const first = immediateSource("first");
    const second = immediateSource("second");
    const view = render(DeckLibrary, {
      decks,
      catalog,
      images: first.source,
      ...callbacks,
    });
    await waitFor(() => expect(first.acquire).toHaveBeenCalledTimes(2));
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(first.acquire).toHaveBeenCalledTimes(5));
    await fireEvent.click(cy("deck-tile-press-b"));
    await waitFor(() => expect(first.acquire).toHaveBeenCalledTimes(6));
    for (const lease of first.leases)
      expect(lease.release).toHaveBeenCalledTimes(
        lease.code === C || (lease.variant === "full" && lease.code === A)
          ? 1
          : 0,
      );
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${B}`));
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:first-full-${B}`,
    );
    await view.rerender({
      decks,
      catalog,
      images: second.source,
      ...callbacks,
    });
    await waitFor(() => expect(second.acquire).toHaveBeenCalledTimes(3));
    expect(
      first.leases.every((lease) => lease.release.mock.calls.length === 1),
    ).toBe(true);
    expect(cy("deck-tile-art-a").getAttribute("src")).toBe(
      `blob:second-cropped-${A}`,
    );
    expect(
      document.querySelector('[data-cy="deck-select-card-art-float"]'),
    ).toBeNull();
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${B}`));
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:second-full-${B}`,
    );
    view.unmount();
    expect(
      second.leases.every((lease) => lease.release.mock.calls.length === 1),
    ).toBe(true);
    expect(
      first.leases.every((lease) => lease.release.mock.calls.length === 1),
    ).toBe(true);
  });

  it("caps acquisitions at four, cancels obsolete queued work and releases late unmounted results", async () => {
    const pending: Array<{
      signal: AbortSignal;
      resolve: (lease: CardImageLease) => void;
    }> = [];
    const acquire = vi.fn(
      (_code: CardCode, _variant: CardImageVariant, signal: AbortSignal) =>
        new Promise<CardImageLease>((resolve) =>
          pending.push({ signal, resolve }),
        ),
    );
    const source: CardImageSource = { acquire };
    const codes = [...prototypeCatalogMap.keys()].slice(0, 8);
    const many = codes.map((code, i) => deck(`many-${i}`, [code]));
    const view = render(DeckLibrary, {
      decks: many,
      catalog,
      images: source,
      ...callbacks,
    });
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(4));
    await view.rerender({
      decks: many.slice(0, 1),
      catalog,
      images: source,
      ...callbacks,
    });
    expect(pending[0]!.signal.aborted).toBe(false);
    expect(pending.slice(1).every((item) => item.signal.aborted)).toBe(true);
    view.unmount();
    expect(pending.every((item) => item.signal.aborted)).toBe(true);
    const releases = pending.map((item, i) => {
      const release = vi.fn();
      item.resolve({ url: `blob:late-${i}`, release });
      return release;
    });
    await waitFor(() =>
      expect(releases.every((release) => release.mock.calls.length === 1)).toBe(
        true,
      ),
    );
    expect(acquire).toHaveBeenCalledTimes(4);
    expect(document.querySelectorAll('img[src^="blob:late-"]')).toHaveLength(0);
  });

  it("late selected-row results cannot render after selection changes", async () => {
    const pending: Array<{
      code: number;
      variant: CardImageVariant;
      signal: AbortSignal;
      resolve: (lease: CardImageLease) => void;
    }> = [];
    const source: CardImageSource = {
      acquire: vi.fn<CardImageSource["acquire"]>((code, variant, signal) =>
        variant === "cropped" && code !== C
          ? Promise.resolve({ url: `blob:cover-${code}`, release: vi.fn() })
          : new Promise((resolve) =>
              pending.push({ code, variant, signal, resolve }),
            ),
      ),
    };
    render(DeckLibrary, { decks, catalog, images: source, ...callbacks });
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(pending).toHaveLength(3));
    await fireEvent.click(cy("deck-tile-press-b"));
    await waitFor(() => expect(pending).toHaveLength(4));
    const stale = pending.filter((item) => item.code !== B);
    expect(stale.every((item) => item.signal.aborted)).toBe(true);
    const releases = stale.map((item) => {
      const release = vi.fn();
      item.resolve({ url: `blob:stale-${item.code}`, release });
      return release;
    });
    pending
      .find((item) => item.code === B)!
      .resolve({ url: `blob:selected-${B}`, release: vi.fn() });
    await waitFor(() =>
      expect(releases.every((release) => release.mock.calls.length === 1)).toBe(
        true,
      ),
    );
    expect(
      document.querySelector(`[data-cy="deck-select-docked-list-row-${C}"]`),
    ).toBeNull();
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${B}`));
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:selected-${B}`,
    );
  });

  it("clears obsolete hover on selection or selected-deck edits without resetting filter or focus", async () => {
    const { source, acquire } = immediateSource("hover");
    const view = render(DeckLibrary, {
      decks,
      catalog,
      images: source,
      ...callbacks,
    });
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(5));
    await fireEvent.input(cy("deck-select-filter"), {
      target: { value: "Prototype" },
    });
    await fireEvent.change(cy("deck-select-sort"), {
      target: { value: "name" },
    });
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${C}`));
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:hover-full-${C}`,
    );
    cy("deck-tile-press-b").focus();
    await fireEvent.click(cy("deck-tile-press-b"));
    expect(
      document.querySelector('[data-cy="deck-select-card-art-float"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(cy("deck-tile-press-b"));
    expect((cy("deck-select-filter") as HTMLInputElement).value).toBe(
      "Prototype",
    );
    expect((cy("deck-select-sort") as HTMLSelectElement).value).toBe("name");
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(9));
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${C}`));
    await view.rerender({
      decks: [decks[0]!, { ...decks[1]!, name: "Prototype renamed" }],
      catalog,
      images: source,
      ...callbacks,
    });
    expect(cy("deck-select-card-art-float").getAttribute("src")).toBe(
      `blob:hover-full-${C}`,
    );
    await view.rerender({
      decks: [deck("a", [A]), decks[1]!],
      catalog,
      images: source,
      ...callbacks,
    });
    expect(
      document.querySelector('[data-cy="deck-select-card-art-float"]'),
    ).toBeNull();
  });

  it("source-backed missing media never falls back to legacy HTTP URLs", async () => {
    const acquire = vi.fn(async () => null);
    render(DeckLibrary, { decks, catalog, images: { acquire }, ...callbacks });
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
    await fireEvent.click(cy("deck-tile-press-a"));
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(5));
    expect(
      document.querySelectorAll('img[src^="https://legacy.example/"]'),
    ).toHaveLength(0);
    expect(
      document.querySelector(
        `[data-cy="deck-select-docked-list-row-art-${A}"]`,
      ),
    ).toBeNull();
    await fireEvent.pointerEnter(cy(`deck-select-docked-list-row-${A}`));
    expect(
      document.querySelector('[data-cy="deck-select-card-art-float"]'),
    ).toBeNull();
  });
});

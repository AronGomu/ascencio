// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import CardCatalog from "../../../src/deck-editor/components/CardCatalog.svelte";
import DeckZoneGrid from "../../../src/deck-editor/components/DeckZoneGrid.svelte";
import type {
  CardImageLease,
  CardImageSource,
} from "../../../src/cards/images/index.ts";
import { mainDeckGridPlan } from "../../../src/decks/editing/index.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

function deferredImages() {
  const requests: Array<{
    code: number;
    signal: AbortSignal;
    pending: ReturnType<typeof Promise.withResolvers<CardImageLease | null>>;
  }> = [];
  const source: CardImageSource = {
    acquire: vi.fn((code, _variant, signal) => {
      const pending = Promise.withResolvers<CardImageLease | null>();
      requests.push({ code, signal, pending });
      return pending.promise;
    }),
  };
  return { source, requests };
}

it("bounds tile acquisitions to four, aborts filtered cards, releases stale and unmounted leases", async () => {
  const { source, requests } = deferredImages();
  const view = render(CardCatalog, {
    cards: PROTOTYPE_CATALOG,
    ruleset: PROTOTYPE_RULESET,
    images: source,
  });
  await waitFor(() => expect(requests).toHaveLength(4));
  const first = requests.slice();
  await fireEvent.input(
    view.container.querySelector('[data-cy="deck-catalog-name-input"]')!,
    { target: { value: "no matching card" } },
  );
  expect(first.every(({ signal }) => signal.aborted)).toBe(true);
  const releases = first.map(() => vi.fn());
  first.forEach(({ pending }, index) =>
    pending.resolve({ url: `blob:stale-${index}`, release: releases[index]! }),
  );
  await waitFor(() =>
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(
      true,
    ),
  );
  expect(requests).toHaveLength(4);
  expect(view.container.querySelector("img")).toBeNull();
  await fireEvent.input(
    view.container.querySelector('[data-cy="deck-catalog-name-input"]')!,
    { target: { value: "Blue-Eyes White Dragon" } },
  );
  await waitFor(() => expect(requests).toHaveLength(5));
  const late = requests[4]!;
  view.unmount();
  expect(late.signal.aborted).toBe(true);
  const release = vi.fn();
  late.pending.resolve({ url: "blob:late", release });
  await waitFor(() => expect(release).toHaveBeenCalledOnce());
});

it("zone images follow rendered codes and collapse, replacing sources without publishing old art", async () => {
  const first = deferredImages();
  const next = deferredImages();
  const view = render(DeckZoneGrid, {
    zone: "main",
    label: "Main Deck",
    codes: [89631139, 89631139],
    plan: mainDeckGridPlan(2),
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    totalCopies: new Map([[89631139, 2]]),
    images: first.source,
  });
  await waitFor(() => expect(first.requests).toHaveLength(1));
  await view.rerender({ images: next.source });
  expect(first.requests[0]!.signal.aborted).toBe(true);
  const staleRelease = vi.fn();
  first.requests[0]!.pending.resolve({
    url: "blob:old",
    release: staleRelease,
  });
  await waitFor(() => expect(staleRelease).toHaveBeenCalledOnce());
  const release = vi.fn();
  next.requests[0]!.pending.resolve({ url: "blob:new", release });
  await waitFor(() =>
    expect(view.container.querySelectorAll('img[src="blob:new"]')).toHaveLength(
      2,
    ),
  );
  await view.rerender({
    codes: [46986414],
    totalCopies: new Map([[46986414, 1]]),
  });
  expect(release).toHaveBeenCalledOnce();
  expect(view.container.querySelector("img")).toBeNull();
  await waitFor(() => expect(next.requests).toHaveLength(2));
  await view.rerender({ collapsed: true });
  expect(next.requests[1]!.signal.aborted).toBe(true);
  next.requests[1]!.pending.resolve(null);
});

it("optional tile image rejection keeps tiles usable", async () => {
  const onselect = vi.fn();
  const view = render(CardCatalog, {
    cards: [prototypeCatalogMap.get(89631139)!],
    ruleset: PROTOTYPE_RULESET,
    onselect,
    images: {
      acquire: async () => {
        throw new Error("art unavailable");
      },
    },
  });
  await fireEvent.click(view.container.querySelector("[data-card-code]")!);
  expect(onselect).toHaveBeenCalledWith(prototypeCatalogMap.get(89631139));
  expect(view.container.querySelector("img")).toBeNull();
});

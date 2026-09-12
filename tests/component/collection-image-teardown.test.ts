// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InstalledImageLibrary } from "../../src/content/index.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const mocks = vi.hoisted(() => ({
  images: vi.fn(),
  catalog: vi.fn(),
  screen: vi.fn(),
}));
vi.mock("../../src/content/load-installed-images.ts", () => ({
  loadInstalledImages: mocks.images,
}));
vi.mock("../../src/story/index.ts", () => ({
  loadCollectionCatalog: mocks.catalog,
  loadCollectionScreen: mocks.screen,
}));

import AppShell from "../../src/shell/AppShell.svelte";
import { createShellStore } from "../../src/shell/shell-store.ts";

beforeEach(() => {
  mocks.catalog.mockResolvedValue({ cards: [], rarityByCode: new Map() });
  mocks.screen.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function mount() {
  const store = createShellStore("#/free-play/collection", () => {});
  const close = vi.fn();
  const mounted = render(AppShell, {
    store,
    initialCoreGate: {
      kind: "ready",
      gameplay: installedGameplayFixture(),
      reader: { close } as never,
      generation: 1,
    },
    loaders: {
      duel: () => new Promise(() => {}),
      decks: () => new Promise(() => {}),
      story: () => new Promise(() => {}),
    },
  });
  return { ...mounted, store, close };
}

it.each(["route exit", "unmount"])(
  "disposes stale late collection images once after %s",
  async (exit) => {
    const pending = Promise.withResolvers<InstalledImageLibrary>();
    mocks.images.mockReturnValueOnce(pending.promise);
    const { store, unmount } = mount();
    await waitFor(() => expect(mocks.images).toHaveBeenCalledOnce());
    if (exit === "route exit") {
      store.navigate({ kind: "home" });
      await tick();
    } else unmount();
    const dispose = vi.fn();
    pending.resolve({ cardUrls: new Map(), setUrls: new Map(), dispose });
    await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    expect(document.querySelector('[data-cy="collection-screen"]')).toBeNull();
    cleanup();
    expect(dispose).toHaveBeenCalledOnce();
  },
);

it("ignores a stale collection rejection after route exit", async () => {
  const pending = Promise.withResolvers<InstalledImageLibrary>();
  mocks.images.mockReturnValueOnce(pending.promise);
  const { store } = mount();
  await waitFor(() => expect(mocks.images).toHaveBeenCalledOnce());
  store.navigate({ kind: "free-play-decks" });
  await tick();
  pending.reject(new Error("late image failure"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
  expect(
    document.querySelector('[data-cy="shell-region-decks"]'),
  ).not.toBeNull();
});

it("releases a late image library when a sibling collection read fails", async () => {
  const pending = Promise.withResolvers<InstalledImageLibrary>();
  mocks.images.mockReturnValueOnce(pending.promise);
  mocks.catalog.mockRejectedValueOnce(new Error("catalog failed"));
  mount();
  await waitFor(() => expect(mocks.images).toHaveBeenCalledOnce());
  const dispose = vi.fn();
  pending.resolve({ cardUrls: new Map(), setUrls: new Map(), dispose });
  await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  cleanup();
  expect(dispose).toHaveBeenCalledOnce();
});

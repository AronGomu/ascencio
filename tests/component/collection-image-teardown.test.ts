import type * as StoryMediaAdapter from "../../src/shell/adapters/sqlite-story-media.ts";
import {
  semanticShellFixture,
  disposeSemanticShells,
} from "../fixtures/semantic-shell.ts";
import { resetStorySessionFixture } from "../fixtures/story-session.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const mocks = vi.hoisted(() => ({
  images: vi.fn(),
  catalog: vi.fn(),
  screen: vi.fn(),
}));
vi.mock("../../src/shell/adapters/sqlite-story-media.ts", async (original) => ({
  ...(await original<typeof StoryMediaAdapter>()),
  loadSqliteStoryImageLibrary: mocks.images,
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
afterEach(async () => {
  cleanup();
  await disposeSemanticShells();
  await resetStorySessionFixture();
  vi.resetAllMocks();
});

function mount() {
  const store = createShellStore("#/free-play/collection", () => {});
  const close = vi.fn();
  const mounted = render(AppShell, {
    store,
    ...semanticShellFixture(installedGameplayFixture()),
    loaders: {
      duel: () => new Promise(() => {}),
      decks: () => new Promise(() => {}),
      story: () => new Promise(() => {}),
    },
  });
  return { ...mounted, store, close };
}

it.each(["route exit", "unmount"])(
  "drops stale late collection metadata after %s without aggregate image load",
  async (exit) => {
    const pending = Promise.withResolvers<{
      readonly cards: readonly [];
      readonly rarityByCode: ReadonlyMap<number, "common">;
    }>();
    mocks.catalog.mockReturnValueOnce(pending.promise);
    const { store, unmount } = mount();
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledOnce());
    if (exit === "route exit") {
      store.navigate({ kind: "home" });
      await tick();
    } else unmount();
    pending.resolve({
      cards: [],
      rarityByCode: new Map<number, "common">(),
    });
    await tick();
    expect(document.querySelector('[data-cy="collection-screen"]')).toBeNull();
    expect(mocks.images).not.toHaveBeenCalled();
  },
);

it("ignores a stale collection rejection after route exit without image preload", async () => {
  const pending = Promise.withResolvers<never>();
  mocks.catalog.mockReturnValueOnce(pending.promise);
  const { store } = mount();
  await waitFor(() => expect(mocks.catalog).toHaveBeenCalledOnce());
  store.navigate({ kind: "free-play-decks" });
  await tick();
  pending.reject(new Error("late catalog failure"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
  expect(
    document.querySelector('[data-cy="shell-region-decks"]'),
  ).not.toBeNull();
  expect(mocks.images).not.toHaveBeenCalled();
});

it("does not start aggregate images when a sibling collection read fails", async () => {
  const pending = Promise.withResolvers<unknown>();
  mocks.screen.mockReturnValueOnce(pending.promise);
  mocks.catalog.mockRejectedValueOnce(new Error("catalog failed"));
  mount();
  await waitFor(() => expect(mocks.catalog).toHaveBeenCalledOnce());
  pending.resolve(undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.images).not.toHaveBeenCalled();
});

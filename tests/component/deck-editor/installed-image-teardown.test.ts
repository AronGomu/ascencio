// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import { installedEditorCatalog } from "../../../src/shell/cards/installed-editor-catalog.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const mocks = vi.hoisted(() => ({ repository: vi.fn(), initialize: vi.fn() }));
vi.mock("../../../src/decks/deck-repository-context.ts", () => ({
  resolveDeckRepository: mocks.repository,
}));
vi.mock("../../../src/deck-editor/deck-editor-store.ts", () => ({
  DeckBuilderController: class {
    initialize = mocks.initialize;
  },
}));
import DeckEditorApp from "../../../src/deck-editor/DeckEditorApp.svelte";
import type { resolveDeckRepository } from "../../../src/decks/repository/index.ts";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("required-only editor releases late repository after unmount without reading optional art", async () => {
  const pending =
    Promise.withResolvers<Awaited<ReturnType<typeof resolveDeckRepository>>>();
  mocks.repository.mockReturnValueOnce(pending.promise);
  const images = { acquire: vi.fn() };
  const input = installedEditorCatalog(installedDuelGameplayFixture());
  const { unmount } = render(DeckEditorApp, {
    catalogInput: { ...input, images },
  });
  await waitFor(() => expect(mocks.repository).toHaveBeenCalledOnce());
  unmount();
  const close = vi.fn();
  // No repository method may run after the mounted editor releases ownership.
  pending.resolve({
    repository: {} as never,
    ownership: { ownedCount: () => Infinity, isUnlimited: true },
    close,
  });
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(images.acquire).not.toHaveBeenCalled();
  expect(mocks.initialize).not.toHaveBeenCalled();
});

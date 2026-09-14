// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import type { InstalledImageLibrary } from "../../../src/content/index.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

const mocks = vi.hoisted(() => ({
  images: vi.fn(),
  repository: vi.fn(),
  initialize: vi.fn(),
}));
vi.mock("../../../src/content/load-installed-images.ts", () => ({
  loadInstalledImages: mocks.images,
}));
vi.mock("../../../src/decks/deck-repository-context.ts", () => ({
  resolveDeckRepository: mocks.repository,
}));
vi.mock("../../../src/deck-editor/deck-editor-store.ts", () => ({
  DeckBuilderController: class {
    initialize = mocks.initialize;
  },
}));

import DeckEditorApp from "../../../src/deck-editor/DeckEditorApp.svelte";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("immediately disposes late installed images after unmount without repo/init", async () => {
  const pending = Promise.withResolvers<InstalledImageLibrary>();
  mocks.images.mockReturnValueOnce(pending.promise);
  const { unmount } = render(DeckEditorApp, {
    gameplay: installedDuelGameplayFixture(),
    reader: {} as never,
  });
  await waitFor(() => expect(mocks.images).toHaveBeenCalledOnce());
  unmount();
  const dispose = vi.fn();
  pending.resolve({ cardUrls: new Map(), setUrls: new Map(), dispose });
  await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  expect(mocks.repository).not.toHaveBeenCalled();
  expect(mocks.initialize).not.toHaveBeenCalled();
  cleanup();
  expect(dispose).toHaveBeenCalledOnce();
});

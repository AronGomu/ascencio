// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import * as coreGate from "../../src/shell/core/core-gate.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";
import { createSqliteCardImageSource } from "../../src/shell/adapters/sqlite-image-source.ts";
import {
  semanticShellStartup,
  disposeSemanticShells,
} from "../fixtures/semantic-shell.ts";
import { resetStorySessionFixture } from "../fixtures/story-session.ts";

afterEach(async () => {
  cleanup();
  await disposeSemanticShells();
  await resetStorySessionFixture();
  vi.restoreAllMocks();
});
async function mount() {
  const startup = await semanticShellStartup();
  vi.spyOn(coreGate, "loadCoreStartup").mockResolvedValue(startup);
  const view = render(AppShell, {
    store: createShellStore("#/", () => {}),
    loaders: {
      duel: () => new Promise(() => {}),
      decks: () => new Promise(() => {}),
      story: () => new Promise(() => {}),
    },
  });
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cy="main-menu-free-play"]'),
    ).toHaveProperty("disabled", false),
  );
  const source = createSqliteCardImageSource(
    startup.userPersistence!.storage!.content,
  );
  return { view, source };
}
it("Shell observes package optional-media warnings without fetching fallback art", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const { view, source } = await mount();
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    source.acquire(cardCode(1), "full", aborted.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(
    view.container.querySelector('[data-cy="optional-media-package-warning"]'),
  ).toBeNull();
  expect(
    await source.acquire(cardCode(1), "full", new AbortController().signal),
  ).toBeNull();
  await vi.waitFor(() =>
    expect(
      view.container.querySelector('[data-cy="optional-media-package-warning"]')
        ?.textContent,
    ).toContain(
      "Optional media unavailable: card-library/cards/full/1.jpg (missing).",
    ),
  );
  expect(
    view.container.querySelector('[data-cy="optional-media-package-warning"]')
      ?.textContent,
  ).toContain("You can keep playing.");
  expect(fetch).not.toHaveBeenCalled();
  source.close();
});
it("Shell unsubscribes optional-media status after unmount", async () => {
  const { view, source } = await mount();
  view.unmount();
  await source.acquire(cardCode(1), "full", new AbortController().signal);
  expect(
    document.querySelector('[data-cy="optional-media-package-warning"]'),
  ).toBeNull();
  source.close();
});

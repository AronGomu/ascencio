// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import type { CardImageSource } from "../../src/cards/images/index.ts";
import type { OwnedContentReader } from "../../src/content/index.ts";
import type * as Content from "../../src/content/index.ts";
import type * as InstalledEditorCatalog from "../../src/shell/cards/installed-editor-catalog.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import { createShellStore } from "../../src/shell/shell-store.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";

const { acquireInstalledAsset, installedEditorCatalog } = vi.hoisted(() => ({
  acquireInstalledAsset: vi.fn(),
  installedEditorCatalog: vi.fn(),
}));
vi.mock("../../src/content/index.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof Content>()),
  acquireInstalledAsset,
}));
vi.mock(
  "../../src/shell/cards/installed-editor-catalog.ts",
  async (importOriginal) => {
    const actual = await importOriginal<typeof InstalledEditorCatalog>();
    installedEditorCatalog.mockImplementation(actual.installedEditorCatalog);
    return { ...actual, installedEditorCatalog };
  },
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function renderImageShell() {
  const gameplay = installedGameplayFixture();
  const reader = { close: vi.fn() } as unknown as OwnedContentReader;
  const view = render(AppShell, {
    initialCoreGate: { kind: "ready", gameplay, reader, generation: 1 },
    store: createShellStore("#/decks", () => {}),
    loaders: {
      duel: () => new Promise<never>(() => {}),
      decks: () => new Promise<never>(() => {}),
      story: () => new Promise<never>(() => {}),
    },
  });
  acquireInstalledAsset.mockResolvedValue({
    kind: "failed",
    code: "CONTENT_MISSING",
  });
  const source = await vi.waitFor(() => {
    const images = installedEditorCatalog.mock.calls.find(
      ([, images]) => images != null,
    )?.[1] as CardImageSource | undefined;
    expect(images).toBeDefined();
    return images!;
  });
  return { view, source, code: cardCode(gameplay.cards[0]!.code) };
}

it("Shell observes real image-source failures once per reason and shows one optional-media warning", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fetch = vi.spyOn(globalThis, "fetch");
  const { view, source, code } = await renderImageShell();
  const aborted = new AbortController();
  aborted.abort();
  await expect(source.acquire(code, "full", aborted.signal)).rejects.toEqual(
    new DOMException("The operation was aborted.", "AbortError"),
  );
  expect(warn).not.toHaveBeenCalled();
  expect(view.queryByRole("status")).toBeNull();

  for (const failureCode of [
    "CONTENT_MISSING",
    "CONTENT_MISSING",
    "CONTENT_INTEGRITY_FAILED",
    "CONTENT_STORAGE_UNAVAILABLE",
  ]) {
    acquireInstalledAsset.mockResolvedValueOnce({
      kind: "failed",
      code: failureCode,
      path: "private/path",
      packId: "private-pack",
    });
    await expect(
      source.acquire(code, "full", new AbortController().signal),
    ).resolves.toBeNull();
  }
  acquireInstalledAsset.mockRejectedValueOnce(
    new Error("private read details"),
  );
  await expect(
    source.acquire(code, "full", new AbortController().signal),
  ).resolves.toBeNull();
  await vi.waitFor(() => {
    expect(view.getAllByRole("status")).toHaveLength(1);
    expect(view.getByRole("status").textContent).toContain(
      "Some card images are unavailable. You can keep playing.",
    );
  });
  expect(warn.mock.calls).toEqual(
    ["missing", "corrupt", "unreadable"].map((reason) => [
      { event: "shell.card-images.missing-media", reason },
    ]),
  );
  await fireEvent.click(
    view.getByRole("button", { name: "Dismiss notification" }),
  );
  await expect(
    source.acquire(code, "full", new AbortController().signal),
  ).resolves.toBeNull();
  expect(view.queryByRole("status")).toBeNull();
  expect(warn).toHaveBeenCalledTimes(3);
  expect(fetch).not.toHaveBeenCalled();
});

it("Shell ignores a late missing-media callback after unmount", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { view, source, code } = await renderImageShell();
  const deferred = Promise.withResolvers<unknown>();
  acquireInstalledAsset.mockReturnValueOnce(deferred.promise);
  const pending = source.acquire(code, "full", new AbortController().signal);
  await vi.waitFor(() => expect(acquireInstalledAsset).toHaveBeenCalledOnce());
  view.unmount();
  deferred.resolve({ kind: "failed", code: "CONTENT_MISSING" });
  await expect(pending).resolves.toBeNull();
  expect(warn).not.toHaveBeenCalled();
  expect(document.querySelector('[data-cy="shell-toast-region"]')).toBeNull();
});

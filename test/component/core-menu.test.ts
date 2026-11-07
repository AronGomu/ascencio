// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as coreStartup from "../../src/shell/core/core-gate.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import type { DomainLoaders } from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";
import type { CoreGate } from "../../src/shell/core/core-gate.ts";

const locked: CoreGate = { kind: "locked", reason: "content-required" };

const query = (cy: string): HTMLElement | null =>
  document.querySelector(`[data-cy="${cy}"]`);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("asset-free CORE menu", () => {
  it("disposes a semantic startup delivered after shell unmount", async () => {
    const close = vi.fn();
    let finish!: (startup: coreStartup.CoreStartup) => void;
    vi.spyOn(coreStartup, "loadCoreStartup").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(AppShell, {
      store: createShellStore("#/", () => undefined),
    });
    view.unmount();
    finish({
      gate: { kind: "ready", generation: 1 },
      dispose: async () => close(),
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("requires chapter-01 for New Game, keeps Load and Free Play ready, and retains exact media warnings", async () => {
    let publishStatus!: (status: {
      readonly warnings: readonly {
        readonly packageId: "card-library";
        readonly path: string;
        readonly reason: "missing";
      }[];
    }) => void;
    const unsubscribeStatus = vi.fn();
    const application = {
      acquire: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
      subscribe: () => () => undefined,
    };
    vi.spyOn(coreStartup, "loadCoreStartup").mockResolvedValue({
      gate: { kind: "ready", generation: 4, missing: ["chapter-01"] },
      application: application as never,
      applicationStatus: { warnings: [] },
      subscribeApplicationStatus(listener) {
        publishStatus = listener as typeof publishStatus;
        return unsubscribeStatus;
      },
      dispose: async () => undefined,
    });
    const view = render(AppShell, {
      store: createShellStore("#/", () => undefined),
    });

    await waitFor(() =>
      expect(query("main-menu-free-play")).toHaveProperty("disabled", false),
    );
    for (const cy of ["main-menu-new-game", "main-menu-continue"])
      expect(query(cy)).toHaveProperty("disabled", true);
    expect(query("main-menu-load")).toHaveProperty("disabled", false);
    expect(query("core-gate-status")?.textContent).toContain(
      "New Game requires chapter-01",
    );
    await fireEvent.pointerEnter(query("main-menu-free-play")!);
    await fireEvent.focus(query("main-menu-free-play")!);
    expect(application.acquire).not.toHaveBeenCalled();

    publishStatus({
      warnings: [
        {
          packageId: "card-library",
          path: "cards/full/7.jpg",
          reason: "missing",
        },
      ],
    });
    await waitFor(() =>
      expect(query("optional-media-package-warning")?.textContent).toContain(
        "card-library/cards/full/7.jpg (missing)",
      ),
    );
    application.clear();
    expect(query("optional-media-package-warning")?.textContent).toContain(
      "card-library/cards/full/7.jpg (missing)",
    );
    view.unmount();
    expect(unsubscribeStatus).toHaveBeenCalledOnce();
  });

  it("keeps settings and installer usable while gameplay stays visibly disabled", async () => {
    const hashes: string[] = [];
    const store = createShellStore("#/", (hash) => hashes.push(hash));
    const loaders: DomainLoaders = {
      duel: vi.fn(),
      decks: vi.fn(),
      story: vi.fn(),
    } as unknown as DomainLoaders;
    render(AppShell, {
      store,
      loaders,
      initialCoreGate: locked,
    });

    for (const cy of [
      "main-menu-new-game",
      "main-menu-continue",
      "main-menu-load",
      "main-menu-free-play",
    ])
      expect(query(cy)).toHaveProperty("disabled", true);
    expect(query("core-gate-status")?.textContent).toContain(
      "Content is required",
    );

    await fireEvent.pointerEnter(query("main-menu-free-play")!);
    await fireEvent.focus(query("main-menu-free-play")!);
    expect(loaders.duel).not.toHaveBeenCalled();

    await fireEvent.click(query("main-menu-settings")!);
    expect(query("shell-settings-dialog")).not.toBeNull();
    expect(query("shell-settings-content-status")?.textContent).toContain(
      "Content is required",
    );

    await fireEvent.click(query("shell-settings-close")!);
    await fireEvent.click(query("main-menu-install-content")!);
    expect(hashes).toStrictEqual(["#/install-content"]);
    await waitFor(() => expect(query("install-content-screen")).not.toBeNull());
    expect(query("install-content-unavailable")?.textContent).toContain(
      "Local content controls are unavailable. Reopen from Main Menu.",
    );
    expect(loaders.duel).not.toHaveBeenCalled();
    expect(loaders.decks).not.toHaveBeenCalled();
    expect(loaders.story).not.toHaveBeenCalled();
  });

  it.each(["#/free-play", "#/story", "#/admin", "#/duel/session/direct"])(
    "redirects locked direct route %s before any domain loader",
    async (hash) => {
      const hashes: Array<{ hash: string; replace: boolean }> = [];
      const loaders: DomainLoaders = {
        duel: vi.fn(),
        decks: vi.fn(),
        story: vi.fn(),
      } as unknown as DomainLoaders;
      render(AppShell, {
        store: createShellStore(hash, (next, replace) =>
          hashes.push({ hash: next, replace }),
        ),
        loaders,
        initialCoreGate: locked,
      });
      await tick();

      await waitFor(() =>
        expect(query("install-content-screen")).not.toBeNull(),
      );
      expect(hashes).toContainEqual({
        hash: "#/install-content",
        replace: true,
      });
      expect(loaders.duel).not.toHaveBeenCalled();
      expect(loaders.decks).not.toHaveBeenCalled();
      expect(loaders.story).not.toHaveBeenCalled();
    },
  );
});

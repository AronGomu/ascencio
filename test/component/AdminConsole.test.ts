import type { ShellApplication } from "../../src/shell/core/shell-application.ts";
import { shellGameplayFixture as installedGameplayFixture } from "../fixtures/shell-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeckRecord, DeckRepository } from "../../src/decks/index.ts";
import AdminConsole from "../../src/shell/admin/AdminConsole.svelte";
import {
  ADMIN_STORAGE_TARGETS,
  seedAdminTestDeck,
  type AdminResetResult,
  type AdminStorageTarget,
} from "../../src/shell/admin/admin-actions.ts";
import MainMenuScreen from "../../src/shell/screens/MainMenuScreen.svelte";
import { createShellStore } from "../../src/shell/shell-store.ts";

afterEach(() => {
  cleanup();
});

function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${selector}"]`);
}

/* Only the calls the console makes are implemented; the rest throw so an
   unexpected write shows up as a failure instead of a silent no-op. */
function fakeRepository(created: DeckRecord[]): DeckRepository & {
  close: () => void;
  closed: () => number;
} {
  let closes = 0;
  const unexpected = () => {
    throw new Error("Admin console used an unexpected repository call");
  };
  return {
    create: async (deck: DeckRecord) => {
      created.push(deck);
      return { deck, history: { undo: [], redo: [], nextSequence: 1 } };
    },
    close: () => {
      closes += 1;
    },
    closed: () => closes,
    list: unexpected,
    load: unexpected,
    createAndOpen: unexpected,
    save: unexpected,
    delete: unexpected,
    getLastOpened: unexpected,
    setLastOpened: unexpected,
    clearLastOpened: unexpected,
  } as unknown as DeckRepository & { close: () => void; closed: () => number };
}

function recordReset(
  reset: AdminStorageTarget[],
  target: AdminStorageTarget,
): AdminResetResult {
  reset.push(target);
  return { outcome: "deleted" };
}

function mount(
  options: {
    hashes?: string[];
    created?: DeckRecord[];
    resetTarget?: (target: AdminStorageTarget) => Promise<AdminResetResult>;
    seedDeck?: (signal: AbortSignal) => Promise<void>;
  } = {},
) {
  const created = options.created ?? [];
  const repository = fakeRepository(created);
  const gameplay = installedGameplayFixture();
  const application = {
    acquire: async () => ({
      inputs: {
        presentation: gameplay.presentation,
        editor: gameplay.editor(),
        users: { createDeckRepository: () => repository },
      },
      close: async () => repository.close(),
    }),
  } as unknown as ShellApplication;
  return render(AdminConsole, {
    store: createShellStore("#/admin", (hash) => options.hashes?.push(hash)),
    seedDeck:
      options.seedDeck ??
      ((signal: AbortSignal) =>
        seedAdminTestDeck(
          application,
          signal,
          () => new Date("2026-08-14T00:00:00.000Z"),
        )),
    resetTarget:
      options.resetTarget ?? (async () => ({ outcome: "deleted" }) as const),
  });
}

describe("AdminConsole", () => {
  it("renders the three sections", () => {
    mount();
    expect(query("admin-title")).not.toBeNull();
    for (const section of ["admin-routes", "admin-jumps", "admin-resets"])
      expect(query(section)).not.toBeNull();
  });

  it("renders one button per indexed route and none for admin", () => {
    mount();
    for (const kind of [
      "home",
      "free-play",
      "free-play-decks",
      "free-play-collection",
      "story",
      "story-decks",
      "story-collection",
    ])
      expect(query(`admin-route-${kind}`)).not.toBeNull();
    expect(query("admin-route-admin")).toBeNull();
  });

  it("navigates from a route link", async () => {
    const hashes: string[] = [];
    mount({ hashes });
    await fireEvent.click(query("admin-route-free-play")!);
    expect(hashes).toEqual(["#/free-play"]);
  });

  it("seeds the test deck and then opens the deck editor", async () => {
    const hashes: string[] = [];
    const created: DeckRecord[] = [];
    mount({ hashes, created });
    await fireEvent.click(query("admin-jump-seed-deck")!);
    await vi.waitFor(() =>
      expect(hashes).toEqual(["#/free-play/decks/admin-test-deck"]),
    );
    expect(created).toHaveLength(1);
    expect(created[0]!.id).toBe("admin-test-deck");
    expect(created[0]!.main).toHaveLength(40);
  });

  it("suppresses double clicks; navigation aborts pending seed without late redirect", async () => {
    const hashes: string[] = [];
    const pending = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const seedDeck = vi.fn(async (value: AbortSignal) => {
      signal = value;
      await pending.promise;
    });
    mount({ hashes, seedDeck });
    await fireEvent.click(query("admin-jump-seed-deck")!);
    await fireEvent.click(query("admin-jump-seed-deck")!);
    expect(seedDeck).toHaveBeenCalledTimes(1);
    await fireEvent.click(query("admin-route-home")!);
    expect(signal?.aborted).toBe(true);
    pending.resolve();
    await vi.waitFor(() =>
      expect(
        (query("admin-jump-seed-deck") as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(hashes).toEqual(["#/"]);
  });

  it("aborts pending seed on root unmount", async () => {
    const pending = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const hashes: string[] = [];
    const view = mount({
      hashes,
      seedDeck: async (value) => {
        signal = value;
        await pending.promise;
      },
    });
    await fireEvent.click(query("admin-jump-seed-deck")!);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    pending.resolve();
    await Promise.resolve();
    expect(hashes).toEqual([]);
  });

  it("reports precise readiness failures in existing status", async () => {
    mount({
      seedDeck: async () => {
        throw new Error("APP_CONTENT_REQUIRED:freeplay");
      },
    });
    await fireEvent.click(query("admin-jump-seed-deck")!);
    await vi.waitFor(() =>
      expect(query("admin-status")?.textContent).toBe(
        "Could not seed the test deck: APP_CONTENT_REQUIRED:freeplay",
      ),
    );
  });

  it("opens the installed duel without writing a deck", async () => {
    const hashes: string[] = [];
    const created: DeckRecord[] = [];
    mount({ hashes, created });
    expect(query("admin-jump-installed-duel")?.textContent).toContain(
      "Launch installed duel",
    );
    expect(query("admin-jumps")?.textContent).not.toMatch(/bundled|preset/i);
    await fireEvent.click(query("admin-jump-installed-duel")!);
    expect(hashes).toEqual(["#/free-play"]);
    expect(created).toHaveLength(0);
  });

  it("opens story", async () => {
    const hashes: string[] = [];
    mount({ hashes });
    await fireEvent.click(query("admin-jump-story")!);
    expect(hashes).toEqual(["#/story"]);
  });

  it("renders one reset button per storage target", () => {
    mount();
    for (const entry of ADMIN_STORAGE_TARGETS)
      expect(query(`admin-reset-${entry.id}`)).not.toBeNull();
  });

  it("asks for confirmation before deleting anything", async () => {
    const reset: AdminStorageTarget[] = [];
    mount({ resetTarget: async (target) => recordReset(reset, target) });
    expect(query("admin-reset-decks-confirm")).toBeNull();
    await fireEvent.click(query("admin-reset-decks")!);
    expect(query("admin-reset-decks-confirm")).not.toBeNull();
    expect(reset).toEqual([]);
  });

  it("resets only the confirmed target", async () => {
    const reset: AdminStorageTarget[] = [];
    mount({ resetTarget: async (target) => recordReset(reset, target) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-confirm")!);
    await vi.waitFor(() => expect(reset).toHaveLength(1));
    expect(reset[0]).toEqual(
      ADMIN_STORAGE_TARGETS.find((entry) => entry.id === "decks"),
    );
  });

  it("reports a completed reset as cleared", async () => {
    mount({ resetTarget: async () => ({ outcome: "deleted" }) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-confirm")!);
    await vi.waitFor(() =>
      expect(query("admin-status")!.textContent).toBe(
        "Cleared Free-play deck library.",
      ),
    );
  });

  /* The delete is queued behind the other tab's connection, so the console may
     not claim the store is gone (audit F18). */
  it("reports a blocked reset as still open, not cleared", async () => {
    mount({ resetTarget: async () => ({ outcome: "blocked" }) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-confirm")!);
    await vi.waitFor(() =>
      expect(query("admin-status")!.textContent).toBe(
        "Free-play deck library is still open in another tab, so the delete is queued rather than done. Close the other tab, then reset again.",
      ),
    );
  });

  it("cancels a pending reset without deleting", async () => {
    const reset: AdminStorageTarget[] = [];
    mount({ resetTarget: async (target) => recordReset(reset, target) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-cancel")!);
    expect(query("admin-reset-decks-confirm")).toBeNull();
    expect(reset).toEqual([]);
  });

  it("arms only one reset at a time", async () => {
    mount();
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-preferences")!);
    expect(query("admin-reset-decks-confirm")).toBeNull();
    expect(query("admin-reset-preferences-confirm")).not.toBeNull();
  });
});

describe("admin reachability", () => {
  it("exposes no admin control on the main menu", () => {
    render(MainMenuScreen, {
      store: createShellStore("#/", () => {}),
      coreGate: {
        kind: "ready",
        generation: 1,
      },
    });
    expect(document.querySelector('[data-cy^="admin-"]')).toBeNull();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeckRecord, DeckRepository } from "../../src/decks/index.ts";
import AdminConsole from "../../src/shell/admin/AdminConsole.svelte";
import {
  ADMIN_STORAGE_TARGETS,
  type AdminStorageTarget,
} from "../../src/shell/admin/admin-actions.ts";
import HomeScreen from "../../src/shell/screens/HomeScreen.svelte";
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

function mount(
  options: {
    hashes?: string[];
    created?: DeckRecord[];
    resetTarget?: (target: AdminStorageTarget) => Promise<void>;
  } = {},
) {
  const created = options.created ?? [];
  const repository = fakeRepository(created);
  return render(AdminConsole, {
    store: createShellStore("#/admin", (hash) => options.hashes?.push(hash)),
    openRepository: async () => repository,
    resetTarget: options.resetTarget ?? (async () => {}),
    now: () => new Date("2026-08-14T00:00:00.000Z"),
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
    for (const kind of ["home", "duel", "decks", "story"])
      expect(query(`admin-route-${kind}`)).not.toBeNull();
    expect(query("admin-route-admin")).toBeNull();
  });

  it("navigates from a route link", async () => {
    const hashes: string[] = [];
    mount({ hashes });
    await fireEvent.click(query("admin-route-duel")!);
    expect(hashes).toEqual(["#/duel"]);
  });

  it("seeds the test deck and then opens the deck editor", async () => {
    const hashes: string[] = [];
    const created: DeckRecord[] = [];
    mount({ hashes, created });
    await fireEvent.click(query("admin-jump-seed-deck")!);
    await vi.waitFor(() => expect(hashes).toEqual(["#/decks/admin-test-deck"]));
    expect(created).toHaveLength(1);
    expect(created[0]!.id).toBe("admin-test-deck");
    expect(created[0]!.main).toHaveLength(40);
  });

  it("opens the preset duel without writing a deck", async () => {
    const hashes: string[] = [];
    const created: DeckRecord[] = [];
    mount({ hashes, created });
    await fireEvent.click(query("admin-jump-preset-duel")!);
    expect(hashes).toEqual(["#/duel"]);
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
    mount({ resetTarget: async (target) => void reset.push(target) });
    expect(query("admin-reset-decks-confirm")).toBeNull();
    await fireEvent.click(query("admin-reset-decks")!);
    expect(query("admin-reset-decks-confirm")).not.toBeNull();
    expect(reset).toEqual([]);
  });

  it("resets only the confirmed target", async () => {
    const reset: AdminStorageTarget[] = [];
    mount({ resetTarget: async (target) => void reset.push(target) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-confirm")!);
    await vi.waitFor(() => expect(reset).toHaveLength(1));
    expect(reset[0]).toEqual(
      ADMIN_STORAGE_TARGETS.find((entry) => entry.id === "decks"),
    );
  });

  it("cancels a pending reset without deleting", async () => {
    const reset: AdminStorageTarget[] = [];
    mount({ resetTarget: async (target) => void reset.push(target) });
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-decks-cancel")!);
    expect(query("admin-reset-decks-confirm")).toBeNull();
    expect(reset).toEqual([]);
  });

  it("arms only one reset at a time", async () => {
    mount();
    await fireEvent.click(query("admin-reset-decks")!);
    await fireEvent.click(query("admin-reset-shell-settings")!);
    expect(query("admin-reset-decks-confirm")).toBeNull();
    expect(query("admin-reset-shell-settings-confirm")).not.toBeNull();
  });
});

describe("admin reachability", () => {
  it("exposes no admin control on the home hub", () => {
    render(HomeScreen, { store: createShellStore("#/", () => {}) });
    expect(document.querySelector('[data-cy^="admin-"]')).toBeNull();
  });
});

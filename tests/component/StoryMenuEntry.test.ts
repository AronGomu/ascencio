import {
  semanticShellFixture,
  semanticShellStartup,
  disposeSemanticShells,
} from "../fixtures/semantic-shell.ts";
import {
  storyAppProps,
  createStorySaveRepository,
  resetStorySessionFixture,
} from "../fixtures/story-session.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as coreGate from "../../src/shell/core/core-gate.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import type { DomainLoaders } from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";
import StoryApp from "../../src/story/StoryApp.svelte";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import { installPrototypeActiveCatalog } from "../fixtures/active-catalog.ts";
import { fieldableStoryDeck } from "../fixtures/story-decks.ts";

/* The map is one click from the briefing, which revalidates the save's decks
   against the card database. jsdom has no runtime assets to serve one from. */
installPrototypeActiveCatalog();

/* Mounted through `AppShell` with the real story loader on purpose. The menu
   entry reaches the visual novel as a prop of `<svelte:component>`, which
   `svelte-check` does not prop-check: a story root that never declared the
   prop type-checked green while the three entries did nothing. Only the whole
   path — menu click, shell store, lazy domain load, story mount — can catch
   that, so no test here hands `StoryApp` props by hand. */
const loaders: DomainLoaders = {
  duel: () => new Promise<never>(() => {}),
  decks: () => new Promise<never>(() => {}),
  story: async () => await import("../../src/story/index.ts"),
};

/* Loading the story domain root is a Vite transform of the module graph behind
   it, which the default one-second budget knows nothing about. */
const REAL_IMPORT = { timeout: 15_000 };

let hash = "#/";

function renderShell() {
  const store = createShellStore(hash, (next) => {
    hash = next;
  });
  return render(AppShell, {
    store,
    loaders,
    ...semanticShellFixture(),
  });
}

function cy(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

async function waitForCy(value: string): Promise<HTMLElement> {
  await vi.waitFor(() => {
    const found = cy(value);
    expect(found, `waiting for data-cy="${value}"`).not.toBeNull();
    if (found instanceof HTMLButtonElement) expect(found.disabled).toBe(false);
  }, REAL_IMPORT);
  return cy(value)!;
}

/** A save on the city map, holding the deck and cards a real one carries. */
async function seedMapSave(): Promise<void> {
  const { deck, collection } = fieldableStoryDeck();
  const result = await createStorySaveRepository(globalThis.indexedDB).write(
    "autosave",
    {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      progressExists: true,
      decks: [deck],
      defaultDeckId: deck.id,
      collection,
    },
    null,
  );
  expect(result.kind).toBe("written");
}

beforeEach(async () => {
  hash = "#/";
});

afterEach(async () => {
  cleanup();
  await disposeSemanticShells();
  await resetStorySessionFixture();
});

describe("the main menu's story entries", () => {
  it("keeps quota-refused progress mounted through the production session wrapper and retries", async () => {
    const props = storyAppProps();
    const write = vi
      .spyOn(props.saves, "write")
      .mockResolvedValueOnce({ kind: "failed", reason: "quota" });
    const startup = await semanticShellStartup(undefined, props.saves);
    vi.spyOn(coreGate, "loadCoreStartup").mockResolvedValue(startup);
    const application = startup.application!;
    const clear = vi.spyOn(application, "clear");
    const store = createShellStore("#/story", (next) => {
      hash = next;
    });
    render(AppShell, {
      store,
      loaders,
      application,
      initialCoreGate: null,
    });
    await fireEvent.click(await waitForCy("story-narrative-dialogue"));
    const beat = cy("story-narrative-cursor")!.textContent;
    const mountedStory = cy("story-app");
    const clearedBeforeSave = clear.mock.calls.length;
    await fireEvent.click(await waitForCy("story-narrative-menu"));
    await fireEvent.click(await waitForCy("story-pause-save"));
    await fireEvent.click(await waitForCy("story-save-load-overwrite-confirm"));
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(cy("story-save-load-failure")).not.toBeNull(),
    );
    expect(cy("story-narrative-cursor")!.textContent).toBe(beat);
    expect(cy("story-app")).toBe(mountedStory);
    expect(application.clear).toHaveBeenCalledTimes(clearedBeforeSave);
    expect(cy("application-recovery-message")).toBeNull();
    await fireEvent.click(await waitForCy("story-save-load-retry"));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(cy("story-save-load-failure")).toBeNull());
    const saved = await props.saves.read("manual:1");
    expect(saved.kind).toBe("ready");
    if (saved.kind === "ready")
      expect(saved.envelope.state.narrativeIndex).toBe(1);
    expect(cy("story-narrative-cursor")!.textContent).toBe(beat);
    expect(cy("story-app")).toBe(mountedStory);
  });

  it("disables missing manual slots after hydration and remount; loads exact autosave", async () => {
    await seedMapSave();
    const user = userEvent.setup();
    const view = renderShell();
    await user.click(await waitForCy("main-menu-load"));
    await waitForCy("story-load-screen");
    const manual =
      document.querySelector<HTMLButtonElement>(
        '[data-cy="story-load-slot-manual-load"]',
      ) ??
      document.querySelector<HTMLButtonElement>(
        '[data-cy="story-load-slot-manual-disabled"]',
      );
    expect(manual).toHaveProperty("disabled", true);
    await user.click(await waitForCy("story-load-slot-autosave-load"));
    await waitForCy("story-map-screen");
    await user.click(await waitForCy("story-top-bar-decks"));
    await vi.waitFor(() => expect(hash).toBe("#/story/decks"));
    const saved = await createStorySaveRepository(indexedDB).read("autosave");
    expect(saved.kind).toBe("ready");
    if (saved.kind === "ready") {
      const { deck, collection } = fieldableStoryDeck();
      expect(saved.envelope.state.decks).toEqual([deck]);
      expect(saved.envelope.state.collection).toEqual(collection);
      expect(saved.envelope.state.savedScreen).toBe("map");
    }
    view.unmount();
    hash = "#/";
    renderShell();
    await user.click(await waitForCy("main-menu-load"));
    await waitForCy("story-load-screen");
    expect(
      document.querySelector('[data-cy="story-load-slot-manual-disabled"]'),
    ).toHaveProperty("disabled", true);
  });

  it("keeps direct Story entry fresh even when a saved map exists", async () => {
    await seedMapSave();
    hash = "#/story";
    renderShell();
    await waitForCy("story-narrative-stage");
    expect(cy("story-narrative-cursor")?.textContent).toBe("Beat 1");
    expect(cy("story-map-screen")).toBeNull();
  });

  it("keeps a deleted manual slot disabled after remount", async () => {
    await seedMapSave();
    const saves = createStorySaveRepository(indexedDB);
    const saved = await saves.read("autosave");
    if (saved.kind !== "ready") throw new Error("Expected autosave");
    await saves.write("manual:1", saved.envelope.state, 0);
    const user = userEvent.setup();
    const view = renderShell();
    await user.click(await waitForCy("main-menu-load"));
    await user.click(await waitForCy("story-load-slot-manual-delete"));
    await user.click(await waitForCy("story-load-delete-confirm"));
    await waitForCy("story-load-slot-manual-disabled");
    expect(await saves.read("manual:1")).toEqual({
      kind: "empty",
      slot: "manual:1",
    });
    view.unmount();
    hash = "#/";
    renderShell();
    await user.click(await waitForCy("main-menu-load"));
    expect(await waitForCy("story-load-slot-manual-disabled")).toHaveProperty(
      "disabled",
      true,
    );
    expect(await waitForCy("story-load-slot-autosave-load")).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("disables incompatible slots in the in-session Load overlay", async () => {
    const props = storyAppProps();
    props.saves.read = async (slot) => ({
      kind: "incompatible",
      slot,
      found: 99,
    });
    render(StoryApp, props);
    await waitForCy("story-storage-error");
    await fireEvent.click(await waitForCy("story-narrative-menu"));
    await fireEvent.click(await waitForCy("story-pause-load"));
    expect(await waitForCy("story-load-slot-manual-disabled")).toHaveProperty(
      "disabled",
      true,
    );
    expect(await waitForCy("story-load-slot-autosave-load")).toHaveProperty(
      "disabled",
      true,
    );
    expect(cy("story-narrative-cursor")?.textContent).toBe("Beat 1");
  });

  it("opens New Game on the prologue rather than on the story's own title", async () => {
    await seedMapSave();
    const user = userEvent.setup();
    renderShell();

    await user.click(await waitForCy("main-menu-new-game"));

    await waitForCy("story-narrative-stage");
    expect(hash).toBe("#/story");
    expect(cy("story-title-screen")).toBeNull();
    expect(cy("story-narrative-cursor")?.textContent).toBe("Beat 1");
    expect(cy("story-map-screen")).toBeNull();
  });

  it("resumes Continue on the saved screen, asking nothing a second time", async () => {
    await seedMapSave();
    const user = userEvent.setup();
    renderShell();

    await vi.waitFor(
      () => expect(cy("main-menu-continue")).toHaveProperty("disabled", false),
      REAL_IMPORT,
    );
    await user.click(await waitForCy("main-menu-continue"));

    await waitForCy("story-map-screen");
    expect(cy("story-title-screen")).toBeNull();
  });

  it("opens Load on the story's load screen", async () => {
    await seedMapSave();
    const user = userEvent.setup();
    renderShell();

    await user.click(await waitForCy("main-menu-load"));

    await waitForCy("story-load-screen");
    expect(cy("story-title-screen")).toBeNull();
  });

  /* A mount that starts from a checkpoint is not on the title either. The shell
     drops the intent when the route leaves the story, so this cannot happen
     through it — but a resolution applied and then overwritten by an entry is a
     duel result the player never sees, so the story refuses it on its own. */
  it("never opens an entry over a state handed back from a duel", async () => {
    render(StoryApp, {
      ...storyAppProps(),
      storyEntryIntent: "new",
      resumeState: {
        ...createInitialStoryState(),
        screen: "map",
        savedScreen: "map",
        progressExists: true,
      },
    });

    await waitForCy("story-map-screen");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(cy("story-map-screen")).not.toBeNull();
    expect(cy("story-narrative-stage")).toBeNull();
  });
});

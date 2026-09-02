// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import StoryApp from "../../../src/story/StoryApp.svelte";
import {
  TOAST_CONTEXT_KEY,
  type ToastPublisher,
} from "../../../src/shell/index.ts";
import {
  installPrototypeActiveCatalog,
  resetRuntimeCatalog,
} from "../../fixtures/active-catalog.ts";

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.location.hash = "";
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

/* Sells Dark Magician and nothing else, so a Blue-Eyes in the collection has
   no rarity from the shop data and falls through to the catalog view — the
   case the sell screen holds full views for. */
const SHOP_SETS = {
  version: 1,
  sets: [
    {
      id: "alpha",
      name: "Alpha Set",
      releaseYear: 2002,
      released: true,
      cards: [{ code: 46986414, name: "Dark Magician", rarity: "ultra-rare" }],
    },
  ],
};

/**
 * Answers the shop-data request and refuses every other one.
 *
 * The catalog reads the packaged snapshot over the same `fetch`, so a blanket
 * stub would fail both sources at once and the sell screen would report the
 * shop data rather than the card database. Routing by URL keeps the two
 * failures tellable apart.
 */
function installShopDataOnlyNetwork(): void {
  const cache = {
    match: () => Promise.resolve(undefined),
    put: () => Promise.resolve(undefined),
  };
  vi.stubGlobal("caches", { open: () => Promise.resolve(cache) });
  vi.stubGlobal("fetch", (input: unknown) =>
    String(input).includes("shop-sets")
      ? Promise.resolve(
          new Response(JSON.stringify(SHOP_SETS), {
            headers: { "Content-Type": "application/json" },
          }),
        )
      : Promise.reject(new Error("offline")),
  );
}

function sellState(collection: Record<number, number>) {
  return {
    ...createInitialStoryState(),
    screen: "shop-sell" as const,
    savedScreen: "shop-sell" as const,
    shopReturnScreen: "map" as const,
    collection,
  };
}

describe("StoryApp", () => {
  it("mounts from the story domain straight into the prologue", async () => {
    render(StoryApp);
    await waitFor(() => expect(screen.getByText(/Rain turned/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "New Game" })).toBeNull();
  });

  /* The reviewer harness was the prototype's entry point; the production
     domain has to open on the story itself, with no reviewer surface left
     anywhere in the tree. */
  it("exposes no reviewer launcher or drawer", () => {
    render(StoryApp);
    expect(
      screen.queryByRole("button", { name: "Start full flow" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Jump to screen or state" }),
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Reviewer tools" }),
    ).toBeNull();
  });

  it("starts prologue without a second visual-novel menu", async () => {
    render(StoryApp);
    expect(screen.getByText(/Rain turned/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New Game" })).toBeNull();
  });

  it("map screen shows floating menu gear, narrative does not", async () => {
    const mapState = {
      ...createInitialStoryState(),
      screen: "map" as const,
      savedScreen: "map" as const,
    };
    const { container } = render(StoryApp, { resumeState: mapState });
    // On map: floating gear present with aria-label
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
    expect(
      container.querySelector('[data-cy="story-global-menu"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-global-pause"]'),
    ).toBeNull();
  });

  it("narrative screen hides the floating menu gear", async () => {
    const { container } = render(StoryApp);
    // Story starts in narrative.
    // On narrative: floating gear (story-global-menu) must be absent;
    // narrative bar's own gear (story-narrative-menu) may still be present
    expect(container.querySelector('[data-cy="story-global-menu"]')).toBeNull();
  });

  /* Story styling has to stay inside its own root: the shell mounts duel and
     deck editor in the same document, so a bare `button`/`body` rule would
     repaint them. */
  it("top bar rides narrative, map and shop, not title", async () => {
    // narrative: present
    const { container: narrativeContainer } = render(StoryApp);
    expect(
      narrativeContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
    cleanup();

    // narrative state: present
    const narrativeState = {
      ...createInitialStoryState(),
      screen: "narrative" as const,
      savedScreen: "narrative" as const,
    };
    const { container: narrativeStateContainer } = render(StoryApp, {
      resumeState: narrativeState,
    });
    expect(
      narrativeStateContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
    cleanup();

    // map: present
    const mapState = {
      ...createInitialStoryState(),
      screen: "map" as const,
      savedScreen: "map" as const,
    };
    const { container: mapContainer } = render(StoryApp, {
      resumeState: mapState,
    });
    expect(
      mapContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
    cleanup();

    // shop-greeting: present
    const shopState = {
      ...createInitialStoryState(),
      screen: "shop-greeting" as const,
      savedScreen: "shop-greeting" as const,
    };
    const { container: shopContainer } = render(StoryApp, {
      resumeState: shopState,
    });
    expect(
      shopContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
  });

  /* The top bar is how a player inside a save reaches their decks, and from
     there their collection. `StoryApp` passes no `ondecks`, so what the button
     does is `StoryTopBar`'s own default — asserted here from the story root,
     because the requirement is about the bar the story actually mounts. */
  it("top bar decks button opens the story's own deck builder", async () => {
    const mapState = {
      ...createInitialStoryState(),
      screen: "map" as const,
      savedScreen: "map" as const,
    };
    render(StoryApp, { resumeState: mapState });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Open deck builder" }));

    expect(globalThis.location.hash).toBe("#/story/decks");
  });

  /* Selling is irreversible and priced by rarity, and rarity is only known
     once the shop data has loaded. With no data the screen must offer no
     rows at all rather than rows that would degrade to the commonest
     price. */
  it("offers no sale on the sell screen until the shop data has loaded", async () => {
    const sellState = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      savedScreen: "shop-sell" as const,
      shopReturnScreen: "map" as const,
      collection: { 111: 3 },
    };
    /* The sell screen reads the packaged catalog for card names, which a
       jsdom test has no build to substitute. */
    installPrototypeActiveCatalog();
    const { container } = render(StoryApp, { resumeState: sellState });
    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-sell-error"]') ??
          container.querySelector('[data-cy="story-shop-sell-loading"]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelectorAll('[data-cy^="story-shop-sell-plus-"]'),
    ).toHaveLength(0);
    expect(
      container.querySelector('[data-cy="story-shop-sell-confirm"]'),
    ).toBeNull();
  });

  /* The card database is fetched rather than compiled in, so the shop opens
     before it lands. What it carries has to reach the screen when it does:
     a name for a code no set sells, and the rarity the sell price is read
     from — which for a 3000 ATK monster is secret-rare at 250 DP, not the
     10 DP floor an unresolved card would degrade to. */
  it("names and prices a sell row from the catalog once it resolves", async () => {
    installShopDataOnlyNetwork();
    installPrototypeActiveCatalog();
    const { container } = render(StoryApp, {
      resumeState: sellState({ 89631139: 2 }),
    });

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-sell-name-89631139"]')
          ?.textContent,
      ).toContain("Blue-Eyes White Dragon"),
    );
    expect(
      container.querySelector('[data-cy="story-shop-sell-price-89631139"]')
        ?.textContent,
    ).toContain("250 DP");
    expect(
      container.querySelector('[data-cy="story-shop-sell-owned-89631139"]')
        ?.textContent,
    ).toContain("2");
  });

  /* A catalog that never lands is not a dead shop: it is one screen that
     cannot price what it would sell. That screen says so and offers a
     Retry, and the Retry has to reach the catalog rather than only the shop
     data, which loaded fine here. */
  it("blocks selling behind a retryable error when the catalog fails", async () => {
    installShopDataOnlyNetwork();
    resetRuntimeCatalog();
    const { container } = render(StoryApp, {
      resumeState: sellState({ 89631139: 2 }),
    });

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-sell-error-message"]')
          ?.textContent,
      ).toContain("card database"),
    );
    expect(
      container.querySelectorAll('[data-cy^="story-shop-sell-plus-"]'),
    ).toHaveLength(0);
    expect(
      container.querySelector('[data-cy="story-shop-sell-confirm"]'),
    ).toBeNull();

    installPrototypeActiveCatalog();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(
        container.querySelector('[data-cy="story-shop-sell-price-89631139"]')
          ?.textContent,
      ).toContain("250 DP"),
    );
    expect(
      container.querySelector('[data-cy="story-shop-sell-error"]'),
    ).toBeNull();
  });

  it("renders under a single scoping root element", () => {
    const { container } = render(StoryApp);
    expect(container.querySelector(".story-app")).not.toBeNull();
  });

  /* The save overlay's backing store is the thing that changed, so the proof
     has to outlive the component: a save made by one mount is offered by the
     next one, which only holds if it reached IndexedDB. */
  it("saves through the overlay into a store the next mount reads back", async () => {
    const user = userEvent.setup();
    const show = vi.fn<ToastPublisher["show"]>(() => "toast-test");
    const first = render(StoryApp, {
      context: new Map([[TOAST_CONTEXT_KEY, { show }]]),
    });
    // Story starts in narrative; T1 consolidated Save into gear menu — open gear first
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await user.click(screen.getByRole("button", { name: "Confirm overwrite" }));
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith({
        message: "Game saved.",
        tone: "success",
      }),
    );
    expect(screen.queryByText(/Save complete/)).toBeNull();
    first.unmount();
    cleanup();

    render(StoryApp, { storyEntryIntent: "continue" });
    await waitFor(() => expect(screen.getByText(/Rain turned/)).toBeTruthy());
  });

  /* A slot this build cannot parse must cost the player their progress and
     nothing else — the title screen still has to come up and play. */
  it("degrades a corrupt slot to no save instead of a blank screen", async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STORY_SAVES_DATABASE_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("saves", "readwrite");
    transaction.objectStore("saves").put("not a save", "manual:1");
    await new Promise((resolve) => (transaction.oncomplete = resolve));
    database.close();

    render(StoryApp);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/manual:1/),
    );
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.getByText(/Rain turned/)).toBeTruthy();
  });
});

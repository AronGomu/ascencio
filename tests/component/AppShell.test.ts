// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBattleRequest } from "../../src/battle/battle-contracts.ts";
import {
  findSelectableDeck,
  listSelectableDecks,
  presetSelectableDecks,
} from "../../src/battle/decks/selectable-decks.ts";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import type {
  BattleDeckModule,
  DomainLoaders,
} from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";
import { installPrototypeActiveCatalog } from "../fixtures/active-catalog.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import type {
  StorySaveReadResult,
  StorySlotKey,
} from "../../src/story/saves/story-save-contracts.ts";
import type { StorySaveRepository } from "../../src/story/saves/story-save-repository.ts";

/* The match setup reads the card database before it can offer a deck, and
   jsdom has no runtime assets to serve it. */
installPrototypeActiveCatalog();

/* The domain roots boot a duel worker and IndexedDB, neither of which this
   test needs: it only asserts which region the shell renders. */
const never = () => new Promise<never>(() => {});

/* T17: the free-play match setup is reached before the duel, and it loads the
   battle entry for the decks it offers. `BattleFacade` is deliberately absent —
   `<svelte:component this={undefined}>` renders nothing, so the duel region is
   still asserted without a Worker ever being constructed. */
const duelDeckModule = async () =>
  ({
    DECK_CATALOG,
    DEFAULT_PLAYER_DECK_ID: "mvp-player",
    DEFAULT_OPPONENT_DECK_ID: "shaddoll",
    presetSelectableDecks,
    listSelectableDecks,
    findSelectableDeck,
    parseBattleRequest,
    supportedDuelCardCodes: async () =>
      new Set(PROTOTYPE_CATALOG.map(({ code }) => code)),
  }) as BattleDeckModule as Awaited<ReturnType<DomainLoaders["duel"]>>;

const loaders: DomainLoaders = {
  duel: duelDeckModule,
  decks: never,
  story: never,
};

const SESSION_HANDOFF = "77777777-2222-4333-8444-555555555555";

/* A wait that gates on a real domain root being imported is waiting for a
   Vite transform of the whole module graph behind it, which is work the
   default one-second `vi.waitFor` budget knows nothing about: a warm machine
   resolves the story root in ~0.4s, a loaded one has been measured past 1s
   and failed the assertion for no reason but the clock. The assertions below
   are unchanged; they are only allowed to become true later. */
const REAL_IMPORT = { timeout: 15_000 };

/** A story save store that answers the checkpoint read with exactly `read`,
    so the two session-route branches are decided by this test rather than by
    whatever IndexedDB the environment happens to have. */
function savesAnswering(read: StorySaveReadResult): StorySaveRepository {
  return {
    read: (slot: StorySlotKey) =>
      Promise.resolve(
        slot === "checkpoint:pre-duel" ? read : { kind: "empty", slot },
      ),
    write: () => Promise.resolve({ kind: "failed", reason: "unavailable" }),
    list: () => Promise.resolve([]),
    clear: () => Promise.resolve(),
  };
}

function checkpointFor(handoffId: string): StorySaveReadResult {
  return {
    kind: "ready",
    envelope: {
      schemaVersion: 3,
      slot: "checkpoint:pre-duel",
      revision: 1,
      savedAt: 1,
      state: {
        ...createInitialStoryState(),
        screen: "battle-mock",
        encounterId: "old-arena",
        pendingHandoffId: handoffId,
      },
    },
  };
}

function renderAt(hash: string) {
  return render(AppShell, {
    store: createShellStore(hash, () => {}),
    loaders,
  });
}

/** Opens the match setup the menu's first entry offers. The duel is no longer
    what `#/free-play` renders: T16 put the free-play menu on that route and
    made the match a state of it, and T17 made choosing both decks the first
    half of that state. */
async function openMatchSetup(): Promise<void> {
  const start = document.querySelector<HTMLElement>(
    '[data-cy="free-play-start-match"]',
  );
  if (start === null)
    throw new Error("The free-play menu offers no match to start");
  await fireEvent.click(start);
}

/** The setup screen's own control, once its chunk has landed and the library
    behind it has answered. */
async function matchSetupControl(cy: string): Promise<HTMLButtonElement> {
  return await vi.waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>(
      `[data-cy="${cy}"]`,
    );
    expect(found?.disabled).toBe(false);
    return found!;
  }, REAL_IMPORT);
}

/** Opens the match setup and duels the pair it preselected. */
async function startMatch(): Promise<void> {
  await openMatchSetup();
  await fireEvent.click(await matchSetupControl("free-play-match-start"));
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
  });
}

const defaultViewport = {
  width: window.innerWidth,
  height: window.innerHeight,
};

afterEach(() => {
  cleanup();
  setViewport(defaultViewport.width, defaultViewport.height);
});

describe("AppShell", () => {
  it("mounts the main menu for the home route", () => {
    renderAt("#/");
    expect(
      document.querySelector('[data-cy="shell-region-home"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="main-menu-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
    expect(document.querySelector('[data-cy="shell-region-decks"]')).toBeNull();
  });

  it("mounts the free-play menu for the duel route", async () => {
    renderAt("#/duel");
    expect(
      document.querySelector('[data-cy="shell-region-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();

    await startMatch();

    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="shell-region-free-play"]'),
    ).toBeNull();
  });

  /* The battle domain is the largest chunk the shell can load, so the menu in
     front of it must not be what loads it. The match setup may: the player is
     one click from duelling by then, and the decks it offers come from that
     same entry. */
  it("loads the battle domain only once a match starts", async () => {
    const duel = vi.fn(never);
    render(AppShell, {
      store: createShellStore("#/free-play", () => {}),
      loaders: { ...loaders, duel },
    });

    expect(duel).not.toHaveBeenCalled();

    await openMatchSetup();

    await vi.waitFor(() => expect(duel).toHaveBeenCalled(), REAL_IMPORT);
  });

  /* The setup screen stands between the menu and the duel, and the duel still
     mounts in the shell's own duel region and nowhere else: `stage-frame.ts`
     maps every viewport coordinate through `shell-region-duel`. */
  it("chooses both decks before the duel region appears", async () => {
    renderAt("#/free-play");

    await openMatchSetup();

    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
    const seats = await vi.waitFor(() => {
      const found = document.querySelectorAll<HTMLSelectElement>(
        '[data-cy="free-play-match-player-picker"], [data-cy="free-play-match-opponent-picker"]',
      );
      expect(found).toHaveLength(2);
      expect(found[0]!.value).not.toBe("");
      return found;
    }, REAL_IMPORT);
    expect([...seats].map((seat) => seat.value)).toEqual([
      "preset:mvp-player",
      "preset:shaddoll",
    ]);

    await fireEvent.click(
      document.querySelector<HTMLElement>('[data-cy="free-play-match-start"]')!,
    );

    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBeNull();
  });

  /* Back is not Leave: it is the way out of the setup screen itself, and it
     lands on the menu without having started anything. */
  it("returns to the free-play menu from the setup screen", async () => {
    renderAt("#/free-play");
    await openMatchSetup();

    await fireEvent.click(await matchSetupControl("free-play-match-back"));

    expect(
      document.querySelector('[data-cy="shell-region-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("returns to the free-play menu when the match is left", async () => {
    renderAt("#/free-play");
    await startMatch();

    await fireEvent.click(
      document.querySelector<HTMLElement>('[data-cy="free-play-leave-match"]')!,
    );

    expect(
      document.querySelector('[data-cy="shell-region-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  /* The match is a state of the menu rather than a route, so a route change is
     what ends it: coming back opens on the menu rather than on a duel nobody
     asked to resume. */
  it("ends the match when the route leaves free play", async () => {
    const store = createShellStore("#/free-play", () => {});
    render(AppShell, { store, loaders });
    await startMatch();

    store.syncFromHash("#/");
    await Promise.resolve();
    store.syncFromHash("#/free-play");
    await Promise.resolve();

    expect(
      document.querySelector('[data-cy="shell-region-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  /* A story session owns its own exit, so the shell paints no way out over it:
     leaving it is the story's business, not a control the duel region adds. */
  it("paints no leave control over a story session's duel", () => {
    renderAt(`#/duel/session/${SESSION_HANDOFF}`);
    expect(
      document.querySelector('[data-cy="free-play-leave-match"]'),
    ).toBeNull();
  });

  /* Nothing of the duel mounts until the checkpoint behind the session route
     has been found, so a route nobody can resume never becomes half a duel. */
  it("marks the duel-session route as pending while its checkpoint is read", () => {
    renderAt("#/duel/session/opening-duel");
    const region = document.querySelector('[data-cy="shell-region-duel"]');
    expect(region).not.toBeNull();
    expect(
      region?.querySelector('[data-cy="battle-session-pending"]'),
    ).not.toBeNull();
  });

  it("mounts the duel once the session's checkpoint is restored", async () => {
    render(AppShell, {
      store: createShellStore(`#/duel/session/${SESSION_HANDOFF}`, () => {}),
      loaders: {
        ...loaders,
        duel: async () => await import("../../src/battle/index.ts"),
      },
      saves: savesAnswering(checkpointFor(SESSION_HANDOFF)),
    });

    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="battle-session-pending"]'),
        ).toBeNull(),
      REAL_IMPORT,
    );
    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
  });

  it.each([
    ["another handoff", checkpointFor("11111111-2222-4333-8444-555555555555")],
    [
      "no checkpoint",
      { kind: "empty", slot: "checkpoint:pre-duel" } as StorySaveReadResult,
    ],
    [
      "a corrupt checkpoint",
      {
        kind: "corrupt",
        slot: "checkpoint:pre-duel",
        reason: "not an envelope",
      } as StorySaveReadResult,
    ],
  ])("sends a session route with %s back to the story", async (_name, read) => {
    let hash = `#/duel/session/${SESSION_HANDOFF}`;
    render(AppShell, {
      store: createShellStore(hash, (next) => {
        hash = next;
      }),
      loaders,
      saves: savesAnswering(read),
    });

    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="shell-region-story"]'),
      ).not.toBeNull(),
    );
    expect(hash).toBe("#/story");
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("leaves the plain duel route unmarked", async () => {
    renderAt("#/duel");
    await startMatch();
    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="battle-session-pending"]'),
    ).toBeNull();
  });

  it("mounts the deck editor region for the decks route", () => {
    renderAt("#/decks");
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("mounts the story region for the story route", () => {
    renderAt("#/story");
    expect(
      document.querySelector('[data-cy="shell-region-story"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-placeholder"]')).toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("loads the real story domain root through its public entry", async () => {
    render(AppShell, {
      store: createShellStore("#/story", () => {}),
      loaders: {
        ...loaders,
        story: async () => await import("../../src/story/index.ts"),
      },
    });
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="shell-region-story"] .story-app'),
        ).not.toBeNull(),
      REAL_IMPORT,
    );
  });

  it("mounts the admin console region for the admin route", async () => {
    renderAt("#/admin");
    expect(
      document.querySelector('[data-cy="shell-region-admin"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-placeholder"]')).toBeNull();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="admin-title"]'),
        ).not.toBeNull(),
      REAL_IMPORT,
    );
  });

  /* A domain whose chunk never arrives — a stale dev server missing a build
     constant, a half-cached build, an offline reload — used to render nothing
     at all, so the entry buttons looked like routes that lead to an empty
     page. The region must say what failed and offer a way out instead. */
  it.each([
    ["duel", "#/duel", "decks" as const],
    ["decks", "#/decks", "duel" as const],
    ["story", "#/story", "duel" as const],
  ])(
    "reports a %s domain whose chunk fails to load",
    async (domain, hash, other) => {
      const failing = () =>
        Promise.reject(new Error("__ACTIVE_CARD_DATA__ is not defined"));
      render(AppShell, {
        store: createShellStore(hash, () => {}),
        loaders: {
          ...loaders,
          [domain]: failing,
        } as unknown as DomainLoaders,
      });
      /* A battle chunk that never arrives fails the match setup now, one
         screen before the duel region it used to fail in. It is still the duel
         domain failing, so it is still reported as one. */
      if (domain === "duel") await openMatchSetup();

      const error = await vi.waitFor(() => {
        const found = document.querySelector(
          `[data-cy="shell-domain-error-${domain}"]`,
        );
        expect(found).not.toBeNull();
        return found!;
      });
      expect(error.textContent).toContain("__ACTIVE_CARD_DATA__");
      expect(
        error.querySelector(`[data-cy="shell-domain-error-retry-${domain}"]`),
      ).not.toBeNull();
      expect(
        error.querySelector<HTMLAnchorElement>(
          `[data-cy="shell-domain-error-home-${domain}"]`,
        )?.hash,
      ).toBe("#/");
      expect(
        document.querySelector(`[data-cy="shell-domain-error-${other}"]`),
      ).toBeNull();
    },
  );

  it("publishes the stage mode on the stage element", () => {
    setViewport(800, 1000);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  /* T15: the quarter turn itself is a media query in `src/styles/app.css`, and
     applies to the duel region rather than the whole stage — the deck editor,
     story and home hub share this stage and read upright in portrait. What the
     shell publishes here is the mode: `src/battle/app/presentation/stage-frame.ts`
     still reads the live transform before mapping a single coordinate. */
  it("marks a portrait phone's stage as rotated", () => {
    setViewport(400, 900);
    renderAt("#/duel");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-rotated")).toBe("true");
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  it("leaves desktop and small-landscape stages unrotated", () => {
    setViewport(900, 400);
    renderAt("#/duel");
    expect(
      document
        .querySelector('[data-cy="app-stage"]')
        ?.getAttribute("data-stage-rotated"),
    ).toBeNull();
    cleanup();
    setViewport(1600, 900);
    renderAt("#/duel");
    expect(
      document
        .querySelector('[data-cy="app-stage"]')
        ?.getAttribute("data-stage-rotated"),
    ).toBeNull();
  });

  /* The rotation must not reorder anything: it is a transform on one box, so
     the duel's controls keep the DOM order — and therefore the tab order —
     they have in landscape. */
  it("renders the same duel region markup rotated and unrotated", async () => {
    setViewport(900, 400);
    renderAt("#/duel");
    await startMatch();
    const landscape = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    expect(landscape).toBeDefined();
    cleanup();
    setViewport(400, 900);
    renderAt("#/duel");
    await startMatch();
    const portrait = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    expect(portrait).toBe(landscape);
  });

  it("letterboxes a desktop viewport into a 16:9 stage", () => {
    setViewport(1920, 1200);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("stage");
  });

  /* The pixel box belongs to `.app-stage` in CSS so it is applied by the same
     layout pass as the viewport change. Re-publishing it inline from here
     would win over the stylesheet and reintroduce a box that trails the
     viewport by at least a frame; the numbers stay covered by
     `tests/unit/stage-layout.test.ts` and `tests/unit/global-styles.test.ts`. */
  it("leaves the stage pixel box to the stylesheet", () => {
    setViewport(1920, 1200);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("style")).toBeNull();
  });

  it("follows store navigation without a remount", async () => {
    const store = createShellStore("#/", () => {});
    render(AppShell, { store, loaders });
    store.syncFromHash("#/decks");
    await Promise.resolve();
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
  });
});

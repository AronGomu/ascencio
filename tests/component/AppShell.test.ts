import * as coreGateModule from "../../src/shell/core/core-gate.ts";
import { get } from "svelte/store";
import { installedGameplayFixture as rawGameplayFixture } from "../fixtures/installed-gameplay.ts";
import { installedDuelGameplayFixture } from "../fixtures/installed-duel-gameplay.ts";
import {
  semanticShellStartup,
  disposeSemanticShells,
} from "../fixtures/semantic-shell.ts";
import * as handoffModule from "../../src/shell/handoff/handoff-coordinator.ts";
import { rmSync } from "node:fs";
import { createUserDataFixture } from "../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../unit/storage/runtime-fixtures.ts";
import { UserDataRuntime } from "../../src/storage/runtime/user-data-runtime.ts";
import { createSqliteStoryRepository } from "../../src/story/saves/sqlite-story-repository.ts";
import type {
  FreeplaySession,
  ShellApplication,
  StorySession,
} from "../../src/shell/core/shell-application.ts";
import {
  storyShellProps,
  resetStorySessionFixture,
} from "../fixtures/story-session.ts";
import { storyBindingFixture } from "../fixtures/story-release.ts";
import { shellGameplayFixture as installedGameplayFixture } from "../fixtures/shell-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import BattleFacadeProbe from "../fixtures/BattleFacadeProbe.svelte";
import DeckEditorProbe from "../fixtures/DeckEditorProbe.svelte";
import {
  battleFacadeProps,
  resetBattleFacadeProps,
} from "../fixtures/battle-facade-probe.ts";
import { parseBattleRequest } from "../../src/battle/battle-contracts.ts";
import { deckId } from "../../src/decks/index.ts";
import { installedSelectableDecks } from "../../src/battle/decks/installed-selectable-decks.ts";
import {
  findSelectableDeck,
  listSelectableDecks,
  presetSelectableDecks,
} from "../../src/battle/decks/selectable-decks.ts";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import type {
  BattleDeckModule,
  DomainLoaders,
} from "../../src/shell/domain-loaders.ts";
import { resetFreePlayDeckCacheForTests } from "../../src/shell/screens/free-play-deck-listing.ts";
import {
  createShellStore,
  type ShellStore,
} from "../../src/shell/shell-store.ts";
import type { CoreGate } from "../../src/shell/core/core-gate.ts";
import { installPrototypeActiveCatalog } from "../fixtures/active-catalog.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import type {
  StorySaveReadResult,
  StorySlotKey,
} from "../../src/story/saves/generation-contracts.ts";
import type { GenerationSaveRepository as StorySaveRepository } from "../../src/story/saves/index.ts";
import { unavailableUserServicesForTests } from "../../src/shell/core/unavailable-user-services.ts";

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
    DEFAULT_PLAYER_DECK_ID: "chapter-one-starter",
    DEFAULT_OPPONENT_DECK_ID: "chapter-one-practice",
    presetSelectableDecks,
    listSelectableDecks,
    findSelectableDeck,
    parseBattleRequest,
    installedSelectableDecks,
  }) as BattleDeckModule as Awaited<ReturnType<DomainLoaders["duel"]>>;

const loaders: DomainLoaders = {
  duel: duelDeckModule,
  decks: never,
  story: never,
};

const SESSION_HANDOFF = "77777777-2222-4333-8444-555555555555";
const READY_CORE_GATE: CoreGate = {
  kind: "ready",
  generation: 1,
};

function storySession(
  options: {
    readonly close?: () => Promise<void>;
    readonly saves?: StorySaveRepository;
    readonly gameplay?: ReturnType<typeof installedGameplayFixture>;
  } = {},
): StorySession {
  const props = storyShellProps();
  return {
    kind: "story",
    generation: 1,
    inputs: {
      users: unavailableUserServicesForTests(),
      gameplay: options.gameplay ?? installedGameplayFixture(),
      cards: props.storyCards,
      release: props.storyRelease,
      media: {
        acquireMap: async () => null,
        acquireSetImage: async () => null,
      },
      saves: options.saves ?? props.saves,
    },
    close: options.close ?? (async () => undefined),
  };
}

function freeplaySession(close: () => Promise<void>): FreeplaySession {
  const gameplay = installedGameplayFixture();
  return {
    kind: "freeplay",
    generation: 1,
    inputs: {
      users: {} as FreeplaySession["inputs"]["users"],
      cards: gameplay.cards,
      collectionSets: gameplay.sets,
      images: { acquire: async () => null },
      battle: gameplay.battle,
      presentation: gameplay.presentation,
      editor: gameplay.editor(),
    },
    close,
  };
}

function sqliteApplication(
  acquireFreeplay: (signal: AbortSignal) => Promise<FreeplaySession>,
  acquireStory: (signal: AbortSignal) => Promise<StorySession> = () =>
    Promise.reject(new Error("APP_REQUIRED_INPUT_FAILED")),
): ShellApplication & {
  readonly acquire: ReturnType<typeof vi.fn>;
  readonly clear: ReturnType<typeof vi.fn>;
} {
  const acquire = vi.fn((mode: "freeplay" | "story", signal: AbortSignal) =>
    mode === "story" ? acquireStory(signal) : acquireFreeplay(signal),
  );
  return {
    acquire: acquire as unknown as ShellApplication["acquire"],
    clear: vi.fn(),
    close: vi.fn(),
    subscribe: () => () => undefined,
  } as unknown as ShellApplication & {
    readonly acquire: ReturnType<typeof vi.fn>;
    readonly clear: ReturnType<typeof vi.fn>;
  };
}

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

/** A store holding one manual save, for the routes that read what a save owns
    rather than what a duel checkpointed. */
function savesHolding(
  collection: Readonly<Record<number, number>>,
): StorySaveRepository {
  return {
    read: (slot: StorySlotKey) =>
      Promise.resolve(
        slot === "manual:1"
          ? {
              kind: "ready",
              envelope: {
                schemaVersion: 6,
                story: storyBindingFixture(),
                slot,
                revision: 1,
                savedAt: 1,
                state: { ...createInitialStoryState(), collection },
              },
            }
          : { kind: "empty", slot },
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
      schemaVersion: 6,
      story: storyBindingFixture(),
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

/* The same module the duel region loads, with a probe in `BattleFacade`'s
   place: the shell's own props are then readable without a Worker. */
const probeLoaders: DomainLoaders = {
  ...loaders,
  duel: async () =>
    ({
      ...(await duelDeckModule()),
      BattleFacade: BattleFacadeProbe,
    }) as Awaited<ReturnType<DomainLoaders["duel"]>>,
};

const deckProbeLoaders: DomainLoaders = {
  ...loaders,
  decks: async () => ({ default: DeckEditorProbe }),
};

async function renderShell(props: {
  readonly store: ShellStore;
  readonly loaders: DomainLoaders;
  readonly saves?: StorySaveRepository;
}) {
  const gameplay = rawGameplayFixture();
  const startup = await semanticShellStartup(
    {
      ...gameplay,
      cards: [...gameplay.cards, ...installedDuelGameplayFixture().cards],
    },
    props.saves,
  );
  const acquire = vi.spyOn(startup.application!, "acquire");
  const boot = vi
    .spyOn(coreGateModule, "loadCoreStartup")
    .mockResolvedValue(startup);
  const view = render(AppShell, { ...props });
  await vi.waitFor(() => expect(boot).toHaveBeenCalled(), REAL_IMPORT);
  await tick();
  if (
    !["home", "admin", "install-content"].includes(get(props.store).route.kind)
  ) {
    await vi.waitFor(() => expect(acquire).toHaveBeenCalled(), REAL_IMPORT);
    await Promise.all(acquire.mock.results.map((result) => result.value));
    await tick();
  }
  return view;
}

async function renderAt(hash: string, domainLoaders: DomainLoaders = loaders) {
  return renderShell({
    store: createShellStore(hash, () => {}),
    loaders: domainLoaders,
  });
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

/** Duels the pair the setup screen preselected. `#/free-play` opens on that
    screen, so there is nothing to click first (ADR-054). */
async function startMatch(): Promise<void> {
  await fireEvent.click(await matchSetupControl("deck-select-start"));
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

afterEach(async () => {
  cleanup();
  await disposeSemanticShells();
  await resetStorySessionFixture();
  resetBattleFacadeProps();
  /* The listing is held for the life of the page, so one test's library would
     otherwise be the next one's first paint. */
  resetFreePlayDeckCacheForTests();
  setViewport(defaultViewport.width, defaultViewport.height);
});

describe("AppShell", async () => {
  it("mounts the main menu for the home route", async () => {
    await renderAt("#/");
    expect(
      document.querySelector('[data-cy="shell-region-home"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="main-menu-free-play"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
    expect(document.querySelector('[data-cy="shell-region-decks"]')).toBeNull();
  });

  it("mounts the match setup for the duel route", async () => {
    await renderAt("#/duel");
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();

    await startMatch();

    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBeNull();
  });

  /* The battle domain is the largest chunk the shell can load, so the main
     menu must not be what loads it. Free play may: the player is two clicks
     from duelling by then, and the decks its seats offer come from that same
     entry. */
  it("loads the battle domain once when free play is opened", async () => {
    const duel = vi.fn(never);
    const store = createShellStore("#/", () => {});
    await renderShell({ store, loaders: { ...loaders, duel } });

    expect(duel).not.toHaveBeenCalled();

    store.navigate({ kind: "free-play" });

    await vi.waitFor(() => expect(duel).toHaveBeenCalledOnce(), REAL_IMPORT);
    window.dispatchEvent(new Event("resize"));
    await tick();
    expect(duel).toHaveBeenCalledOnce();
  });

  /* The duel still mounts in the shell's own duel region and nowhere else:
     `stage-frame.ts` maps every viewport coordinate through
     `shell-region-duel`. */
  it("chooses both decks before the duel region appears", async () => {
    await renderAt("#/free-play");

    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
    /* Player-first seat chips name both decks without cloning their grid tiles. */
    const seats = await vi.waitFor(() => {
      const found = document.querySelectorAll<HTMLElement>(
        '[data-cy="duel-start-your-deck-name"], [data-cy="duel-start-opponent-deck-name"]',
      );
      expect(found).toHaveLength(2);
      return found;
    }, REAL_IMPORT);
    expect([...seats].map((chip) => chip.textContent)).toEqual([
      "Installed Starter",
      "Installed Starter",
    ]);

    await fireEvent.click(
      document.querySelector<HTMLElement>('[data-cy="deck-select-start"]')!,
    );

    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBeNull();
  });

  /* Back is not Leave: it is the way out of free play itself, and it lands on
     the main menu without having started anything. */
  it("returns to the main menu from the setup screen", async () => {
    const hashes: string[] = [];
    await renderShell({
      store: createShellStore("#/free-play", (hash) => hashes.push(hash)),
      loaders,
    });

    await fireEvent.click(await matchSetupControl("deck-select-back"));

    expect(hashes).toEqual(["#/"]);
    expect(
      document.querySelector('[data-cy="shell-region-home"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  /* The library the seats are filled from is one click away from the seats
     themselves, and it is the shell that owns that route. */
  it("opens the free-play deck library from the selection screen", async () => {
    const hashes: string[] = [];
    await renderShell({
      store: createShellStore("#/free-play", (hash) => hashes.push(hash)),
      loaders,
    });

    await fireEvent.click(await matchSetupControl("deck-select-create"));

    expect(hashes).toEqual(["#/free-play/decks"]);
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
  });

  /* The way out of a free-play match now lives in the duel's own menu, so the
     shell's half of it is the callback it hands the duel. Calling that callback
     is what the menu button does, and it ends the match. */
  it("returns to the seats when the duel calls the exit the shell handed it", async () => {
    await renderAt("#/free-play", probeLoaders);
    await startMatch();

    const leave = battleFacadeProps.current?.onleavematch;
    expect(leave).toBeTypeOf("function");
    leave?.();
    await tick();

    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  /* The match is a state of the route rather than a route of its own, so a
     route change is what ends it: coming back opens on the seats rather than
     on a duel nobody asked to resume. */
  it("ends the match when the route leaves free play", async () => {
    const store = createShellStore("#/free-play", () => {});
    await renderShell({ store, loaders });
    await startMatch();

    store.syncFromHash("#/");
    await Promise.resolve();
    store.syncFromHash("#/free-play");
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="shell-region-free-play-setup"]'),
        ).not.toBeNull(),
      REAL_IMPORT,
    );

    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  /* A story session owns its own exit, so the shell offers the duel none:
     leaving it is the story's business, not an item the duel menu adds. */
  it("hands a story session's duel no exit of its own", async () => {
    await renderShell({
      store: createShellStore(`#/duel/session/${SESSION_HANDOFF}`, () => {}),
      loaders: probeLoaders,
      saves: savesAnswering(checkpointFor(SESSION_HANDOFF)),
    });
    await vi.waitFor(
      () => expect(battleFacadeProps.current).not.toBeNull(),
      REAL_IMPORT,
    );
    expect(battleFacadeProps.current?.onleavematch).toBeNull();
  });

  /* Nothing of the duel mounts until the checkpoint behind the session route
     has been found, so a route nobody can resume never becomes half a duel. */
  it("marks the duel-session route as pending while its checkpoint is read", async () => {
    await renderShell({
      store: createShellStore("#/duel/session/opening-duel", () => {}),
      loaders,
      saves: {
        ...savesAnswering({ kind: "empty", slot: "checkpoint:pre-duel" }),
        read: () => new Promise(() => {}),
      },
    });
    const region = document.querySelector('[data-cy="shell-region-duel"]');
    expect(region).not.toBeNull();
    expect(
      region?.querySelector('[data-cy="battle-session-pending"]'),
    ).not.toBeNull();
  });

  it("mounts the duel once the session's checkpoint is restored", async () => {
    await renderShell({
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
          document.querySelector('[data-cy="shell-region-duel"]'),
        ).not.toBeNull(),
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
    await renderShell({
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
    await renderAt("#/duel");
    await startMatch();
    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="battle-session-pending"]'),
    ).toBeNull();
  });

  it("mounts the deck editor region for the decks route", async () => {
    await renderAt("#/decks");
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("returns an editor entered from story to that exact origin", async () => {
    const hashes: string[] = [];
    const store = createShellStore("#/story", (hash) => hashes.push(hash));
    await renderShell({
      store,
      loaders: deckProbeLoaders,
      saves: savesHolding({}),
    });

    store.navigate({ kind: "story-deck", deckId: deckId("story-deck") });
    const button = await vi.waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>(
        '[data-cy="deck-editor-probe-return"]',
      );
      expect(found?.textContent).toContain("Return to Story");
      return found!;
    }, REAL_IMPORT);
    hashes.length = 0;
    await fireEvent.click(button);

    expect(hashes).toEqual(["#/story"]);
  });

  it.each([
    ["free-play", "#/free-play/decks/direct", "#/free-play/decks"],
    ["story", "#/story/decks/direct", "#/story/decks"],
  ])(
    "returns a direct %s editor route to its scoped deck selection",
    async (_context, hash, expected) => {
      const hashes: string[] = [];
      await renderShell({
        store: createShellStore(hash, (next) => hashes.push(next)),
        loaders: deckProbeLoaders,
        saves: savesHolding({}),
      });

      const button = await vi.waitFor(() => {
        const found = document.querySelector<HTMLButtonElement>(
          '[data-cy="deck-editor-probe-return"]',
        );
        expect(found?.textContent).toContain("Return to Deck Selection");
        return found!;
      }, REAL_IMPORT);
      await fireEvent.click(button);

      expect(hashes).toEqual([expected]);
    },
  );

  it("mounts the story region for the story route", async () => {
    await renderAt("#/story");
    expect(
      document.querySelector('[data-cy="shell-region-story"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-placeholder"]')).toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("loads the real story domain root through its public entry", async () => {
    await renderShell({
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

  /* Free play owns every printed card, so its collection route needs no save:
     the region is the whole database, browsed through the story's own screen
     because rarity is resolved there. */
  it("mounts the collection region for the free-play collection route", async () => {
    await renderAt("#/free-play/collection");
    expect(
      document.querySelector('[data-cy="shell-region-collection"]'),
    ).not.toBeNull();
    await vi.waitFor(
      () =>
        expect(
          document.querySelector(
            '[data-cy="shell-region-collection"] [data-cy="collection-screen"]',
          ),
        ).not.toBeNull(),
      REAL_IMPORT,
    );
    expect(document.querySelector('[data-cy="shell-region-home"]')).toBeNull();
  });

  /* The loaded save decides what the story collection lists: its own cards, at
     the counts it records, and nothing else in the database. */
  it("lists the loaded save's own cards with their counts", async () => {
    const installedCard = 1;
    await renderShell({
      store: createShellStore("#/story/collection", () => {}),
      loaders,
      saves: savesHolding({ [installedCard]: 3 }),
    });
    const count = await vi.waitFor(() => {
      const found = document.querySelector(
        `[data-cy="collection-count-${installedCard}"]`,
      );
      expect(found).not.toBeNull();
      return found!;
    }, REAL_IMPORT);
    expect(count.textContent).toBe("3");
    expect(
      document.querySelectorAll('[data-cy^="collection-card-"]'),
    ).toHaveLength(1);
    /* Everything else the database holds is behind the checkbox, which starts
       unticked. */
    expect(
      document.querySelector<HTMLInputElement>(
        '[data-cy="collection-show-all"]',
      )?.checked,
    ).toBe(false);
  });

  /* A collection belongs to one save, so a story collection route reached with
     none loaded has nothing to browse. ADR-051 sends it back to the main menu
     rather than opening an empty one, exactly as the story deck routes do. */
  it("sends the story collection route home when no save is loaded", async () => {
    await renderShell({
      store: createShellStore("#/story/collection", () => {}),
      loaders,
      saves: savesAnswering({ kind: "empty", slot: "checkpoint:pre-duel" }),
    });
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="shell-region-home"]'),
        ).not.toBeNull(),
      REAL_IMPORT,
    );
    expect(document.querySelector('[data-cy="collection-screen"]')).toBeNull();
  });

  it("mounts the admin console region for the admin route", async () => {
    await renderAt("#/admin");
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
      await renderShell({
        store: createShellStore(hash, () => {}),
        loaders: {
          ...loaders,
          [domain]: failing,
        } as unknown as DomainLoaders,
      });
      await vi.waitFor(
        () =>
          expect(
            document.querySelector('[data-cy="shell-region-home"]'),
          ).not.toBeNull(),
        REAL_IMPORT,
      );
      expect(document.body.textContent).toContain(
        "This session stopped because its required data became unavailable.",
      );
      await vi.waitFor(
        () =>
          expect(
            document.querySelector('[data-cy="main-menu-free-play"]'),
          ).toHaveProperty("disabled", true),
        REAL_IMPORT,
      );
      expect(
        document.querySelector(`[data-cy="shell-domain-error-${other}"]`),
      ).toBeNull();
    },
  );

  it("publishes the stage mode on the stage element", async () => {
    setViewport(800, 1000);
    await renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  /* T15: the quarter turn itself is a media query in `src/styles/app.css`, and
     applies to the duel region rather than the whole stage — the deck editor,
     story and home hub share this stage and read upright in portrait. What the
     shell publishes here is the mode: `src/shared-svelte-ui/geometry/stage-frame.ts`
     still reads the live transform before mapping a single coordinate. */
  it("marks a portrait phone's stage as rotated", async () => {
    setViewport(400, 900);
    await renderAt("#/duel");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-rotated")).toBe("true");
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  it("leaves desktop and small-landscape stages unrotated", async () => {
    setViewport(900, 400);
    await renderAt("#/duel");
    expect(
      document
        .querySelector('[data-cy="app-stage"]')
        ?.getAttribute("data-stage-rotated"),
    ).toBeNull();
    cleanup();
    setViewport(1600, 900);
    await renderAt("#/duel");
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
    await renderAt("#/duel");
    await startMatch();
    const landscape = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    expect(landscape).toBeDefined();
    cleanup();
    setViewport(400, 900);
    await renderAt("#/duel");
    await startMatch();
    const portrait = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    expect(portrait).toBe(landscape);
  });

  it("letterboxes a desktop viewport into a 16:9 stage", async () => {
    setViewport(1920, 1200);
    await renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("stage");
  });

  /* The pixel box belongs to `.app-stage` in CSS so it is applied by the same
     layout pass as the viewport change. Re-publishing it inline from here
     would win over the stylesheet and reintroduce a box that trails the
     viewport by at least a frame; the numbers stay covered by
     `tests/unit/stage-layout.test.ts` and `tests/unit/global-styles.test.ts`. */
  it("leaves the stage pixel box to the stylesheet", async () => {
    setViewport(1920, 1200);
    await renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("style")).toBeNull();
  });

  it("follows store navigation without a remount", async () => {
    const store = createShellStore("#/", () => {});
    await renderShell({ store, loaders });
    store.syncFromHash("#/decks");
    await vi.waitFor(
      () =>
        expect(
          document.querySelector('[data-cy="shell-region-decks"]'),
        ).not.toBeNull(),
      REAL_IMPORT,
    );
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
  });
});

it("refuses Story without selected semantic inputs instead of creating legacy binding", async () => {
  const store = createShellStore("#/story", () => undefined);
  const mounted = render(AppShell, {
    store,
    loaders,
    initialCoreGate: READY_CORE_GATE,
  });
  await vi.waitFor(() =>
    expect(mounted.container.textContent).toContain(
      "APP_REQUIRED_INPUT_FAILED",
    ),
  );
});

it.each([
  "#/story",
  "#/story/decks",
  "#/story/collection",
  "#/duel/session/direct",
])(
  "acquires one Story session before mounting production route %s",
  async (hash) => {
    const story = Promise.withResolvers<StorySession>();
    const application = sqliteApplication(
      async () => freeplaySession(async () => undefined),
      () => story.promise,
    );
    render(AppShell, {
      store: createShellStore(hash, () => undefined),
      loaders,
      initialCoreGate: READY_CORE_GATE,
      application,
    });

    await vi.waitFor(() =>
      expect(application.acquire).toHaveBeenCalledWith(
        "story",
        expect.any(AbortSignal),
      ),
    );
    expect(document.body.textContent).not.toContain(
      "STORY_UNAVAILABLE_UNTIL_T6",
    );
  },
);

it("runs menu New Game through acquired Story inputs without reading saved slots", async () => {
  const props = storyShellProps();
  const read = vi.fn(props.saves.read);
  const session = storySession({
    saves: { ...props.saves, read },
  });
  const application = sqliteApplication(
    async () => freeplaySession(async () => undefined),
    async () => session,
  );
  const store = createShellStore("#/", () => undefined);
  render(AppShell, {
    store,
    loaders: {
      ...loaders,
      story: async () => await import("../../src/story/index.ts"),
    },
    initialCoreGate: READY_CORE_GATE,
    application,
  });

  await fireEvent.click(
    document.querySelector<HTMLElement>('[data-cy="main-menu-new-game"]')!,
  );
  await vi.waitFor(
    () =>
      expect(
        document.querySelector('[data-cy="story-narrative-stage"]'),
      ).not.toBeNull(),
    REAL_IMPORT,
  );
  expect(application.acquire).toHaveBeenCalledWith(
    "story",
    expect.any(AbortSignal),
  );
  expect(read).not.toHaveBeenCalled();
});

it("keeps Story collection media lazy and releases selected preview on navigation", async () => {
  const leaseRelease = vi.fn();
  const acquire = vi.fn(async () => ({
    url: "blob:selected",
    release: leaseRelease,
  }));
  const aggregate = vi.fn();
  const base = installedGameplayFixture();
  const imageSource = { acquire };
  const gameplay = {
    ...base,
    images: aggregate,
    editor: () => ({ ...base.editor(imageSource), images: imageSource }),
    cardImages: async () => imageSource,
  } as ReturnType<typeof installedGameplayFixture>;
  const application = sqliteApplication(
    async () => freeplaySession(async () => undefined),
    async () => storySession({ saves: savesHolding({ 1: 3 }), gameplay }),
  );
  const store = createShellStore("#/story/collection", () => undefined);
  render(AppShell, {
    store,
    loaders,
    initialCoreGate: READY_CORE_GATE,
    application,
  });

  const card = await vi.waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      '[data-cy="collection-card-1"]',
    );
    expect(found).not.toBeNull();
    return found!;
  }, REAL_IMPORT);
  expect(aggregate).not.toHaveBeenCalled();
  expect(acquire).not.toHaveBeenCalled();
  await fireEvent.mouseEnter(card);
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());

  store.navigate({ kind: "home" });
  await vi.waitFor(() => expect(leaseRelease).toHaveBeenCalledOnce());
  expect(aggregate).not.toHaveBeenCalled();
});

it("cancels pending Story collection preview media on navigation", async () => {
  let pendingSignal: AbortSignal | null = null;
  const acquire = vi.fn((_code, _variant, signal: AbortSignal) => {
    pendingSignal = signal;
    return new Promise<null>((resolve) => {
      signal.addEventListener("abort", () => resolve(null), { once: true });
    });
  });
  const base = installedGameplayFixture();
  const imageSource = { acquire };
  const gameplay = {
    ...base,
    editor: () => ({ ...base.editor(imageSource), images: imageSource }),
    cardImages: async () => imageSource,
  } as ReturnType<typeof installedGameplayFixture>;
  const application = sqliteApplication(
    async () => freeplaySession(async () => undefined),
    async () => storySession({ saves: savesHolding({ 1: 3 }), gameplay }),
  );
  const store = createShellStore("#/story/collection", () => undefined);
  render(AppShell, {
    store,
    loaders,
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  const card = await vi.waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      '[data-cy="collection-card-1"]',
    );
    expect(found).not.toBeNull();
    return found!;
  }, REAL_IMPORT);

  await fireEvent.mouseEnter(card);
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());
  store.navigate({ kind: "home" });
  await vi.waitFor(() => expect(pendingSignal?.aborted).toBe(true));
});

it("acquires Free Play lease before mount; releases after disposal", async () => {
  const acquire = Promise.withResolvers<FreeplaySession>();
  const close = vi.fn(async () => {
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBeNull();
  });
  const application = sqliteApplication(() => acquire.promise);
  const duelLoader = vi.fn(duelDeckModule);
  const store = createShellStore("#/free-play", () => undefined);
  render(AppShell, {
    store,
    loaders: { ...loaders, duel: duelLoader },
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  expect(duelLoader).not.toHaveBeenCalled();
  acquire.resolve(freeplaySession(close));
  await vi.waitFor(() => expect(duelLoader).toHaveBeenCalledOnce());
  await store.navigate({ kind: "home" });
  await tick();
  await vi.waitFor(() => expect(close).toHaveBeenCalled());
});

it("Post-gate eviction: explicit asynchronous error returns Main Menu after lease disposal", async () => {
  const close = vi.fn(async () => {
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBeNull();
  });
  const session = freeplaySession(close);
  const application = sqliteApplication(async () => session);
  const store = createShellStore("#/free-play", () => undefined);
  render(AppShell, {
    store,
    loaders,
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).not.toBeNull(),
  );
  window.dispatchEvent(
    new ErrorEvent("error", { error: new Error("APP_REQUIRED_INPUT_FAILED") }),
  );
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cy="application-recovery-message"]'),
    ).not.toBeNull(),
  );
  await vi.waitFor(() => expect(application.clear).toHaveBeenCalled());
  expect(close).toHaveBeenCalled();
  expect(document.querySelector('[data-cy="main-menu-screen"]')).not.toBeNull();
});

const resizeObserverWarning =
  "ResizeObserver loop completed with undelivered notifications.";
it.each([
  {
    name: "absent error, real Error with same message",
    warningError: undefined,
    failure: () =>
      new ErrorEvent("error", {
        message: resizeObserverWarning,
        error: new Error(resizeObserverWarning),
        cancelable: true,
      }),
  },
  {
    name: "null error, different message",
    warningError: null,
    failure: () =>
      new ErrorEvent("error", { message: "Script error.", cancelable: true }),
  },
  {
    name: "null error, message substring",
    warningError: null,
    failure: () =>
      new ErrorEvent("error", {
        message: `${resizeObserverWarning} extra`,
        cancelable: true,
      }),
  },
  {
    name: "null error, unhandled rejection",
    warningError: null,
    failure: () =>
      Object.assign(new Event("unhandledrejection", { cancelable: true }), {
        reason: new Error("APP_REQUIRED_INPUT_FAILED"),
      }),
  },
])(
  "ResizeObserver diagnostic retains domain ownership; $name still recovers",
  async ({ warningError, failure }) => {
    const close = vi.fn(async () => undefined);
    let activeLeases = 0;
    const application = sqliteApplication(async () => {
      activeLeases++;
      let closed = false;
      return freeplaySession(async () => {
        if (closed) return;
        closed = true;
        activeLeases--;
        await close();
      });
    });
    const store = createShellStore("#/free-play", () => undefined);
    render(AppShell, {
      store,
      loaders,
      initialCoreGate: READY_CORE_GATE,
      application,
    });
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="shell-region-free-play-setup"]'),
      ).not.toBeNull(),
    );
    await vi.waitFor(() => expect(activeLeases).toBe(1));
    const acquiredBefore = application.acquire.mock.calls.length;
    const closedBefore = close.mock.calls.length;
    const domain = document.querySelector(
      '[data-cy="shell-region-free-play-setup"]',
    );
    const warning = new ErrorEvent("error", {
      message: resizeObserverWarning,
      cancelable: true,
    });
    Object.defineProperty(warning, "error", { value: warningError });
    window.dispatchEvent(warning);
    await tick();
    expect(
      document.querySelector('[data-cy="shell-region-free-play-setup"]'),
    ).toBe(domain);
    expect(
      document.querySelector('[data-cy="application-recovery-message"]'),
    ).toBeNull();
    expect(warning.defaultPrevented).toBe(false);
    expect(activeLeases).toBe(1);
    expect(close).toHaveBeenCalledTimes(closedBefore);
    expect(application.clear).not.toHaveBeenCalled();
    expect(application.acquire).toHaveBeenCalledTimes(acquiredBefore);
    window.dispatchEvent(failure());
    await vi.waitFor(() => expect(application.clear).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(activeLeases).toBe(0));
    expect(close.mock.calls.length).toBeGreaterThan(closedBefore);
    expect(
      document.querySelector('[data-cy="application-recovery-message"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="main-menu-screen"]'),
    ).not.toBeNull();
  },
);

it("Svelte root boundary disposes failed render and recovers Main Menu", async () => {
  const { default: Probe } =
    await import("../fixtures/ApplicationFailureProbe.svelte");
  const close = vi.fn(async () => undefined);
  const application = sqliteApplication(async () => freeplaySession(close));
  render(AppShell, {
    store: createShellStore("#/free-play/decks", () => undefined),
    loaders: { ...loaders, decks: async () => ({ default: Probe }) as never },
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  await vi.waitFor(() => expect(application.clear).toHaveBeenCalled());
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cy="main-menu-screen"]'),
    ).not.toBeNull(),
  );
  expect(close).toHaveBeenCalled();
  expect(
    document.querySelector('[data-cy="application-recovery-message"]'),
  ).not.toBeNull();
});

async function assertMountedMode(mode: "story" | "freeplay") {
  await vi.waitFor(() => {
    expect(
      document.querySelector(
        mode === "story"
          ? '[data-cy="story-narrative-stage"]'
          : '[data-cy="deck-select-start"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        mode === "story"
          ? '[data-cy="shell-region-free-play-setup"]'
          : '[data-cy="story-narrative-stage"]',
      ),
    ).toBeNull();
  }, REAL_IMPORT);
}

it.each(["story", "freeplay"] as const)(
  "R5 pending %s startup cannot publish across modes",
  async (first) => {
    const pending = Promise.withResolvers<StorySession | FreeplaySession>();
    const oldClose = vi.fn(async () => undefined);
    const nextClose = vi.fn(async () => undefined);
    const nextPending = Promise.withResolvers<StorySession | FreeplaySession>();
    const old =
      first === "story"
        ? storySession({ close: oldClose })
        : freeplaySession(oldClose);
    const next =
      first === "story"
        ? freeplaySession(nextClose)
        : storySession({ close: nextClose });
    const acquire = vi.fn(async (mode: string, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      return mode === first ? pending.promise : nextPending.promise;
    });
    const application = {
      acquire,
      clear: vi.fn(),
      close: vi.fn(),
      subscribe: () => () => undefined,
    } as unknown as ShellApplication;
    const store = createShellStore(
      first === "story" ? "#/story" : "#/free-play",
      () => undefined,
    );
    const mounted = render(AppShell, {
      store,
      loaders: {
        ...loaders,
        story: async () => await import("../../src/story/index.ts"),
      },
      initialCoreGate: READY_CORE_GATE,
      application,
    });
    await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());
    const signal = (
      acquire.mock.calls[0] as unknown as [string, AbortSignal]
    )[1];
    store.syncFromHash(first === "story" ? "#/free-play" : "#/story");
    await tick();
    expect(signal.aborted).toBe(true);
    pending.resolve(old);
    await vi.waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(oldClose).toHaveBeenCalledOnce());
    expect(nextClose).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-cy="story-narrative-stage"]'),
    ).toBeNull();
    expect(document.querySelector('[data-cy="deck-select-start"]')).toBeNull();
    nextPending.resolve(next);
    await assertMountedMode(first === "story" ? "freeplay" : "story");
    await assertMountedMode(first === "story" ? "freeplay" : "story");
    mounted.unmount();
    await vi.waitFor(() => expect(nextClose).toHaveBeenCalledOnce());
    expect(oldClose).toHaveBeenCalledOnce();
  },
);

it.each(["story", "freeplay"] as const)(
  "R5 settled %s explicitly closes then acquires target",
  async (first) => {
    const closed = Promise.withResolvers<void>();
    const oldClose = vi.fn(() => closed.promise);
    const nextClose = vi.fn(async () => undefined);
    const old =
      first === "story"
        ? storySession({ close: oldClose })
        : freeplaySession(oldClose);
    const next =
      first === "story"
        ? freeplaySession(nextClose)
        : storySession({ close: nextClose });
    const acquire = vi.fn(async (mode: string) =>
      mode === first ? old : next,
    );
    const application = {
      acquire,
      clear: vi.fn(),
      close: vi.fn(),
      subscribe: () => () => undefined,
    } as unknown as ShellApplication;
    const store = createShellStore(
      first === "story" ? "#/story" : "#/free-play",
      () => undefined,
    );
    const mounted = render(AppShell, {
      store,
      loaders: {
        ...loaders,
        story: async () => await import("../../src/story/index.ts"),
      },
      initialCoreGate: READY_CORE_GATE,
      application,
    });
    await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());
    await assertMountedMode(first);
    store.syncFromHash(first === "story" ? "#/free-play" : "#/story");
    await vi.waitFor(() => expect(oldClose).toHaveBeenCalledOnce());
    expect(acquire).toHaveBeenCalledOnce();
    closed.resolve();
    await vi.waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
    await assertMountedMode(first === "story" ? "freeplay" : "story");
    mounted.unmount();
    await vi.waitFor(() => expect(nextClose).toHaveBeenCalledOnce());
    expect(oldClose).toHaveBeenCalledOnce();
  },
);

it("G2 failed Continue returns Home; New Game reacquires current inputs with zero new slot reads", async () => {
  const props = storyShellProps();
  const read = vi.fn(async () => {
    throw new Error("STORAGE_UNAVAILABLE");
  });
  const list = vi.fn(props.saves.list);
  const close = vi.fn(async () => undefined);
  const application = sqliteApplication(
    async () => freeplaySession(async () => undefined),
    async () => storySession({ close, saves: { ...props.saves, read, list } }),
  );
  const store = createShellStore("#/", () => undefined);
  render(AppShell, {
    store,
    loaders: {
      ...loaders,
      story: async () => await import("../../src/story/index.ts"),
    },
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  store.enterStory("continue");
  await vi.waitFor(() => expect(read).toHaveBeenCalled(), REAL_IMPORT);
  await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  const before = read.mock.calls.length;
  const listBefore = list.mock.calls.length;
  const button = document.querySelector<HTMLButtonElement>(
    '[data-cy="main-menu-new-game"]',
  )!;
  expect(button.disabled).toBe(false);
  await fireEvent.click(button);
  await vi.waitFor(
    () =>
      expect(
        document.querySelector('[data-cy="story-narrative-stage"]'),
      ).not.toBeNull(),
    REAL_IMPORT,
  );
  expect(read).toHaveBeenCalledTimes(before);
  expect(list).toHaveBeenCalledTimes(listBefore);
  expect(application.acquire).toHaveBeenCalledTimes(2);
  expect(application.clear).not.toHaveBeenCalled();
});

it("R5 root destruction waits pending acquisition cleanup exactly once", async () => {
  const pending = Promise.withResolvers<StorySession>();
  const close = vi.fn(async () => undefined);
  const application = sqliteApplication(
    async () => freeplaySession(async () => undefined),
    () => pending.promise,
  );
  const mounted = render(AppShell, {
    store: createShellStore("#/story", () => undefined),
    loaders,
    initialCoreGate: READY_CORE_GATE,
    application,
  });
  await vi.waitFor(() => expect(application.acquire).toHaveBeenCalledOnce());
  mounted.unmount();
  expect(application.acquire.mock.calls[0]![1].aborted).toBe(true);
  expect(application.close).not.toHaveBeenCalled();
  pending.resolve(storySession({ close }));
  await vi.waitFor(() => expect(application.close).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledOnce();
  expect(application.acquire).toHaveBeenCalledOnce();
});

function checkpointDatabase() {
  const fixture = createUserDataFixture();
  const files = createNodeFileStore();
  const runtime = new UserDataRuntime({
    database: databaseAdapter(fixture.database),
    files,
    randomId: () => crypto.randomUUID(),
  });
  return {
    saves: createSqliteStoryRepository(runtime),
    async close() {
      await runtime.close();
      rmSync(fixture.file);
      rmSync(files.root, { recursive: true });
    },
  };
}

it.each(["home", "destroy"] as const)(
  "RESET Shell %s drains pending SQLite write and clear before session/root close",
  async (exit) => {
    const h = checkpointDatabase();
    const writeGate = Promise.withResolvers<void>();
    const clearGate = Promise.withResolvers<void>();
    const coordinator = vi.spyOn(handoffModule, "createHandoffCoordinator");
    let mounted: ReturnType<typeof render> | undefined;
    try {
      const saves = h.saves;
      const wrote = Promise.withResolvers<void>();
      const write = vi.fn(async (...args: Parameters<typeof saves.write>) => {
        const result = await saves.write(...args);
        wrote.resolve();
        await writeGate.promise;
        return result;
      });
      const clear = vi.fn(async (...args: Parameters<typeof saves.clear>) => {
        await clearGate.promise;
        await saves.clear(...args);
      });
      const close = vi.fn(async () => {
        expect(await saves.read("checkpoint:pre-duel")).toEqual({
          kind: "empty",
          slot: "checkpoint:pre-duel",
        });
      });
      const application = sqliteApplication(
        async () => freeplaySession(async () => undefined),
        async () => storySession({ saves: { ...saves, write, clear }, close }),
      );
      const store = createShellStore("#/story", () => undefined);
      mounted = render(AppShell, {
        store,
        loaders,
        initialCoreGate: READY_CORE_GATE,
        application,
      });
      await vi.waitFor(() =>
        expect(application.acquire).toHaveBeenCalledOnce(),
      );
      await tick();
      const handoff = coordinator.mock.results[0]!.value as ReturnType<
        typeof handoffModule.createHandoffCoordinator
      >;
      const begin = handoff.begin(
        { handoffId: SESSION_HANDOFF, encounterId: "old-arena", label: "Rin" },
        createInitialStoryState(),
        storyBindingFixture(),
      );
      await wrote.promise;
      if (exit === "destroy") {
        mounted.unmount();
        mounted = undefined;
      } else store.navigate({ kind: "home" });
      await tick();
      await tick();
      expect(close).not.toHaveBeenCalled();
      expect(application.close).not.toHaveBeenCalled();
      writeGate.resolve();
      await vi.waitFor(() =>
        expect(clear).toHaveBeenCalledWith("checkpoint:pre-duel", 1),
      );
      expect(close).not.toHaveBeenCalled();
      clearGate.resolve();
      expect(await begin).toBe("checkpoint-failed");
      await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
      mounted?.unmount();
      mounted = undefined;
      await vi.waitFor(() => expect(application.close).toHaveBeenCalledOnce());
      expect(clear).toHaveBeenCalledOnce();
    } finally {
      writeGate.resolve();
      clearGate.resolve();
      mounted?.unmount();
      coordinator.mockRestore();
      await h.close();
    }
  },
);

it.each(["new", "load", "freeplay"] as const)(
  "RESET New Game cleanup preserves newest %s route/entry",
  async (latest) => {
    const h = checkpointDatabase();
    const gate = Promise.withResolvers<void>();
    const coordinator = vi.spyOn(handoffModule, "createHandoffCoordinator");
    let mounted: ReturnType<typeof render> | undefined;
    try {
      const saves = h.saves;
      const clear = vi.fn(async (...args: Parameters<typeof saves.clear>) => {
        await gate.promise;
        await saves.clear(...args);
      });
      const close = vi.fn(async () => undefined);
      const application = sqliteApplication(
        async () => freeplaySession(async () => undefined),
        async () => storySession({ saves: { ...saves, clear }, close }),
      );
      const store = createShellStore("#/story", () => undefined);
      mounted = render(AppShell, {
        store,
        loaders: {
          ...loaders,
          story: async () => await import("../../src/story/index.ts"),
        },
        initialCoreGate: READY_CORE_GATE,
        application,
      });
      await vi.waitFor(() =>
        expect(application.acquire).toHaveBeenCalledOnce(),
      );
      await tick();
      const handoff = coordinator.mock.results[0]!.value as ReturnType<
        typeof handoffModule.createHandoffCoordinator
      >;
      expect(
        await handoff.begin(
          {
            handoffId: SESSION_HANDOFF,
            encounterId: "old-arena",
            label: "Rin",
          },
          createInitialStoryState(),
          storyBindingFixture(),
        ),
      ).toBe("ready");
      store.enterStory("new");
      if (latest === "load") store.enterStory("load");
      if (latest === "freeplay") store.navigate({ kind: "free-play" });
      await vi.waitFor(() =>
        expect(clear).toHaveBeenCalledWith("checkpoint:pre-duel", 1),
      );
      gate.resolve();
      if (latest === "new") await assertMountedMode("story");
      else if (latest === "freeplay") await assertMountedMode("freeplay");
      else
        await vi.waitFor(
          () =>
            expect(
              document.querySelector('[data-cy="story-load-slots"]'),
            ).not.toBeNull(),
          REAL_IMPORT,
        );
      await vi.waitFor(async () =>
        expect(await saves.read("checkpoint:pre-duel")).toEqual({
          kind: "empty",
          slot: "checkpoint:pre-duel",
        }),
      );
      expect(clear).toHaveBeenCalledOnce();
      mounted.unmount();
      mounted = undefined;
      await vi.waitFor(() => expect(application.close).toHaveBeenCalledOnce());
    } finally {
      gate.resolve();
      mounted?.unmount();
      coordinator.mockRestore();
      await h.close();
    }
  },
);

it.each(["freeplay", "story"] as const)(
  "hands BattleFacade the selected %s package ruleset",
  async (mode) => {
    const freeplay = freeplaySession(async () => undefined);
    const freeplayRuleset = {
      ...freeplay.inputs.editor.ruleset,
      id: "freeplay-package",
      revision: "freeplay-package-sha",
    };
    const base = installedGameplayFixture();
    const chapterRuleset = {
      ...base.editor().ruleset,
      id: "chapter-01",
      revision: "chapter-package-sha",
    };
    const gameplay: ReturnType<typeof installedGameplayFixture> = {
      ...base,
      editor: (images) => ({ ...base.editor(images), ruleset: chapterRuleset }),
    };
    const application = sqliteApplication(
      async () => ({
        ...freeplay,
        inputs: {
          ...freeplay.inputs,
          editor: { ...freeplay.inputs.editor, ruleset: freeplayRuleset },
        },
      }),
      async () =>
        storySession({
          gameplay,
          saves: savesAnswering(checkpointFor(SESSION_HANDOFF)),
        }),
    );
    render(AppShell, {
      store: createShellStore(
        mode === "freeplay"
          ? "#/free-play"
          : `#/duel/session/${SESSION_HANDOFF}`,
        () => undefined,
      ),
      loaders: probeLoaders,
      initialCoreGate: READY_CORE_GATE,
      application,
    });
    if (mode === "freeplay") await startMatch();
    const probe = await vi.waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        '[data-cy="battle-facade-probe"]',
      );
      expect(found).not.toBeNull();
      return found!;
    }, REAL_IMPORT);
    const expected = mode === "freeplay" ? freeplayRuleset : chapterRuleset;
    expect(probe.dataset.rulesetId).toBe(expected.id);
    expect(probe.dataset.rulesetRevision).toBe(expected.revision);
  },
);

it("current Freeplay session opens full collection without Story gameplay and releases on exit", async () => {
  const close = vi.fn(async () => undefined);
  const session = freeplaySession(close);
  const application = sqliteApplication(async () => session);
  const store = createShellStore("#/free-play/collection", () => {});
  render(AppShell, {
    store,
    initialCoreGate: { kind: "ready", generation: 1 },
    application,
    loaders,
  });
  await vi.waitFor(
    () =>
      expect(
        document.querySelector('[data-cy="collection-screen"]'),
      ).not.toBeNull(),
    REAL_IMPORT,
  );
  expect(
    document.querySelector('[data-cy="shell-region-collection"]'),
  ).not.toBeNull();
  expect(application.acquire).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  store.navigate({ kind: "home" });
  await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});

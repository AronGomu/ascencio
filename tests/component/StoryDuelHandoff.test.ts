// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The duel's worker client is the only piece of the battle domain this test
   cannot run for real in jsdom, so it is replaced with the same hand-driven
   double `tests/component/BattleFacade.test.ts` uses: everything else —
   the shell, the coordinator, the story and the real deck picker — is the
   production code path. */
vi.hoisted(() => {
  const runtimeSnapshotId = "a".repeat(64);
  Object.assign(globalThis, {
    __RUNTIME_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVATION_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVE_CARD_TEXTS__: [],
    __RUNTIME_MANIFEST_SHA256__: "b".repeat(64),
    __ACTIVE_IMAGE_MANIFEST_SHA256__: "c".repeat(64),
    __RUNTIME_REVISIONS__: {},
    __ACTIVE_IMAGE_MANIFEST__: {
      snapshotId: runtimeSnapshotId,
      files: [],
      missing: [],
    },
    __APP_BUILD_ID__: "component-test",
  });
});

vi.mock("../../src/app/DuelWorkerClient.ts", () => {
  class DuelWorkerClientMock {
    static instances: DuelWorkerClientMock[] = [];
    context = { workerGeneration: 1, sessionGeneration: 0 };
    listeners = new Set<(received: unknown) => void>();

    constructor() {
      DuelWorkerClientMock.instances.push(this);
    }

    subscribe(listener: (received: unknown) => void) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    initialize() {
      queueMicrotask(() => {
        for (const listener of this.listeners)
          listener({
            context: this.context,
            event: { type: "ready", coreVersion: [11, 0] },
          });
      });
      return true;
    }

    startDuel() {
      this.context = { ...this.context, sessionGeneration: 1 };
      return this.context;
    }

    respond() {
      return false;
    }

    surrender() {
      return false;
    }

    requestDiagnostics() {
      return false;
    }

    async replace() {
      this.context = {
        workerGeneration: this.context.workerGeneration + 1,
        sessionGeneration: 0,
      };
      return { graceful: true };
    }

    async dispose() {
      return { graceful: true };
    }
  }

  return { DuelWorkerClient: DuelWorkerClientMock };
});

import { DuelWorkerClient as MockedDuelWorkerClient } from "../../src/app/DuelWorkerClient.ts";
import AppShell from "../../src/shell/AppShell.svelte";
import type { DomainLoaders } from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../src/story/saves/story-save-contracts.ts";
import type {
  StorySaveWriteResult,
  StorySlotKey,
} from "../../src/story/saves/story-save-contracts.ts";
import {
  createStorySaveRepository,
  type StorySaveRepository,
} from "../../src/story/saves/story-save-repository.ts";

interface MockedWorkerInstance {
  readonly context: { workerGeneration: number; sessionGeneration: number };
  readonly listeners: Set<(received: unknown) => void>;
}

const mockedWorkerClientCtor = MockedDuelWorkerClient as unknown as {
  instances: MockedWorkerInstance[];
};

const loaders: DomainLoaders = {
  duel: async () => await import("../../src/battle/index.ts"),
  decks: () => new Promise<never>(() => {}),
  story: async () => await import("../../src/story/index.ts"),
};

let hash = "#/story";
let saves: StorySaveRepository;
/** Set to fail the next checkpoint write, exactly as full storage would. */
let checkpointWriteFailure: StorySaveWriteResult | null = null;

function failableSaves(inner: StorySaveRepository): StorySaveRepository {
  return {
    read: (slot) => inner.read(slot),
    write: (slot, state, expectedRevision) => {
      const failure = checkpointWriteFailure;
      if (failure !== null && slot === "checkpoint:pre-duel") {
        checkpointWriteFailure = null;
        return Promise.resolve(failure);
      }
      return inner.write(slot, state, expectedRevision);
    },
    list: () => inner.list(),
    clear: (slot) => inner.clear(slot),
  };
}

function renderShell() {
  return render(AppShell, {
    store: createShellStore(hash, (next) => {
      hash = next;
    }),
    loaders,
    saves,
  });
}

function region(name: string): Element | null {
  return document.querySelector(`[data-cy="shell-region-${name}"]`);
}

function cy(value: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
  if (element === null) throw new Error(`No element for data-cy="${value}"`);
  return element;
}

async function waitForCy(value: string): Promise<HTMLElement> {
  await vi.waitFor(
    () =>
      expect(
        document.querySelector(`[data-cy="${value}"]`),
        `waiting for data-cy="${value}"`,
      ).not.toBeNull(),
    { timeout: 5_000 },
  );
  return cy(value);
}

function emitResult(result: unknown): void {
  const worker =
    mockedWorkerClientCtor.instances[
      mockedWorkerClientCtor.instances.length - 1
    ];
  if (worker === undefined) throw new Error("No mocked worker client instance");
  for (const listener of worker.listeners)
    listener({ context: worker.context, event: { type: "result", result } });
}

/** Puts the player on the city map with one save on disk, so the flow under
    test starts at the encounter rather than 30 narrative beats earlier. */
async function seedMapProgress(): Promise<void> {
  await saves.write(
    "autosave" as StorySlotKey,
    {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      progressExists: true,
    },
    null,
  );
}

async function reachEncounter(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  renderShell();
  await user.click(await waitForCy("story-title-continue"));
  await user.click(await waitForCy("story-map-location-old-arena"));
  await user.click(await waitForCy("story-briefing-start"));
  return user;
}

async function deleteStorySaves(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(STORY_SAVES_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  hash = "#/story";
  checkpointWriteFailure = null;
  await deleteStorySaves();
  saves = failableSaves(createStorySaveRepository(globalThis.indexedDB));
  await seedMapProgress();
});

afterEach(async () => {
  cleanup();
  localStorage.clear();
  mockedWorkerClientCtor.instances.length = 0;
  await deleteStorySaves();
});

describe("story duel handoff", () => {
  it("starts a real duel through the deck picker and routes to the session", async () => {
    await reachEncounter();

    await waitForCy("deck-picker");
    expect(region("duel")).not.toBeNull();
    expect(region("story")).toBeNull();
    expect(cy("battle-root")).not.toBeNull();
    expect(hash).toMatch(/^#\/duel\/session\/[\w-]+$/);
  });

  it("returns a surrendered duel to the story's abort branch", async () => {
    await reachEncounter();
    await waitForCy("battle-root");

    emitResult({ type: "surrendered", player: 0 });

    await waitForCy("story-outcome-abort-heading");
    expect(hash).toBe("#/story");
    expect(
      document.querySelector('[data-cy="story-outcome-win-heading"]'),
    ).toBeNull();
  });

  it("takes a completed win to the win branch and its reward", async () => {
    const user = await reachEncounter();
    await waitForCy("battle-root");

    emitResult({ type: "completed", winner: 0, loser: 1, reason: 1 });

    await waitForCy("story-outcome-win-heading");
    await user.click(cy("story-outcome-win-continue"));
    await waitForCy("story-reward-screen");
  });

  /* The property, end to end: a duel the engine could not finish must reach
     the technical-failure scene, not the authored defeat. */
  it("takes an engine failure to the technical-failure branch, never to a loss", async () => {
    await reachEncounter();
    await waitForCy("battle-root");

    emitResult({ type: "engineError", detail: "core stopped" });

    await waitForCy("story-outcome-error-heading");
    expect(
      document.querySelector('[data-cy="story-outcome-loss-heading"]'),
    ).toBeNull();
  });

  it("ignores a duplicate result instead of advancing the story twice", async () => {
    await reachEncounter();
    await waitForCy("battle-root");

    emitResult({ type: "completed", winner: 0, loser: 1, reason: 1 });
    emitResult({ type: "completed", winner: 1, loser: 0, reason: 1 });
    emitResult({ type: "surrendered", player: 0 });

    await waitForCy("story-outcome-win-heading");
    expect(
      document.querySelector('[data-cy="story-outcome-loss-heading"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="story-outcome-abort-heading"]'),
    ).toBeNull();
  });

  /* The crash-safety property, without a browser: a session route reached
     with nothing in memory has to come back as the same encounter, read out
     of the checkpoint. `e2e/story-duel.spec.ts` does the real reload. */
  it("restarts the encounter from the checkpoint on a cold start into the session", async () => {
    const handoffId = "66666666-2222-4333-8444-555555555555";
    await saves.write(
      "checkpoint:pre-duel",
      {
        ...createInitialStoryState(),
        screen: "battle-mock",
        savedScreen: "map",
        progressExists: true,
        encounterId: "old-arena",
        pendingHandoffId: handoffId,
      },
      null,
    );
    hash = `#/duel/session/${handoffId}`;
    renderShell();

    await waitForCy("battle-root");
    expect(hash).toBe(`#/duel/session/${handoffId}`);

    emitResult({ type: "surrendered", player: 0 });

    await waitForCy("story-outcome-abort-heading");
    expect(hash).toBe("#/story");
  });

  /* Leaving a story duel still owes the story a result, or the checkpoint
     would outlive the duel it was written for. */
  it("settles a story duel that is torn down before it finishes as an abort", async () => {
    await reachEncounter();
    await waitForCy("battle-root");

    cleanup();

    expect(hash).toBe("#/story");
    await vi.waitFor(async () =>
      expect((await saves.read("checkpoint:pre-duel")).kind).toBe("empty"),
    );
  });

  it("shows a retry instead of a duel when the checkpoint cannot be written", async () => {
    checkpointWriteFailure = { kind: "failed", reason: "quota" };
    const user = await reachEncounter();

    await waitForCy("story-handoff-error");
    expect(region("duel")).toBeNull();
    expect(hash).toBe("#/story");

    await user.click(cy("story-handoff-retry"));

    await waitForCy("battle-root");
    expect(
      document.querySelector('[data-cy="story-handoff-error"]'),
    ).toBeNull();
  });

  it("sends a session route with no matching checkpoint back to the story", async () => {
    hash = "#/duel/session/44444444-2222-4333-8444-555555555555";
    renderShell();

    await waitForCy("story-app");
    expect(hash).toBe("#/story");
    expect(region("duel")).toBeNull();
  });
});

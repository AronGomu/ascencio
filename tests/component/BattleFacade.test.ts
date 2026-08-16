// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

const workerClientSpies = vi.hoisted(() => {
  const runtimeSnapshotId = "a".repeat(64);
  Object.assign(globalThis, {
    __RUNTIME_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVATION_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVE_CARD_TEXTS__: [],
    __ACTIVE_CARD_DATA__: [],
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
  return { dispose: vi.fn() };
});

vi.mock("../../src/battle/app/DuelWorkerClient.ts", () => {
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
      workerClientSpies.dispose();
      return { graceful: true };
    }
  }

  return { DuelWorkerClient: DuelWorkerClientMock };
});

import { DuelWorkerClient as MockedDuelWorkerClient } from "../../src/battle/app/DuelWorkerClient.ts";
import {
  BattleFacade,
  parseBattleRequest,
  type BattleFacadeResult,
} from "../../src/battle/index.ts";
import type { DuelResult } from "../../src/battle/duel/contracts/duel-result.ts";

interface MockedWorkerInstance {
  readonly context: { workerGeneration: number; sessionGeneration: number };
  readonly listeners: Set<(received: unknown) => void>;
}
interface MockedWorkerClientCtor {
  instances: MockedWorkerInstance[];
}

const mockedWorkerClientCtor =
  MockedDuelWorkerClient as unknown as MockedWorkerClientCtor;

const HOSTED_REQUEST = parseBattleRequest({
  player: { kind: "preset", deckId: "burning-abyss" },
  opponent: { kind: "preset", deckId: "shaddoll" },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  workerClientSpies.dispose.mockReset();
  mockedWorkerClientCtor.instances.length = 0;
});

function latestWorker(): MockedWorkerInstance {
  const worker =
    mockedWorkerClientCtor.instances[
      mockedWorkerClientCtor.instances.length - 1
    ];
  if (worker === undefined) throw new Error("No mocked worker client instance");
  return worker;
}

function emit(event: unknown): void {
  const worker = latestWorker();
  for (const listener of worker.listeners)
    listener({ context: worker.context, event });
}

function emitResult(result: DuelResult): void {
  emit({ type: "result", result });
}

function emitFatalWorkerError(): void {
  emit({
    type: "error",
    error: {
      code: "worker_error",
      message: "Unable to initialize the Duel Worker",
      recoverable: false,
    },
  });
}

async function renderFacade(
  request: ReturnType<typeof parseBattleRequest> | null,
  oncomplete: (result: BattleFacadeResult) => void,
) {
  const rendered = render(BattleFacade, { request, oncomplete });
  await vi.waitFor(() =>
    expect(document.querySelector('[data-cy="deck-picker"]')).not.toBeNull(),
  );
  return rendered;
}

describe("BattleFacade", () => {
  it("mounts the duel inside the battle root", async () => {
    await renderFacade(null, vi.fn());

    const root = document.querySelector('[data-cy="battle-root"]');
    expect(root).not.toBeNull();
    expect(root?.querySelector('[data-cy="app-main"]')).not.toBeNull();
    expect(root?.querySelector('[data-cy="deck-picker"]')).not.toBeNull();
    expect(mockedWorkerClientCtor.instances).toHaveLength(1);
  });

  /* Standalone mode is today's `#/duel`: the duel owns its picker and reports
     nothing outwards, so the shell keeps behaving exactly as before. */
  it("never reports completion in standalone mode", async () => {
    const oncomplete = vi.fn();
    await renderFacade(null, oncomplete);

    emitResult({ type: "completed", winner: 0, loser: 1, reason: 1 });
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="duel-result-dialog"]'),
      ).not.toBeNull(),
    );

    expect(oncomplete).not.toHaveBeenCalled();
  });

  it("settles a hosted session exactly once", async () => {
    const oncomplete = vi.fn();
    await renderFacade(HOSTED_REQUEST, oncomplete);

    emitResult({ type: "completed", winner: 0, loser: 1, reason: 1 });
    emitResult({ type: "completed", winner: 1, loser: 0, reason: 1 });
    await vi.waitFor(() => expect(oncomplete).toHaveBeenCalled());

    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect(oncomplete).toHaveBeenCalledWith({
      kind: "resolved",
      outcome: "player-win",
    });
  });

  it("maps a fatal worker error to a failure, never to a resolved loss", async () => {
    const oncomplete = vi.fn();
    await renderFacade(HOSTED_REQUEST, oncomplete);

    emitFatalWorkerError();
    await vi.waitFor(() => expect(oncomplete).toHaveBeenCalled());

    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect(oncomplete).toHaveBeenCalledWith({
      kind: "failed",
      message: "Unable to initialize the Duel Worker",
    });
  });

  /* Navigating away mid-duel still owes the host one result, or a story would
     wait forever on a duel that no longer exists. */
  it("settles a hosted session that is unmounted before it finishes", async () => {
    const oncomplete = vi.fn();
    const { unmount } = await renderFacade(HOSTED_REQUEST, oncomplete);

    unmount();

    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect(oncomplete).toHaveBeenCalledWith({
      kind: "aborted",
      reason: "exit",
    });
  });

  it("disposes the duel worker client exactly once on unmount", async () => {
    const { unmount } = await renderFacade(null, vi.fn());

    unmount();
    await vi.waitFor(() =>
      expect(workerClientSpies.dispose).toHaveBeenCalledTimes(1),
    );

    expect(mockedWorkerClientCtor.instances).toHaveLength(1);
  });
});

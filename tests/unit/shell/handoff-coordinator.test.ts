import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHandoffCoordinator } from "../../../src/shell/handoff/handoff-coordinator.ts";
import { formatAppRoute, type AppRoute } from "../../../src/shell/routes.ts";
import type { NavigateOptions } from "../../../src/shell/shell-store.ts";
import {
  createInitialStoryState,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import type {
  StorySaveReadResult,
  StorySaveWriteResult,
  StorySlotKey,
} from "../../../src/story/saves/story-save-contracts.ts";
import type { StorySaveRepository } from "../../../src/story/saves/story-save-repository.ts";
import type { StoryDuelResolution } from "../../../src/story/handoff/story-handoff.ts";

const CHECKPOINT: StorySlotKey = "checkpoint:pre-duel";

interface FakeSaves extends StorySaveRepository {
  /** Forces the next write to answer with this instead of storing. */
  failWriteWith: StorySaveWriteResult | null;
  /** Rewrites the state after a successful write, so the read-back a caller
      verifies with can be made to disagree with what it asked for. */
  corruptStoredState: ((state: StoryState) => StoryState) | null;
  /** Replaces the next read's answer outright. */
  readAs: StorySaveReadResult | null;
  readonly writes: string[];
  readonly cleared: string[];
}

function createFakeSaves(): FakeSaves {
  const records = new Map<
    StorySlotKey,
    { revision: number; savedAt: number; state: StoryState }
  >();
  const fake: FakeSaves = {
    failWriteWith: null,
    corruptStoredState: null,
    readAs: null,
    writes: [],
    cleared: [],
    read(slot) {
      const forced = fake.readAs;
      if (forced !== null) {
        fake.readAs = null;
        return Promise.resolve(forced);
      }
      const record = records.get(slot);
      if (record === undefined)
        return Promise.resolve<StorySaveReadResult>({ kind: "empty", slot });
      return Promise.resolve<StorySaveReadResult>({
        kind: "ready",
        envelope: {
          schemaVersion: 2,
          slot,
          revision: record.revision,
          savedAt: record.savedAt,
          state: record.state,
        },
      });
    },
    write(slot, state) {
      fake.writes.push(slot);
      const failure = fake.failWriteWith;
      if (failure !== null) {
        fake.failWriteWith = null;
        return Promise.resolve(failure);
      }
      const revision = (records.get(slot)?.revision ?? 0) + 1;
      records.set(slot, {
        revision,
        savedAt: revision,
        state: fake.corruptStoredState?.(state) ?? state,
      });
      return Promise.resolve<StorySaveWriteResult>({
        kind: "written",
        revision,
      });
    },
    list() {
      return Promise.resolve([]);
    },
    clear(slot) {
      fake.cleared.push(slot);
      records.delete(slot);
      return Promise.resolve();
    },
  };
  return fake;
}

const INTENT = {
  handoffId: "11111111-2222-4333-8444-555555555555",
  encounterId: "old-arena",
  label: "Rin's Echo",
} as const;

function preBattleState(): StoryState {
  return {
    ...createInitialStoryState(),
    screen: "battle-mock",
    progressExists: true,
    encounterId: "old-arena",
  };
}

let saves: FakeSaves;
let navigate: ReturnType<
  typeof vi.fn<(route: AppRoute, options?: NavigateOptions) => void>
>;
let onResolution: ReturnType<
  typeof vi.fn<(resolution: StoryDuelResolution, encounterId: string) => void>
>;
let onRestore: ReturnType<typeof vi.fn<(state: StoryState) => void>>;

function coordinator() {
  return createHandoffCoordinator({
    saves,
    navigate,
    onResolution,
    onRestore,
  });
}

function routes(): readonly string[] {
  return navigate.mock.calls.map(([route]) => formatAppRoute(route));
}

/** How each navigation entered history, so a correction the player never asked
    for can be told apart from the duel they chose to start. */
function replacements(): readonly boolean[] {
  return navigate.mock.calls.map(([, options]) => options?.replace === true);
}

beforeEach(() => {
  saves = createFakeSaves();
  navigate = vi.fn();
  onResolution = vi.fn();
  onRestore = vi.fn();
});

describe("begin", () => {
  it("writes and verifies the checkpoint before it navigates", async () => {
    const order: string[] = [];
    navigate.mockImplementation(() => order.push("navigate"));
    const original = saves.write.bind(saves);
    saves.write = (slot, state, expected) => {
      order.push("write");
      return original(slot, state, expected);
    };

    await expect(coordinator().begin(INTENT, preBattleState())).resolves.toBe(
      "ready",
    );

    expect(order).toEqual(["write", "navigate"]);
    expect(routes()).toEqual([`#/duel/session/${INTENT.handoffId}`]);
    /* The player asked for this one, so Back out of the duel must lead back to
       the story it started from. */
    expect(replacements()).toEqual([false]);
    const stored = await saves.read(CHECKPOINT);
    expect(stored.kind).toBe("ready");
    if (stored.kind !== "ready") throw new Error("checkpoint was not written");
    expect(stored.envelope.state.pendingHandoffId).toBe(INTENT.handoffId);
    expect(stored.envelope.state.encounterId).toBe("old-arena");
    expect(stored.envelope.state.screen).toBe("battle-mock");
  });

  it("hands the checkpointed state back as the last stable state", async () => {
    await coordinator().begin(INTENT, preBattleState());
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore.mock.calls[0]?.[0].pendingHandoffId).toBe(
      INTENT.handoffId,
    );
  });

  it.each([
    { kind: "failed", reason: "quota" } as const,
    { kind: "failed", reason: "unavailable" } as const,
    { kind: "stale", currentRevision: 4 } as const,
  ])("does not start the duel when the write answers %o", async (result) => {
    saves.failWriteWith = result;

    await expect(coordinator().begin(INTENT, preBattleState())).resolves.toBe(
      "checkpoint-failed",
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("does not start the duel when the read-back disagrees with the write", async () => {
    saves.corruptStoredState = (state) => ({
      ...state,
      pendingHandoffId: "someone-elses-handoff",
    });

    await expect(coordinator().begin(INTENT, preBattleState())).resolves.toBe(
      "checkpoint-failed",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not start the duel when the checkpoint cannot be read back", async () => {
    const started = coordinator().begin(INTENT, preBattleState());
    saves.readAs = { kind: "corrupt", slot: CHECKPOINT, reason: "broken" };

    await expect(started).resolves.toBe("checkpoint-failed");
    expect(navigate).not.toHaveBeenCalled();
  });

  /* A handoff id that cannot survive the URL hash would strand the player on a
     route nothing can resume, so it is refused before anything is stored. */
  it("refuses an unroutable handoff id without writing anything", async () => {
    await expect(
      coordinator().begin(
        { ...INTENT, handoffId: "not/a/route" },
        preBattleState(),
      ),
    ).resolves.toBe("checkpoint-failed");
    expect(saves.writes).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });

  /* A duel that never started must not be settleable by a late result. */
  it("leaves nothing pending after a failed checkpoint", async () => {
    saves.failWriteWith = { kind: "failed", reason: "unknown" };
    const handoff = coordinator();
    await handoff.begin(INTENT, preBattleState());

    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });

    expect(onResolution).not.toHaveBeenCalled();
  });
});

describe("resume", () => {
  it("restores a checkpoint whose handoff matches", async () => {
    const handoff = coordinator();
    await handoff.begin(INTENT, preBattleState());
    navigate.mockClear();
    onRestore.mockClear();

    /* A fresh coordinator is the reload: nothing is held in memory, so the
       answer can only come out of the store. */
    const reloaded = coordinator();
    await expect(reloaded.resume(INTENT.handoffId)).resolves.toBe("restored");
    expect(navigate).not.toHaveBeenCalled();
    expect(onRestore.mock.calls[0]?.[0].encounterId).toBe("old-arena");
  });

  it("restores the duel it is already running without re-reading", async () => {
    const handoff = coordinator();
    await handoff.begin(INTENT, preBattleState());
    saves.readAs = { kind: "empty", slot: CHECKPOINT };

    await expect(handoff.resume(INTENT.handoffId)).resolves.toBe("restored");
    expect(saves.readAs).not.toBeNull();
  });

  it.each([
    [
      "a mismatched handoff id",
      async () => {
        await coordinator().begin(INTENT, preBattleState());
      },
      "22222222-2222-4333-8444-555555555555",
    ],
    ["an absent checkpoint", async () => undefined, INTENT.handoffId],
  ])("sends %s back to the story", async (_name, seed, requested) => {
    await seed();
    navigate.mockClear();
    onRestore.mockClear();

    await expect(coordinator().resume(requested)).resolves.toBe("not-found");
    expect(routes()).toEqual(["#/story"]);
    /* Pushing here is what traps Back: the entry the player pressed Back to
       reach would be replaced by a forward push of the same session route. */
    expect(replacements()).toEqual([true]);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "corrupt", slot: CHECKPOINT, reason: "not an envelope" } as const,
    { kind: "incompatible", slot: CHECKPOINT, found: 9 } as const,
  ])("sends a %o checkpoint back to the story", async (read) => {
    saves.readAs = read;

    await expect(coordinator().resume(INTENT.handoffId)).resolves.toBe(
      "not-found",
    );
    expect(routes()).toEqual(["#/story"]);
  });

  /* A checkpoint whose state names no encounter cannot be restarted, so it is
     treated exactly like a missing one instead of half-restoring a duel. */
  it("sends a checkpoint with no encounter back to the story", async () => {
    saves.readAs = {
      kind: "ready",
      envelope: {
        schemaVersion: 2,
        slot: CHECKPOINT,
        revision: 1,
        savedAt: 1,
        state: {
          ...createInitialStoryState(),
          pendingHandoffId: INTENT.handoffId,
          encounterId: null,
        },
      },
    };

    await expect(coordinator().resume(INTENT.handoffId)).resolves.toBe(
      "not-found",
    );
    expect(routes()).toEqual(["#/story"]);
  });

  it("cannot be settled by the handoff it refused", async () => {
    const handoff = coordinator();
    await handoff.resume(INTENT.handoffId);

    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });

    expect(onResolution).not.toHaveBeenCalled();
  });
});

describe("settle", () => {
  async function started() {
    const handoff = coordinator();
    await handoff.begin(INTENT, preBattleState());
    navigate.mockClear();
    return handoff;
  }

  it("forwards the mapped resolution, clears the checkpoint and returns to the story", async () => {
    const handoff = await started();

    handoff.settle(INTENT.handoffId, { kind: "aborted", reason: "surrender" });

    expect(onResolution).toHaveBeenCalledWith({ kind: "abort" }, "old-arena");
    expect(routes()).toEqual(["#/story"]);
    /* The session route is spent once the duel has settled, so the return
       replaces it rather than leaving it behind for Back to walk into. */
    expect(replacements()).toEqual([true]);
    await vi.waitFor(() => expect(saves.cleared).toEqual([CHECKPOINT]));
  });

  it("ignores a result from a duel that is not the pending one", async () => {
    const handoff = await started();

    handoff.settle("22222222-2222-4333-8444-555555555555", {
      kind: "resolved",
      outcome: "player-win",
    });

    expect(onResolution).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(saves.cleared).toEqual([]);
  });

  it("accepts exactly one result per handoff", async () => {
    const handoff = await started();

    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });
    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-loss",
    });
    handoff.settle(INTENT.handoffId, { kind: "aborted", reason: "exit" });

    expect(onResolution).toHaveBeenCalledTimes(1);
    expect(onResolution).toHaveBeenCalledWith({ kind: "win" }, "old-arena");
  });

  /* A stale result is one from the previous encounter arriving after the next
     handoff already began; it must not settle the new duel. */
  it("ignores a result from the previous handoff after a new one began", async () => {
    const handoff = await started();
    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });
    onResolution.mockClear();
    const second = {
      ...INTENT,
      handoffId: "33333333-2222-4333-8444-555555555555",
    };
    await handoff.begin(second, preBattleState());

    handoff.settle(INTENT.handoffId, {
      kind: "resolved",
      outcome: "player-loss",
    });

    expect(onResolution).not.toHaveBeenCalled();
  });

  it("reports a technical failure as a failure, never as a loss", async () => {
    const handoff = await started();

    handoff.settle(INTENT.handoffId, {
      kind: "failed",
      message: "worker gone",
    });

    expect(onResolution).toHaveBeenCalledWith(
      { kind: "failure", message: "worker gone" },
      "old-arena",
    );
  });

  it("still returns to the story when clearing the checkpoint fails", async () => {
    const handoff = await started();
    saves.clear = () => Promise.reject(new Error("storage is gone"));

    handoff.settle(INTENT.handoffId, { kind: "aborted", reason: "exit" });

    expect(onResolution).toHaveBeenCalledTimes(1);
    expect(routes()).toEqual(["#/story"]);
  });
});

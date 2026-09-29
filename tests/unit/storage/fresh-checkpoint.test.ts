// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createHandoffCoordinator } from "../../../src/shell/handoff/handoff-coordinator.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/sqlite-story-repository.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
import { createStoryInputsHarness } from "../../fixtures/sqlite/story-inputs-runtime.ts";

const slot = "checkpoint:pre-duel" as const;
const intent = {
  handoffId: "11111111-2222-4333-8444-555555555555",
  encounterId: "old-arena",
  label: "Rin",
} as const;
const state = () => ({
  ...createInitialStoryState(),
  screen: "battle-mock" as const,
  encounterId: "old-arena" as const,
  progressExists: true,
});

describe("R8 checkpoint ownership", () => {
  it("fresh run preserves every old SQLite slot byte and revision; failed checkpoint never launches duel", async () => {
    const h = await createStoryInputsHarness();
    try {
      const saves = createSqliteStoryRepository(h.storage.userData);
      for (const key of ["manual:1", "autosave", slot] as const)
        expect(
          (await saves.write(key, state(), 0, storyBindingFixture())).kind,
        ).toBe("written");
      const before = h.userDatabase
        .prepare("SELECT * FROM user_records ORDER BY record_key")
        .all();
      const navigate = vi.fn();
      const handoff = createHandoffCoordinator({
        saves,
        navigate,
        onRestore: vi.fn(),
        onResolution: vi.fn(),
      });
      expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
        "checkpoint-failed",
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(
        h.userDatabase
          .prepare("SELECT * FROM user_records ORDER BY record_key")
          .all(),
      ).toEqual(before);
    } finally {
      await h.close();
    }
  });
});

it("R8 same-run next duel awaits revision-bound cleanup; settled checkpoint cannot replay", async () => {
  const h = await createStoryInputsHarness();
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
    const navigate = vi.fn();
    const handoff = createHandoffCoordinator({
      saves,
      navigate,
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
      "ready",
    );
    handoff.settle(intent.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });
    const next = {
      ...intent,
      handoffId: "22222222-2222-4333-8444-555555555555",
    };
    expect(await handoff.begin(next, state(), storyBindingFixture())).toBe(
      "ready",
    );
    const restored = createHandoffCoordinator({
      saves,
      navigate,
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    expect(await restored.resume(intent.handoffId)).toBe("not-found");
    expect(await restored.resume(next.handoffId)).toBe("restored");
    restored.settle(next.handoffId, {
      kind: "resolved",
      outcome: "player-win",
    });
    expect(
      await restored.begin(
        { ...intent, handoffId: "33333333-2222-4333-8444-555555555555" },
        state(),
        storyBindingFixture(),
      ),
    ).toBe("ready");
  } finally {
    await h.close();
  }
});

it("R8 settlement preserves a newer external checkpoint; same-run retry never adopts it", async () => {
  const h = await createStoryInputsHarness();
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
    const navigate = vi.fn();
    const handoff = createHandoffCoordinator({
      saves,
      navigate,
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
      "ready",
    );
    expect(
      (
        await saves.write(
          slot,
          { ...state(), pendingHandoffId: "external" },
          1,
          storyBindingFixture(),
        )
      ).kind,
    ).toBe("written");
    const before = h.userDatabase
      .prepare("SELECT * FROM user_records ORDER BY record_key")
      .all();
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    try {
      handoff.settle(intent.handoffId, {
        kind: "resolved",
        outcome: "player-win",
      });
      expect(
        await handoff.begin(
          { ...intent, handoffId: "22222222-2222-4333-8444-555555555555" },
          state(),
          storyBindingFixture(),
        ),
      ).toBe("checkpoint-failed");
      expect(warning).toHaveBeenCalledWith("CHECKPOINT_CLEAR_FAILED");
      expect(
        h.userDatabase
          .prepare("SELECT * FROM user_records ORDER BY record_key")
          .all(),
      ).toEqual(before);
      await expect(Promise.resolve(handoff.reset())).rejects.toThrow(
        "CHECKPOINT_CLEAR_FAILED",
      );
      expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
        "checkpoint-failed",
      );
      expect(
        h.userDatabase
          .prepare("SELECT * FROM user_records ORDER BY record_key")
          .all(),
      ).toEqual(before);
    } finally {
      warning.mockRestore();
    }
  } finally {
    await h.close();
  }
});

it("RESET ready checkpoint cannot resume; fresh begin waits revision-bound cleanup", async () => {
  const h = await createStoryInputsHarness();
  const gate = Promise.withResolvers<void>();
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
    const clear = vi.fn(async (...args: Parameters<typeof saves.clear>) => {
      await gate.promise;
      await saves.clear(...args);
    });
    const read = vi.fn(saves.read);
    const handoff = createHandoffCoordinator({
      saves: { ...saves, clear, read },
      navigate: vi.fn(),
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
      "ready",
    );
    const reset = handoff.reset();
    const resume = handoff.resume(intent.handoffId);
    const next = handoff.begin(
      { ...intent, handoffId: "22222222-2222-4333-8444-555555555555" },
      state(),
      storyBindingFixture(),
    );
    await vi.waitFor(() => expect(clear).toHaveBeenCalledWith(slot, 1));
    expect(read).toHaveBeenCalledTimes(1);
    gate.resolve();
    await reset;
    expect(await resume).toBe("not-found");
    expect(await next).toBe("ready");
    expect(clear).toHaveBeenCalledOnce();
  } finally {
    gate.resolve();
    await h.close();
  }
});

it("RESET pending successful write removes returned revision before storage close", async () => {
  const h = await createStoryInputsHarness();
  const writeGate = Promise.withResolvers<void>();
  const clearGate = Promise.withResolvers<void>();
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
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
    const navigate = vi.fn();
    const handoff = createHandoffCoordinator({
      saves: { ...saves, write, clear },
      navigate,
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    const begin = handoff.begin(intent, state(), storyBindingFixture());
    await wrote.promise;
    const close = vi.fn(async () => {
      expect(await saves.read(slot)).toEqual({ kind: "empty", slot });
      await h.storage.close();
    });
    const reset = Promise.resolve(handoff.reset()).then(close);
    // Attach observation immediately, including against the intentionally red impl.
    const observedReset = reset.then(
      () => null,
      (error: unknown) => error,
    );
    await Promise.resolve();
    writeGate.resolve();
    await vi.waitFor(() => expect(clear).toHaveBeenCalledWith(slot, 1));
    expect(close).not.toHaveBeenCalled();
    clearGate.resolve();
    expect(await begin).toBe("checkpoint-failed");
    expect(await observedReset).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  } finally {
    writeGate.resolve();
    clearGate.resolve();
    await h.close();
  }
});

it("RESET newer external revision preserves SQLite bytes, reports CHECKPOINT_CLEAR_FAILED, fails begin/resume closed", async () => {
  const h = await createStoryInputsHarness();
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
    const read = vi.fn(saves.read),
      write = vi.fn(saves.write),
      clear = vi.fn(saves.clear);
    const handoff = createHandoffCoordinator({
      saves: { ...saves, read, write, clear },
      navigate: vi.fn(),
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
      "ready",
    );
    expect(
      (
        await saves.write(
          slot,
          { ...state(), pendingHandoffId: intent.handoffId },
          1,
          storyBindingFixture(),
        )
      ).kind,
    ).toBe("written");
    const before = readFileSync(h.userFile);
    await expect(Promise.resolve(handoff.reset())).rejects.toThrow(
      "CHECKPOINT_CLEAR_FAILED",
    );
    expect(warning).toHaveBeenCalledWith("CHECKPOINT_CLEAR_FAILED");
    expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
      "checkpoint-failed",
    );
    expect(await handoff.resume(intent.handoffId)).toBe("not-found");
    await expect(Promise.resolve(handoff.reset())).rejects.toThrow(
      "CHECKPOINT_CLEAR_FAILED",
    );
    expect(clear).toHaveBeenCalledExactlyOnceWith(slot, 1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(readFileSync(h.userFile)).toEqual(before);
  } finally {
    warning.mockRestore();
    await h.close();
  }
});

it.each(["reset-first", "settle-first"] as const)(
  "RESET repeated calls serialize %s without duplicate clear or rejection",
  async (order) => {
    const h = await createStoryInputsHarness();
    const gate = Promise.withResolvers<void>();
    try {
      const saves = createSqliteStoryRepository(h.storage.userData);
      const clear = vi.fn(async (...args: Parameters<typeof saves.clear>) => {
        await gate.promise;
        await saves.clear(...args);
      });
      const onResolution = vi.fn();
      const handoff = createHandoffCoordinator({
        saves: { ...saves, clear },
        navigate: vi.fn(),
        onRestore: vi.fn(),
        onResolution,
      });
      expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
        "ready",
      );
      const settle = () =>
        handoff.settle(intent.handoffId, { kind: "aborted", reason: "exit" });
      if (order === "settle-first") settle();
      const first = handoff.reset();
      const second = handoff.reset();
      settle();
      gate.resolve();
      await Promise.all([first, second]);
      expect(clear).toHaveBeenCalledExactlyOnceWith(slot, 1);
      expect(onResolution).toHaveBeenCalledTimes(
        order === "settle-first" ? 1 : 0,
      );
      expect(await saves.read(slot)).toEqual({ kind: "empty", slot });
      expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
        "ready",
      );
      await handoff.reset();
    } finally {
      gate.resolve();
      await h.close();
    }
  },
);

it("RESET unowned old SQLite saves remain byte-identical without reads or clears", async () => {
  const h = await createStoryInputsHarness();
  try {
    const saves = createSqliteStoryRepository(h.storage.userData);
    for (const key of ["manual:1", "autosave", slot] as const)
      expect(
        (await saves.write(key, state(), 0, storyBindingFixture())).kind,
      ).toBe("written");
    const before = readFileSync(h.userFile);
    const read = vi.fn(saves.read),
      clear = vi.fn(saves.clear);
    const handoff = createHandoffCoordinator({
      saves: { ...saves, read, clear },
      navigate: vi.fn(),
      onRestore: vi.fn(),
      onResolution: vi.fn(),
    });
    await handoff.reset();
    await handoff.reset();
    expect(read).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(readFileSync(h.userFile)).toEqual(before);
  } finally {
    await h.close();
  }
});

it.each(["written", "failed"] as const)(
  "RESET during owned checkpoint retry %s clears exactly its final revision",
  async (outcome) => {
    const h = await createStoryInputsHarness();
    const gate = Promise.withResolvers<void>();
    try {
      const saves = createSqliteStoryRepository(h.storage.userData);
      const read = vi
        .fn(saves.read)
        .mockResolvedValueOnce({ kind: "empty", slot });
      const entered = Promise.withResolvers<void>();
      const write = vi.fn(saves.write).mockImplementationOnce(saves.write);
      const clear = vi.fn(saves.clear);
      const handoff = createHandoffCoordinator({
        saves: { ...saves, read, write, clear },
        navigate: vi.fn(),
        onRestore: vi.fn(),
        onResolution: vi.fn(),
      });
      expect(await handoff.begin(intent, state(), storyBindingFixture())).toBe(
        "checkpoint-failed",
      );
      write.mockImplementationOnce(async (...args) => {
        const result =
          outcome === "written"
            ? await saves.write(...args)
            : { kind: "failed" as const, reason: "unavailable" as const };
        entered.resolve();
        await gate.promise;
        return result;
      });
      const retry = handoff.begin(intent, state(), storyBindingFixture());
      await entered.promise;
      const reset = Promise.resolve(handoff.reset());
      const observed = reset.then(
        () => null,
        (error: unknown) => error,
      );
      gate.resolve();
      expect(await retry).toBe("checkpoint-failed");
      expect(await observed).toBeNull();
      expect(clear).toHaveBeenCalledExactlyOnceWith(
        slot,
        outcome === "written" ? 2 : 1,
      );
      expect(await saves.read(slot)).toEqual({ kind: "empty", slot });
    } finally {
      gate.resolve();
      await h.close();
    }
  },
);

import { describe, expect, it, vi } from "vitest";
import { sessionSaves } from "../../../src/shell/core/session-saves.ts";
import type {
  GenerationSaveRepository,
  StorySaveWriteResult,
} from "../../../src/story/saves/index.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";

function repository(result: StorySaveWriteResult): GenerationSaveRepository {
  return {
    read: async (slot) => ({ kind: "empty", slot }),
    write: async () => result,
    clear: async () => {},
    list: async () => [],
  };
}

describe("session save failure policy", () => {
  it.each(["quota", "unavailable", "unknown"] as const)(
    "classifies %s without changing the domain result",
    async (reason) => {
      const failure = { kind: "failed" as const, reason };
      const onerror = vi.fn();
      const saves = sessionSaves(repository(failure), onerror);
      expect(
        await saves.write(
          "manual:1",
          createInitialStoryState(),
          0,
          storyBindingFixture(),
        ),
      ).toBe(failure);
      expect(onerror).toHaveBeenCalledTimes(reason === "quota" ? 0 : 1);
    },
  );

  it("preserves CAS refusals without global recovery", async () => {
    const onerror = vi.fn();
    const stale = { kind: "stale" as const, currentRevision: 4 };
    const saves = sessionSaves(repository(stale), onerror);
    expect(
      await saves.write(
        "manual:1",
        createInitialStoryState(),
        0,
        storyBindingFixture(),
      ),
    ).toBe(stale);
    expect(onerror).not.toHaveBeenCalled();
  });

  it("still escalates corrupt reads and rejected I/O", async () => {
    const onerror = vi.fn();
    const error = new Error("APP_STORAGE_UNAVAILABLE");
    const saves = sessionSaves(
      {
        ...repository({ kind: "written", revision: 1 }),
        read: async (slot) => ({ kind: "corrupt", slot, reason: "invalid" }),
        clear: async () => {
          throw error;
        },
      },
      onerror,
    );
    expect(await saves.read("manual:1")).toMatchObject({ kind: "corrupt" });
    await expect(saves.clear("manual:1")).rejects.toBe(error);
    expect(onerror).toHaveBeenCalledTimes(2);
    expect(onerror).toHaveBeenLastCalledWith(error);
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cardCode } from "../../../src/cards/index.ts";
import {
  chapterDeckLimit,
  loadStoryInputs,
} from "../../../src/shell/adapters/sqlite-story-inputs.ts";
import { loadFreeplayInputs } from "../../../src/shell/adapters/sqlite-freeplay-inputs.ts";
import { runtimeSnapshotId } from "../../../src/shell/adapters/sqlite-battle-runtime.ts";
import { createStoryInputsHarness } from "../../fixtures/sqlite/story-inputs-runtime.ts";

describe("chapterDeckLimit", () => {
  it("defaults missing chapter rows to three independently of Free Play", () => {
    const chapter = new Map<number, 0 | 1 | 2>([[2, 1]]);
    expect(chapterDeckLimit(chapter, 1)).toBe(3);
    expect(chapterDeckLimit(chapter, 2)).toBe(1);
  });

  it("keeps real SQLite Free Play and chapter limits independent while preserving global search", async () => {
    const harness = await createStoryInputsHarness();
    const lease = await harness.storage.packages.acquireSession();
    expect(lease.kind).toBe("ok");
    const story = await loadStoryInputs(
      harness.storage,
      harness.users,
      "chapter-01",
      new AbortController().signal,
    );
    const freeplay = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    try {
      const [storyRuntime, freeplayRuntime] = await Promise.all([
        story.gameplay.battle.load(new AbortController().signal),
        freeplay.battle.load(new AbortController().signal),
      ]);
      const storyLimits = new Map(storyRuntime.ruleset.quantityByCode);
      const freeplayLimits = new Map(freeplayRuntime.ruleset.quantityByCode);
      expect(freeplayLimits.get(cardCode(1))).toBe(0);
      expect(storyLimits.get(cardCode(1))).toBe(1);
      expect(storyLimits.has(cardCode(2))).toBe(false);
      expect(storyLimits.get(cardCode(17))).toBe(2);
      expect(storyLimits.has(cardCode(18))).toBe(false);
      expect(story.gameplay.editor().ruleset.quantityByCode.get(18) ?? 3).toBe(
        3,
      );
      expect(freeplayLimits.get(cardCode(18))).toBe(0);
      expect(storyRuntime.allowedCardCodes).toContain(cardCode(18));
      expect(storyRuntime.allowedCardCodes).toContain(cardCode(2));
      expect(storyRuntime.allowedCardCodes).not.toContain(cardCode(15));
      expect(story.cards.all()).toHaveLength(20);
      expect(story.gameplay.presentation.cards).toHaveLength(20);
      expect(freeplayRuntime.ruleset.id).toBe("fixture");
      expect(storyRuntime.ruleset.id).toBe("chapter-01");
      expect(story.gameplay.editor().ruleset.quantityByCode).toEqual(
        storyLimits,
      );
      expect(freeplay.editor.ruleset.quantityByCode).toEqual(freeplayLimits);
      expect(story.gameplay.editor().ruleset.quantityByCode.get(2) ?? 3).toBe(
        3,
      );
      expect(story.gameplay.editor().cards.all()).toHaveLength(20);

      const stack = await harness.storage.packages.current();
      expect(stack.kind).toBe("ok");
      if (stack.kind === "ok") {
        const directChapter = stack.value.packages.map((active) =>
          active.packageId === "chapter-01"
            ? {
                ...active,
                dependencies: [
                  {
                    packageId: "card-library" as const,
                    requirement: "exact" as const,
                    version: "1.0.0",
                  },
                ],
              }
            : active,
        );
        const unrelatedFreeplayChanged = directChapter.map((active) =>
          active.packageId === "freeplay"
            ? { ...active, sha256: "f".repeat(64) }
            : active,
        );
        expect(runtimeSnapshotId(directChapter, "chapter-01")).toBe(
          runtimeSnapshotId(unrelatedFreeplayChanged, "chapter-01"),
        );
      }
    } finally {
      story.close();
      freeplay.close();
      if (lease.kind === "ok") await lease.value.release();
      await harness.close();
    }
  }, 120_000);
});

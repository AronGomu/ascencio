import { afterEach, expect, it } from "vitest";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import {
  createStorySaveRepository,
  resetStorySessionFixture,
  storyUserRuntime,
} from "../../fixtures/story-session.ts";

afterEach(resetStorySessionFixture);
it("reports unavailable when the SQLite owner closes before a queued write", async () => {
  const key = {};
  const repo = createStorySaveRepository(key);
  await storyUserRuntime(key).close();
  await expect(
    repo.write("autosave", createInitialStoryState(), 0),
  ).resolves.toEqual({ kind: "failed", reason: "unavailable" });
});

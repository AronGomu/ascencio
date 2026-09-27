import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as readLog from "../../../src/story/playback/story-read-log.ts";
import * as settings from "../../../src/story/playback/story-playback-settings.ts";

describe("retired Story playback persistence API", () => {
  it("exposes only pure read-log and playback setting helpers", () => {
    expect(Object.keys(readLog).sort()).toEqual(["withBeatRead"]);
    expect(Object.keys(settings).sort()).toEqual([
      "DEFAULT_STORY_PLAYBACK_SETTINGS",
      "clampAutoSpeed",
    ]);
  });

  it("contains no browser storage adapter or Story compatibility fixture", () => {
    for (const file of [
      "src/story/playback/story-read-log.ts",
      "src/story/playback/story-playback-settings.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(
        /localStorage|defaultStorage|Storage|JSON\.(parse|stringify)/,
      );
    }
    expect(existsSync("tests/fixtures/legacy-user-preference-ports.ts")).toBe(
      false,
    );
  });
});

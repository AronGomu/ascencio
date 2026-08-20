import { describe, expect, it } from "vitest";
import {
  readStoryReadLog,
  STORY_READ_LOG_KEY,
  writeStoryReadLog,
} from "../../../src/story/playback/story-read-log.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("story read log", () => {
  it("round-trips the beats it was given", () => {
    const storage = memoryStorage();
    writeStoryReadLog(new Set(["arrival", "reply"]), storage);
    expect([...readStoryReadLog(storage)]).toEqual(["arrival", "reply"]);
  });

  it("reads an absent, corrupt or foreign-version log as nothing read", () => {
    expect(readStoryReadLog(memoryStorage())).toEqual(new Set());
    expect(
      readStoryReadLog(memoryStorage({ [STORY_READ_LOG_KEY]: "{" })),
    ).toEqual(new Set());
    expect(
      readStoryReadLog(
        memoryStorage({
          [STORY_READ_LOG_KEY]: JSON.stringify({ version: 2, beats: ["a"] }),
        }),
      ),
    ).toEqual(new Set());
  });

  it("keeps only usable beat ids out of a tampered payload", () => {
    expect([
      ...readStoryReadLog(
        memoryStorage({
          [STORY_READ_LOG_KEY]: JSON.stringify({
            version: 1,
            beats: ["arrival", 7, "", null],
          }),
        }),
      ),
    ]).toEqual(["arrival"]);
  });

  it("survives storage that refuses both reads and writes", () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoryReadLog(hostile)).toEqual(new Set());
    expect(() =>
      writeStoryReadLog(new Set(["arrival"]), hostile),
    ).not.toThrow();
    expect(readStoryReadLog(null)).toEqual(new Set());
  });
});

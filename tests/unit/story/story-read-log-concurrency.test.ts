import { describe, expect, it } from "vitest";
import {
  readStoryReadLog,
  withBeatRead,
  writeStoryReadLog,
} from "../../../src/story/playback/story-read-log.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("story read log concurrency", () => {
  it("preserves dialogue progress written by another open session", () => {
    const storage = memoryStorage();
    const firstSession = readStoryReadLog(storage);
    const staleSecondSession = readStoryReadLog(storage);

    writeStoryReadLog(withBeatRead(firstSession, "arrival"), storage);
    writeStoryReadLog(withBeatRead(staleSecondSession, "reply"), storage);

    expect([...readStoryReadLog(storage)]).toEqual(["arrival", "reply"]);
  });
});

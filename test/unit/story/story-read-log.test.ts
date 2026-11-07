import { afterEach, describe, expect, it } from "vitest";
import { withBeatRead } from "../../../src/story/playback/story-read-log.ts";
import { sqliteStoryReader } from "../../fixtures/sqlite-story-reader.ts";

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture() {
  const value = sqliteStoryReader();
  fixtures.push(value);
  return value;
}

describe("story read log", () => {
  it("round-trips the beats it was given through SQLite", async () => {
    const { preferences, runtime } = fixture();
    const port = preferences.storyReadLog;
    expect(await port.markRead("arrival")).toEqual({
      kind: "ok",
      value: undefined,
    });
    expect(await port.markRead("reply")).toEqual({
      kind: "ok",
      value: undefined,
    });
    expect([...(await port.read())]).toEqual(["arrival", "reply"]);
    expect(await runtime.readUser("story-read-log", "read")).toMatchObject({
      kind: "ok",
      value: {
        revision: 2,
        payload: { version: 1, beats: ["arrival", "reply"] },
      },
    });
  });

  it("reads an absent log as nothing read without writing a row", async () => {
    const { preferences, database } = fixture();
    expect(await preferences.storyReadLog.read()).toEqual(new Set());
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
  });

  it.each([
    "{",
    JSON.stringify({ version: 2, beats: ["a"] }),
    JSON.stringify({ version: 1, beats: ["arrival", 7, "", null] }),
  ])(
    "rejects corrupt or foreign current rows without altering bytes: %s",
    async (serialized) => {
      const { database, preferences } = fixture();
      database
        .prepare(
          "INSERT INTO user_records VALUES ('story-read-log', 'read', 1, ?)",
        )
        .run(serialized);
      const before = database.prepare("SELECT * FROM user_records").all();
      await expect(preferences.storyReadLog.read()).rejects.toThrow(
        "USER_DATA_INVALID",
      );
      expect(database.prepare("SELECT * FROM user_records").all()).toEqual(
        before,
      );
      expect(
        database.prepare("SELECT revision FROM user_data_meta").get(),
      ).toEqual({ revision: 0 });
    },
  );

  it("rejects unusable beat ids instead of silently filtering a write", async () => {
    const { preferences, database } = fixture();
    expect(await preferences.storyReadLog.markRead("")).toEqual({
      kind: "failed",
      error: { code: "USER_DATA_INVALID" },
    });
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
  });

  it("surfaces unavailable storage through the current read/write port", async () => {
    const { preferences, runtime } = fixture();
    await runtime.close();
    await expect(preferences.storyReadLog.read()).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
    expect(await preferences.storyReadLog.markRead("arrival")).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
  });

  it("adds a beat immutably and reuses a log already containing it", () => {
    const before = new Set(["arrival"]);
    const next = withBeatRead(before, "reply");
    expect([...before]).toEqual(["arrival"]);
    expect([...next]).toEqual(["arrival", "reply"]);
    expect(withBeatRead(next, "reply")).toBe(next);
  });
});

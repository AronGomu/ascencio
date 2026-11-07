import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqliteUserServices } from "../../../src/shell/adapters/sqlite-user-services.ts";
import { sqliteStoryReader } from "../../fixtures/sqlite-story-reader.ts";

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture(fault?: (point: string) => void) {
  const value = sqliteStoryReader(fault);
  fixtures.push(value);
  return value;
}

describe("story read log concurrency", () => {
  it("preserves dialogue progress written by another service sharing the owner", async () => {
    const { runtime, preferences } = fixture();
    const first = preferences.storyReadLog;
    const second = createSqliteUserServices(runtime).preferences.storyReadLog;
    expect(await first.read()).toEqual(new Set());
    const staleSecondSnapshot = await second.read();
    expect(
      await Promise.all([first.markRead("arrival"), second.markRead("reply")]),
    ).toEqual([
      { kind: "ok", value: undefined },
      { kind: "ok", value: undefined },
    ]);
    expect(staleSecondSnapshot).toEqual(new Set());
    expect([...(await second.read())]).toEqual(["arrival", "reply"]);
    expect(await runtime.readUser("story-read-log", "read")).toMatchObject({
      kind: "ok",
      value: {
        revision: 2,
        payload: { version: 1, beats: ["arrival", "reply"] },
      },
    });
  });

  it("flush waits for a failed in-flight mark without publishing it, then permits retry", async () => {
    let fail = true;
    const { runtime, preferences, database } = fixture((point) => {
      if (fail && point === "write-after-first")
        throw new Error("injected read-log failure");
    });
    const port = preferences.storyReadLog;
    await port.read();
    const write = runtime.writeUser.bind(runtime);
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    vi.spyOn(runtime, "writeUser").mockImplementation(async (mutations) => {
      reached();
      await gate;
      return write(mutations);
    });
    const marking = port.markRead("arrival");
    await started;
    let flushed = false;
    const flushing = port.flush().then((result) => {
      flushed = true;
      return result;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);
    release();
    const failure = { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
    expect(await marking).toEqual(failure);
    expect(await flushing).toEqual(failure);
    expect(await port.read()).toEqual(new Set());
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
    expect(
      database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual({ revision: 0 });
    fail = false;
    expect(await port.markRead("reply")).toEqual({
      kind: "ok",
      value: undefined,
    });
    expect(await port.flush()).toEqual({ kind: "ok", value: undefined });
    expect([...(await port.read())]).toEqual(["reply"]);
    expect(await runtime.readUser("story-read-log", "read")).toMatchObject({
      kind: "ok",
      value: { revision: 1, payload: { version: 1, beats: ["reply"] } },
    });
  });
});

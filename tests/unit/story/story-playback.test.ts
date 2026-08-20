import { describe, expect, it } from "vitest";
import {
  playbackDelayMs,
  playbackHalt,
  playbackNotice,
  SKIP_STEP_MS,
} from "../../../src/story/playback/story-playback.ts";

const running = {
  hasChoices: false,
  atLastBeat: false,
  nextBeatRead: true,
  skipUnread: false,
} as const;

describe("story playback decisions", () => {
  it("runs while the next beat is read and nothing blocks the scene", () => {
    expect(playbackHalt("auto", running)).toBeNull();
    expect(playbackHalt("skip", running)).toBeNull();
    expect(playbackHalt("off", { ...running, hasChoices: true })).toBeNull();
  });

  it("stops both modes at choices and at the end of the scene", () => {
    expect(playbackHalt("auto", { ...running, hasChoices: true })).toBe(
      "choice",
    );
    expect(playbackHalt("skip", { ...running, hasChoices: true })).toBe(
      "choice",
    );
    expect(playbackHalt("auto", { ...running, atLastBeat: true })).toBe("end");
    expect(playbackHalt("skip", { ...running, atLastBeat: true })).toBe("end");
  });

  it("stops skip at unread text unless the reader opted in, and never stops auto there", () => {
    const unread = { ...running, nextBeatRead: false };
    expect(playbackHalt("skip", unread)).toBe("unread");
    expect(playbackHalt("skip", { ...unread, skipUnread: true })).toBeNull();
    expect(playbackHalt("auto", unread)).toBeNull();
  });

  it("paces auto by the setting and skip by one fixed step", () => {
    expect(playbackDelayMs("auto", 3)).toBe(3000);
    expect(playbackDelayMs("skip", 3)).toBe(SKIP_STEP_MS);
    expect(playbackDelayMs("off", 3)).toBe(SKIP_STEP_MS);
  });

  it("clamps an out-of-range or unusable auto speed to the slider's range", () => {
    expect(playbackDelayMs("auto", 0)).toBe(1000);
    expect(playbackDelayMs("auto", 99)).toBe(8000);
    expect(playbackDelayMs("auto", Number.NaN)).toBe(1000);
  });

  it("names the reason for every stop", () => {
    expect(playbackNotice("skip", "unread")).toContain("not read yet");
    expect(playbackNotice("skip", "unread")).toContain("Skip unread text");
    expect(playbackNotice("auto", "choice")).toContain("Auto");
    expect(playbackNotice("skip", "choice")).toContain("Skip");
    expect(playbackNotice("auto", "end")).toContain("end of the scene");
  });
});

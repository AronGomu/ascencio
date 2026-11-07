import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_FLIP_INTERVAL_MS,
  createAutoFlip,
} from "../../../src/story/shop/auto-flip.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function record(total: number, intervalMs?: number) {
  const flipped: number[] = [];
  const autoFlip = createAutoFlip({
    total,
    ...(intervalMs === undefined ? {} : { intervalMs }),
    onFlip: (index) => flipped.push(index),
  });
  return { flipped, autoFlip };
}

describe("createAutoFlip", () => {
  it("flips left to right, one card per interval", () => {
    const { flipped, autoFlip } = record(3);
    autoFlip.start();

    expect(flipped).toEqual([]);
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    expect(flipped).toEqual([0]);
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    expect(flipped).toEqual([0, 1]);
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    expect(flipped).toEqual([0, 1, 2]);
  });

  it("stops itself at the last card rather than running an empty timer", () => {
    const { flipped, autoFlip } = record(2);
    autoFlip.start();
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS * 6);
    expect(flipped).toEqual([0, 1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stop cancels the pending flip and start resumes where it left off", () => {
    const { flipped, autoFlip } = record(4);
    autoFlip.start();
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    autoFlip.stop();
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS * 3);
    expect(flipped).toEqual([0]);

    autoFlip.start();
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    expect(flipped).toEqual([0, 1]);
  });

  it("a second start does not double the pace", () => {
    const { flipped, autoFlip } = record(4);
    autoFlip.start();
    autoFlip.start();
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    expect(flipped).toEqual([0]);
  });

  it("honours a caller's own interval", () => {
    const { flipped, autoFlip } = record(2, 100);
    autoFlip.start();
    vi.advanceTimersByTime(100);
    expect(flipped).toEqual([0]);
  });

  it("starting an empty pack schedules nothing", () => {
    const { autoFlip } = record(0);
    autoFlip.start();
    expect(vi.getTimerCount()).toBe(0);
  });
});

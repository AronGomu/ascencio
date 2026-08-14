import { describe, expect, it, vi } from "vitest";
import { settleOnce } from "../../src/battle/settle-once.ts";

describe("settleOnce", () => {
  it("forwards the first value and ignores every later one", () => {
    const sink = vi.fn();
    const settle = settleOnce<string>(sink);

    settle("first");
    settle("second");
    settle("third");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("first");
  });

  /* A sink that throws has still consumed its one settle: retrying would let
     a second, different result reach a host that already saw one. */
  it("stays settled when the sink throws", () => {
    const sink = vi.fn(() => {
      throw new Error("sink failed");
    });
    const settle = settleOnce<string>(sink);

    expect(() => settle("first")).toThrow("sink failed");
    settle("second");

    expect(sink).toHaveBeenCalledTimes(1);
  });
});

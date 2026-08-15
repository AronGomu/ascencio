import { describe, expect, it } from "vitest";
import type { BattleFacadeResult } from "../../../src/battle/battle-contracts.ts";
import {
  acceptsResult,
  ENCOUNTER_LABELS,
  storyBattleResult,
  toStoryResolution,
  type PendingStoryDuel,
} from "../../../src/story/handoff/story-handoff.ts";

const PENDING: PendingStoryDuel = {
  handoffId: "h1",
  encounterId: "old-arena",
};

describe("toStoryResolution", () => {
  it("maps a resolved win onto the win branch", () => {
    expect(
      toStoryResolution({ kind: "resolved", outcome: "player-win" }),
    ).toEqual({ kind: "win" });
  });

  it("maps a resolved loss onto the loss branch", () => {
    expect(
      toStoryResolution({ kind: "resolved", outcome: "player-loss" }),
    ).toEqual({ kind: "loss" });
  });

  /* A draw is a duel that finished without the player winning it, so it takes
     the same authored branch as a loss: the story's loss scene already reads
     as "the duel completed and that was enough". */
  it("maps a draw onto the documented loss branch", () => {
    expect(toStoryResolution({ kind: "resolved", outcome: "draw" })).toEqual({
      kind: "loss",
    });
  });

  it.each(["surrender", "exit"] as const)(
    "maps an abort by %s onto the abort branch",
    (reason) => {
      expect(toStoryResolution({ kind: "aborted", reason })).toEqual({
        kind: "abort",
      });
    },
  );

  /* The property this whole slice exists to protect: a duel that never
     finished must not advance the story past a defeat it never dealt. */
  it("maps a technical failure onto the failure branch, never onto a loss", () => {
    const resolution = toStoryResolution({
      kind: "failed",
      message: "Unable to initialize the Duel Worker",
    });
    expect(resolution.kind).toBe("failure");
    expect(resolution).toEqual({
      kind: "failure",
      message: "Unable to initialize the Duel Worker",
    });
  });

  it("never reports a failure as any player-facing duel ending", () => {
    const failures: readonly BattleFacadeResult[] = [
      { kind: "failed", message: "worker gone" },
      { kind: "failed", message: "" },
    ];
    for (const failure of failures)
      expect(["win", "loss", "abort"]).not.toContain(
        toStoryResolution(failure).kind,
      );
  });
});

describe("storyBattleResult", () => {
  it.each([
    [{ kind: "win" } as const, "win"],
    [{ kind: "loss" } as const, "loss"],
    [{ kind: "abort" } as const, "abort"],
    [{ kind: "failure", message: "x" } as const, "failure"],
  ])("maps %o onto the reducer's %s branch", (resolution, expected) => {
    expect(storyBattleResult(resolution)).toBe(expected);
  });
});

describe("acceptsResult", () => {
  it("accepts only the pending handoff", () => {
    expect(acceptsResult(PENDING, "h1")).toBe(true);
    expect(acceptsResult(PENDING, "h2")).toBe(false);
  });

  it("accepts nothing while no duel is pending", () => {
    expect(acceptsResult(null, "h1")).toBe(false);
    expect(acceptsResult(null, "")).toBe(false);
  });

  it("refuses an empty handoff id even against a pending duel", () => {
    expect(acceptsResult({ ...PENDING, handoffId: "" }, "")).toBe(false);
  });
});

describe("ENCOUNTER_LABELS", () => {
  it("names every encounter the map can start", () => {
    expect(Object.keys(ENCOUNTER_LABELS).sort()).toEqual([
      "archive",
      "hidden-gate",
      "old-arena",
    ]);
    expect(ENCOUNTER_LABELS["old-arena"]).toBe("Rin's Echo");
  });
});

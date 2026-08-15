import { describe, expect, it } from "vitest";
import type { DuelPhase } from "../../src/battle/duel/contracts/public-duel-state.ts";
import {
  DUEL_PHASE_LABELS,
  duelPhaseLabel,
} from "../../src/battle/app/presentation/duel-phase-label.ts";

describe("duelPhaseLabel", () => {
  it("every phase has a label", () => {
    const keys = Object.keys(DUEL_PHASE_LABELS);
    expect(keys).toHaveLength(11);
    const phases: readonly DuelPhase[] = [
      "draw",
      "standby",
      "main1",
      "battleStart",
      "battleStep",
      "damage",
      "damageCalculation",
      "battle",
      "main2",
      "end",
      "unknown",
    ];
    for (const phase of phases) {
      expect(keys).toContain(phase);
    }
  });

  it("phase label maps main1", () => {
    expect(duelPhaseLabel("main1")).toBe("Main 1");
  });

  it("phase label maps damageCalculation", () => {
    expect(duelPhaseLabel("damageCalculation")).toBe("Damage Calculation");
  });
});

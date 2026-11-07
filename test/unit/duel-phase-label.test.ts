import { describe, expect, it } from "vitest";
import { duelPhaseLabel } from "../../src/battle/app/presentation/duel-phase-label.ts";

describe("duelPhaseLabel", () => {
  it("phase label maps main1", () => {
    expect(duelPhaseLabel("main1")).toBe("Main 1");
  });

  it("phase label maps damageCalculation", () => {
    expect(duelPhaseLabel("damageCalculation")).toBe("Damage Calculation");
  });
});

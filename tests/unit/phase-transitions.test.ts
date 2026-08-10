import { describe, expect, it } from "vitest";
import {
  phaseSlotChoices,
  phaseSlotForDuelPhase,
} from "../../src/app/prompts/phase-transitions.ts";
import { choiceId } from "../../src/duel/contracts/ids.ts";
import type { ActiveInteractionSpec } from "../../src/app/prompts/interaction-spec.ts";
import type { DuelPhase } from "../../src/duel/contracts/public-duel-state.ts";

const PHASE_TO_SLOT: Readonly<Record<DuelPhase, string | null>> = {
  draw: "draw",
  standby: "standby",
  main1: "main1",
  battleStart: "battle",
  battleStep: "battle",
  damage: "battle",
  damageCalculation: "battle",
  battle: "battle",
  main2: "main2",
  end: "end",
  unknown: null,
};

function specWithGlobalChoices(
  entries: readonly [string, "battlePhase" | "endPhase" | "mainPhase2"][],
): ActiveInteractionSpec {
  const globalChoices = new Map(
    entries.map(([id, action]) => [
      choiceId(id),
      { id: choiceId(id), label: id, action },
    ]),
  );
  return { globalChoices } as unknown as ActiveInteractionSpec;
}

describe("phaseSlotForDuelPhase", () => {
  it("maps every engine phase to a slot", () => {
    for (const [phase, slot] of Object.entries(PHASE_TO_SLOT)) {
      expect(phaseSlotForDuelPhase(phase as DuelPhase)).toBe(slot);
    }
  });
});

describe("phaseSlotChoices", () => {
  it("maps global choices to slots", () => {
    const spec = specWithGlobalChoices([
      ["battle", "battlePhase"],
      ["end", "endPhase"],
    ]);
    const map = phaseSlotChoices(spec);
    expect(map.size).toBe(2);
    expect(map.get("battle")?.id).toBe(choiceId("battle"));
    expect(map.get("end")?.id).toBe(choiceId("end"));
  });

  it("returns an empty map for no spec", () => {
    expect(phaseSlotChoices(null).size).toBe(0);
  });
});

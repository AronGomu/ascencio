import { describe, expect, it } from "vitest";
import {
  PHASE_SLOT_LABELS,
  phaseSlotChoices,
  phaseSlotForDuelPhase,
} from "../../src/battle/app/prompts/phase-transitions.ts";
import { choiceId } from "../../src/battle/duel/contracts/ids.ts";
import type { ActiveInteractionSpec } from "../../src/battle/app/prompts/interaction-spec.ts";
import type { DuelPhase } from "../../src/battle/duel/contracts/public-duel-state.ts";

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

describe("end compatibility", () => {
  it("keeps the end slot label for current-phase compatibility", () => {
    expect(PHASE_SLOT_LABELS.end).toBe("End");
  });

  it("still maps the engine's end phase to the end slot", () => {
    expect(phaseSlotForDuelPhase("end")).toBe("end");
  });

  it("still maps the endPhase choice to the end slot", () => {
    const spec = specWithGlobalChoices([["end", "endPhase"]]);
    expect(phaseSlotChoices(spec).get("end")?.id).toBe(choiceId("end"));
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

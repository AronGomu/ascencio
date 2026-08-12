import type { DuelPhase } from "../../duel/contracts/public-duel-state.ts";
import type {
  ActiveInteractionSpec,
  InteractionChoice,
} from "./interaction-spec.ts";

export type PhaseSlot =
  "draw" | "standby" | "main1" | "battle" | "main2" | "end";

export const PHASE_SLOTS_LEFT: readonly PhaseSlot[] = [
  "draw",
  "standby",
  "main1",
  "battle",
];

export const PHASE_SLOTS_RIGHT: readonly PhaseSlot[] = ["main2"];

export const PHASE_SLOT_LABELS: Readonly<Record<PhaseSlot, string>> = {
  draw: "Draw",
  standby: "Standby",
  main1: "Main 1",
  battle: "Battle",
  main2: "Main 2",
  end: "End",
};

const PHASE_TO_SLOT: Readonly<Record<DuelPhase, PhaseSlot | null>> = {
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

/** Which chip the engine's current phase lights up. `null` for "unknown". */
export function phaseSlotForDuelPhase(phase: DuelPhase): PhaseSlot | null {
  return PHASE_TO_SLOT[phase];
}

/** Chips the engine is currently offering to move to, keyed by slot. */
export function phaseSlotChoices(
  spec: ActiveInteractionSpec | null,
): ReadonlyMap<PhaseSlot, InteractionChoice> {
  const result = new Map<PhaseSlot, InteractionChoice>();
  if (spec === null) return result;
  for (const choice of spec.globalChoices.values()) {
    let slot: PhaseSlot | null = null;
    if (choice.action === "battlePhase") slot = "battle";
    else if (choice.action === "mainPhase2") slot = "main2";
    else if (choice.action === "endPhase") slot = "end";
    if (slot !== null && !result.has(slot)) result.set(slot, choice);
  }
  return result;
}

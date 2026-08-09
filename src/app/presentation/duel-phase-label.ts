import type { DuelPhase } from "../../duel/contracts/public-duel-state.ts";

export const DUEL_PHASE_LABELS: Readonly<Record<DuelPhase, string>> =
  Object.freeze({
    draw: "Draw",
    standby: "Standby",
    main1: "Main 1",
    battleStart: "Battle Start",
    battleStep: "Battle Step",
    damage: "Damage",
    damageCalculation: "Damage Calculation",
    battle: "Battle",
    main2: "Main 2",
    end: "End",
    unknown: "Unknown",
  });

export function duelPhaseLabel(phase: DuelPhase): string {
  return DUEL_PHASE_LABELS[phase];
}

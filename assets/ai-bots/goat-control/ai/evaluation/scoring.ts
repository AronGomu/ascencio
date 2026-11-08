import type { PromptChoice } from "../../../../../src/battle/duel/contracts/player-prompt.ts";
/** Independent initial copy of the Generalist baseline; specialize GOAT scoring here. */
import { EnginePosition } from "../../../../../src/battle/worker/engine/engine-constants.ts";
import type { ActiveDuelDependencies } from "../../../../../src/battle/worker/assets/active-duel-dependencies.ts";

import type { GeneralistStrategy } from "../../../../../src/battle/worker/bot/strategy-contract.ts";

export function baselineStrategy(
  dependencies: Pick<ActiveDuelDependencies, "cards">,
): GeneralistStrategy {
  return (input, choice) => {
    const { prompt, observation } = input;
    const stats =
      choice.card?.code === undefined
        ? undefined
        : dependencies.cards.get(choice.card.code);
    const attack = Math.max(0, stats?.attack ?? 0);
    const defense = Math.max(0, stats?.defense ?? 0);
    const enemies =
      observation.publicState?.players[prompt.player === 0 ? 1 : 0].monsters ??
      [];
    const knownThreat = Math.max(
      0,
      ...enemies
        .filter((c) => c.faceUp)
        .map((c) =>
          c.code === undefined
            ? 0
            : Math.max(0, dependencies.cards.get(c.code)?.attack ?? 0),
        ),
    );
    let score = 0;
    let code = "legal_fallback";
    if (prompt.kind === "idleCommand") {
      const priorities: Partial<Record<PromptChoice["action"], number>> = {
        summon: 100,
        specialSummon: 110,
        flipSummon: 90,
        activate: 60,
        setMonster: 50,
        setSpellTrap: 40,
        battlePhase: 20,
        endPhase: 10,
        changePosition: -10,
        shuffle: -100,
      };
      score = priorities[choice.action] ?? 0;
      if (["summon", "specialSummon", "flipSummon"].includes(choice.action))
        score += attack / 1000;
      if (choice.action === "setMonster") score += defense / 1000;
      if (
        choice.action === "changePosition" &&
        choice.card?.position === "faceUpDefense" &&
        attack >= knownThreat
      )
        score = 80;
      code = "develop_board";
    } else if (prompt.kind === "battleCommand") {
      // Printed stats are a cheap estimate, never an assertion of combat legality.
      score =
        choice.action === "attack"
          ? enemies.length === 0 || attack >= knownThreat
            ? 100 + attack / 1000
            : -10
          : choice.action === "mainPhase2"
            ? 20
            : choice.action === "endPhase"
              ? 10
              : 0;
      code = "estimate_combat";
    } else if (
      prompt.kind === "chain" ||
      prompt.kind === "effectYesNo" ||
      prompt.kind === "yesNo"
    ) {
      score = choice.action === "yes" || choice.action === "activate" ? 10 : 0;
      code = "try_offered_effect";
    } else if (prompt.kind === "selectPosition") {
      const aggressive = attack >= knownThreat && attack >= defense;
      score =
        choice.value ===
        (aggressive
          ? EnginePosition.FACE_UP_ATTACK
          : EnginePosition.FACE_UP_DEFENSE)
          ? 10
          : 0;
      code = "choose_position";
    } else if (prompt.kind === "selectTribute") {
      score = -attack;
      code = "retain_stronger_monsters";
    } else if (prompt.kind === "selectCard" && choice.card) {
      score = choice.card.controller === prompt.player ? attack : -attack;
      code = "rank_visible_cards";
    } else if (prompt.kind === "selectUnselectCard") {
      score = choice.action === "finish" ? 10 : choice.selected ? -1 : 0;
      code = "complete_selection";
    }
    return {
      score,
      code,
      explanation: `Rank ${choice.action} using ${code.replaceAll("_", " ")} (score ${score}).`,
    };
  };
}

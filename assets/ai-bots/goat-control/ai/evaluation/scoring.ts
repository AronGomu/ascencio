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
    const opponent =
      observation.publicState?.players[prompt.player === 0 ? 1 : 0];
    const effect = observation.publicState?.chain.at(-1);
    const own = observation.publicState?.players[prompt.player];
    if (
      choice.action === "activate" &&
      choice.card?.code === 71044499 &&
      opponent &&
      !opponent.monsters.some((card) => !card.faceUp)
    )
      return {
        score: -1000,
        code: "preserve_nobleman",
        explanation: "Keep Nobleman without an opposing face-down target.",
      };
    if (
      prompt.kind === "selectCard" &&
      effect?.controller === prompt.player &&
      effect.sourceIdentityVisible &&
      effect.sourceCard === 5318639 &&
      choice.card &&
      ["spellTrap", "field"].includes(choice.card.location)
    )
      return {
        score: choice.card.controller === prompt.player ? -1000 : 1000,
        code: "mst_enemy_target",
        explanation: "Prefer opposing backrow for our pending MST.",
      };
    if (
      choice.action === "activate" &&
      choice.card?.code === 5318639 &&
      opponent &&
      opponent.spellsAndTraps.length === 0
    )
      return {
        score: -1000,
        code: "preserve_mst",
        explanation: "Keep MST without opposing backrow.",
      };
    if (
      choice.action === "activate" &&
      choice.card?.code === 19613556 &&
      opponent &&
      opponent.spellsAndTraps.length === 0
    )
      return {
        score: -1000,
        code: "preserve_heavy_storm",
        explanation: "Do not clear only our backrow.",
      };
    const usefulFlip =
      choice.card?.code === 31560081
        ? own?.graveyard.some(
            (card) =>
              card.code !== undefined &&
              ((dependencies.cards.get(card.code)?.type ?? 0) & 2) !== 0,
          )
        : choice.card?.code === 33508719 &&
          own &&
          opponent &&
          own.handCount - 1 < 5 &&
          own.handCount - 1 <= opponent.handCount;
    if (
      prompt.kind === "idleCommand" &&
      choice.action === "summon" &&
      usefulFlip &&
      prompt.choices.some(
        (alternative) =>
          alternative.action === "setMonster" &&
          alternative.card?.instanceId === choice.card?.instanceId,
      ) &&
      opponent?.monsters.some(
        (card) =>
          card.faceUp &&
          card.code !== undefined &&
          (dependencies.cards.get(card.code)?.attack ?? 0) >
            (dependencies.cards.get(choice.card!.code!)?.attack ?? 0),
      )
    )
      return {
        score: -1000,
        code: "protect_flip_utility",
        explanation:
          "Set a useful flip monster instead of exposing it to a stronger visible monster.",
      };
    if (
      choice.action === "activate" &&
      choice.card?.code === 53582587 &&
      own &&
      opponent &&
      opponent.monsters.length === 0 &&
      own.monsters.some(
        (card) =>
          card.code !== 26202165 &&
          card.code !== undefined &&
          ((dependencies.cards.get(card.code)?.type ?? 0) & 16384) === 0,
      )
    )
      return {
        score: -1000,
        code: "preserve_own_board",
        explanation:
          "Decline Torrential when only our non-token board would be lost.",
      };
    if (
      prompt.kind === "selectCard" &&
      effect?.controller === prompt.player &&
      effect.sourceIdentityVisible &&
      effect.sourceCard === 71044499 &&
      choice.card?.location === "monster"
    )
      return {
        score: choice.card.controller === prompt.player ? -1000 : 1000,
        code: "nobleman_enemy_target",
        explanation: "Prefer opposing monsters for our pending Nobleman.",
      };
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

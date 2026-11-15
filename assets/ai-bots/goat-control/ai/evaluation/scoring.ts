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
    // ai-rule: bls-enemy-target
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 72989439 && choice.card && choice.card.location === "monster") { return {score:choice.card.controller === prompt.player ? -10000 : 10000,code:"bls_enemy_banish",explanation:"Prefer an offered opposing target over our own resource."}; }
    }

    // ai-rule: bls-safe-activation
    {
      if (prompt.kind === "idleCommand" && choice.action === "activate" && choice.card?.code === 72989439 && opponent && opponent.monsters.length === 0) { return {score:-10000,code:"bls_require_enemy",explanation:"Preserve our board when BLS has no opposing banish target."}; }
    }

    // ai-rule: book-enemy-target
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 14087893 && (observation.publicState?.chain.length ?? 0) === 1 && choice.card?.location === "monster" && prompt.choices.some(other => other.card?.controller !== prompt.player && other.card?.location === "monster") && !prompt.choices.some(other => other.card?.controller === prompt.player && other.card.code !== undefined && ((dependencies.cards.get(other.card.code)?.type ?? 0) & (0x200000 | 0x200)) !== 0)) { return {score:choice.card.controller === prompt.player ? -10000 : 10000,code:"book_enemy_target",explanation:"Turn an offered opposing monster down when no reactive or own Flip/Spirit reset is visible."}; }
    }

    // ai-rule: book-safe-activation
    {
      if (choice.action === "activate" && choice.card?.code === 14087893 && observation.chainSize === 0 && own && opponent && !opponent.monsters.some(card => card.faceUp) && !own.monsters.some(card => card.faceUp && card.code !== undefined && ((dependencies.cards.get(card.code)?.type ?? 0) & (0x200000 | 0x200)) !== 0)) { return {score:-10000,code:"book_preserve_without_threat",explanation:"Preserve Book when no opposing face-up target or own Flip/Spirit utility is visible."}; }
    }

    // ai-rule: breaker-enemy-target
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 71413901 && choice.card && ["spellTrap", "field"].includes(choice.card.location)) { return {score:choice.card.controller === prompt.player ? -10000 : 10000,code:"breaker_enemy_backrow",explanation:"Prefer an offered opposing target over our own resource."}; }
    }

    // ai-rule: breaker-safe-activation
    {
      if (prompt.kind === "idleCommand" && choice.action === "activate" && choice.card?.code === 71413901 && opponent && opponent.spellsAndTraps.length === 0) { return {score:-10000,code:"breaker_preserve_own_backrow",explanation:"Retain the counter when only our backrow can be removed."}; }
    }

    // ai-rule: discard-sinister-first
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && [79571449,33184167,69162969].includes(effect.sourceCard ?? 0) && choice.card?.location === "hand" && choice.card.controller === prompt.player && choice.card.code === 8131171) { return {score:10000,code:"discard_recoverable_serpent",explanation:"Spend the offered recoverable Sinister Serpent for this known discard effect."}; }
    }

    // ai-rule: faith-set-for-value
    {
      if (prompt.kind === "idleCommand" && choice.action === "summon" && choice.card?.code === 31560081 && own && opponent && opponent.lifePoints > 300 && (observation.turn <= 2 || own.graveyard.some(card => card.code !== undefined && ((dependencies.cards.get(card.code)?.type ?? 0) & 2) !== 0)) && prompt.choices.some(other => other.action === "setMonster" && other.card?.instanceId === choice.card?.instanceId)) { return {score:-10000,code:"faith_preserve_flip",explanation:"Keep Magician of Faith set when its flip has visible or opening value."}; }
    }

    // ai-rule: mst-preserve-no-negation
    {
      if (choice.action === "activate" && choice.card?.code === 5318639 && opponent && opponent.spellsAndTraps.length > 0) { const links = observation.publicState?.chain ?? []; const onlySpentSources = opponent.spellsAndTraps.every(card => card.faceUp && card.code !== undefined && ((dependencies.cards.get(card.code)?.type ?? 0) & (0x20000 | 0x40000 | 0x80000)) === 0 && links.some(link => link.controller !== prompt.player && link.sourceIdentityVisible && link.sourceInstanceId === card.instanceId)); if (onlySpentSources) { return {score:-10000,code:"mst_preserve_against_one_shot",explanation:"Destroying a resolving one-shot source does not negate its effect."}; } }
    }

    // ai-rule: ring-non-token-target
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 83555666 && choice.card?.location === "monster" && choice.card.controller !== prompt.player) { const stats = choice.card.code === undefined ? undefined : dependencies.cards.get(choice.card.code); const token = ((stats?.type ?? 0) & 16384) !== 0; return {score:token ? -10000 : stats ? 10000 + Math.max(0, stats.attack) : 0,code:"ring_non_token",explanation:"Prefer a visible non-token threat over a disposable token."}; }
    }

    // ai-rule: snatch-non-token
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 45986603 && choice.card?.location === "monster" && choice.card.controller !== prompt.player) { const stats = choice.card.code === undefined ? undefined : dependencies.cards.get(choice.card.code); const token = ((stats?.type ?? 0) & 16384) !== 0; return {score:token ? -10000 : stats ? 10000 + Math.max(0, stats.attack) : 0,code:"snatch_non_token",explanation:"Prefer a visible non-token threat over a disposable token."}; }
    }

    // ai-rule: swap-token-giveaway
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 31036355 && choice.card?.location === "monster" && choice.card.controller === prompt.player) { const ownChoices = prompt.choices.filter(other => other.card?.controller === prompt.player && other.card.location === "monster"); const hasToken = ownChoices.some(other => other.card?.code !== undefined && ((dependencies.cards.get(other.card.code)?.type ?? 0) & 16384) !== 0); const hasReturnOrSearch = ownChoices.some(other => other.card?.code === 26202165 || (other.card?.code !== undefined && ((dependencies.cards.get(other.card.code)?.type ?? 0) & 0x200) !== 0)); if (hasToken && !hasReturnOrSearch) { const token = choice.card.code !== undefined && ((dependencies.cards.get(choice.card.code)?.type ?? 0) & 16384) !== 0; return {score:token ? 10000 : -10000,code:"swap_give_disposable_token",explanation:"Give an offered token while preserving non-token material; search and Spirit cases stay unchanged."}; } }
    }

    // ai-rule: ter-non-token
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 63519819 && choice.card?.location === "monster" && choice.card.controller !== prompt.player) { const stats = choice.card.code === undefined ? undefined : dependencies.cards.get(choice.card.code); const token = ((stats?.type ?? 0) & 16384) !== 0; return {score:token ? -10000 : stats ? 10000 + Math.max(0, stats.attack) : 0,code:"ter_non_token",explanation:"Prefer a visible non-token threat over a disposable token."}; }
    }

    // ai-rule: tsukuyomi-enemy-target
    {
      if (prompt.kind === "selectCard" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 34853266 && choice.card?.location === "monster" && prompt.choices.some(other => other.card?.controller !== prompt.player && other.card?.location === "monster") && !prompt.choices.some(other => other.card?.controller === prompt.player && other.card.code !== undefined && ((dependencies.cards.get(other.card.code)?.type ?? 0) & 0x200000) !== 0)) { return {score:choice.card.controller === prompt.player ? -10000 : 10000,code:"tsukuyomi_enemy_target",explanation:"Use Tsukuyomi on an offered opposing monster while preserving own Flip-reset opportunities."}; }
    }

    // ai-rule: virus-race-value
    {
      if (prompt.kind === "announceRace" && effect?.controller === prompt.player && effect.sourceIdentityVisible && effect.sourceCard === 33184167 && own && opponent && choice.value !== undefined) { const race = Number(choice.value); if (Number.isSafeInteger(race) && race > 0) { const value = (cards: typeof own.monsters) => cards.reduce((sum, card) => { const stats = card.faceUp && card.code !== undefined ? dependencies.cards.get(card.code) : undefined; return sum + (stats && (Number(stats.race) & race) !== 0 ? 500 + Math.max(0, stats.attack) : 0); }, 0); return {score:value(opponent.monsters) - value(own.monsters),code:"virus_visible_race_value",explanation:"Declare a type using visible opposing removal value minus our own losses."}; } }
    }

    // ai-rule: virus-safe-activation
    {
      if (prompt.kind === "idleCommand" && choice.action === "activate" && choice.card?.code === 33184167 && opponent && !opponent.monsters.some(card => card.faceUp)) { return {score:-10000,code:"virus_require_faceup_enemy",explanation:"Keep the discard when Virus has no face-up opposing monster to remove."}; }
    }

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

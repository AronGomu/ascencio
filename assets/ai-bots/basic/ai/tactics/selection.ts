import type { ChoiceId } from "../../../../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../../../../src/battle/duel/contracts/player-prompt.ts";
import type { ActiveDuelDependencies } from "../../../../../src/battle/worker/assets/active-duel-dependencies.ts";
import type {
  OpponentPolicy,
  OpponentDecision,
  OpponentDecisionReason,
  OpponentVisibleDuelState,
} from "../../../../../src/battle/worker/opponent/OpponentPolicy.ts";
import { findValidContributionSelection } from "../../../../../src/battle/worker/protocol/sum-selection.ts";

export class BasicOpponentPolicy implements OpponentPolicy {
  readonly #dependencies: Pick<ActiveDuelDependencies, "cards">;
  #loop: {
    stateFingerprint: string;
    promptSignature: string;
    consecutive: number;
    tried: ReadonlySet<string>;
  } | null = null;

  constructor(dependencies: Pick<ActiveDuelDependencies, "cards">) {
    this.#dependencies = dependencies;
  }

  choose(
    prompt: PlayerPrompt,
    visibleState: OpponentVisibleDuelState,
  ): OpponentDecision {
    const normal = this.#chooseNormally(prompt);
    const promptSignature = opponentPromptSignature(prompt);
    const stateFingerprint = opponentVisibleStateFingerprint(visibleState);
    if (
      this.#loop?.promptSignature !== promptSignature ||
      this.#loop.stateFingerprint !== stateFingerprint
    ) {
      this.#loop = {
        stateFingerprint,
        promptSignature,
        consecutive: 1,
        tried: new Set(normalChoiceKeys(prompt, normal)),
      };
      return normal;
    }

    const tried = new Set(this.#loop.tried);
    for (const key of normalChoiceKeys(prompt, normal)) tried.add(key);
    this.#loop = {
      stateFingerprint,
      promptSignature,
      consecutive: this.#loop.consecutive + 1,
      tried,
    };
    if (
      this.#loop.consecutive < 3 ||
      normal.choiceIds.length !== 1 ||
      prompt.maximum !== 1
    ) {
      return normal;
    }

    const alternative = prompt.choices.find(
      (choice) =>
        !tried.has(semanticChoiceKey(choice)) && !isExitAction(choice.action),
    );
    if (alternative !== undefined) {
      tried.add(semanticChoiceKey(alternative));
      this.#loop = { ...this.#loop, tried };
      return {
        choiceIds: [alternative.id],
        reason: "break_loop_alternative",
      };
    }

    for (const action of exitActions) {
      const exit = prompt.choices.find((choice) => choice.action === action);
      if (exit !== undefined)
        return { choiceIds: [exit.id], reason: "break_loop_exit" };
    }
    return normal;
  }

  #chooseNormally(prompt: PlayerPrompt): OpponentDecision {
    if (prompt.choices.length === 0 && prompt.minimum === 0)
      return { choiceIds: [], reason: "select_first_legal" };
    if (prompt.choices.length === 0)
      throw new Error(`Prompt ${prompt.kind} has no legal choices`);

    switch (prompt.kind) {
      case "idleCommand":
        return this.#chooseIdle(prompt);
      case "battleCommand": {
        const attacks = prompt.choices.filter(
          (choice) => choice.action === "attack",
        );
        if (attacks.length > 0) {
          const strongest = [...attacks].sort(
            (left, right) => this.#attack(right) - this.#attack(left),
          )[0];
          if (strongest !== undefined) {
            return { choiceIds: [strongest.id], reason: "attack_strongest" };
          }
        }
        return {
          choiceIds: [prefer(prompt.choices, ["mainPhase2", "endPhase"]).id],
          reason: "advance_phase",
        };
      }
      case "chain": {
        const pass = prompt.choices.find((choice) => choice.action === "pass");
        return pass === undefined
          ? { choiceIds: [prompt.choices[0]!.id], reason: "answer_mandatory" }
          : { choiceIds: [pass.id], reason: "decline_optional" };
      }
      case "yesNo":
      case "effectYesNo": {
        const no = prompt.choices.find((choice) => choice.action === "no");
        return no === undefined
          ? { choiceIds: [prompt.choices[0]!.id], reason: "answer_mandatory" }
          : { choiceIds: [no.id], reason: "decline_optional" };
      }
      case "selectSum": {
        const valid = validSum(prompt);
        return { choiceIds: valid, reason: "select_valid_sum" };
      }
      case "sortCard":
      case "sortChain":
        return {
          choiceIds: prompt.choices.map((choice) => choice.id),
          reason: "preserve_order",
        };
      case "selectCounter": {
        const selected: ChoiceId[] = [];
        for (const choice of prompt.choices) {
          const capacity = choice.allocationMaximum ?? 0;
          const allocation = Math.min(
            capacity,
            prompt.minimum - selected.length,
          );
          for (let count = 0; count < allocation; count += 1)
            selected.push(choice.id);
          if (selected.length === prompt.minimum) break;
        }
        if (selected.length !== prompt.minimum) {
          throw new Error(
            `No legal counter allocation satisfies ${prompt.minimum}`,
          );
        }
        return { choiceIds: selected, reason: "select_first_legal" };
      }
      case "selectTribute": {
        const ids: ChoiceId[] = [];
        let total = 0;
        for (const choice of prompt.choices) {
          if (ids.length >= prompt.maximum) break;
          ids.push(choice.id);
          total += choice.card?.contribution ?? 1;
          if (total >= (prompt.requiredTotal ?? prompt.minimum))
            return { choiceIds: ids, reason: "select_first_legal" };
        }
        throw new Error("No legal tribute selection");
      }
      case "selectCard":
      case "selectPlace":
      case "selectDisabledField":
      case "announceAttribute":
      case "announceRace": {
        return {
          choiceIds: prompt.choices
            .slice(0, prompt.minimum)
            .map((choice) => choice.id),
          reason: "select_first_legal",
        };
      }
      case "selectUnselectCard": {
        const finish = prompt.choices.find(
          (choice) => choice.action === "finish",
        );
        return {
          choiceIds: [(finish ?? prompt.choices[0]!).id],
          reason: "select_first_legal",
        };
      }
      case "option":
      case "selectPosition":
      case "announceNumber":
      case "announceCard":
      case "rockPaperScissors":
        return {
          choiceIds: [prompt.choices[0]!.id],
          reason: "select_first_legal",
        };
    }
  }

  #chooseIdle(prompt: PlayerPrompt): OpponentDecision {
    const priorities: readonly [
      readonly PromptChoice["action"][],
      OpponentDecisionReason,
    ][] = [
      [["summon"], "summon_first_legal"],
      [["specialSummon"], "special_summon_first_legal"],
      [["activate"], "activate_first_legal"],
      [["setMonster", "setSpellTrap"], "set_first_legal"],
      [["battlePhase", "endPhase"], "advance_phase"],
    ];
    for (const [actions, reason] of priorities) {
      const selected = prompt.choices.find((choice) =>
        actions.includes(choice.action),
      );
      if (selected !== undefined) return { choiceIds: [selected.id], reason };
    }
    return { choiceIds: [prompt.choices[0]!.id], reason: "answer_mandatory" };
  }

  #attack(choice: PromptChoice): number {
    const code = choice.card?.code;
    return code === undefined
      ? 0
      : (this.#dependencies.cards.get(code)?.attack ?? 0);
  }
}

const exitActions = [
  "pass",
  "mainPhase2",
  "endPhase",
  "finish",
  "cancel",
] as const satisfies readonly PromptChoice["action"][];

function semanticChoice(choice: PromptChoice) {
  return {
    action: choice.action,
    card:
      choice.card === undefined
        ? null
        : {
            instanceId: choice.card.instanceId,
            controller: choice.card.controller,
            location: choice.card.location,
            sequence: choice.card.sequence,
            position: choice.card.position ?? null,
          },
    place: choice.place ?? null,
    value: choice.value ?? null,
    selected: choice.selected ?? null,
    allocationMaximum: choice.allocationMaximum ?? null,
  };
}

function semanticChoiceKey(choice: PromptChoice): string {
  return JSON.stringify(semanticChoice(choice));
}

function opponentPromptSignature(prompt: PlayerPrompt): string {
  return JSON.stringify({
    kind: prompt.kind,
    minimum: prompt.minimum,
    maximum: prompt.maximum,
    cancelable: prompt.cancelable,
    ordered: prompt.ordered,
    requiredTotal: prompt.requiredTotal ?? null,
    sumMode: prompt.sumMode ?? null,
    choices: prompt.choices.map(semanticChoice),
  });
}

function opponentVisibleStateFingerprint(
  visibleState: OpponentVisibleDuelState,
): string {
  return JSON.stringify({
    turn: visibleState.turn,
    turnPlayer: visibleState.turnPlayer,
    phase: visibleState.phase,
    players: visibleState.players.map((player) => ({
      player: player.player,
      lifePoints: player.lifePoints,
      deckCount: player.deckCount,
      extraDeckCount: player.extraDeckCount,
      handCount: player.handCount,
      monsterCount: player.monsterCount,
      spellTrapCount: player.spellTrapCount,
      graveyardCount: player.graveyardCount,
      banishedCount: player.banishedCount,
    })),
    chainSize: visibleState.chainSize,
  });
}

function normalChoiceKeys(
  prompt: PlayerPrompt,
  decision: OpponentDecision,
): readonly string[] {
  const ids = new Set(decision.choiceIds);
  return prompt.choices
    .filter((choice) => ids.has(choice.id))
    .map(semanticChoiceKey);
}

function isExitAction(action: PromptChoice["action"]): boolean {
  return exitActions.some((exitAction) => exitAction === action);
}

function prefer(
  choices: readonly PromptChoice[],
  actions: readonly PromptChoice["action"][],
): PromptChoice {
  for (const action of actions) {
    const choice = choices.find((candidate) => candidate.action === action);
    if (choice !== undefined) return choice;
  }
  const first = choices[0];
  if (first === undefined) throw new Error("No legal prompt choice");
  return first;
}

function validSum(prompt: PlayerPrompt): readonly ChoiceId[] {
  const target = prompt.requiredTotal;
  if (target === undefined)
    return prompt.choices.slice(0, prompt.minimum).map((choice) => choice.id);

  const candidates = prompt.choices.map((choice) => ({
    contribution: choice.card?.contribution ?? 0,
    ...(choice.card?.alternativeContribution === undefined
      ? {}
      : { alternativeContribution: choice.card.alternativeContribution }),
  }));
  const selected = findValidContributionSelection(
    candidates,
    prompt.mandatoryContributions ?? [],
    target,
    prompt.sumMode ?? "exact",
    prompt.minimum,
    prompt.maximum,
  );
  if (selected === null)
    throw new Error(`No legal sum selection reaches ${target}`);
  return selected.map((index) => prompt.choices[index]!.id);
}

import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import {
  contributionOptions,
  isValidContributionTotal,
} from "../../duel/prompt-sum.ts";
import type { BotDecision, BotReason } from "./bot-contract.ts";

export function validateBotReason(reason: BotReason): void {
  if (
    !reason ||
    typeof reason.code !== "string" ||
    !/^[a-z][a-z0-9_]*$/.test(reason.code) ||
    reason.code.length > 128 ||
    typeof reason.explanation !== "string" ||
    reason.explanation.trim().length === 0 ||
    reason.explanation.length > 2048
  ) {
    throw new Error(
      "Invalid bot reason: require a stable code and short explanation",
    );
  }
}

/** Defense at the shared boundary; PromptRegistry still resolves the engine response. */
export function validateBotDecision(
  prompt: PlayerPrompt,
  decision: BotDecision,
): void {
  validateBotReason(decision?.reason);
  if (!Array.isArray(decision.choiceIds))
    throw new Error("Invalid choice identifiers");
  const ids = decision.choiceIds;
  const choices = ids.map((id) => {
    const choice = prompt.choices.find((candidate) => candidate.id === id);
    if (!choice) throw new Error("Unknown choice identifier");
    return choice;
  });
  if (prompt.kind !== "selectCounter" && new Set(ids).size !== ids.length) {
    throw new Error("Duplicate choice identifiers");
  }
  if (ids.length === 0 && prompt.cancelable) return;
  if (ids.length < prompt.minimum || ids.length > prompt.maximum) {
    throw new Error("Selection violates minimum/maximum");
  }
  if (
    prompt.ordered &&
    (ids.length !== prompt.choices.length ||
      new Set(ids).size !== prompt.choices.length)
  ) {
    throw new Error("Ordering must be a complete permutation");
  }
  if (prompt.kind === "selectCounter") {
    const counts = new Map<string, number>();
    for (const choice of choices) {
      const count = (counts.get(choice.id) ?? 0) + 1;
      if (count > (choice.allocationMaximum ?? 0))
        throw new Error("Counter allocation exceeds capacity");
      counts.set(choice.id, count);
    }
  }
  if (
    prompt.kind === "selectSum" &&
    prompt.requiredTotal !== undefined &&
    !isValidContributionTotal(
      [
        ...(prompt.mandatoryContributions ?? []).map(contributionOptions),
        ...choices.map((choice) =>
          contributionOptions({
            contribution: choice.card?.contribution ?? 0,
            ...(choice.card?.alternativeContribution === undefined
              ? {}
              : {
                  alternativeContribution: choice.card.alternativeContribution,
                }),
          }),
        ),
      ],
      prompt.requiredTotal,
      prompt.sumMode ?? "exact",
    )
  ) {
    throw new Error("Selection violates required contribution total");
  }
}

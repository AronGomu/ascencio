import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../duel/contracts/player-prompt.ts";
import { findValidContributionSelection } from "../../duel/prompt-sum.ts";

import { allowsEmptyCancellation } from "./validate-bot-decision.ts";

export type RandomSource = () => number;
export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    if (!(value >= 0 && value < 1))
      throw new Error("Random source must return [0, 1)");
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Ordered preferences only influence strategy; this layer owns response constraints.
 * Random callers shuffle both candidates and counts, without action priorities.
 */
export function legalSelection(
  prompt: PlayerPrompt,
  choices: readonly PromptChoice[],
  counts: readonly number[],
  random?: RandomSource,
): readonly ChoiceId[] {
  for (const count of counts) {
    if (count === 0 && allowsEmptyCancellation(prompt)) return [];
    if (prompt.ordered) return choices.map((c) => c.id);
    if (prompt.kind === "selectCounter") {
      const selected: ChoiceId[] = [];
      const remaining = new Map(
        choices.map((c) => [c.id, c.allocationMaximum ?? 0]),
      );
      while (selected.length < count) {
        const available = choices.filter((c) => remaining.get(c.id)! > 0);
        const choice = (random ? shuffled(available, random) : available)[0];
        if (!choice) break;
        selected.push(choice.id);
        remaining.set(choice.id, remaining.get(choice.id)! - 1);
      }
      if (selected.length === count) return selected;
    } else if (
      prompt.kind === "selectSum" &&
      prompt.requiredTotal !== undefined
    ) {
      const selection = findValidContributionSelection(
        choices.map((c) => ({
          contribution: c.card?.contribution ?? 0,
          ...(c.card?.alternativeContribution === undefined
            ? {}
            : { alternativeContribution: c.card.alternativeContribution }),
        })),
        prompt.mandatoryContributions ?? [],
        prompt.requiredTotal,
        prompt.sumMode ?? "exact",
        count,
        count,
      );
      if (selection !== null) return selection.map((i) => choices[i]!.id);
    } else if (prompt.kind === "selectTribute") {
      const target = prompt.requiredTotal ?? prompt.minimum;
      // Saturating totals preserve all feasible counts, including overpayment.
      let states = new Map<string, { total: number; ids: ChoiceId[] }>([
        ["0:0", { total: 0, ids: [] }],
      ]);
      for (const choice of choices) {
        const next = new Map(states);
        for (const state of states.values()) {
          if (state.ids.length >= count) continue;
          const total = Math.min(
            target,
            state.total + (choice.card?.contribution ?? 1),
          );
          const ids = [...state.ids, choice.id];
          const key = `${ids.length}:${total}`;
          if (!next.has(key)) next.set(key, { total, ids });
        }
        states = next;
      }
      const selected = states.get(`${count}:${target}`);
      if (selected) return selected.ids;
    } else if (count <= choices.length) {
      return choices.slice(0, count).map((c) => c.id);
    }
  }
  throw new Error(`No legal response for ${prompt.kind}`);
}

export function selectionCounts(prompt: PlayerPrompt): number[] {
  if (prompt.kind === "selectUnselectCard") return [1];
  const capacity =
    prompt.kind === "selectCounter"
      ? prompt.choices.reduce((n, c) => n + (c.allocationMaximum ?? 0), 0)
      : prompt.choices.length;
  const maximum = Math.min(prompt.maximum, capacity);
  const counts = Array.from(
    { length: Math.max(0, maximum - prompt.minimum + 1) },
    (_, i) => prompt.minimum + i,
  );
  if (allowsEmptyCancellation(prompt) && prompt.minimum > 0) counts.push(0);
  return counts;
}

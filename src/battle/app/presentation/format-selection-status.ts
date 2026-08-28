import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import { contributionOptions } from "../../duel/prompt-sum.ts";

type SelectionChoice = PlayerPrompt["choices"][number];

/** Prompt kinds that render a live selection-status line. */
export const SELECTION_STATUS_KINDS: ReadonlySet<PlayerPrompt["kind"]> =
  Object.freeze(
    new Set<PlayerPrompt["kind"]>([
      "selectCard",
      "selectTribute",
      "selectSum",
      "selectUnselectCard",
    ]),
  );

/**
 * Single source of truth for the selection-status string shown by
 * FieldActionBar and the target-mode ZoneListDialog.
 * Returns null for any prompt kind outside SELECTION_STATUS_KINDS.
 */
export function formatSelectionStatus(
  prompt: PlayerPrompt,
  selectedChoiceIds: readonly ChoiceId[],
): string | null {
  if (!SELECTION_STATUS_KINDS.has(prompt.kind)) return null;
  const selected = matchedChoices(prompt, selectedChoiceIds);
  const count =
    prompt.minimum === prompt.maximum
      ? `${selected.length} of ${prompt.maximum} selected`
      : `${selected.length} selected (choose ${prompt.minimum}–${prompt.maximum})`;
  const target = prompt.requiredTotal;
  if (prompt.kind !== "selectSum" || target === undefined) return count;
  const total = bestFitTotal(
    achievableTotals(prompt, selected),
    target,
    prompt.sumMode,
  );
  return `${count} · sum ${total} of ${prompt.sumMode === "atLeast" ? "at least " : ""}${target}`;
}

/** Selected ids that address a live choice, deduped, in selection order. */
function matchedChoices(
  prompt: PlayerPrompt,
  selectedChoiceIds: readonly ChoiceId[],
): readonly SelectionChoice[] {
  const byId = new Map(prompt.choices.map((choice) => [choice.id, choice]));
  const seen = new Set<ChoiceId>();
  const matched: SelectionChoice[] = [];
  for (const id of selectedChoiceIds) {
    const choice = byId.get(id);
    if (choice === undefined || seen.has(id)) continue;
    seen.add(id);
    matched.push(choice);
  }
  return matched;
}

/** Every total reachable by taking one option per mandatory and selected card. */
function achievableTotals(
  prompt: PlayerPrompt,
  selected: readonly SelectionChoice[],
): ReadonlySet<number> {
  const optionLists = [
    ...(prompt.mandatoryContributions ?? []).map((value) =>
      contributionOptions(value),
    ),
    ...selected.map(({ card }) =>
      contributionOptions({
        contribution: card?.contribution ?? 0,
        ...(card?.alternativeContribution === undefined
          ? {}
          : { alternativeContribution: card.alternativeContribution }),
      }),
    ),
  ];
  let totals = new Set([0]);
  for (const options of optionLists) {
    totals = new Set(
      [...totals].flatMap((total) => options.map((value) => total + value)),
    );
  }
  return totals;
}

/* A dual-level card displays the option that best serves the target, so the
   panel never blames the player for an ambiguity the engine resolves in their
   favour. */
function bestFitTotal(
  totals: ReadonlySet<number>,
  target: number,
  mode: PlayerPrompt["sumMode"],
): number {
  const values = [...totals];
  if (mode === "atLeast") {
    const reaching = values.filter((value) => value >= target);
    return reaching.length > 0 ? Math.min(...reaching) : Math.max(...values);
  }
  if (totals.has(target)) return target;
  const below = values.filter((value) => value < target);
  return below.length > 0 ? Math.max(...below) : Math.min(...values);
}

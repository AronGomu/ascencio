import type { BotDecisionInput } from "./bot-contract.ts";

/** Order candidate counts (including zero for legal cancellation). Shared selection
 * still checks totals and capacities, falling back to the next feasible count.
 */
export type GeneralistSelectionStrategy = (
  input: BotDecisionInput,
  counts: readonly number[],
) => readonly number[];

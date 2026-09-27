import type { BattlePresentationInput } from "../../battle/ports/index.ts";

export interface FreePlayOpponent {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly deckKey: string;
  readonly policyId: "basic";
}

export function installedFreePlayOpponents(
  presentation: Pick<BattlePresentationInput, "opponents">,
): readonly FreePlayOpponent[] {
  return Object.freeze(
    presentation.opponents.map((opponent) =>
      Object.freeze({
        id: opponent.id,
        name: opponent.name,
        line: opponent.line,
        deckKey: `chapter:${opponent.deckId}`,
        policyId: "basic" as const,
      }),
    ),
  );
}

export function freePlayOpponent(
  opponents: readonly FreePlayOpponent[],
  defaultId: string,
  id: string | null,
): FreePlayOpponent {
  const selected = id === null ? undefined : withId(opponents, id);
  const defaultOpponent = withId(opponents, defaultId);
  if (selected !== undefined) return selected;
  if (defaultOpponent !== undefined) return defaultOpponent;
  throw new Error("Installed gameplay has no Free Play opponent");
}

function withId(
  opponents: readonly FreePlayOpponent[],
  id: string,
): FreePlayOpponent | undefined {
  return opponents.find((opponent) => opponent.id === id);
}

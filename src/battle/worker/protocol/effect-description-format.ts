import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import { EngineLocation } from "../engine/engine-constants.ts";

/** Project Ignis writes its system strings as printf templates the client is
    expected to fill: `Use the effect of "%ls" from [%ls]?` is one string plus
    two arguments, not a sentence. Handed to the UI unfilled it reaches the
    player as a literal `%ls` where the card's name belongs.

    Substitution is positional, exactly as the C client's `%ls` arguments are:
    the first placeholder takes the first value. A placeholder with no value —
    past the end of `values`, or one this duel could not resolve — is left
    standing, because there is nothing truthful to put there. */
export function formatEffectDescription(
  description: string,
  values: readonly (string | undefined)[],
): string {
  let next = 0;
  return description.replace(/%ls/g, (placeholder) => {
    const value = values[next];
    next += 1;
    return value ?? placeholder;
  });
}

/* The pinned strings name every location the engine can cite; the indexes are
   Project Ignis's own. Reading them keeps location wording in the snapshot
   rather than in this file, beside the description it is substituted into. */
const LOCATION_STRING_INDEX: ReadonlyMap<number, string> = new Map([
  [EngineLocation.DECK, "1000"],
  [EngineLocation.HAND, "1001"],
  [EngineLocation.MONSTER, "1002"],
  [EngineLocation.SPELL_TRAP, "1003"],
  [EngineLocation.GRAVEYARD, "1004"],
  [EngineLocation.BANISHED, "1005"],
  [EngineLocation.EXTRA, "1006"],
  [EngineLocation.OVERLAY, "1007"],
  [EngineLocation.FIELD, "1008"],
  [EngineLocation.PENDULUM, "1009"],
]);

/** The name a description's `[%ls]` location argument expects, or `undefined`
    where the snapshot has no string for it — which leaves the placeholder
    standing rather than inventing a word for a zone. */
export function locationDescriptionName(
  location: number,
  dependencies: Pick<ActiveDuelDependencies, "strings">,
): string | undefined {
  /* `OVERLAY` rides on top of the zone the material is attached to, so it is
     read first: a card there is cited as Xyz Material, not as the monster zone
     underneath it. */
  const index =
    (location & EngineLocation.OVERLAY) === 0
      ? LOCATION_STRING_INDEX.get(location)
      : LOCATION_STRING_INDEX.get(EngineLocation.OVERLAY);
  return index === undefined ? undefined : dependencies.strings.system[index];
}

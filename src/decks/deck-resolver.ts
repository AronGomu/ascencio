import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "./card-ownership.ts";
import type {
  DeckId,
  ResolveDeckResult,
  ValidatedDeckSnapshot,
} from "./deck-contracts.ts";
import type { DeckRepository } from "./deck-repository.ts";
import type { DeckBuilderCardView } from "./catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "./catalog/pinned-ruleset.ts";
import { validateDeckDraft, validationDigest } from "./deck-validation.ts";

/** `ownership` defaults to free play's, exactly as `validateDeckDraft` does and
    for the same reason: a caller that says nothing about which world the deck
    belongs to is asking about the one that owns everything. A story caller
    passes the save's reader, or the snapshot it gets back — the one a duel is
    actually started from — would carry cards that save no longer has
    (ADR-050). */
export async function resolveDeck(
  deckId: DeckId,
  repository: Pick<DeckRepository, "load">,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
  ownership: CardOwnership = unlimitedCardOwnership(),
): Promise<ResolveDeckResult> {
  const stored = await repository.load(deckId);
  if (stored === null) return Object.freeze({ type: "missing", deckId });
  const validation = validateDeckDraft(
    {
      ...stored.deck,
      storedRulesetRevision: stored.deck.validation.rulesetRevision,
    },
    catalog,
    ruleset,
    ownership,
  );
  const errors = validation.issues.filter(
    ({ severity }) => severity === "error",
  );
  if (errors.length > 0)
    return Object.freeze({
      type: "invalid",
      deckId,
      issues: Object.freeze(errors),
    });
  const snapshot: ValidatedDeckSnapshot = Object.freeze({
    ref: Object.freeze({
      type: "local",
      deckId,
      revision: stored.deck.revision,
    }),
    name: stored.deck.name,
    main: Object.freeze([...stored.deck.main]),
    extra: Object.freeze([...stored.deck.extra]),
    side: Object.freeze([...stored.deck.side]),
    validationDigest: validationDigest(validation),
  });
  return Object.freeze({ type: "ready", deck: snapshot });
}

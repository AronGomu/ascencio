import type { BattlePresentationInput } from "../../battle/ports/index.ts";
import type { SelectableDeck } from "../../battle/index.ts";
import {
  catalogByCode,
  type PinnedDeckRuleset,
} from "../../decks/validation/index.ts";
import type { DeckRepository } from "../../decks/repository/index.ts";
import type { BattleDeckModule } from "../domain-loaders.ts";

export type BattleDeckLoader = () => Promise<BattleDeckModule>;

export async function loadFreePlayDecks(
  battle: BattleDeckModule,
  presentation: BattlePresentationInput,
  createRepository: () => DeckRepository,
  ruleset: PinnedDeckRuleset,
): Promise<readonly SelectableDeck[]> {
  const catalog = catalogByCode(presentation.cards);
  try {
    return await battle.installedSelectableDecks(
      presentation,
      createRepository(),
      catalog,
      ruleset,
    );
  } catch {
    return await battle.installedSelectableDecks(
      presentation,
      { list: async () => [], load: async () => null },
      catalog,
      ruleset,
    );
  }
}

let cachedBattle: Promise<BattleDeckModule> | null = null;
let cachedDecks: readonly SelectableDeck[] | null = null;
let cachedContentKey: string | null = null;
const pendingListings = new Map<string, Promise<readonly SelectableDeck[]>>();
let listingGeneration = 0;

function contentKey(
  presentation: BattlePresentationInput,
  ruleset: PinnedDeckRuleset,
): string {
  return JSON.stringify([
    presentation.snapshotId,
    ruleset.id,
    ruleset.revision,
  ]);
}

export function freePlayBattleModule(
  load: BattleDeckLoader,
): Promise<BattleDeckModule> {
  if (cachedBattle !== null) return cachedBattle;
  const started = load();
  cachedBattle = started;
  started.catch(() => {
    if (cachedBattle === started) cachedBattle = null;
  });
  return started;
}

export function listedFreePlayDecks(
  presentation: BattlePresentationInput,
  ruleset: PinnedDeckRuleset,
): readonly SelectableDeck[] | null {
  return cachedContentKey === contentKey(presentation, ruleset)
    ? cachedDecks
    : null;
}

export function refreshFreePlayDecks(
  load: BattleDeckLoader,
  presentation: BattlePresentationInput,
  createRepository: () => DeckRepository,
  ruleset: PinnedDeckRuleset,
): Promise<readonly SelectableDeck[]> {
  const key = contentKey(presentation, ruleset);
  const pending = pendingListings.get(key);
  if (pending !== undefined) return pending;
  const generation = ++listingGeneration;
  const started = (async () => {
    const decks = await loadFreePlayDecks(
      await freePlayBattleModule(load),
      presentation,
      createRepository,
      ruleset,
    );
    if (generation === listingGeneration) {
      cachedContentKey = key;
      cachedDecks = decks;
    }
    return decks;
  })();
  pendingListings.set(key, started);
  const settle = () => {
    if (pendingListings.get(key) === started) pendingListings.delete(key);
  };
  started.then(settle, settle);
  return started;
}

export function warmFreePlayDecks(
  load: BattleDeckLoader,
  presentation: BattlePresentationInput,
  createRepository: () => DeckRepository,
  ruleset: PinnedDeckRuleset,
  onFailure: (error: unknown) => void,
): void {
  void refreshFreePlayDecks(
    load,
    presentation,
    createRepository,
    ruleset,
  ).catch(onFailure);
}

export function invalidateFreePlayDeckCache(): void {
  cachedBattle = null;
  cachedDecks = null;
  cachedContentKey = null;
  pendingListings.clear();
  listingGeneration += 1;
}

export function resetFreePlayDeckCacheForTests(): void {
  invalidateFreePlayDeckCache();
}

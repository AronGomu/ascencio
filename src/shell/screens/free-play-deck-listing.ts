import type { InstalledGameplay } from "../../content/index.ts";
import type { SelectableDeck } from "../../battle/index.ts";
import { installedDeckCatalog } from "../../decks/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/validation/index.ts";
import { IndexedDbDeckRepository } from "../../decks/repository/index.ts";
import type { BattleDeckModule } from "../domain-loaders.ts";
import { legacyBattlePresentation } from "../adapters/legacy-battle-runtime.ts";

export type BattleDeckLoader = () => Promise<BattleDeckModule>;

export async function loadFreePlayDecks(
  battle: BattleDeckModule,
  gameplay: InstalledGameplay,
): Promise<readonly SelectableDeck[]> {
  const catalog = catalogByCode(installedDeckCatalog(gameplay).cards);
  const presentation = legacyBattlePresentation(gameplay);
  let repository: IndexedDbDeckRepository | null = null;
  try {
    repository = await IndexedDbDeckRepository.open();
    return await battle.installedSelectableDecks(
      presentation,
      repository,
      catalog,
      PROTOTYPE_RULESET,
    );
  } catch {
    return await battle.installedSelectableDecks(
      presentation,
      { list: async () => [], load: async () => null },
      catalog,
      PROTOTYPE_RULESET,
    );
  } finally {
    repository?.close();
  }
}

let cachedBattle: Promise<BattleDeckModule> | null = null;
let cachedDecks: readonly SelectableDeck[] | null = null;
let cachedContentKey: string | null = null;
let listing: Promise<readonly SelectableDeck[]> | null = null;

function contentKey(gameplay: InstalledGameplay): string {
  return [
    gameplay.content.catalogSha256,
    gameplay.content.runtime.sha256,
    ...gameplay.content.chapters.map(({ sha256 }) => sha256),
  ].join(":");
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
  gameplay: InstalledGameplay,
): readonly SelectableDeck[] | null {
  return cachedContentKey === contentKey(gameplay) ? cachedDecks : null;
}

export function refreshFreePlayDecks(
  load: BattleDeckLoader,
  gameplay: InstalledGameplay,
): Promise<readonly SelectableDeck[]> {
  const key = contentKey(gameplay);
  if (listing !== null && cachedContentKey === key) return listing;
  const started = (async () => {
    const decks = await loadFreePlayDecks(
      await freePlayBattleModule(load),
      gameplay,
    );
    cachedContentKey = key;
    cachedDecks = decks;
    return decks;
  })();
  listing = started;
  const settle = () => {
    if (listing === started) listing = null;
  };
  started.then(settle, settle);
  return started;
}

export function warmFreePlayDecks(
  load: BattleDeckLoader,
  gameplay: InstalledGameplay,
): void {
  void refreshFreePlayDecks(load, gameplay).catch(() => undefined);
}

export function resetFreePlayDeckCacheForTests(): void {
  cachedBattle = null;
  cachedDecks = null;
  cachedContentKey = null;
  listing = null;
}

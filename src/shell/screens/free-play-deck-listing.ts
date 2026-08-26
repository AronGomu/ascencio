import type { SelectableDeck } from "../../battle/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/catalog/pinned-ruleset.ts";
import { runtimeCatalog } from "../../decks/catalog/runtime-catalog.ts";
import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";
import type { BattleDeckModule } from "../domain-loaders.ts";

/** How the deck half of the battle entry is reached. It is a loader rather
    than an import for the reason `domain-loaders.ts` gives: the same entry
    carries the duel, and importing it here would make the largest chunk in the
    build eager. */
export type BattleDeckLoader = () => Promise<BattleDeckModule>;

/**
 * Every deck a free-play seat may be given: the bundled list this build ships,
 * plus the decks in the free-play library that this build can actually play.
 *
 * The battle entry owns which decks qualify — `listSelectableDecks` drops a
 * local deck the pinned ruleset refuses or the card snapshot cannot draw — so
 * the shell only supplies the library and the catalog it is validated against.
 *
 * Nothing here writes. A library that will not open is answered with the
 * bundled decks alone rather than an error: they are compiled into this build,
 * so a match is still one click away, and the deck editor is where a library
 * is repaired.
 */
export async function loadFreePlayDecks(
  battle: BattleDeckModule,
): Promise<readonly SelectableDeck[]> {
  let repository: IndexedDbDeckRepository | null = null;
  try {
    /* Both before the library opens: each is a read the listing needs anyway,
       and the catalog is what every local deck's codes are resolved against. */
    const [supportedCodes, cards] = await Promise.all([
      battle.supportedDuelCardCodes(),
      runtimeCatalog(),
    ]);
    repository = await IndexedDbDeckRepository.open();
    return await battle.listSelectableDecks(
      battle.DECK_CATALOG,
      repository,
      catalogByCode(cards),
      PROTOTYPE_RULESET,
      supportedCodes,
    );
  } catch {
    return battle.presetSelectableDecks(battle.DECK_CATALOG);
  } finally {
    repository?.close();
  }
}

/* The listing is a fetch of the whole packaged card database, an IndexedDB
   read and one deck resolution per local deck, and the match setup is opened
   over and over: once per match, once more after every trip to the deck
   editor. Holding the last answer for the page is what makes the second visit
   instant, and `warmFreePlayDecks` is what makes the first one instant too —
   the main menu starts this read as soon as a player reaches for Free Play, so
   the work happens while the pointer is still travelling.

   The cache is never the last word: every mount revalidates against the
   library as it is now, so a deck built or edited between two visits appears
   without the player having to wait for it to be proved. */
let cachedBattle: Promise<BattleDeckModule> | null = null;
let cachedDecks: readonly SelectableDeck[] | null = null;
let listing: Promise<readonly SelectableDeck[]> | null = null;

/** The battle entry's deck half, loaded at most once per page.

    A rejection is not kept, for the reason `runtimeCatalog()` does not keep
    one: a single failed chunk fetch would otherwise leave free play dead for
    the rest of the page load, never attempting a second import. */
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

/** The listing the last completed read produced, or `null` when this page has
    not finished one. Rendered while the current read is still running, so the
    seats are never empty and never disabled on a library already known. */
export function listedFreePlayDecks(): readonly SelectableDeck[] | null {
  return cachedDecks;
}

/** Reads the library again and remembers the answer. Concurrent callers share
    one read; a later caller starts a new one, which is what makes this a
    revalidation rather than a memo. */
export function refreshFreePlayDecks(
  load: BattleDeckLoader,
): Promise<readonly SelectableDeck[]> {
  if (listing !== null) return listing;
  const started = (async () => {
    const decks = await loadFreePlayDecks(await freePlayBattleModule(load));
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

/** Starts the read without waiting for it, for a host that knows the player is
    about to need it. A failure is dropped here and reported by the screen that
    goes on to await the same read. */
export function warmFreePlayDecks(load: BattleDeckLoader): void {
  void refreshFreePlayDecks(load).catch(() => undefined);
}

/** Forgets the page's answer, so one test's library cannot be another's.
    Production never calls this: the cache lives exactly as long as the page. */
export function resetFreePlayDeckCacheForTests(): void {
  cachedBattle = null;
  cachedDecks = null;
  listing = null;
}

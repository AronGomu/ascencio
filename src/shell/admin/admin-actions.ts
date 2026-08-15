import { DECK_DATABASE_NAME, deckId, type DeckId } from "../../decks/index.ts";
import { parseYdk } from "../../battle/duel/presets/deck-parser.ts";
import { DECK_SOURCES } from "../../battle/duel/presets/deck-sources-browser.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../story/index.ts";
import { SNAPSHOT_DATABASE_NAME } from "../../battle/storage/snapshot-store.ts";
import type { AppRoute } from "../routes.ts";
import { SHELL_SETTINGS_KEY } from "../settings/shell-settings.ts";

export interface AdminStorageTarget {
  readonly id: string;
  readonly label: string;
  readonly kind: "indexeddb" | "localstorage";
  /** Database name for `indexeddb`, storage key for `localstorage`. */
  readonly name: string;
}

/* Every store the app writes today. A new database or key is only reachable
   from the console once it is appended here. */
export const ADMIN_STORAGE_TARGETS: readonly AdminStorageTarget[] =
  Object.freeze([
    Object.freeze({
      id: "decks",
      label: "Deck library",
      kind: "indexeddb",
      name: DECK_DATABASE_NAME,
    } as const),
    Object.freeze({
      id: "duel-snapshots",
      label: "Duel snapshots",
      kind: "indexeddb",
      name: SNAPSHOT_DATABASE_NAME,
    } as const),
    Object.freeze({
      id: "shell-settings",
      label: "Shell settings",
      kind: "localstorage",
      name: SHELL_SETTINGS_KEY,
    } as const),
    Object.freeze({
      id: "story-saves",
      label: "Story saves",
      kind: "indexeddb",
      name: STORY_SAVES_DATABASE_NAME,
    } as const),
  ]);

/* Keyed by kind so adding an `AppRoute` member is a compile error here rather
   than a route the console silently forgets. Routes that need an id, and the
   console's own route, map to `null`. */
const ROUTE_INDEX: Readonly<Record<AppRoute["kind"], AppRoute | null>> =
  Object.freeze({
    home: { kind: "home" },
    duel: { kind: "duel" },
    "duel-session": null,
    decks: { kind: "decks" },
    deck: null,
    story: { kind: "story" },
    admin: null,
  });

export const ADMIN_ROUTES: readonly AppRoute[] = Object.freeze(
  Object.values(ROUTE_INDEX).filter(
    (route): route is AppRoute => route !== null,
  ),
);

export const ADMIN_TEST_DECK_ID: DeckId = deckId("admin-test-deck");
export const ADMIN_TEST_DECK_NAME = "Admin test deck";

const ADMIN_TEST_DECK_SOURCE = "mvp-player";
const MAIN_DECK_SIZE = 40;

export async function resetStorageTarget(
  target: AdminStorageTarget,
  factory: IDBFactory,
  storage: Pick<Storage, "removeItem">,
): Promise<void> {
  if (target.kind === "localstorage") {
    storage.removeItem(target.name);
    return;
  }
  if (target.kind !== "indexeddb")
    throw new Error(`Unknown admin storage kind: ${String(target.kind)}`);

  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(target.name);
    request.onsuccess = () => resolve();
    /* `blocked` means another tab still holds the database open. The delete
       stays queued, so the console reports success rather than hanging. */
    request.onblocked = () => resolve();
    request.onerror = () =>
      reject(
        new Error(`Could not delete database ${target.name}`, {
          cause: request.error,
        }),
      );
  });
}

/** A fixed 40-card Main deck taken from a bundled preset, so the seeded deck is
    always dispatchable by the duel engine. */
export function buildAdminTestDeck(): {
  readonly main: readonly number[];
  readonly extra: readonly number[];
  readonly side: readonly number[];
} {
  const source = DECK_SOURCES.get(ADMIN_TEST_DECK_SOURCE);
  if (source === undefined)
    throw new Error("Admin test deck preset is not bundled");
  const parsed = parseYdk(source);
  if (parsed.main.length < MAIN_DECK_SIZE)
    throw new Error("Admin test deck preset has fewer than 40 Main cards");
  return Object.freeze({
    main: Object.freeze(parsed.main.slice(0, MAIN_DECK_SIZE)),
    extra: Object.freeze([...parsed.extra]),
    side: Object.freeze([...parsed.side]),
  });
}

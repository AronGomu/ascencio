import { deckId, type DeckId } from "../../decks/index.ts";
import type { UserNamespace } from "../../storage/index.ts";
import type { AppRoute } from "../routes.ts";
import type { ShellGameplay } from "../core/installed-inputs.ts";
import type { ShellApplication } from "../core/shell-application.ts";
import { emptyDeckHistory } from "../../decks/editing/index.ts";

const SNAPSHOT_DATABASE_NAME = "ygo-story-duel";

export interface AdminStorageTarget {
  readonly id: string;
  readonly label: string;
  readonly kind: "user" | "indexeddb";
  readonly name: string;
  readonly namespaces?: readonly UserNamespace[];
}

export const ADMIN_STORAGE_TARGETS: readonly AdminStorageTarget[] =
  Object.freeze([
    Object.freeze({
      id: "decks",
      label: "Free-play deck library",
      kind: "user",
      name: "user-data.sqlite",
      namespaces: ["decks", "deck-meta", "deck-autosaves"],
    } as const),
    Object.freeze({
      id: "story-saves",
      label: "Story saves",
      kind: "user",
      name: "user-data.sqlite",
      namespaces: ["story"],
    } as const),
    Object.freeze({
      id: "preferences",
      label: "Player settings and read history",
      kind: "user",
      name: "user-data.sqlite",
      namespaces: ["preferences", "story-read-log"],
    } as const),
    Object.freeze({
      id: "duel-snapshots",
      label: "Operational duel diagnostics",
      kind: "indexeddb",
      name: SNAPSHOT_DATABASE_NAME,
    } as const),
  ]);

const ROUTE_INDEX: Readonly<Record<AppRoute["kind"], AppRoute | null>> =
  Object.freeze({
    home: { kind: "home" },
    "install-content": { kind: "install-content" },
    "free-play": { kind: "free-play" },
    "free-play-decks": { kind: "free-play-decks" },
    "free-play-deck": null,
    "free-play-collection": { kind: "free-play-collection" },
    story: { kind: "story" },
    "story-decks": { kind: "story-decks" },
    "story-deck": null,
    "story-collection": { kind: "story-collection" },
    "duel-session": null,
    admin: null,
  });

export const ADMIN_ROUTES: readonly AppRoute[] = Object.freeze(
  Object.values(ROUTE_INDEX).filter(
    (route): route is AppRoute => route !== null,
  ),
);

export const ADMIN_TEST_DECK_ID: DeckId = deckId("admin-test-deck");
export const ADMIN_TEST_DECK_NAME = "Admin test deck";

export type AdminResetResult =
  { readonly outcome: "deleted" } | { readonly outcome: "blocked" };

export async function resetOperationalStorageTarget(
  target: AdminStorageTarget,
  factory: IDBFactory,
): Promise<AdminResetResult> {
  if (target.kind !== "indexeddb")
    throw new Error(`User namespace reset requires injected SQLite capability`);
  return await new Promise<AdminResetResult>((resolve, reject) => {
    const request = factory.deleteDatabase(target.name);
    request.onsuccess = () => resolve({ outcome: "deleted" });
    request.onblocked = () => resolve({ outcome: "blocked" });
    request.onerror = () =>
      reject(
        new Error(`Could not delete database ${target.name}`, {
          cause: request.error,
        }),
      );
  });
}

export async function seedAdminTestDeck(
  application: ShellApplication,
  signal: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<void> {
  const session = await application.acquire("freeplay", signal);
  try {
    signal.throwIfAborted();
    // Acquisition validates the published presets against this session's ruleset.
    const { presentation, editor, users } = session.inputs;
    const timestamp = now().toISOString();
    await users.createDeckRepository().create(
      {
        schemaVersion: 1,
        id: ADMIN_TEST_DECK_ID,
        revision: 0,
        name: ADMIN_TEST_DECK_NAME,
        ...buildAdminTestDeck(presentation),
        createdAt: timestamp,
        updatedAt: timestamp,
        validation: {
          status: "valid",
          issues: [],
          rulesetRevision: editor.ruleset.revision,
        },
        importedNeedsReview: false,
        illustrationCardCode: null,
      },
      emptyDeckHistory(),
    );
  } finally {
    // Flush admitted writes before releasing semantic inputs and package lease.
    await session.close();
  }
  signal.throwIfAborted();
}

export function buildAdminTestDeck(
  gameplay: Pick<ShellGameplay, "decks" | "defaults">,
) {
  const deck = gameplay.decks.find(
    ({ id }) => id === gameplay.defaults.starterDeckId,
  );
  if (deck === undefined) throw new Error("Installed default deck is missing");
  return Object.freeze({
    main: Object.freeze([...deck.main]),
    extra: Object.freeze([...deck.extra]),
    side: Object.freeze([...deck.side]),
  });
}

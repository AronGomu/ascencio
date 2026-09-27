import { runtimeSnapshotId } from "../../src/shell/adapters/sqlite-battle-runtime.ts";
import {
  createBlankDeck,
  emptyDeckHistory,
  pushDeckUpdate,
} from "../../src/decks/editing/index.ts";
import { PROTOTYPE_RULESET } from "../../src/decks/validation/index.ts";
import type { PersistedUiState } from "../../src/battle/ports/index.ts";
import type { ShellSettings } from "../../src/shell/settings/index.ts";
import {
  openLocalStorage,
  type ContentQueries,
  type MediaWarning,
  type PackageStack,
  type StorageResult,
} from "../../src/storage/index.ts";
import { createApplicationAdmission } from "../../src/shell/application/application-admission.ts";
import { createSqliteApplicationService } from "../../src/shell/application/sqlite-application-service.ts";
import {
  createUserPersistenceOwner,
  type UserPersistenceOwner,
} from "../../src/shell/application/user-persistence-owner.ts";
import type { CoreStartup } from "../../src/shell/core/core-gate.ts";
import type { StorySlotKey } from "../../src/story/saves/index.ts";
import type { StoryState } from "../../src/story/model/story-state.ts";
import type {
  DeckCardLists,
  StoredDeck,
} from "../../src/decks/contracts/index.ts";
import { deckId } from "../../src/decks/contracts/index.ts";

let owner: UserPersistenceOwner;
let service: ReturnType<typeof createSqliteApplicationService>;
let stack: PackageStack;
const closed = Promise.withResolvers<void>();
function requireOk<T>(result: StorageResult<T>): T {
  if (result.kind === "failed") throw new Error(result.error.code);
  return result.value;
}
const fault = (operation: unknown): Promise<unknown> =>
  (
    globalThis as unknown as {
      domainFixtureFault(value: unknown): Promise<unknown>;
    }
  ).domainFixtureFault(operation);

/** Test entry replaces startup only. Real SQLite client, owner, repositories, leases. */
export async function loadCoreStartup(): Promise<CoreStartup> {
  const admission = createApplicationAdmission();
  const client = requireOk(await openLocalStorage());
  try {
    owner = await createUserPersistenceOwner(client, admission);
    stack = await (await fetch("/domain-fixture/stack")).json();
    const warnings = new Set<(warning: MediaWarning) => void>();
    const content: ContentQueries = {
      async query(request, signal) {
        const response = await fetch(
          `/domain-fixture/query?request=${encodeURIComponent(JSON.stringify(request))}`,
          { signal },
        );
        const result = await response.json();
        if (
          result.kind === "ok" &&
          result.value === null &&
          (request.kind === "asset" || request.kind === "set-image")
        ) {
          const warning: MediaWarning = {
            packageId:
              request.kind === "asset" ? request.packageId : "card-library",
            path:
              request.kind === "asset" ? request.path : `sets/${request.setId}`,
            reason: "missing",
          };
          for (const listener of warnings) listener(warning);
        }
        if (result.kind === "ok" && result.value?.bytes)
          result.value.bytes = Uint8Array.from(
            atob(result.value.bytes),
            (char) => char.charCodeAt(0),
          );
        return result;
      },
    };
    // Only immutable semantic content differs. Same production userData object and Worker lease.
    const storage = {
      ...client,
      content,
      subscribeMediaWarnings(listener: (warning: MediaWarning) => void) {
        const unsubscribe = client.subscribeMediaWarnings(listener);
        warnings.add(listener);
        return () => {
          unsubscribe();
          warnings.delete(listener);
        };
      },
      packages: {
        ...client.packages,
        current: async () => ({ kind: "ok" as const, value: stack }),
        acquireSession: async () => {
          const lease = await client.packages.acquireSession();
          return lease.kind === "failed"
            ? lease
            : {
                kind: "ok" as const,
                value: { ...lease.value, generation: stack.generation },
              };
        },
      },
    };
    service = createSqliteApplicationService({
      admission,
      storage,
      users: owner.services,
      flushUserWrites: () => owner.flush(),
    });
    Object.assign(globalThis, { selectedContent });
    return {
      gate: { kind: "ready", generation: stack.generation },
      application: service.application,
      applicationStatus: service.status,
      subscribeApplicationStatus: (listener) =>
        service.subscribeStatus(listener),
      userPersistence: owner,
      async dispose() {
        admission.close();
        try {
          try {
            await service.dispose();
          } finally {
            await owner.close();
          }
          closed.resolve();
        } catch (error) {
          closed.reject(error);
          throw error;
        }
      },
    };
  } catch (error) {
    admission.close();
    await client.close();
    throw error;
  }
}

export const selectedContent = {
  async shutdown() {
    await (
      globalThis as unknown as { domainFixtureUnmount(): Promise<void> }
    ).domainFixtureUnmount();
    await closed.promise;
  },
  async save(slot: StorySlotKey, state: StoryState) {
    const current = await owner.saves.read(slot);
    const result = await owner.saves.write(
      slot,
      state,
      current.kind === "ready" ? current.envelope.revision : null,
      {
        chapterId: "chapter-01",
        contentId: "prototype-prologue-v1",
        revision: stack.generation,
        completedChapterIds: [],
      },
    );
    if (result.kind !== "written") throw new Error(JSON.stringify(result));
    return result;
  },
  async slots() {
    return (await owner.saves.list()).map(({ slot }) => slot);
  },
  async snapshot() {
    return {
      // Semantic fixture identity, not a persisted legacy application selector.
      selection: stack,
      rows: (await fault({ kind: "snapshot-story" })) as readonly {
        slot: StorySlotKey;
        revision: number;
        payload: string;
      }[],
      slots: await Promise.all(
        (
          [
            "manual:1",
            "manual:2",
            "manual:3",
            "autosave",
            "checkpoint:pre-duel",
          ] as const
        ).map((slot) => owner.saves.read(slot)),
      ),
    };
  },
  async corrupt(slot: StorySlotKey, value: unknown) {
    requireOk(await owner.flush());
    await fault({ kind: "corrupt-story", slot, value });
  },
  async clear(slot: StorySlotKey) {
    requireOk(await owner.flush());
    await fault({ kind: "clear-story", slot });
  },
  runtimeIdentity() {
    return runtimeSnapshotId(
      stack.packages.filter(({ packageId }) => packageId !== "chapter-01"),
    );
  },
  sessionActive() {
    return service.sessionActive();
  },
  async resetDecks() {
    requireOk(await owner.reset(["decks", "deck-meta", "deck-autosaves"]));
  },
  async decks() {
    return owner.services.createDeckRepository().list();
  },
  async deck(id: string) {
    return owner.services.createDeckRepository().load(deckId(id));
  },
  async putDeck(stored: StoredDeck) {
    await owner.services
      .createDeckRepository()
      .create(stored.deck, stored.history);
  },
  async replaceDeck(id: string, cards: DeckCardLists) {
    const stored = await owner.services.createDeckRepository().load(deckId(id));
    if (stored === null) throw new Error("Fixture deck missing");
    return owner.services.createDeckRepository().save(
      stored.deck.revision,
      { ...stored.deck, ...cards },
      pushDeckUpdate(stored.history, {
        deckId: stored.deck.id,
        before: stored.deck,
        after: cards,
        reason: "restore",
        beforeImportedNeedsReview: stored.deck.importedNeedsReview,
        afterImportedNeedsReview: stored.deck.importedNeedsReview,
        beforeIllustrationCardCode: stored.deck.illustrationCardCode,
        afterIllustrationCardCode: stored.deck.illustrationCardCode,
      }),
    );
  },
  async failDeckWrite() {
    await fault({ kind: "fail-deck-write" });
  },
  async battlePreferences() {
    requireOk(await owner.flush());
    return requireOk(
      await owner.storage!.userData.readUser("preferences", "battle-ui"),
    )?.payload as PersistedUiState;
  },
  async shellPreferences() {
    requireOk(await owner.flush());
    return requireOk(
      await owner.storage!.userData.readUser("preferences", "shell"),
    )?.payload as ShellSettings;
  },
  async seedDeck(id: string, name: string, cards: DeckCardLists) {
    const deck = createBlankDeck(name, new Map(), PROTOTYPE_RULESET, { id });
    await owner.services
      .createDeckRepository()
      .create({ ...deck, ...cards }, emptyDeckHistory());
  },
  async playback(
    value: Parameters<
      UserPersistenceOwner["services"]["preferences"]["storyPlayback"]["update"]
    >[0],
  ) {
    requireOk(await owner.services.preferences.storyPlayback.update(value));
    requireOk(await owner.flush());
  },
};

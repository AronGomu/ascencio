/* Whether the story has anything to continue from, answered without loading
   the visual novel. The main menu is the app's first screen, so everything it
   touches is in the entry chunk.

   The two names below are declared here rather than imported from the story.
   `src/story/index.ts` is the visual novel's lazy chunk entry, so a static
   value import of it from anything eager makes the whole domain eager: Rollup
   reports INEFFECTIVE_DYNAMIC_IMPORT, emits no `story-*.js` chunk at all, and
   `npm run build:verify` refuses the build. Deep-importing
   `src/story/saves/story-save-contracts.ts` instead is legal with an ADR-022
   allowance, but that module reaches the prologue content and the story-state
   model, so it costs the entry chunk 9,216 bytes for two strings.
   `tests/unit/story-save-presence.test.ts` pins both names to the story's own
   constants, so a rename there fails there rather than silently hiding
   Continue. */
export const STORY_SAVES_DATABASE_NAME = "ygo-story-saves";
export const STORY_SAVES_STORE_NAME = "saves";

/* The slots a player can resume from. Checkpoint is internal, never counted.
   Keep in sync with `StoryApp.hydrate()` (StoryApp.svelte) — it reads only
   `manual:1` and `autosave` today. `manual:2`/`manual:3` are inert until a
   multi-slot feature writes them; the wider list here is forward-compatible. */
const PLAYER_SLOT_KEYS: readonly string[] = [
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
];

/**
 * Answers whether any story save is on disk.
 *
 * Opened without a version on purpose. An existing database opens at whatever
 * version it holds, and a missing one would otherwise be *created* at version 1
 * with no object stores — indistinguishable, to `createStorySaveRepository`,
 * from a database it had already set up. Its `open(name, 1)` would then find
 * the version it wants, skip the `upgradeneeded` that builds the `saves` store,
 * and the story could never save again. Aborting the version-change
 * transaction rolls that creation back, and the request reports the abort,
 * which is the same "no save" answer.
 *
 * Every failure is "no save" plus a warning: the menu hides Continue rather
 * than offering a resume that cannot happen.
 */
export function storySaveExists(factory: IDBFactory): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const answer = (found: boolean): void => resolve(found);
    const unavailable = (cause: unknown): void => {
      console.warn("Story saves could not be read; Continue is hidden", cause);
      resolve(false);
    };

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(STORY_SAVES_DATABASE_NAME);
    } catch (error) {
      unavailable(error);
      return;
    }

    /* Only fires when there was no database, and the abort keeps it that way. */
    let missing = false;
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      if (missing) answer(false);
      else unavailable(request.error);
    };
    request.onblocked = () =>
      unavailable(new Error("Another browser tab still has the story saves"));
    request.onsuccess = () => {
      const database = request.result;
      const close = (found: boolean): void => {
        database.close();
        answer(found);
      };
      if (!database.objectStoreNames.contains(STORY_SAVES_STORE_NAME)) {
        close(false);
        return;
      }
      try {
        const transaction = database.transaction(
          STORY_SAVES_STORE_NAME,
          "readonly",
        );
        const store = transaction.objectStore(STORY_SAVES_STORE_NAME);
        const requests = PLAYER_SLOT_KEYS.map((key) => store.get(key));
        transaction.oncomplete = () => {
          const found = requests.some((req) => req.result !== undefined);
          close(found);
        };
        transaction.onabort = () => close(false);
        transaction.onerror = () => close(false);
      } catch (error) {
        database.close();
        unavailable(error);
      }
    };
  });
}

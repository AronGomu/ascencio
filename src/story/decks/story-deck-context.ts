/* The one place a story `DeckContext` is built.

   The deck editor is one editor over two worlds, and which one it writes into
   is decided here for every story route (ADR-049, ADR-051). Everything the
   context carries — the repository, what the save owns, the name on the banner
   — is read from a single envelope, so a caller cannot pair one save's decks
   with another save's collection, nor with free play's unlimited ownership.

   `DeckContext` is typed from `src/decks/` and never imported for its value:
   `deck-repository-context.ts` reaches `IndexedDbDeckRepository`, and pulling
   that into the story closure would put `idb`, the deck schema and its
   migration into a chunk that never opens the free-play library. */

import type { DeckContext } from "../../decks/deck-repository-context.ts";
import { DeckStorageError } from "../../decks/deck-storage-errors.ts";
import { storyCardOwnership } from "./card-ownership.ts";
import { createStoryDeckRepository } from "./story-deck-repository.ts";
import { reduceStory } from "../model/story-reducer.ts";
import type { StoryState } from "../model/story-state.ts";
import {
  storyChapterLabel,
  type StorySaveEnvelope,
  type StorySaveWriteResult,
  type StorySlotKey,
} from "../saves/story-save-contracts.ts";
import type { StorySaveRepository } from "../saves/story-save-repository.ts";

/* The slots a player's own progress lives in, and the ones the title screen's
   Continue chooses between. `checkpoint:pre-duel` is deliberately absent: it is
   the shell's scratch record for a duel in flight, so a deck edited into it
   would be overwritten by the next hand-back. */
const PLAYER_SLOTS: readonly StorySlotKey[] = ["manual:1", "autosave"];

/**
 * The context for the save the player would resume, or `null` when they have
 * none — which is a story deck route reached with nothing loaded, and sends the
 * shell back to the main menu rather than opening an empty editor.
 *
 * Newest slot wins, exactly as `StoryApp`'s Continue decides it, so the decks
 * the editor shows are the decks the next resumed session will duel with.
 */
export async function openStoryDeckContext(
  saves: StorySaveRepository,
): Promise<DeckContext | null> {
  const results = await Promise.all(
    PLAYER_SLOTS.map(async (slot) => await saves.read(slot)),
  );
  const [loaded] = results
    .flatMap((result) => (result.kind === "ready" ? [result.envelope] : []))
    .sort((a, b) => b.savedAt - a.savedAt);
  return loaded === undefined ? null : storyDeckContext(saves, loaded);
}

function storyDeckContext(
  saves: StorySaveRepository,
  loaded: StorySaveEnvelope,
): DeckContext {
  const slot = loaded.slot;
  let state: StoryState = loaded.state;
  /* The revision the last write landed on, so a second edit is not refused as
     stale by the record its own first edit created. */
  let revision = loaded.revision;
  const context: DeckContext = {
    kind: "story",
    label: storyChapterLabel(state),
    /* A snapshot of the save as it was opened, which is what ADR-050 asks for:
       a deck edit never changes the collection, so the reader stays true for
       the whole editing session. */
    ownership: storyCardOwnership(state),
    createRepository: () =>
      createStoryDeckRepository({
        readState: () => state,
        dispatch: (command) => {
          state = reduceStory(state, command);
        },
        /* A refused write rolls the dispatched command back out, so the next
           attempt writes from the state the save still holds instead of being
           refused as stale. */
        restore: (previous) => {
          state = previous;
        },
        /* Thrown rather than returned: the editor reports a failed save from
           an exception, and a refused write reported as success would leave
           the player looking at a deck their save does not have. */
        persist: async () => {
          const result = await saves.write(slot, state, revision);
          if (result.kind !== "written")
            throw new DeckStorageError(writeFailure(result));
          revision = result.revision;
        },
      }),
  };
  return Object.freeze(context);
}

function writeFailure(result: StorySaveWriteResult): string {
  if (result.kind === "stale")
    return `The story save was changed elsewhere (revision ${String(result.currentRevision)})`;
  if (result.kind === "failed" && result.reason === "quota")
    return "Storage is full";
  if (result.kind === "failed" && result.reason === "unavailable")
    return "Storage is unavailable";
  return "The story save could not be written";
}

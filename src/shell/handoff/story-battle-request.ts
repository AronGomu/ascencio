/* The pairing a story encounter is fought with.

   Only the player's seat comes from the save. The opponent stays the bundled
   deck the duel has always fixed it to (`App.svelte`'s `FIXED_OPPONENT_KEY`),
   because who the encounter stages is the story's to say and choosing their
   deck is not part of this handoff.

   The battle module is passed in rather than imported: `src/battle/index.ts`
   also exports `BattleFacade`, and a static import of it from the shell makes
   the duel eager — the "shell initial JavaScript" budget in
   `scripts/verify-browser-build.ts` rejects that build. `AppShell` reaches it
   through `loaders.duel()`, exactly as the free-play match setup does. */

import type { BattleRequest } from "../../battle/index.ts";
import type { ValidatedDeckSnapshot } from "../../decks/index.ts";
import type { BattleDeckModule } from "../domain-loaders.ts";

/** Throws `BattleRequestError` when the snapshot is one the duel would refuse,
    which is the point of parsing here: the caller learns the rule it broke
    while the story is still on screen, instead of after a duel has mounted. */
export function storyBattleRequest(
  battle: BattleDeckModule,
  deck: ValidatedDeckSnapshot,
): BattleRequest {
  return battle.parseBattleRequest({
    player: { kind: "local", deck },
    opponent: { kind: "preset", deckId: battle.DEFAULT_OPPONENT_DECK_ID },
  });
}

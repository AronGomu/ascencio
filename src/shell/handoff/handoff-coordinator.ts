/* The shell's half of the story→duel handoff. It owns the three things the
   story cannot: the handoff id, the route the duel runs on, and the promise
   that exactly one result ever comes back.

   The order in `begin` is the whole safety property. The checkpoint is
   written, then read back and compared, and only a checkpoint that survived
   that round trip is allowed to become a duel. A player whose storage is full
   gets a retry on the briefing screen instead of a duel whose result has
   nowhere to land. */

import { handoffId as routeHandoffId, type AppRoute } from "../routes.ts";
import type { NavigateOptions } from "../shell-store.ts";
/* Both cross-domain imports are type-only, which is what keeps the duel and
   the visual novel behind their dynamic imports: a value import of either
   public entry would pull `BattleFacade` or `StoryApp` into the entry chunk. */
import type { BattleFacadeResult } from "../../battle/index.ts";
import type { StorySaveRepository, StoryState } from "../../story/index.ts";
/* The one deep import the shell holds into the visual novel, for the same
   reason `src/shell/settings/shell-settings.ts` holds one into the duel: the
   entry that could legally carry these four functions also exports `StoryApp`,
   and a static import of it would make the whole visual novel eager. This
   module imports no component and no state of its own. Allowed against this
   file alone in `eslint.config.js` and `tests/unit/domain-boundaries.test.ts`. */
import {
  acceptsResult,
  restoreStoryState,
  toStoryResolution,
  type PendingStoryDuel,
  type StoryDuelResolution,
  type StoryEncounterIntent,
} from "../../story/handoff/story-handoff.ts";

const CHECKPOINT = "checkpoint:pre-duel" as const;
const STORY_ROUTE: AppRoute = { kind: "story" };

export interface HandoffCoordinator {
  begin(
    intent: StoryEncounterIntent,
    state: StoryState,
  ): Promise<"ready" | "checkpoint-failed">;
  resume(handoffId: string): Promise<"restored" | "not-found">;
  settle(handoffId: string, result: BattleFacadeResult): void;
}

export function createHandoffCoordinator(deps: {
  readonly saves: StorySaveRepository;
  readonly navigate: (route: AppRoute, options?: NavigateOptions) => void;
  readonly onResolution: (
    resolution: StoryDuelResolution,
    encounterId: PendingStoryDuel["encounterId"],
  ) => void;
  /** The state the story should come back to: the checkpoint that was just
      verified, or the one a reload restored. */
  readonly onRestore: (state: StoryState) => void;
}): HandoffCoordinator {
  let pending: PendingStoryDuel | null = null;

  return {
    async begin(intent, state) {
      /* Before anything is stored: an id the hash cannot carry would strand
         the player on a route no reload could ever resume. */
      try {
        routeHandoffId(intent.handoffId);
      } catch {
        return "checkpoint-failed";
      }

      const checkpoint: StoryState = {
        ...state,
        encounterId: intent.encounterId,
        pendingHandoffId: intent.handoffId,
      };
      const written = await deps.saves.write(CHECKPOINT, checkpoint, null);
      if (written.kind !== "written") return "checkpoint-failed";

      /* Verified, not assumed. A write that reported success and stored
         something else is exactly the case a later reload cannot recover
         from, so it is caught here while the story is still on screen. */
      const stored = await deps.saves.read(CHECKPOINT);
      if (
        stored.kind !== "ready" ||
        stored.envelope.revision !== written.revision ||
        stored.envelope.state.pendingHandoffId !== intent.handoffId ||
        stored.envelope.state.encounterId !== intent.encounterId
      )
        return "checkpoint-failed";

      pending = {
        handoffId: intent.handoffId,
        encounterId: intent.encounterId,
      };
      deps.onRestore(restoreStoryState(stored.envelope.state));
      deps.navigate({
        kind: "duel-session",
        handoffId: routeHandoffId(intent.handoffId),
      });
      return "ready";
    },

    async resume(handoffId) {
      /* The duel this session already started: the checkpoint has nothing to
         add, and re-reading it would only invite a race with its own write. */
      if (pending !== null && pending.handoffId === handoffId)
        return "restored";

      const stored = await deps.saves.read(CHECKPOINT);
      const state =
        stored.kind === "ready"
          ? restoreStoryState(stored.envelope.state)
          : null;
      /* Absent, unreadable, belonging to another handoff, or naming no
         encounter to restart are one case: there is no duel to resume, so the
         player goes back to the story rather than into half of one. */
      if (
        state === null ||
        state.pendingHandoffId !== handoffId ||
        state.encounterId === null
      ) {
        pending = null;
        /* A correction, not a destination: pushing here would put the session
           route the player just left in front of them again, so every Back
           press would walk forward into it instead of out of the duel. */
        deps.navigate(STORY_ROUTE, { replace: true });
        return "not-found";
      }

      pending = { handoffId, encounterId: state.encounterId };
      deps.onRestore(state);
      return "restored";
    },

    settle(handoffId, result) {
      if (!acceptsResult(pending, handoffId)) return;
      const { encounterId } = pending as PendingStoryDuel;
      /* Cleared before anything else runs, so a duplicate or a stale result
         arriving from the same teardown finds nothing to settle. */
      pending = null;
      deps.onResolution(toStoryResolution(result), encounterId);
      /* The checkpoint has done its job; failing to clear it costs nothing,
         because the next `begin` overwrites the slot and `resume` only ever
         accepts a checkpoint that names the handoff being resumed. */
      void deps.saves.clear(CHECKPOINT).catch((error: unknown) => {
        console.warn({
          event: "shell.handoff.checkpoint_clear_failed",
          err: error,
        });
      });
      /* The session route is spent, so the return replaces it rather than
         stacking a third entry the player has to press Back past twice. */
      deps.navigate(STORY_ROUTE, { replace: true });
    },
  };
}

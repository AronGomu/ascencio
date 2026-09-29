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
import type { StoryState } from "../../story/index.ts";
import type {
  GenerationSaveRepository,
  StoryBinding,
  StorySaveReadResult,
} from "../../story/saves/index.ts";
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
  /** Forget in-memory ownership after whole user DB replacement; never delete restored rows. */
  invalidate(): void;
  reset(): Promise<void>;
  begin(
    intent: StoryEncounterIntent,
    state: StoryState,
    story: StoryBinding,
  ): Promise<"ready" | "checkpoint-failed">;
  resume(handoffId: string): Promise<"restored" | "not-found">;
  settle(handoffId: string, result: BattleFacadeResult): void;
}

export function createHandoffCoordinator(deps: {
  readonly saves: GenerationSaveRepository;
  readonly onReadError?: (
    result: Extract<
      StorySaveReadResult,
      { readonly kind: "corrupt" | "incompatible" }
    >,
  ) => void;
  readonly navigate: (route: AppRoute, options?: NavigateOptions) => void;
  readonly onResolution: (
    resolution: StoryDuelResolution,
    encounterId: PendingStoryDuel["encounterId"],
  ) => void;
  /** The state the story should come back to: the checkpoint that was just
      verified, or the one a reload restored. */
  readonly onRestore: (state: StoryState, story: StoryBinding) => void;
}): HandoffCoordinator {
  let pending: PendingStoryDuel | null = null;
  let ownedRevision = 0;
  let epoch = 0;
  let work: Promise<void> = Promise.resolve();
  let beginning: number | null = null;
  let cleanupFailed = false;

  // One queue covers writes, reads and revision-bound cleanup. Reset invalidates
  // synchronously, then drains everything admitted before it (including a write
  // whose successful revision has not been returned yet).
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = work.then(operation);
    work = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function clearOwned(revision: number): Promise<void> {
    if (revision === 0) return;
    try {
      await deps.saves.clear(CHECKPOINT, revision);
    } catch {
      cleanupFailed = true;
      console.warn("CHECKPOINT_CLEAR_FAILED");
    }
  }

  return {
    invalidate() {
      epoch += 1;
      pending = null;
      ownedRevision = 0;
      cleanupFailed = false;
    },
    reset() {
      epoch += 1;
      pending = null;
      const revision = ownedRevision;
      const reset = enqueue(async () => {
        await clearOwned(revision);
        if (cleanupFailed) throw new Error("CHECKPOINT_CLEAR_FAILED");
      });
      ownedRevision = 0;
      return reset;
    },
    async begin(intent, state, story) {
      if (beginning === epoch || pending !== null) return "checkpoint-failed";
      const run = epoch;
      beginning = run;
      return enqueue(async () => {
        try {
          if (run !== epoch || cleanupFailed || pending !== null)
            return "checkpoint-failed";
          /* Before anything is stored: an id the hash cannot carry would strand
         the player on a route no reload could ever resume. */
          try {
            routeHandoffId(intent.handoffId);
          } catch {
            return "checkpoint-failed";
          }

          const binding = structuredClone(story);
          const checkpoint: StoryState = {
            ...structuredClone(state),
            encounterId: intent.encounterId,
            pendingHandoffId: intent.handoffId,
          };
          // The admitted write holds the previous revision until its outcome
          // is known. Reset must not also queue a clear of that superseded row.
          const revision = ownedRevision;
          ownedRevision = 0;
          const written = await deps.saves
            .write(CHECKPOINT, checkpoint, revision, binding)
            .catch(() => ({ kind: "failed" as const }));
          if (written.kind !== "written") {
            if (run !== epoch) await clearOwned(revision);
            else ownedRevision = revision;
            return "checkpoint-failed";
          }
          if (run !== epoch) {
            // Reset could not capture a revision that was still inside write().
            // Clear it here, inside the admitted operation, before reset drains.
            await clearOwned(written.revision);
            return "checkpoint-failed";
          }
          ownedRevision = written.revision;

          /* Verified, not assumed. A write that reported success and stored
         something else is exactly the case a later reload cannot recover
         from, so it is caught here while the story is still on screen. */
          const stored = await deps.saves.read(CHECKPOINT);
          if (
            run !== epoch ||
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
          deps.onRestore(
            restoreStoryState(stored.envelope.state),
            stored.envelope.story,
          );
          deps.navigate({
            kind: "duel-session",
            handoffId: routeHandoffId(intent.handoffId),
          });
          return "ready";
        } catch {
          return "checkpoint-failed";
        } finally {
          if (beginning === run) beginning = null;
        }
      });
    },

    async resume(handoffId) {
      const run = epoch;
      return enqueue(async () => {
        if (run !== epoch || cleanupFailed) return "not-found";
        /* The duel this session already started: the checkpoint has nothing to
         add, and re-reading it would only invite a race with its own write. */
        if (pending !== null && pending.handoffId === handoffId)
          return "restored";

        let stored: StorySaveReadResult;
        try {
          stored = await deps.saves.read(CHECKPOINT);
        } catch (error) {
          stored = {
            kind: "corrupt",
            slot: CHECKPOINT,
            reason:
              error instanceof Error ? error.message : "STORAGE_UNAVAILABLE",
          };
        }
        if (run !== epoch) return "not-found";
        if (stored.kind === "corrupt" || stored.kind === "incompatible")
          deps.onReadError?.(stored);
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
        if (stored.kind === "ready") {
          ownedRevision = stored.envelope.revision;
          deps.onRestore(state, stored.envelope.story);
        }
        return "restored";
      });
    },

    settle(handoffId, result) {
      if (!acceptsResult(pending, handoffId)) return;
      const { encounterId } = pending as PendingStoryDuel;
      /* Cleared before anything else runs, so a duplicate or a stale result
         arriving from the same teardown finds nothing to settle. */
      pending = null;
      // Transfer ownership to the queue before callbacks can reset or begin.
      const revision = ownedRevision;
      void enqueue(() => clearOwned(revision));
      ownedRevision = 0;
      deps.onResolution(toStoryResolution(result), encounterId);
      /* The session route is spent, so the return replaces it rather than
         stacking a third entry the player has to press Back past twice. */
      deps.navigate(STORY_ROUTE, { replace: true });
    },
  };
}

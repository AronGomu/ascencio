import { formatAppRoute, parseAppRoute, type AppRoute } from "./routes.ts";

/** Which main-menu entry asked for the story, so the visual novel can open on
    that screen instead of repeating its own title. */
export type StoryEntryIntent = "new" | "continue" | "load";

export interface ShellState {
  readonly route: AppRoute;
  readonly previousRoute: AppRoute | null;
  /** Set only by `enterStory`, and only for as long as the route is the story:
      leaving it drops the intent, so coming back resumes where the player left
      off rather than replaying the entry they once chose. */
  readonly storyEntryIntent: StoryEntryIntent | null;
}

export interface NavigateOptions {
  /** Replaces the current history entry instead of pushing a new one. For a
      route the player did not ask for — a settled duel returning to the story,
      or a session route nothing can resume — so Back leads where they came
      from rather than back into the route that just corrected them. */
  readonly replace?: boolean;
}

export interface ShellStore {
  subscribe(run: (state: ShellState) => void): () => void;
  /** Writes `location.hash`; the hashchange listener is not needed to react. */
  navigate(route: AppRoute, options?: NavigateOptions): void;
  /** Navigates to the story, recording which menu entry sent the player. */
  enterStory(intent: StoryEntryIntent): void;
  /** Applies a hash that the browser already owns, without writing it back. */
  syncFromHash(hash: string): void;
}

/** The shell's own hash writer, kept here rather than inline so the history
    entry each navigation produces is testable on its own. */
export function writeLocationHash(hash: string, replace: boolean): void {
  if (replace) globalThis.history.replaceState(null, "", hash);
  else globalThis.location.hash = hash;
}

export function createShellStore(
  initialHash: string,
  setHash: (hash: string, replace: boolean) => void,
): ShellStore {
  let state: ShellState = {
    route: parseAppRoute(initialHash),
    previousRoute: null,
    storyEntryIntent: null,
  };
  const subscribers = new Set<(state: ShellState) => void>();

  function apply(route: AppRoute, intent: StoryEntryIntent | null): void {
    /* The intent belongs to the story route it was chosen for. Carrying it
       through `syncFromHash` is what lets it survive the `hashchange` the
       navigation that set it provokes; dropping it anywhere else is what stops
       it from outliving the visit. */
    const carried = route.kind === "story" ? intent : null;
    const routeChanged = formatAppRoute(route) !== formatAppRoute(state.route);
    if (!routeChanged && carried === state.storyEntryIntent) return;
    state = {
      route,
      previousRoute: routeChanged ? state.route : state.previousRoute,
      storyEntryIntent: carried,
    };
    for (const run of subscribers) run(state);
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      run(state);
      return () => {
        subscribers.delete(run);
      };
    },
    navigate(route, options) {
      setHash(formatAppRoute(route), options?.replace === true);
      apply(route, state.storyEntryIntent);
    },
    enterStory(intent) {
      const route: AppRoute = { kind: "story" };
      setHash(formatAppRoute(route), false);
      apply(route, intent);
    },
    syncFromHash(hash) {
      apply(parseAppRoute(hash), state.storyEntryIntent);
    },
  };
}

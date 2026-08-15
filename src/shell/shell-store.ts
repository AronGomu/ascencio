import { formatAppRoute, parseAppRoute, type AppRoute } from "./routes.ts";

export interface ShellState {
  readonly route: AppRoute;
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
  let state: ShellState = { route: parseAppRoute(initialHash) };
  const subscribers = new Set<(state: ShellState) => void>();

  function apply(route: AppRoute): void {
    if (formatAppRoute(route) === formatAppRoute(state.route)) return;
    state = { route };
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
      apply(route);
    },
    syncFromHash(hash) {
      apply(parseAppRoute(hash));
    },
  };
}

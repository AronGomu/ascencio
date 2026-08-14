import { formatAppRoute, parseAppRoute, type AppRoute } from "./routes.ts";

export interface ShellState {
  readonly route: AppRoute;
}

export interface ShellStore {
  subscribe(run: (state: ShellState) => void): () => void;
  /** Writes `location.hash`; the hashchange listener is not needed to react. */
  navigate(route: AppRoute): void;
  /** Applies a hash that the browser already owns, without writing it back. */
  syncFromHash(hash: string): void;
}

export function createShellStore(
  initialHash: string,
  setHash: (hash: string) => void,
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
    navigate(route) {
      setHash(formatAppRoute(route));
      apply(route);
    },
    syncFromHash(hash) {
      apply(parseAppRoute(hash));
    },
  };
}

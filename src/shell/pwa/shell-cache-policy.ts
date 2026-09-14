export const SHELL_CACHE_PREFIX = "ygo-core-shell-";

export interface ShellPrecacheEntry {
  readonly url: string;
  readonly revision?: string | null;
}

export type ServiceWorkerState =
  | { readonly kind: "checking" }
  | { readonly kind: "unsupported" }
  | { readonly kind: "installing" }
  | { readonly kind: "reload-required" }
  | { readonly kind: "offline-ready" }
  | { readonly kind: "update-waiting" }
  | { readonly kind: "failed" };

export interface ServiceWorkerSnapshot {
  readonly supported: boolean;
  readonly controlled: boolean;
  readonly active: boolean;
  readonly installing: boolean;
  readonly waiting: boolean;
  readonly failed?: boolean;
}

export function shellCacheName(buildId: string): string {
  return `${SHELL_CACHE_PREFIX}${buildId}`;
}

export function isFirstCoreInstall(
  hasActiveWorker: boolean,
  cacheNames: readonly string[],
): boolean {
  return (
    !hasActiveWorker &&
    !cacheNames.some((name) => name.startsWith(SHELL_CACHE_PREFIX))
  );
}

export function assertShellPrecacheEntries<
  T extends ShellPrecacheEntry | string,
>(entries: readonly T[]): readonly T[] {
  for (const entry of entries) {
    const entryUrl = typeof entry === "string" ? entry : entry.url;
    const url = new URL(entryUrl, "https://core.invalid/");
    const pathname = url.pathname;
    if (
      /%|\\/.test(entryUrl) ||
      /(?:^|\/)(?:content|runtime|__content)(?:\/|$)/.test(pathname) ||
      /(?:^|\/)assets\/story(?:\/|$)/.test(pathname) ||
      /\.(?:wasm|zip)$/i.test(pathname)
    )
      throw new Error(
        `CORE shell precache contains forbidden payload: ${entryUrl}`,
      );
  }
  return entries;
}

export function isAppNavigationRequest(
  requestUrl: string,
  scopeUrl: string,
): boolean {
  const request = new URL(requestUrl);
  const scope = new URL(scopeUrl);
  if (
    request.origin !== scope.origin ||
    !request.pathname.startsWith(scope.pathname)
  )
    return false;
  const relative = request.pathname.slice(scope.pathname.length);
  return relative === "" || relative === "index.html";
}

export function resolveServiceWorkerState(
  snapshot: ServiceWorkerSnapshot,
): ServiceWorkerState {
  if (!snapshot.supported) return { kind: "unsupported" };
  if (snapshot.waiting) return { kind: "update-waiting" };
  if (snapshot.controlled && snapshot.active) return { kind: "offline-ready" };
  if (snapshot.installing) return { kind: "installing" };
  if (snapshot.failed) return { kind: "failed" };
  if (snapshot.active) return { kind: "reload-required" };
  return { kind: "checking" };
}

export function serviceWorkerStateMessage(state: ServiceWorkerState): string {
  switch (state.kind) {
    case "checking":
      return "Preparing offline access…";
    case "unsupported":
      return "Offline install unavailable in this build.";
    case "installing":
      return "Caching app for offline use…";
    case "reload-required":
      return "App cached. Reload to enable offline use.";
    case "offline-ready":
      return "Offline reopening is ready.";
    case "update-waiting":
      return "Close all app tabs, then reopen to update.";
    case "failed":
      return "Offline setup failed. Reopen online to retry.";
  }
}

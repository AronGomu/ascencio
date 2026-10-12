import type { UserJsonBackend } from "../json/user-data-store.ts";
import type { StorageResult } from "../contracts/package.ts";

export const BROWSER_USER_DATA_KEY =
  "ascencio:browser-development:user-data:v1";

/** Development saves share the native JSON schema, with a separate storage key. */
export function browserUserJsonBackend(): UserJsonBackend {
  return {
    async read() {
      return localStorage.getItem(BROWSER_USER_DATA_KEY);
    },
    async write(source, expected): Promise<StorageResult<void>> {
      if (!navigator.locks)
        return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
      try {
        return await navigator.locks.request(BROWSER_USER_DATA_KEY, () => {
          const current = localStorage.getItem(BROWSER_USER_DATA_KEY);
          if (current === source) return { kind: "ok", value: undefined };
          if (current !== expected)
            return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
          localStorage.setItem(BROWSER_USER_DATA_KEY, source);
          return { kind: "ok", value: undefined };
        });
      } catch {
        return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
      }
    },
  };
}

export async function resetBrowserUserData(): Promise<void> {
  await navigator.locks.request(BROWSER_USER_DATA_KEY, () =>
    localStorage.removeItem(BROWSER_USER_DATA_KEY),
  );
}

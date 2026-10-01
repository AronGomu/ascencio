import { JsonUserDataStore } from "./user-data-store.ts";

export const USER_DATA_STORAGE_KEY = "ascencio:user-data:v1";

export function openBrowserUserData(): JsonUserDataStore {
  return new JsonUserDataStore({
    read: async () => localStorage.getItem(USER_DATA_STORAGE_KEY),
    write: async (source, expected) => {
      // The check and set are synchronous within the application's owner tab.
      if (localStorage.getItem(USER_DATA_STORAGE_KEY) !== expected)
        return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
      localStorage.setItem(USER_DATA_STORAGE_KEY, source);
      return { kind: "ok", value: undefined };
    },
  });
}

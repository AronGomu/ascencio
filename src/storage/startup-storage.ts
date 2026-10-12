import { isTauri } from "@tauri-apps/api/core";
import type { StartupProgress } from "./native/prepared-storage.ts";
import {
  prepareNativeStorage,
  closePreparedNativeStorage,
  flushPreparedNativeStorage,
} from "./native/startup-storage.ts";

export async function prepareApplicationStorage(
  signal: AbortSignal,
  progress?: (event: StartupProgress) => void,
) {
  if (isTauri()) return prepareNativeStorage(signal, progress);
  if (__BROWSER_DEVELOPMENT__)
    return (
      await import("./browser-dev/prepared-storage.ts")
    ).prepareBrowserStorage(signal, progress);
  throw new Error("Open this application through Tauri.");
}

export async function closePreparedApplicationStorage(): Promise<void> {
  if (isTauri()) return closePreparedNativeStorage();
  if (__BROWSER_DEVELOPMENT__)
    await (
      await import("./browser-dev/prepared-storage.ts")
    ).closePreparedBrowserStorage();
}

export async function flushPreparedApplicationStorage(): Promise<void> {
  if (isTauri()) return flushPreparedNativeStorage();
  if (__BROWSER_DEVELOPMENT__)
    await (
      await import("./browser-dev/prepared-storage.ts")
    ).flushPreparedBrowserStorage();
}

export async function resetBrowserDevelopmentSaves(): Promise<void> {
  if (!__BROWSER_DEVELOPMENT__ || isTauri())
    throw new Error("STORAGE_UNAVAILABLE");
  await (
    await import("./browser-dev/user-json-backend.ts")
  ).resetBrowserUserData();
}

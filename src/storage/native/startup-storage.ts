import type { StartupProgress } from "./prepared-storage.ts";
/** Keep the content compiler/catalog out of the bundled diagnostic surface. */
export async function prepareNativeStorage(
  signal: AbortSignal,
  progress?: (event: StartupProgress) => void,
) {
  return (await import("./prepared-storage.ts")).prepareNativeStorage(
    signal,
    progress,
  );
}
export async function closePreparedNativeStorage() {
  return (await import("./prepared-storage.ts")).closePreparedNativeStorage();
}
export async function flushPreparedNativeStorage() {
  return (await import("./prepared-storage.ts")).flushPreparedNativeStorage();
}
export async function disableStartupMods() {
  return (await import("./prepared-storage.ts")).disableStartupMods();
}

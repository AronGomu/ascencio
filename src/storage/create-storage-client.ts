import { isTauri } from "@tauri-apps/api/core";
import type { LocalStorageClient } from "./contracts/storage-client.ts";
import type { StorageResult } from "./contracts/package.ts";

/** Production storage is owned by the Tauri process on desktop and mobile. */
export async function openLocalStorage(): Promise<
  StorageResult<LocalStorageClient>
> {
  if (!isTauri())
    return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
  const { openNativeStorage } = await import("./native/storage-client.ts");
  return await openNativeStorage();
}

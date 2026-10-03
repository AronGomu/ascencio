import { isTauri } from "@tauri-apps/api/core";
import {
  invokeNative as invoke,
  openLocalStorage,
} from "../../storage/index.ts";

export interface NativeContentStatus {
  readonly contentFolder: string;
  readonly packages: readonly {
    readonly packageId: string;
    readonly version: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}

let seedTask: Promise<NativeContentStatus> | null = null;

export function isNativeApp(): boolean {
  return isTauri();
}

export function isNativeDesktop(): boolean {
  const mobile =
    /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return isTauri() && !mobile;
}

export async function seedNativeContent(): Promise<NativeContentStatus | null> {
  if (!isTauri()) return null;
  seedTask ??= (async () => {
    const storage = await openLocalStorage();
    if (storage.kind === "failed") throw new Error(storage.error.code);
    const stack = await storage.value.packages.current();
    if (stack.kind === "failed") throw new Error(stack.error.code);
    const contentFolder = await invoke<string>("native_content_location");
    return { contentFolder, packages: stack.value.packages };
  })();
  return await seedTask;
}

export async function openNativeContentFolder(): Promise<void> {
  if (!isNativeDesktop())
    throw new Error("Content folder access is desktop only");
  await invoke("open_content_folder");
}

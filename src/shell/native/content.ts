import { invoke, isTauri } from "@tauri-apps/api/core";

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
  seedTask ??= invoke<NativeContentStatus>("native_content_status");
  return await seedTask;
}

export async function openNativeContentFolder(): Promise<void> {
  if (!isNativeDesktop())
    throw new Error("Content folder access is desktop only");
  await invoke("open_content_folder");
}

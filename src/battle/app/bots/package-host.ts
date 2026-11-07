import { isTauri, invoke } from "@tauri-apps/api/core";
import {
  parseBotManifest,
  type BotPackageInfo,
  type PinnedBotPackage,
} from "../../duel/contracts/bot-package.ts";
import type { BotSelection } from "../../duel/contracts/bot-selection.ts";
// Browser delivery is a fixed server-published index, never native app-data.
async function bundledPackages(): Promise<PinnedBotPackage[]> {
  const index = await fetch("/bot-packages/index.json", { cache: "no-store" });
  if (!index.ok)
    throw new Error(
      "Browser AI package index is missing. Prepare bundled bot content.",
    );
  const folders: unknown = await index.json();
  if (
    !Array.isArray(folders) ||
    folders.some(
      (f) => typeof f !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(f),
    )
  )
    throw new Error("Invalid browser AI package index");
  return Promise.all(
    folders.map(async (folder: string) => {
      const url = `/bot-packages/${folder}/bot.json`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok)
        throw new Error("Bundled AI unavailable. Reinstall the application.");
      const manifest = parseBotManifest(await response.json());
      const wasmUrl = `/bot-packages/${folder}/${manifest.wasm}`;
      const wasm = await fetch(wasmUrl, { cache: "no-store" });
      if (!wasm.ok) throw new Error(`Missing executable for ${manifest.id}`);
      const bytes = new Uint8Array(await wasm.arrayBuffer());
      if (bytes.length > 4 * 1024 * 1024)
        throw new Error("Bot executable exceeds 4 MiB");
      const digest = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { manifest, bytes, digest, nativeCompatible: false };
    }),
  );
}
export async function listBotPackages(): Promise<readonly BotPackageInfo[]> {
  if (isTauri()) return invoke("native_bot_list");
  return (await bundledPackages()).map(({ bytes: _, ...info }) => {
    void _;
    return info;
  });
}
export async function pinBotPackage(
  selection: BotSelection,
): Promise<PinnedBotPackage> {
  const p = isTauri()
    ? await invoke<PinnedBotPackage>("native_bot_pin", {
        id: selection.packageId,
      })
    : (await bundledPackages()).find(
        (p) => p.manifest.id === selection.packageId,
      );
  if (!p)
    throw new Error(
      `Required AI ${selection.packageId} is missing. Install its folder in ai-bots (desktop) or include it in the browser build and retry.`,
    );
  if (
    p.manifest.id !== selection.packageId ||
    !p.manifest.policies.includes(selection.policy)
  )
    throw new Error(
      `Required AI ${selection.packageId}/${selection.policy} is missing. Install its folder in ai-bots and retry.`,
    );
  if (selection.runtime === "native" && !p.nativeCompatible)
    throw new Error("This AI has no bundled native build. Choose WebAssembly.");
  return {
    ...p,
    manifest: parseBotManifest(p.manifest),
    bytes: new Uint8Array(p.bytes),
  };
}
import type { BotHostCall } from "../../duel/contracts/bot-host.ts";
export type { BotHostCall } from "../../duel/contracts/bot-host.ts";
export async function botHostCall(call: BotHostCall): Promise<unknown> {
  if (call.method === "pin")
    return pinBotPackage(call.payload.selection as BotSelection);
  if (!isTauri()) throw new Error("Native AI requires the desktop app");
  const commands = {
    nativeOpen: "native_bot_open",
    nativeRequest: "native_bot_request",
    nativeClose: "native_bot_close",
    nativeMemory: "native_bot_memory",
  } as const;
  if (!(call.method in commands)) throw new Error("Unknown bot host operation");
  return invoke(commands[call.method], call.payload);
}
export async function assertBotAvailable(
  selection: BotSelection,
): Promise<void> {
  if (selection.runtime === "typescript") return;
  try {
    await pinBotPackage(selection);
  } catch (error) {
    const failure = new Error(
      error instanceof Error ? error.message : String(error),
    );
    failure.name = "BotDependencyError";
    throw failure;
  }
}

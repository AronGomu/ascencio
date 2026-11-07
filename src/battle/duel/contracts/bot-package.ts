export interface BotPackageManifest {
  readonly id: string;
  readonly packageVersion: string;
  readonly contractVersion: 1;
  readonly source: string;
  readonly wasm: string;
  readonly policies: readonly string[];
}
export interface BotPackageInfo {
  readonly manifest: BotPackageManifest;
  readonly digest: string;
  readonly nativeCompatible: boolean;
}
export interface PinnedBotPackage extends BotPackageInfo {
  readonly bytes: Uint8Array;
}
export function parseBotManifest(value: unknown): BotPackageManifest {
  if (!value || typeof value !== "object") throw new Error("Missing bot.json");
  const v = value as Record<string, unknown>;
  const relative = (path: unknown) =>
    typeof path === "string" &&
    path.length < 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path.split("/").every((p) => p !== ".." && p !== "." && p.length > 0);
  if (
    typeof v.id !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(v.id) ||
    typeof v.packageVersion !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(v.packageVersion) ||
    v.contractVersion !== 1 ||
    !relative(v.source) ||
    !relative(v.wasm) ||
    !String(v.source).startsWith("ai/") ||
    !String(v.wasm).startsWith("dist/") ||
    !Array.isArray(v.policies) ||
    !v.policies.length ||
    v.policies.some((p) => !["basic", "generalist", "random"].includes(p))
  )
    throw new Error("Unsupported or unsafe bot manifest");
  return Object.freeze({
    id: v.id,
    packageVersion: v.packageVersion,
    contractVersion: 1,
    source: v.source,
    wasm: v.wasm,
    policies: [...v.policies],
  }) as BotPackageManifest;
}

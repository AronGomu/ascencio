export interface BotSelection {
  readonly runtime: "typescript" | "wasm" | "native";
  readonly packageId: string;
  readonly policy: "basic" | "generalist" | "random";
}
export const DEFAULT_BOT: BotSelection = Object.freeze({
  runtime: "typescript",
  packageId: "builtin",
  policy: "basic",
});
export function parseBotSelection(value: unknown): BotSelection {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose an available AI");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) => !["runtime", "packageId", "policy"].includes(k),
    ) ||
    !["typescript", "wasm", "native"].includes(String(v.runtime)) ||
    !["basic", "generalist", "random"].includes(String(v.policy)) ||
    typeof v.packageId !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(v.packageId) ||
    (v.runtime === "typescript" && v.packageId !== "builtin")
  )
    throw new Error("Choose an available AI");
  return Object.freeze({
    runtime: v.runtime,
    packageId: v.packageId,
    policy: v.policy,
  }) as BotSelection;
}

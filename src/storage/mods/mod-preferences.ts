export interface ModPreferences {
  readonly schemaVersion: 1;
  readonly mode: "normal" | "modded";
  readonly root: {
    readonly kind: "managed" | "desktop";
    readonly path: string | null;
  };
  readonly enabled: readonly string[];
}
export const DEFAULT_MOD_PREFERENCES: ModPreferences = Object.freeze({
  schemaVersion: 1,
  mode: "normal",
  root: Object.freeze({ kind: "managed", path: null }),
  enabled: Object.freeze([]),
});
export function validModId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 80
  );
}
export function isModPreferences(value: unknown): value is ModPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as ModPreferences;
  return (
    Object.keys(p).sort().join() === "enabled,mode,root,schemaVersion" &&
    p.schemaVersion === 1 &&
    ["normal", "modded"].includes(p.mode) &&
    !!p.root &&
    typeof p.root === "object" &&
    Object.keys(p.root).sort().join() === "kind,path" &&
    (p.root.kind === "managed"
      ? p.root.path === null
      : p.root.kind === "desktop" &&
        typeof p.root.path === "string" &&
        p.root.path.length > 0 &&
        p.root.path.length <= 4096 &&
        !p.root.path.includes("\0")) &&
    Array.isArray(p.enabled) &&
    p.enabled.length <= 32 &&
    p.enabled.every(validModId) &&
    new Set(p.enabled).size === p.enabled.length
  );
}

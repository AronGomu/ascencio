import type { ContentComposition } from "./mod-contracts.ts";
import { validModId } from "./mod-preferences.ts";
export function isContentComposition(
  value: unknown,
): value is ContentComposition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as ContentComposition;
  return (
    Object.keys(c).sort().join() === "identity,requiredMods" &&
    typeof c.identity === "string" &&
    /^[a-f0-9]{64}$/.test(c.identity) &&
    Array.isArray(c.requiredMods) &&
    c.requiredMods.length <= 32 &&
    c.requiredMods.every(
      (m) =>
        m &&
        Object.keys(m).sort().join() === "id,sha256,version" &&
        validModId(m.id) &&
        typeof m.version === "string" &&
        /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(m.version) &&
        typeof m.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(m.sha256),
    ) &&
    new Set(c.requiredMods.map((m) => m.id)).size === c.requiredMods.length
  );
}

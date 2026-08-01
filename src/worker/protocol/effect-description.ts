import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";

export function resolveEffectDescription(
  reference: bigint,
  dependencies: Pick<ActiveDuelDependencies, "texts" | "strings">,
): string | undefined {
  const code = Number(reference >> 20n);
  const index = Number(reference & 0xfffffn);
  return (
    dependencies.texts.get(code)?.strings[index] ||
    dependencies.texts.get(code)?.name ||
    (code === 0 ? dependencies.strings.system[String(index)] : undefined)
  );
}

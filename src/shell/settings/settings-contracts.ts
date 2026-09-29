import type { ShellSettings } from "./shell-settings.ts";

export function isShellSettings(value: unknown): value is ShellSettings {
  if (
    !exact(value, [
      "version",
      "rotationNoticeDismissed",
      "display",
      "freePlayPairing",
      "freePlayOpponentId",
    ]) ||
    value.version !== 3 ||
    typeof value.rotationNoticeDismissed !== "boolean" ||
    !display(value.display)
  )
    return false;
  const pairing = value.freePlayPairing;
  return (
    (pairing === null ||
      (exact(pairing, ["player", "opponent"]) &&
        nonempty(pairing.player) &&
        nonempty(pairing.opponent))) &&
    (value.freePlayOpponentId === null || nonempty(value.freePlayOpponentId))
  );
}

function display(value: unknown): boolean {
  return (
    exact(value, [
      "showZoneOutlines",
      "showZoneCounts",
      "showCardShadows",
      "showZoneLabels",
    ]) && Object.values(value).every((item) => typeof item === "boolean")
  );
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function exact<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

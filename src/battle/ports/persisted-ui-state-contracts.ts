import type { PersistedUiState } from "../app/stores/persisted-ui-state.ts";

export function defaultPersistedUiState(): PersistedUiState {
  return Object.freeze({
    version: 2,
    windows: Object.freeze({ zoneList: null, confirm: null }),
    decks: Object.freeze({
      playerKey: "preset:chapter-one-starter",
      opponentKey: "preset:chapter-one-practice",
    }),
    settings: Object.freeze({
      showZoneOutlines: true,
      showZoneCounts: true,
      showCardShadows: true,
      showZoneLabels: true,
    }),
  });
}

export function isPersistedUiState(value: unknown): value is PersistedUiState {
  return (
    exact(value, ["version", "windows", "decks", "settings"]) &&
    value.version === 2 &&
    exact(value.windows, ["zoneList", "confirm"]) &&
    windowPosition(value.windows.zoneList) &&
    windowPosition(value.windows.confirm) &&
    exact(value.decks, ["playerKey", "opponentKey"]) &&
    nonempty(value.decks.playerKey) &&
    nonempty(value.decks.opponentKey) &&
    exact(value.settings, [
      "showZoneOutlines",
      "showZoneCounts",
      "showCardShadows",
      "showZoneLabels",
    ]) &&
    Object.values(value.settings).every((item) => typeof item === "boolean")
  );
}
function windowPosition(value: unknown): boolean {
  return (
    value === null ||
    (exact(value, ["x", "y"]) &&
      typeof value.x === "number" &&
      Number.isFinite(value.x) &&
      typeof value.y === "number" &&
      Number.isFinite(value.y))
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

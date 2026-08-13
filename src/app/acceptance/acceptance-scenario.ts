export type AcceptanceScenarioId =
  | "field-emz"
  | "field-no-emz"
  | "field-defense";

const SCENARIOS: ReadonlySet<string> = new Set<AcceptanceScenarioId>([
  "field-emz",
  "field-no-emz",
  "field-defense",
]);

export function acceptanceScenarioId(
  search: string,
): AcceptanceScenarioId | null {
  const scenario = new URLSearchParams(search).get("scenario");
  return scenario !== null && SCENARIOS.has(scenario)
    ? (scenario as AcceptanceScenarioId)
    : null;
}

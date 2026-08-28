/* Single declaration of the scenario ids: the type and the lookup set both
   derive from it, so removing an id breaks its consumers at compile time
   instead of silently making `acceptanceScenarioId()` return null. */
export const ACCEPTANCE_SCENARIO_IDS = [
  "field-emz",
  "field-no-emz",
  "field-defense",
  "field-hand-6",
  "field-hand-20",
  "preview-short",
  "preview-long",
  "card-list-browse-six",
  "card-list-browse-overflow",
  "card-list-browse-opponent",
  "card-list-empty",
  "card-list-target-chrome",
  "card-list-single",
  "card-list-multiple",
  "card-list-mixed",
  "card-list-range",
  "card-list-hand-mixed",
  "card-list-duplicate",
  "card-list-stale",
  "field-hand-zoom",
  "field-invalid-target",
] as const;

export type AcceptanceScenarioId = (typeof ACCEPTANCE_SCENARIO_IDS)[number];

const SCENARIOS: ReadonlySet<string> = new Set<string>(ACCEPTANCE_SCENARIO_IDS);

export function acceptanceScenarioId(
  search: string,
): AcceptanceScenarioId | null {
  const scenario = new URLSearchParams(search).get("scenario");
  return scenario !== null && SCENARIOS.has(scenario)
    ? (scenario as AcceptanceScenarioId)
    : null;
}

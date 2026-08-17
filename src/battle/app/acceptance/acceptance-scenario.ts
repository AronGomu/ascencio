export type AcceptanceScenarioId =
  | "field-emz"
  | "field-no-emz"
  | "field-defense"
  | "field-hand-6"
  | "field-hand-20"
  | "preview-short"
  | "preview-long"
  | "card-list-browse-six"
  | "card-list-browse-overflow"
  | "card-list-browse-opponent"
  | "card-list-empty"
  | "card-list-target-chrome"
  | "card-list-single"
  | "card-list-multiple"
  | "card-list-mixed"
  | "card-list-range"
  | "card-list-hand-mixed"
  | "card-list-duplicate"
  | "card-list-stale"
  | "field-hand-zoom";

const SCENARIOS: ReadonlySet<string> = new Set<AcceptanceScenarioId>([
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
]);

export function acceptanceScenarioId(
  search: string,
): AcceptanceScenarioId | null {
  const scenario = new URLSearchParams(search).get("scenario");
  return scenario !== null && SCENARIOS.has(scenario)
    ? (scenario as AcceptanceScenarioId)
    : null;
}

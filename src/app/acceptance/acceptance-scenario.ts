export type AcceptanceScenarioId =
  | "field-emz"
  | "field-no-emz"
  | "field-defense"
  | "field-hand-6"
  | "field-hand-20"
  | "preview-short"
  | "preview-long";

const SCENARIOS: ReadonlySet<string> = new Set<AcceptanceScenarioId>([
  "field-emz",
  "field-no-emz",
  "field-defense",
  "field-hand-6",
  "field-hand-20",
  "preview-short",
  "preview-long",
]);

export function acceptanceScenarioId(
  search: string,
): AcceptanceScenarioId | null {
  const scenario = new URLSearchParams(search).get("scenario");
  return scenario !== null && SCENARIOS.has(scenario)
    ? (scenario as AcceptanceScenarioId)
    : null;
}

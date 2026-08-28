import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_SCENARIO_IDS,
  acceptanceScenarioId,
} from "../../src/battle/app/acceptance/acceptance-scenario.ts";

describe("acceptance scenario ids", () => {
  it("resolves every declared id from the query string", () => {
    for (const id of ACCEPTANCE_SCENARIO_IDS) {
      expect(acceptanceScenarioId(`?scenario=${id}`)).toBe(id);
    }
  });

  it("keeps returning null for an unknown or missing scenario", () => {
    expect(acceptanceScenarioId("?scenario=nope")).toBeNull();
    expect(acceptanceScenarioId("")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  freePlayOpponent,
  installedFreePlayOpponents,
} from "../../../src/shell/screens/free-play-opponents.ts";
import { installedGameplayFixture } from "../../fixtures/installed-gameplay.ts";

describe("installed free-play opponents", () => {
  it("projects chapter opponent policy and deck", () => {
    const gameplay = installedGameplayFixture();
    expect(installedFreePlayOpponents(gameplay)).toEqual([
      {
        id: "installed-rival",
        name: "Installed Rival",
        line: "Installed only",
        deckKey: "chapter:installed-starter",
        policyId: "basic",
      },
    ]);
  });

  it("falls back to installed default opponent", () => {
    const gameplay = installedGameplayFixture();
    const roster = installedFreePlayOpponents(gameplay);
    expect(freePlayOpponent(roster, "gone", gameplay.defaults.opponentId)).toBe(
      roster[0],
    );
  });
});

import { describe, expect, it } from "vitest";
import * as battle from "../../../src/battle/index.ts";
import {
  deckId,
  type ValidatedDeckSnapshot,
} from "../../../src/decks/contracts/index.ts";
import type { BattleDeckModule } from "../../../src/shell/domain-loaders.ts";
import { storyBattleRequest } from "../../../src/shell/handoff/handoff-request.ts";
import { installedGameplayFixture } from "../../fixtures/installed-gameplay.ts";

/* The pairing a story encounter is fought with. Only the player's seat comes
   from the save; the opponent stays the bundled deck the duel has always fixed
   it to, because choosing the opponent is not part of this handoff. */

const module = battle as unknown as BattleDeckModule;

function snapshot(main: readonly number[]): ValidatedDeckSnapshot {
  return {
    ref: { type: "local", deckId: deckId("story-deck"), revision: 3 },
    name: "Signal Deck",
    main,
    extra: [],
    side: [],
    validationDigest: "fnv1a-0",
  };
}

const FORTY = Array.from({ length: 40 }, (_, index) => 1000 + index);

describe("the battle request a story encounter starts", () => {
  it("seats save deck and installed chapter deck", () => {
    const deck = snapshot(FORTY);

    const request = storyBattleRequest(
      module,
      deck,
      installedGameplayFixture(),
    );

    expect(request.player).toEqual({ kind: "local", deck });
    expect(request.opponent).toMatchObject({
      kind: "local",
      deck: {
        ref: { deckId: "chapter:installed-starter", revision: 0 },
        name: "Installed Starter",
      },
    });
  });

  /* The duel's own parser, run before the duel mounts: a snapshot that drifted
     out of the ruleset it was validated against names the rule it broke here,
     rather than dying inside a duel the player is already looking at. */
  it("refuses a snapshot the duel's own contract rejects", () => {
    const overfull = snapshot([
      ...FORTY,
      ...Array.from({ length: 21 }, () => 9),
    ]);

    expect(() =>
      storyBattleRequest(module, overfull, installedGameplayFixture()),
    ).toThrow(battle.BattleRequestError);
  });
});

import { describe, expect, it } from "vitest";
import { unlimitedCardOwnership } from "../../../src/decks/card-ownership.ts";
import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";

/* The free-play half of the ownership contract, and the one boundary the whole
   design turns on: owning a card and being allowed to run it are two different
   questions. Free play answers the first with "always"; the pinned ruleset
   still answers the second (ADR-050).

   This file opens no `fake-indexeddb`, unlike every other deck test here.
   Reading ownership touches no storage, so a version that did would fail here
   rather than quietly work. */

describe("free-play card ownership", () => {
  it("free play owns everything", () => {
    const ownership = unlimitedCardOwnership();
    expect(ownership.ownedCount(4007)).toBe(Number.POSITIVE_INFINITY);
    expect(ownership.ownedCount(89631139)).toBe(Number.POSITIVE_INFINITY);
    expect(ownership.isUnlimited).toBe(true);
  });

  /* Raigeki is pinned to one copy and 10000000 is pinned to none. Free play
     owning infinitely many of either must not read as "a deck may run
     infinitely many": an addable count is `min(ownedCount, quantityLimit)`, so
     this pins the two answers apart at the source rather than in whichever
     screen happens to ask. */
  it("ownership does not encode deck copy limits", () => {
    const ownership = unlimitedCardOwnership();
    for (const [code, limit] of [
      [12580477, 1],
      [10000000, 0],
    ] as const) {
      expect(ownership.ownedCount(code)).toBe(Number.POSITIVE_INFINITY);
      expect(quantityLimit(PROTOTYPE_RULESET, code)).toBe(limit);
      expect(
        Math.min(
          ownership.ownedCount(code),
          quantityLimit(PROTOTYPE_RULESET, code),
        ),
      ).toBe(limit);
    }
  });

  /* The infinite sentinel is only sound because every consumer composes it
     with a finite ruleset limit. An unpinned card caps at three, not at
     infinity. */
  it("the unlimited sentinel composes to a finite addable count", () => {
    const unpinned = 4007;
    expect(quantityLimit(PROTOTYPE_RULESET, unpinned)).toBe(3);
    expect(
      Math.min(
        unlimitedCardOwnership().ownedCount(unpinned),
        quantityLimit(PROTOTYPE_RULESET, unpinned),
      ),
    ).toBe(3);
  });
});

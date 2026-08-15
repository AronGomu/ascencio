import { describe, expect, it } from "vitest";
import {
  isCardIdentityVisible,
  isProjectedCardIdentityKnown,
} from "../../src/battle/duel/card-visibility.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";

describe("card visibility", () => {
  it("projected identity is known exactly when code exists", () => {
    expect(isProjectedCardIdentityKnown({ code: cardCode(1) })).toBe(true);
    expect(isProjectedCardIdentityKnown({})).toBe(false);
  });

  it("raw geometric visibility remains conservative", () => {
    expect(isCardIdentityVisible(0, 1, "field", "faceDownDefense")).toBe(false);
    expect(isCardIdentityVisible(0, 1, "monster", "faceDownAttack")).toBe(
      false,
    );
    expect(isCardIdentityVisible(0, 1, "hand", "faceDownAttack")).toBe(false);
  });
});

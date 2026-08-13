import { describe, expect, it } from "vitest";
import {
  cardListAlphabeticalAllowed,
  cardListBrowseTitle,
  cardListDisplayEntries,
} from "../../src/app/presentation/card-list-dialog-model.ts";

const entries = Object.freeze([
  Object.freeze({ id: "1", label: "Beta", identityVisible: true }),
  Object.freeze({ id: "2", label: "Alpha", identityVisible: true }),
  Object.freeze({ id: "3", label: "Alpha", identityVisible: true }),
]);

describe("card-list dialog model", () => {
  it("sorts visible entries stably without mutation", () => {
    expect(cardListDisplayEntries(entries, true).map(({ id }) => id)).toEqual([
      "2",
      "3",
      "1",
    ]);
    expect(entries.map(({ id }) => id)).toEqual(["1", "2", "3"]);
  });

  it("restores exact source order when alphabetical is off", () => {
    expect(cardListDisplayEntries(entries, false)).toBe(entries);
  });

  it("never sorts hidden identities", () => {
    const hidden = Object.freeze([
      entries[0]!,
      Object.freeze({ id: "hidden", label: "A", identityVisible: false }),
    ]);
    expect(cardListAlphabeticalAllowed(hidden)).toBe(false);
    expect(cardListDisplayEntries(hidden, true)).toBe(hidden);
    expect(cardListAlphabeticalAllowed(entries.slice(0, 1))).toBe(false);
  });

  it("maps browse zones to approved titles", () => {
    expect(cardListBrowseTitle("deck")).toBe("Deck");
    expect(cardListBrowseTitle("extra")).toBe("Extra Deck");
    expect(cardListBrowseTitle("graveyard")).toBe("Graveyard");
    expect(cardListBrowseTitle("banished")).toBe("Banished");
  });
});

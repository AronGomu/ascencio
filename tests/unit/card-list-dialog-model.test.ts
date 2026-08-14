import { describe, expect, it } from "vitest";
import {
  cardListAlphabeticalAllowed,
  cardListBrowseTitle,
  cardListDisplayEntries,
  cardListSourceNotice,
  cardListSelectionState,
} from "../../src/app/presentation/card-list-dialog-model.ts";
import type { ChoiceId } from "../../src/duel/contracts/ids.ts";
import type { OffFieldTargetEntry } from "../../src/field/off-field-target-list.ts";

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

  it("builds privacy-safe target notices in fixed source order", () => {
    expect(
      cardListSourceNotice([
        { location: "deck" },
        { location: "banished" },
        { location: "graveyard" },
        { location: "extra" },
        { location: "graveyard" },
      ]),
    ).toBe(
      "Filtered: legal targets from Extra Deck, Graveyard, Banished, and Deck",
    );
    expect(
      cardListSourceNotice([
        { location: "deck" },
        { location: "hand" },
        { location: "graveyard" },
      ]),
    ).toBe("Filtered: legal targets from Hand, Graveyard, and Deck");
    expect(cardListSourceNotice([{ location: "hand" }])).toBe(
      "Filtered: legal targets only",
    );
  });

  it("maps browse zones to approved titles", () => {
    expect(cardListBrowseTitle("deck")).toBe("Deck");
    expect(cardListBrowseTitle("extra")).toBe("Extra Deck");
    expect(cardListBrowseTitle("graveyard")).toBe("Graveyard");
    expect(cardListBrowseTitle("banished")).toBe("Banished");
  });

  const id = (value: string) => value as ChoiceId;
  const rendered = (...values: string[]) => [
    {
      choices: values.map((value) => ({
        id: id(value),
      })) as unknown as OffFieldTargetEntry["choices"],
    },
  ];
  const state = (
    selected: string[],
    minimum: number,
    maximum: number,
    promptValid = true,
    entries = rendered("a", "b", "c", "d", "e"),
  ) =>
    cardListSelectionState({
      selectedChoiceIds: selected.map(id),
      entries,
      minimum,
      maximum,
      promptValid,
    });

  it("enables exact validation only at exact count", () => {
    for (let count = 0; count <= 4; count += 1) {
      const result = state(["a", "b", "c", "d"].slice(0, count), 3, 3);
      expect(result.validateEnabled).toBe(count === 3);
      expect(result.countLabel).toBe(`${count} / 3 selected`);
    }
  });

  it("enables range validation inclusively", () => {
    for (let count = 0; count <= 4; count += 1) {
      const result = state(["a", "b", "c", "d"].slice(0, count), 1, 3);
      expect(result.validateEnabled).toBe(count >= 1 && count <= 3);
      expect(result.countLabel).toBe(`${count} selected · choose 1–3`);
    }
  });

  it("locks only unselected choices at maximum", () => {
    const result = state(["a", "b", "c"], 1, 3);
    expect(result.maximumReached).toBe(true);
    expect([...result.unavailableChoiceIds]).toEqual([id("d"), id("e")]);
    expect(result.unavailableChoiceIds.has(id("a"))).toBe(false);
  });

  it("fails closed for stale and duplicate selected ids", () => {
    for (const selected of [
      ["a", "stale"],
      ["a", "a"],
    ]) {
      const result = state(selected, 1, 3);
      expect(result.renderedSelectionValid).toBe(false);
      expect(result.validateEnabled).toBe(false);
    }
  });

  it("honors prompt validator", () => {
    expect(state(["a"], 1, 3, false).validateEnabled).toBe(false);
  });

  it.each([
    [-1, 3],
    [3, 2],
    [1.5, 3],
    [1, 3.5],
    [Number.NaN, 3],
    [1, Number.NaN],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ])("fails closed for invalid bounds %s..%s", (minimum, maximum) => {
    const result = state(["a"], minimum, maximum);
    expect(result.validateEnabled).toBe(false);
    expect(result.maximumReached).toBe(false);
    expect(result.countLabel).toBe("1 selected · invalid requirement");
    expect([...result.unavailableChoiceIds]).toEqual([]);
  });

  it("counts duplicate choices across one address independently", () => {
    const result = state(["a", "b"], 2, 2, true, rendered("a", "b"));
    expect(result.renderedSelectionValid).toBe(true);
    expect(result.validateEnabled).toBe(true);
    expect(result.selectedCount).toBe(2);
  });

  it("freezes state and exposes no mutable unavailable set", () => {
    const result = state(["a"], 1, 1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.unavailableChoiceIds)).toBe(true);
    expect("add" in result.unavailableChoiceIds).toBe(false);
    expect(() => Object.assign(result, { selectedCount: 9 })).toThrow();
  });
});

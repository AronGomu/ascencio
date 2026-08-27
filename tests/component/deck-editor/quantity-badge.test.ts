// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardTile from "../../../src/deck-editor/components/CardTile.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";

afterEach(() => cleanup());

describe("maxed highlight", () => {
  it("a catalog tile at its copy limit renders the maxed highlight", () => {
    const card = PROTOTYPE_CATALOG.find(
      (c) =>
        c.canonicalZone === "main" &&
        quantityLimit(PROTOTYPE_RULESET, c.code) === 3,
    )!;
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit: 3,
      currentCopies: 3,
      maxed: true,
      dataCyPrefix: "catalog",
      dataCyId: card.code,
    });
    expect(container.querySelector("button.maxed")).not.toBeNull();
  });
});

describe("quantity-limit badge", () => {
  it.each([
    [0, "Forbidden"],
    [1, "Limited"],
    [2, "Semi-Limited"],
    [3, "Unlimited"],
  ] as const)("renders %i with explicit %s semantics", (limit, label) => {
    const card = PROTOTYPE_CATALOG[0]!;
    const { container } = render(CardTile, {
      card,
      code: card.code,
      limit,
      currentCopies: 0,
      dataCyPrefix: "catalog",
      dataCyId: card.code,
    });
    expect(
      screen.getByRole("button", {
        name: new RegExp(`${label}, maximum ${limit}`),
      }),
    ).toBeTruthy();
    expect(
      container.querySelector(`[data-cy="catalog-tile-limit-${card.code}"]`)
        ?.textContent,
    ).toBe(String(limit));
  });
});

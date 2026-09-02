// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import StackControl from "../../src/battle/app/components/duel-field/StackControl.svelte";
import type { BoardStackView } from "../../src/battle/field/board-view-model.ts";
import {
  CARD_ASPECT,
  type FieldPlacement,
} from "../../src/battle/field/duel-field-geometry.ts";

/* A pile slot is `cardWidth + SLOT_PAD` wide and a full box tall, so neither
   dimension of the tile may be read off the placement. */
const PLACEMENT: FieldPlacement = { x: 320, y: 180, width: 70, height: 96 };
const CARD_WIDTH = 64;
const CARD_HEIGHT = 92.5;

afterEach(cleanup);

function deckStack(): BoardStackView {
  return {
    id: "p0:deck",
    targetId: "stack:p0:deck",
    player: 0,
    zone: "deck",
    count: 35,
    publicCount: 0,
    label: "Deck",
    accessibleLabel: "Your Deck, 35 cards",
    x: PLACEMENT.x,
    y: PLACEMENT.y,
    width: PLACEMENT.width,
    height: PLACEMENT.height,
  };
}

function renderStack(overrides: Partial<BoardStackView> = {}): HTMLElement {
  const stack = { ...deckStack(), ...overrides };
  const { container } = render(StackControl, {
    stack,
    placement: PLACEMENT,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardBackUrl: "/cards/card-back.webp",
  });
  const tile = container.querySelector<HTMLElement>(
    `[data-cy="field-stack-${stack.id}"]`,
  );
  if (tile === null) throw new Error("Missing stack tile");
  return tile;
}

function emptyGraveyard(): Partial<BoardStackView> {
  return {
    id: "p0:graveyard",
    targetId: "stack:p0:graveyard",
    zone: "graveyard",
    count: 0,
    label: "Graveyard",
    accessibleLabel: "Your Graveyard, 0 cards",
  };
}

describe("StackControl sizing", () => {
  it("renders the tile at true card width and height", () => {
    const tile = renderStack();

    expect(tile.style.getPropertyValue("--field-width")).toBe(
      `${CARD_WIDTH}px`,
    );
    expect(tile.style.getPropertyValue("--field-height")).toBe(
      `${CARD_HEIGHT}px`,
    );
  });

  it("never applies the card aspect a second time", () => {
    const tile = renderStack();

    expect(tile.style.getPropertyValue("--field-width")).not.toBe(
      `${PLACEMENT.width * CARD_ASPECT}px`,
    );
    expect(tile.style.getPropertyValue("--field-height")).not.toBe(
      `${PLACEMENT.height}px`,
    );
  });

  /* `.duel-field-stack` is placed with `transform: translate(-50%, -50%)`, so
     `--field-x`/`--field-y` name the tile centre: the slot centre already is
     the centred position, whatever the tile measures. */
  it("keeps the tile centred on its slot", () => {
    const tile = renderStack();

    expect(tile.style.getPropertyValue("--field-x")).toBe(`${PLACEMENT.x}px`);
    expect(tile.style.getPropertyValue("--field-y")).toBe(`${PLACEMENT.y}px`);
  });
});

/* Item 2 (2026-09-02, owner): a pile holding nothing is a zone with nothing
   in it. The class is what strips the pile chrome in CSS; the name and the
   count are the only things an empty pile still says. */
describe("StackControl empty state", () => {
  it("marks a pile of no cards empty and keeps its name and count", () => {
    const tile = renderStack(emptyGraveyard());

    expect(tile.classList.contains("is-empty")).toBe(true);
    expect(
      tile.querySelector('[data-cy="stack-control-name-p0:graveyard"]')
        ?.textContent,
    ).toBe("GY");
    expect(
      tile.querySelector('[data-cy="stack-control-count-p0:graveyard"]')
        ?.textContent,
    ).toBe("0");
    expect(
      tile.querySelector('[data-cy="stack-control-art-p0:graveyard"]'),
    ).toBeNull();
    expect(
      tile.querySelector('[data-cy="stack-control-back-p0:graveyard"]'),
    ).toBeNull();
  });

  it("leaves a stocked pile unmarked and covered by its card back", () => {
    const tile = renderStack({ count: 3 });

    expect(tile.classList.contains("is-empty")).toBe(false);
    expect(
      tile.querySelector('[data-cy="stack-control-back-p0:deck"]'),
    ).not.toBeNull();
  });
});

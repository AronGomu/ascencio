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

function renderStack(): HTMLElement {
  const { container } = render(StackControl, {
    stack: deckStack(),
    placement: PLACEMENT,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
  });
  const tile = container.querySelector<HTMLElement>(
    '[data-cy="field-stack-p0:deck"]',
  );
  if (tile === null) throw new Error("Missing stack tile");
  return tile;
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

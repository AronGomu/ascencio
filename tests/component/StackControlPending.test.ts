// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FieldBoard from "../../src/battle/app/components/duel-field/FieldBoard.svelte";
import StackControl from "../../src/battle/app/components/duel-field/StackControl.svelte";
import {
  mapSnapshotToBoard,
  type BoardStackView,
} from "../../src/battle/field/board-view-model.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import { createFieldRenderLayout } from "../../src/battle/field/duel-field-geometry.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";

const STACK: BoardStackView = {
  id: "p0:graveyard",
  targetId: "stack:p0:graveyard",
  player: 0,
  zone: "graveyard",
  count: 1,
  publicCount: 1,
  topCardCode: cardCode(46986414),
  label: "Graveyard",
  accessibleLabel: "Your Graveyard, 1 card",
  x: 320,
  y: 180,
  width: 70,
  height: 96,
};

const PLACEMENT = { x: 320, y: 180, width: 70, height: 96 } as const;

afterEach(cleanup);

describe("StackControl pending lock", () => {
  it("blocks pile activation while the duel response is pending", async () => {
    const onactivate = vi.fn();
    const { container } = render(StackControl, {
      stack: STACK,
      placement: PLACEMENT,
      cardWidth: 64,
      cardHeight: 92.5,
      disabled: true,
      onactivate,
    });
    const stack = container.querySelector<HTMLButtonElement>(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    if (stack === null) throw new Error("Missing graveyard stack");

    expect(stack.disabled).toBe(true);
    await userEvent.setup().click(stack);
    expect(onactivate).not.toHaveBeenCalled();
  });

  it("propagates the pending lock from FieldBoard to stocked piles", async () => {
    const mapped = mapSnapshotToBoard(
      BOARD_VIEW_MODEL_FIXTURES["ST-05"],
      BOARD_CARD_TEXTS,
    );
    if (!mapped.ok) throw new Error("Fixture mapping failed");
    const onstackactivate = vi.fn();
    const { container } = render(FieldBoard, {
      board: mapped.value,
      renderLayout: createFieldRenderLayout(true, 1280, 720),
      planeHeight: 720,
      planeTransform: "",
      cardBackUrl: "card-back.png",
      placeholderUrl: "placeholder.png",
      disabled: true,
      onstackactivate,
    });
    const stack = container.querySelector<HTMLButtonElement>(
      '[data-cy="field-stack-p0:deck"]',
    );
    if (stack === null) throw new Error("Missing player deck stack");

    expect(stack.disabled).toBe(true);
    await userEvent.setup().click(stack);
    expect(onstackactivate).not.toHaveBeenCalled();
  });
});

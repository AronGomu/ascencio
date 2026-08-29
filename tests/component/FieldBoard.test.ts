// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import FieldBoard from "../../src/battle/app/components/duel-field/FieldBoard.svelte";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import { createFieldRenderLayout } from "../../src/battle/field/duel-field-geometry.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";

afterEach(cleanup);

describe("FieldBoard perspective plane", () => {
  it("renders every field zone inside the configured plane", () => {
    const mapped = mapSnapshotToBoard(
      BOARD_VIEW_MODEL_FIXTURES["ST-05"],
      BOARD_CARD_TEXTS,
    );
    if (!mapped.ok) throw new Error("Fixture mapping failed");

    const { container } = render(FieldBoard, {
      board: mapped.value,
      renderLayout: createFieldRenderLayout(true, 1280, 1422),
      planeHeight: 1422,
      planeTransform: "perspective(600px) rotateX(20deg)",
      cardBackUrl: "card-back.png",
      placeholderUrl: "placeholder.png",
    });

    const plane = container.querySelector<HTMLElement>(
      '[data-cy="duel-field-board-plane"]',
    );
    expect(plane?.style.height).toBe("1422px");
    expect(plane?.style.transform).toBe("perspective(600px) rotateX(20deg)");
    const zones = container.querySelectorAll('[data-cy^="field-zone-"]');
    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) expect(plane?.contains(zone)).toBe(true);
  });

  it("keeps flat-mode placements unchanged inside the wrapper", () => {
    const mapped = mapSnapshotToBoard(
      BOARD_VIEW_MODEL_FIXTURES["ST-05"],
      BOARD_CARD_TEXTS,
    );
    if (!mapped.ok) throw new Error("Fixture mapping failed");
    const renderLayout = createFieldRenderLayout(true, 1280, 720);

    const { container } = render(FieldBoard, {
      board: mapped.value,
      renderLayout,
      planeHeight: 720,
      planeTransform: "",
      cardBackUrl: "card-back.png",
      placeholderUrl: "placeholder.png",
    });

    const placement = renderLayout.zones.get("p0:mainMonster:0");
    const zone = container.querySelector<HTMLElement>(
      '[data-zone-id="p0:mainMonster:0"]',
    );
    expect(zone?.style.getPropertyValue("--field-x")).toBe(`${placement?.x}px`);
    expect(zone?.style.getPropertyValue("--field-y")).toBe(`${placement?.y}px`);
  });
});

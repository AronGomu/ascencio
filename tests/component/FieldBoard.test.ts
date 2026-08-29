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
    expect(plane?.style.getPropertyValue("--hand-upright")).toBe("-20deg");
    const zones = container.querySelectorAll('[data-cy^="field-zone-"]');
    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) expect(plane?.contains(zone)).toBe(true);

    const content = container.querySelector(
      '[data-cy="duel-field-board-content"]',
    );
    for (const player of [0, 1]) {
      const carrier = container.querySelector(
        `[data-cy="field-hand-band-p${player}"]`,
      );
      const viewport = container.querySelector(
        `[data-cy="field-hand-p${player}-viewport"]`,
      );
      expect(carrier?.parentElement).toBe(content);
      expect(viewport?.parentElement).toBe(carrier);
    }
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
    expect(
      container
        .querySelector<HTMLElement>('[data-cy="duel-field-board-plane"]')
        ?.style.getPropertyValue("--hand-upright"),
    ).toBe("0deg");
  });

  it("sizes field cards to the inset geometry without applying aspect twice", () => {
    const mapped = mapSnapshotToBoard(
      BOARD_VIEW_MODEL_FIXTURES["ST-04"],
      BOARD_CARD_TEXTS,
    );
    if (!mapped.ok) throw new Error("Fixture mapping failed");
    const renderLayout = createFieldRenderLayout(true, 1280, 720);
    const zonePlacement = renderLayout.zones.get("p0:mainMonster:1");
    const { container } = render(FieldBoard, {
      board: mapped.value,
      renderLayout,
      planeHeight: 720,
      planeTransform: "",
      cardBackUrl: "card-back.png",
      placeholderUrl: "placeholder.png",
    });
    const card = container.querySelector<HTMLElement>(
      '[data-card-zone-id="p0:mainMonster:1"]',
    );
    expect(card?.style.getPropertyValue("--field-width")).toBe(
      `${renderLayout.geometry.cardWidth}px`,
    );
    expect(card?.style.getPropertyValue("--field-height")).toBe(
      `${renderLayout.geometry.cardHeight}px`,
    );
    expect(card?.style.getPropertyValue("--field-height")).not.toBe(
      `${zonePlacement?.height}px`,
    );
  });
});

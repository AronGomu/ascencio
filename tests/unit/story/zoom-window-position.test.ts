import { describe, expect, it } from "vitest";
import {
  placeZoomWindow,
  placeZoomedCard,
  ZOOM_VIEWPORT_GUTTER as GUTTER,
} from "../../../src/story/components/zoom-window-position.ts";

/* The story's own copy of the duel's anchored-placement rule: the duel keeps
   `floating-window-position.ts` and `HandZoomOverlay` inside `src/battle/`,
   which ADR-022 puts out of the story's reach, so the behaviour is reproduced
   here rather than imported. */

const VIEWPORT = { width: 1280, height: 800 } as const;
const TILE = { width: 100, height: 146 } as const;
const WINDOW = { width: 260, height: 320 } as const;

function tileAt(left: number, top: number) {
  return { left, top, width: TILE.width, height: TILE.height };
}

describe("placeZoomedCard", () => {
  it("magnifies the tile around its own centre", () => {
    const zoom = placeZoomedCard(tileAt(500, 300), VIEWPORT, 2);
    expect(zoom.width).toBe(200);
    expect(zoom.height).toBe(292);
    /* Same centre as the tile, so the card grows in place rather than
       jumping to one side of the pointer. */
    expect(zoom.left + zoom.width / 2).toBe(500 + TILE.width / 2);
    expect(zoom.top + zoom.height / 2).toBe(300 + TILE.height / 2);
  });

  it("keeps a magnified edge tile inside the viewport", () => {
    const zoom = placeZoomedCard(tileAt(4, 2), VIEWPORT, 2);
    expect(zoom.left).toBe(GUTTER);
    expect(zoom.top).toBe(GUTTER);

    const far = placeZoomedCard(
      tileAt(VIEWPORT.width - 60, VIEWPORT.height - 60),
      VIEWPORT,
      2,
    );
    expect(far.left + far.width).toBeLessThanOrEqual(VIEWPORT.width - GUTTER);
    expect(far.top + far.height).toBeLessThanOrEqual(VIEWPORT.height - GUTTER);
  });

  it("pins a card bigger than the viewport to the gutter", () => {
    /* A phone in portrait can be narrower than a card magnified twice, and half
       a card off the top loses the name and the art at once. */
    const zoom = placeZoomedCard(
      tileAt(500, 300),
      { width: 150, height: 200 },
      2,
    );
    expect(zoom.left).toBe(GUTTER);
    expect(zoom.top).toBe(GUTTER);
  });
});

describe("placeZoomWindow", () => {
  it("places the text window to the right when it fits", () => {
    const zoom = placeZoomedCard(tileAt(100, 300), VIEWPORT, 2);
    const placement = placeZoomWindow(zoom, VIEWPORT, WINDOW);
    expect(placement.side).toBe("right");
    expect(placement.left).toBeGreaterThanOrEqual(zoom.left + zoom.width);
    expect(placement.left + WINDOW.width).toBeLessThanOrEqual(
      VIEWPORT.width - GUTTER,
    );
  });

  it("flips to the left when it would overflow", () => {
    const zoom = placeZoomedCard(
      tileAt(VIEWPORT.width - 160, 300),
      VIEWPORT,
      2,
    );
    const placement = placeZoomWindow(zoom, VIEWPORT, WINDOW);
    expect(placement.side).toBe("left");
    expect(placement.left + WINDOW.width).toBeLessThanOrEqual(zoom.left);
    expect(placement.left).toBeGreaterThanOrEqual(GUTTER);
  });

  it("clamps vertically inside the viewport", () => {
    const zoom = placeZoomedCard(
      tileAt(400, VIEWPORT.height - 90),
      VIEWPORT,
      2,
    );
    const placement = placeZoomWindow(zoom, VIEWPORT, WINDOW);
    expect(placement.top).toBeGreaterThanOrEqual(GUTTER);
    expect(placement.top + WINDOW.height).toBeLessThanOrEqual(
      VIEWPORT.height - GUTTER,
    );
  });

  it("reads the top of the card it is beside when there is room", () => {
    const zoom = placeZoomedCard(tileAt(400, 200), VIEWPORT, 2);
    const placement = placeZoomWindow(zoom, VIEWPORT, WINDOW);
    expect(placement.top).toBe(zoom.top);
  });

  it("pins a window taller than the viewport to the top gutter", () => {
    const zoom = placeZoomedCard(tileAt(400, 300), VIEWPORT, 2);
    const placement = placeZoomWindow(zoom, VIEWPORT, {
      width: WINDOW.width,
      height: VIEWPORT.height + 200,
    });
    expect(placement.top).toBe(GUTTER);
  });
});

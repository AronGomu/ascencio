/** Where a hover zoom and its text window sit, in viewport pixels.

    The duel already solved this for its hand zoom — `HandZoomOverlay` centres
    the magnified card on the card it came from and keeps it a gutter clear of
    the frame edge — but that code lives under `src/battle/`, which ADR-022 puts
    out of the story's reach. So the rule is reproduced here rather than
    imported, and kept DOM-free so it can be read as arithmetic. */

export interface ZoomRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A width and a height with no position: the viewport, or a window measured
    inside it. */
export interface ZoomSize {
  readonly width: number;
  readonly height: number;
}

export interface ZoomWindowPlacement {
  /** Which side of the magnified card the window ended up on. The caller
      renders it as `data-side`, so a screen can style the two mirror images. */
  readonly side: "left" | "right";
  readonly left: number;
  readonly top: number;
}

/** Breathing room kept between anything placed here and the viewport edge, and
    between the magnified card and its window. The duel's hand zoom uses the
    same 8px, so the two zooms sit the same distance off an edge. */
export const ZOOM_VIEWPORT_GUTTER = 8;

/** The magnified card: `scale` times the tile it came from, sharing that
    tile's centre so the card grows in place, then pushed back inside the
    viewport if the growth ran off an edge. */
export function placeZoomedCard(
  anchor: ZoomRect,
  viewport: ZoomSize,
  scale: number,
): ZoomRect {
  const width = anchor.width * scale;
  const height = anchor.height * scale;
  return {
    width,
    height,
    left: clampInside(
      anchor.left + anchor.width / 2 - width / 2,
      width,
      viewport.width,
    ),
    top: clampInside(
      anchor.top + anchor.height / 2 - height / 2,
      height,
      viewport.height,
    ),
  };
}

/** The text window beside `anchor` — which is the *placed* magnified card, not
    the tile it came from, so the window never lands under the card a clamp has
    just moved.

    Right by default because that is the reading direction; the flip is what
    keeps the window on screen for the last column of a grid. Vertically the
    window starts level with the card's top rather than centred on it, so its
    first line and the card's top edge line up, and only a bottom-edge clamp
    moves it. */
export function placeZoomWindow(
  anchor: ZoomRect,
  viewport: ZoomSize,
  windowSize: ZoomSize,
): ZoomWindowPlacement {
  const right = anchor.left + anchor.width + ZOOM_VIEWPORT_GUTTER;
  const fitsRight =
    right + windowSize.width <= viewport.width - ZOOM_VIEWPORT_GUTTER;
  return {
    side: fitsRight ? "right" : "left",
    left: fitsRight
      ? right
      : Math.max(
          ZOOM_VIEWPORT_GUTTER,
          anchor.left - ZOOM_VIEWPORT_GUTTER - windowSize.width,
        ),
    top: clampInside(anchor.top, windowSize.height, viewport.height),
  };
}

/* An axis longer than the viewport pins to the gutter rather than going
   negative: half a card off the bottom still reads, half a card off the top
   loses the name and the art at once. */
function clampInside(value: number, size: number, extent: number): number {
  return Math.max(
    ZOOM_VIEWPORT_GUTTER,
    Math.min(value, extent - size - ZOOM_VIEWPORT_GUTTER),
  );
}

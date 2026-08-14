/** Below this CSS width the product leaves the letterboxed stage behind and
    lays domains out vertically instead (portrait) or scales the stage down
    (landscape). */
export const STAGE_BREAKPOINT_PX = 1024;
export const STAGE_ASPECT_WIDTH = 16;
export const STAGE_ASPECT_HEIGHT = 9;

export type StageMode = "stage" | "mobile-portrait" | "mobile-landscape";

export interface StageBox {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly mode: StageMode;
}

const EMPTY_BOX: StageBox = Object.freeze({
  width: 0,
  height: 0,
  offsetX: 0,
  offsetY: 0,
  mode: "stage",
});

function isUsable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function selectStageMode(
  viewportWidth: number,
  viewportHeight: number,
): StageMode {
  if (viewportWidth >= STAGE_BREAKPOINT_PX) return "stage";
  return viewportHeight >= viewportWidth
    ? "mobile-portrait"
    : "mobile-landscape";
}

export function computeStageBox(
  viewportWidth: number,
  viewportHeight: number,
): StageBox {
  if (!isUsable(viewportWidth) || !isUsable(viewportHeight)) return EMPTY_BOX;

  const mode = selectStageMode(viewportWidth, viewportHeight);
  if (mode === "mobile-portrait") {
    return Object.freeze({
      width: viewportWidth,
      height: viewportHeight,
      offsetX: 0,
      offsetY: 0,
      mode,
    });
  }

  // Largest 16:9 rectangle that fits, centred; the leftover is the bar size.
  const heightLimited =
    viewportWidth * STAGE_ASPECT_HEIGHT > viewportHeight * STAGE_ASPECT_WIDTH;
  const width = heightLimited
    ? Math.floor((viewportHeight * STAGE_ASPECT_WIDTH) / STAGE_ASPECT_HEIGHT)
    : viewportWidth;
  const height = heightLimited
    ? viewportHeight
    : Math.floor((viewportWidth * STAGE_ASPECT_HEIGHT) / STAGE_ASPECT_WIDTH);

  return Object.freeze({
    width,
    height,
    offsetX: Math.floor((viewportWidth - width) / 2),
    offsetY: Math.floor((viewportHeight - height) / 2),
    mode,
  });
}

/* T15: a portrait phone plays the duel on a stage the stylesheet turns a
   quarter turn clockwise (`.shell-region--duel` in `src/styles/app.css`).

   Native hit testing needs nothing from this module: clicks, taps and
   `document.elementFromPoint` already resolve through a `transform`, so a tap
   lands on the card the player sees. What a `transform` does break is every
   place the duel takes a *viewport* number — `clientX`/`clientY`, or a
   `getBoundingClientRect()` edge — and writes it back into the rotated frame's
   own coordinate system. A transformed element becomes the containing block
   for its positioned descendants, so an unmapped viewport delta drags a field
   window sideways when the player drags it down, and pins the drag ghost a
   quarter turn away from the finger.

   Every such number goes through here. The mapping is a rigid quarter turn, so
   it is exact rather than approximate:

     frame x = viewport y - frame.top        frame dx =  viewport dy
     frame y = frame.right - viewport x      frame dy = -viewport dx

   Unrotated, the frame is the viewport and every function below is the
   identity — which is why the desktop and small-landscape paths keep their
   pixel geometry with no branch of their own.

   The rotation is read from the element's live computed transform rather than
   from a JS mirror of the media query. A mirror can disagree with the
   stylesheet by a fraction of a pixel around the breakpoint, and a
   disagreement here inverts a drag axis instead of moving a layout edge. */

/** The shell's duel region: the element the stylesheet rotates, and therefore
    the containing block the duel's positioned children resolve against. It is
    matched by its contract `data-cy` rather than imported, because the duel
    may not reach into the shell (ADR-022). */
const DUEL_FRAME_SELECTOR = '[data-cy="shell-region-duel"]';

export interface FramePoint {
  readonly x: number;
  readonly y: number;
}

export interface FrameRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A viewport-space rectangle, structurally compatible with `DOMRect`. */
export interface ViewportRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface StageFrame {
  readonly rotated: boolean;
  /** Viewport edges of the rotated frame; meaningless when `rotated` is false. */
  readonly top: number;
  readonly right: number;
}

export const UNROTATED_FRAME: StageFrame = Object.freeze({
  rotated: false,
  top: 0,
  right: 0,
});

/** True for exactly the clockwise quarter turn the stylesheet applies.
    `matrix(a, b, c, d, e, f)` is `rotate(90deg)` when `a` is 0 and `b` is 1,
    whatever translation rides along with it. */
export function isQuarterTurnClockwise(transform: string): boolean {
  const values = transform.match(/^matrix\(([^)]*)\)$/)?.[1];
  if (values === undefined) return false;
  const [a, b] = values.split(",").map((value) => Number(value.trim()));
  if (a === undefined || b === undefined) return false;
  return Math.abs(a) < 1e-6 && Math.abs(b - 1) < 1e-6;
}

/** Reads the frame `element` is rendered in. Anything mounted outside the shell
    — the acceptance harness, a component test — has no duel region above it and
    is never rotated. */
export function readStageFrame(element: Element | null): StageFrame {
  const frame = element?.closest(DUEL_FRAME_SELECTOR) ?? null;
  if (frame === null) return UNROTATED_FRAME;
  const transform = globalThis.getComputedStyle?.(frame).transform ?? "";
  if (!isQuarterTurnClockwise(transform)) return UNROTATED_FRAME;
  const rect = frame.getBoundingClientRect();
  return Object.freeze({ rotated: true, top: rect.top, right: rect.right });
}

export function toFramePoint(
  frame: StageFrame,
  x: number,
  y: number,
): FramePoint {
  if (!frame.rotated) return { x, y };
  return { x: y - frame.top, y: frame.right - x };
}

export function toFrameDelta(
  frame: StageFrame,
  dx: number,
  dy: number,
): FramePoint {
  if (!frame.rotated) return { x: dx, y: dy };
  return { x: dy, y: -dx };
}

/** Maps a viewport rectangle onto the frame. The quarter turn swaps the axes,
    so the frame-space left edge comes from the viewport top edge and the
    frame-space top edge from the viewport *right* edge. */
export function toFrameRect(frame: StageFrame, rect: ViewportRect): FrameRect {
  if (!frame.rotated) {
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  return {
    left: rect.top - frame.top,
    top: frame.right - (rect.left + rect.width),
    width: rect.height,
    height: rect.width,
  };
}

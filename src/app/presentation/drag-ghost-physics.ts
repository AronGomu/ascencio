/* Pure, dependency-free drag-ghost physics. No DOM, no timers: callers own
   the rAF loop and pass pointer samples / elapsed time in. Constants and
   formulas are fixed by the plan (T13) — do not retune here. */

export interface DragPointerSample {
  readonly x: number;
  readonly y: number;
  readonly timeMs: number;
}

export interface CardDragOrigin {
  readonly pointer: DragPointerSample;
  readonly sourceLeft: number;
  readonly sourceTop: number;
  readonly width: number;
  readonly height: number;
  readonly pointerOffsetX: number;
  readonly pointerOffsetY: number;
  readonly imageUrl: string;
}

export interface DragGhostFrame {
  readonly x: number; // ghost top-left viewport px
  readonly y: number;
  readonly velocityX: number; // px/s
  readonly velocityY: number;
  readonly tiltDegrees: number;
}

export const DRAG_GHOST_MAX_TILT_DEGREES = 10;
export const DRAG_GHOST_LIFT_SCALE = 1.08;
export const DRAG_SPRING_STIFFNESS = 180;
export const DRAG_SPRING_DAMPING = 24;
export const DRAG_FRAME_DELTA_CAP_MS = 32;
export const DRAG_SETTLE_TIMEOUT_MS = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dragFrameForPointer(
  previous: DragGhostFrame,
  previousSample: DragPointerSample,
  sample: DragPointerSample,
  origin: CardDragOrigin,
): DragGhostFrame {
  const dtMs = Math.max(1, sample.timeMs - previousSample.timeMs);
  const dt = dtMs / 1000;
  const instantVelocityX = (sample.x - previousSample.x) / dt;
  const instantVelocityY = (sample.y - previousSample.y) / dt;
  const velocityX = 0.65 * previous.velocityX + 0.35 * instantVelocityX;
  const velocityY = 0.65 * previous.velocityY + 0.35 * instantVelocityY;
  const tiltDegrees = clamp(
    velocityX * 0.012,
    -DRAG_GHOST_MAX_TILT_DEGREES,
    DRAG_GHOST_MAX_TILT_DEGREES,
  );
  return Object.freeze({
    x: sample.x - origin.pointerOffsetX,
    y: sample.y - origin.pointerOffsetY,
    velocityX,
    velocityY,
    tiltDegrees,
  });
}

export function settleDragGhostFrame(
  frame: DragGhostFrame,
  target: { readonly x: number; readonly y: number },
  elapsedMs: number,
): DragGhostFrame {
  const dt = Math.min(Math.max(elapsedMs, 0), DRAG_FRAME_DELTA_CAP_MS) / 1000;
  const accelerationX =
    DRAG_SPRING_STIFFNESS * (target.x - frame.x) -
    DRAG_SPRING_DAMPING * frame.velocityX;
  const accelerationY =
    DRAG_SPRING_STIFFNESS * (target.y - frame.y) -
    DRAG_SPRING_DAMPING * frame.velocityY;
  const velocityX = frame.velocityX + accelerationX * dt;
  const velocityY = frame.velocityY + accelerationY * dt;
  const x = frame.x + velocityX * dt;
  const y = frame.y + velocityY * dt;
  /* Tilt has no stored angular velocity of its own; it damps toward zero
     through the same stiffness/damping factors, treating its instantaneous
     angular velocity as zero each step (critically-damped-ish decay, never
     overshoots the way a stored-velocity spring could). */
  const tiltAcceleration = DRAG_SPRING_STIFFNESS * (0 - frame.tiltDegrees);
  const tiltVelocity = tiltAcceleration * dt;
  const tiltDegrees = frame.tiltDegrees + tiltVelocity * dt;
  return Object.freeze({ x, y, velocityX, velocityY, tiltDegrees });
}

export function dragGhostSettled(
  frame: DragGhostFrame,
  target: { readonly x: number; readonly y: number },
): boolean {
  const distance = Math.hypot(target.x - frame.x, target.y - frame.y);
  const speed = Math.hypot(frame.velocityX, frame.velocityY);
  return distance <= 0.5 && speed <= 8;
}

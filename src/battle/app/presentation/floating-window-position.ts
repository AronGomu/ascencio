import type { PersistedWindowPosition } from "../stores/persisted-ui-state.ts";

export type FieldWindowId = "zoneList" | "confirm";

export interface Size {
  readonly width: number;
  readonly height: number;
}

/* ADR-017: window coordinates are top-left CSS pixels local to the visible
   duel-field boundary, and the entire measured border box stays inside it.
   An axis whose window is larger than the boundary pins to 0 rather than
   going negative, so the window's own header always stays reachable. */
export function clampFieldWindowPosition(
  position: PersistedWindowPosition,
  boundary: Size,
  windowSize: Size,
): PersistedWindowPosition {
  return Object.freeze({
    x: clampAxis(position.x, boundary.width, windowSize.width),
    y: clampAxis(position.y, boundary.height, windowSize.height),
  });
}

function clampAxis(value: number, boundary: number, window: number): number {
  const maximum = Math.max(0, finite(boundary) - finite(window));
  return Math.min(Math.max(finite(value), 0), maximum);
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

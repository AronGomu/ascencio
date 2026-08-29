import type { BoardTargetId } from "../../field/board-view-model.ts";
import type { DomPresentationCommand } from "./presentation-command.ts";
import {
  readStageFrame,
  toFrameDelta,
  toFramePoint,
  toFrameRect,
} from "./stage-frame.ts";

const MAXIMUM_FEEDBACK_DURATION_MS = 600;
const FIELD_PLANE_SELECTOR = '[data-cy="duel-field-board-plane"]';

export interface FieldFeedbackLine {
  readonly kind: "attack" | "target";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface DomFeedbackState {
  readonly kind: DomPresentationCommand["kind"] | null;
  readonly label: string;
  readonly durationMs: number;
  readonly targetId?: BoardTargetId;
  readonly line?: FieldFeedbackLine;
}

export const EMPTY_DOM_FEEDBACK_STATE: DomFeedbackState = Object.freeze({
  kind: null,
  label: "",
  durationMs: 0,
});

export interface DomFeedbackController {
  readonly activeAnimationCount: number;
  present(command: DomPresentationCommand): void;
  cancel(): void;
}

export function createDomFeedbackController(
  root: HTMLElement,
  onState: (state: DomFeedbackState) => void,
): DomFeedbackController {
  const animations = new Set<Animation>();
  let generation = 0;
  let highlighted: Element | null = null;

  const clearTransient = (): void => {
    generation += 1;
    for (const animation of animations) animation.cancel();
    animations.clear();
    highlighted?.classList.remove("is-feedback-target");
    highlighted = null;
  };

  const notice = (command: DomPresentationCommand): void => {
    onState({
      kind: "notice",
      label: command.label,
      durationMs: boundedDuration(command.durationMs),
    });
  };

  const animate = (
    element: Element,
    keyframes: Keyframe[],
    durationMs: number,
  ): void => {
    if (durationMs === 0 || typeof element.animate !== "function") return;
    const token = generation;
    const animation = element.animate(keyframes, {
      duration: durationMs,
      easing: "ease-out",
    });
    animations.add(animation);
    void animation.finished.then(
      () => {
        if (token === generation) animations.delete(animation);
      },
      () => animations.delete(animation),
    );
  };

  const present = (command: DomPresentationCommand): void => {
    clearTransient();
    const durationMs = boundedDuration(command.durationMs);
    switch (command.kind) {
      case "card-move":
      case "attack": {
        const from = targetElement(root, command.fromTargetId);
        const to = targetElement(root, command.toTargetId);
        if (from === null || to === null) {
          notice(command);
          return;
        }
        highlighted = to;
        highlighted.classList.add("is-feedback-target");
        const line = lineBetween(
          root,
          from,
          to,
          command.kind === "attack" ? "attack" : "target",
        );
        onState({
          kind: command.kind,
          label: command.label,
          durationMs,
          targetId: command.toTargetId,
          line,
        });
        if (command.kind === "card-move") {
          const fromRect = from.getBoundingClientRect();
          const toRect = to.getBoundingClientRect();
          const travel = cardMoveTravel(root, from, to, fromRect, toRect);
          animate(
            to.querySelector(".duel-field-card__art") ?? to,
            [
              { translate: `${travel.x}px ${travel.y}px` },
              { translate: "0 0" },
            ],
            durationMs,
          );
        } else {
          animate(to, [{ opacity: 0.65 }, { opacity: 1 }], durationMs);
        }
        return;
      }
      case "summon":
      case "set":
      case "position": {
        const target = targetElement(root, command.targetId);
        if (target === null) {
          notice(command);
          return;
        }
        highlighted = target;
        highlighted.classList.add("is-feedback-target");
        onState({
          kind: command.kind,
          label: command.label,
          durationMs,
          targetId: command.targetId,
        });
        animate(target, [{ opacity: 0.68 }, { opacity: 1 }], durationMs);
        return;
      }
      case "life-points":
      case "chain":
      case "notice":
        onState({
          kind: command.kind,
          label: command.label,
          durationMs,
        });
        return;
    }
  };

  return {
    get activeAnimationCount() {
      return animations.size;
    },
    present,
    cancel(): void {
      clearTransient();
      onState(EMPTY_DOM_FEEDBACK_STATE);
    },
  };
}

function cardMoveTravel(
  root: HTMLElement,
  from: Element,
  to: Element,
  fromRect: DOMRect,
  toRect: DOMRect,
): { readonly x: number; readonly y: number } {
  const frame = readStageFrame(root);
  const viewportTravel = (): { readonly x: number; readonly y: number } =>
    toFrameDelta(
      frame,
      centerX(fromRect) - centerX(toRect),
      centerY(fromRect) - centerY(toRect),
    );
  const fromPlane = from.closest<HTMLElement>(FIELD_PLANE_SELECTOR);
  const toPlane = to.closest<HTMLElement>(FIELD_PLANE_SELECTOR);
  if (fromPlane === null || fromPlane !== toPlane) return viewportTravel();
  const fromPoint = projectedPointInPlane(
    frame,
    fromPlane,
    centerX(fromRect),
    centerY(fromRect),
  );
  const toPoint = projectedPointInPlane(
    frame,
    fromPlane,
    centerX(toRect),
    centerY(toRect),
  );
  if (fromPoint === null || toPoint === null) return viewportTravel();
  return { x: fromPoint.x - toPoint.x, y: fromPoint.y - toPoint.y };
}

/* A plane-local CSS translate is projected by the ancestor's 3D matrix. Map
   each visible centre back through that plane before subtracting; subtracting
   viewport pixels first only works when the plane is flat. */
function projectedPointInPlane(
  frame: ReturnType<typeof readStageFrame>,
  plane: HTMLElement,
  viewportX: number,
  viewportY: number,
): { readonly x: number; readonly y: number } | null {
  const style = getComputedStyle(plane);
  const values = style.transform
    .match(/^matrix3d\(([^)]*)\)$/)?.[1]
    ?.split(",")
    .map((value) => Number(value.trim()));
  if (values === undefined || values.length !== 16) return null;
  if (values.some((value) => !Number.isFinite(value))) return null;
  const offsetParent = plane.offsetParent ?? plane.parentElement;
  if (offsetParent === null) return null;
  const parentRect = toFrameRect(frame, offsetParent.getBoundingClientRect());
  const [originXToken = "50%", originYToken = "50%"] =
    style.transformOrigin.split(/\s+/);
  const originX = transformOriginPixels(originXToken, plane.offsetWidth);
  const originY = transformOriginPixels(originYToken, plane.offsetHeight);
  const point = toFramePoint(frame, viewportX, viewportY);
  const projectedX =
    point.x -
    (parentRect.left + offsetParent.clientLeft + plane.offsetLeft + originX);
  const projectedY =
    point.y -
    (parentRect.top + offsetParent.clientTop + plane.offsetTop + originY);
  const m11 = values[0]!;
  const m12 = values[1]!;
  const m14 = values[3]!;
  const m21 = values[4]!;
  const m22 = values[5]!;
  const m24 = values[7]!;
  const m41 = values[12]!;
  const m42 = values[13]!;
  const m44 = values[15]!;
  const a = m11 - projectedX * m14;
  const b = m21 - projectedX * m24;
  const c = m12 - projectedY * m14;
  const d = m22 - projectedY * m24;
  const first = projectedX * m44 - m41;
  const second = projectedY * m44 - m42;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-9) return null;
  return {
    x: originX + (first * d - b * second) / determinant,
    y: originY + (a * second - first * c) / determinant,
  };
}

function transformOriginPixels(value: string, size: number): number {
  if (value.endsWith("%")) {
    const percentage = Number.parseFloat(value);
    return Number.isFinite(percentage) ? (percentage / 100) * size : size / 2;
  }
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) ? pixels : size / 2;
}

function boundedDuration(durationMs: number): number {
  return Math.max(0, Math.min(durationMs, MAXIMUM_FEEDBACK_DURATION_MS));
}

function targetElement(
  root: HTMLElement,
  targetId: BoardTargetId,
): Element | null {
  const separator = targetId.indexOf(":");
  const kind = targetId.slice(0, separator);
  const value = targetId.slice(separator + 1);
  const attribute =
    kind === "card"
      ? "data-card-id"
      : kind === "zone"
        ? "data-zone-id"
        : "data-stack-id";
  const direct = [...root.querySelectorAll(`[${attribute}]`)].find(
    (element) => element.getAttribute(attribute) === value,
  );
  if (direct !== undefined) return direct;
  /* The hand band paints no `ZoneControl` (T8), so a hand zone has no
     `[data-zone-id]` element — that attribute stays reserved for the drag
     drop-target hit test, which must never resolve a hand card's action
     chip to an enclosing zone. `[data-feedback-zone-id]` is HandBand's own,
     narrower anchor for exactly this line/highlight lookup. */
  if (kind !== "zone") return null;
  return (
    [...root.querySelectorAll("[data-feedback-zone-id]")].find(
      (element) => element.getAttribute("data-feedback-zone-id") === value,
    ) ?? null
  );
}

function lineBetween(
  root: HTMLElement,
  from: Element,
  to: Element,
  kind: FieldFeedbackLine["kind"],
): FieldFeedbackLine {
  /* The line is drawn in `root`'s own coordinate system, so every viewport
     rect below is mapped into the frame first: on a portrait phone the field
     is turned a quarter turn and a raw viewport difference would draw the
     line across the wrong axis. Unrotated, `toFrameRect` is the identity and
     this is the plain rect arithmetic it has always been. */
  const frame = readStageFrame(root);
  const rootRect = toFrameRect(frame, root.getBoundingClientRect());
  const fromRect = toFrameRect(frame, from.getBoundingClientRect());
  const toRect = toFrameRect(frame, to.getBoundingClientRect());
  return {
    kind,
    x1: centerX(fromRect) - rootRect.left,
    y1: centerY(fromRect) - rootRect.top,
    x2: centerX(toRect) - rootRect.left,
    y2: centerY(toRect) - rootRect.top,
  };
}

function centerX(rect: { left: number; width: number }): number {
  return rect.left + rect.width / 2;
}

function centerY(rect: { top: number; height: number }): number {
  return rect.top + rect.height / 2;
}

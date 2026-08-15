import type { BoardTargetId } from "../../field/board-view-model.ts";
import type { DomPresentationCommand } from "./presentation-command.ts";
import { readStageFrame, toFrameDelta, toFrameRect } from "./stage-frame.ts";

const MAXIMUM_FEEDBACK_DURATION_MS = 600;

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
          /* The rects are viewport-space but the translate lands inside the
             field, which a portrait phone turns a quarter turn (T15). */
          const travel = toFrameDelta(
            readStageFrame(root),
            centerX(fromRect) - centerX(toRect),
            centerY(fromRect) - centerY(toRect),
          );
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

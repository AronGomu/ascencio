// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDomFeedbackController,
  EMPTY_DOM_FEEDBACK_STATE,
  type DomFeedbackState,
} from "../../src/battle/app/presentation/dom-feedback-controller.ts";
import type { DomPresentationCommand } from "../../src/battle/app/presentation/presentation-command.ts";

function rect(left: number, top: number, width = 40, height = 60): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function fieldRoot(): HTMLElement {
  document.body.innerHTML = `
    <section id="field">
      <div data-zone-id="p0:hand"></div>
      <article data-card-id="moved-card"><div class="duel-field-card__art"></div></article>
    </section>`;
  const root = document.querySelector<HTMLElement>("#field");
  const source = document.querySelector<HTMLElement>("[data-zone-id]");
  const target = document.querySelector<HTMLElement>("[data-card-id]");
  if (root === null || source === null || target === null)
    throw new Error("Missing feedback fixture node");
  root.getBoundingClientRect = () => rect(10, 20, 800, 450);
  source.getBoundingClientRect = () => rect(30, 50);
  target.getBoundingClientRect = () => rect(210, 170);
  return root;
}

function moveCommand(durationMs = 420): DomPresentationCommand {
  return {
    kind: "card-move",
    label: "Card moved",
    durationMs,
    fromTargetId: "zone:p0:hand",
    toTargetId: "card:moved-card",
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("DOM feedback controller", () => {
  it("presents bounded movement and a target line without waiting for completion", () => {
    const root = fieldRoot();
    let resolveFinished: (() => void) | undefined;
    const cancel = vi.fn();
    const animateMock = vi.fn(
      (keyframes: Keyframe[], options?: KeyframeAnimationOptions) => {
        void keyframes;
        void options;
        return {
          cancel,
          finished: new Promise<void>((resolve) => {
            resolveFinished = resolve;
          }),
        };
      },
    );
    Element.prototype.animate =
      animateMock as unknown as typeof Element.prototype.animate;
    const states: DomFeedbackState[] = [];
    const controller = createDomFeedbackController(root, (state) =>
      states.push(state),
    );

    controller.present(moveCommand(20_000));

    expect(states.at(-1)).toMatchObject({
      kind: "card-move",
      label: "Card moved",
      durationMs: 600,
      targetId: "card:moved-card",
      line: { kind: "target", x1: 40, y1: 60, x2: 220, y2: 180 },
    });
    expect(animateMock).toHaveBeenCalledTimes(1);
    expect(animateMock.mock.calls[0]?.[1]).toMatchObject({ duration: 600 });
    expect(controller.activeAnimationCount).toBe(1);
    expect(
      root
        .querySelector("[data-card-id]")
        ?.classList.contains("is-feedback-target"),
    ).toBe(true);
    resolveFinished?.();
  });

  it("cancels animations, clears final state, and leaves zero timers", () => {
    vi.useFakeTimers();
    const root = fieldRoot();
    const cancel = vi.fn();
    Element.prototype.animate = vi.fn(() => ({
      cancel,
      finished: new Promise<void>(() => undefined),
    })) as unknown as typeof Element.prototype.animate;
    const onState = vi.fn();
    const controller = createDomFeedbackController(root, onState);
    controller.present(moveCommand());

    controller.cancel();

    expect(cancel).toHaveBeenCalledOnce();
    expect(controller.activeAnimationCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onState).toHaveBeenLastCalledWith(EMPTY_DOM_FEEDBACK_STATE);
    expect(root.querySelector(".is-feedback-target")).toBeNull();
  });

  it("uses duration zero with no movement while retaining highlight and text", () => {
    const root = fieldRoot();
    const animate = vi.fn();
    Element.prototype.animate = animate;
    const onState = vi.fn();
    const controller = createDomFeedbackController(root, onState);

    controller.present(moveCommand(0));

    expect(animate).not.toHaveBeenCalled();
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: "Card moved",
        durationMs: 0,
        targetId: "card:moved-card",
      }),
    );
    expect(root.querySelector(".is-feedback-target")).not.toBeNull();
  });

  it("degrades unresolved command endpoints to a notice", () => {
    const root = fieldRoot();
    const onState = vi.fn();
    const controller = createDomFeedbackController(root, onState);
    controller.present({
      kind: "card-move",
      label: "Card moved",
      durationMs: 420,
      fromTargetId: "zone:p0:hand",
      toTargetId: "card:missing",
    });

    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "notice", label: "Card moved" }),
    );
    expect(root.querySelector(".is-feedback-target")).toBeNull();
  });
});

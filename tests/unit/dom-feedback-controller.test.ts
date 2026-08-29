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
  vi.restoreAllMocks();
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

  it("converts projected centres into plane-local card travel", () => {
    document.body.innerHTML = `
      <section id="field">
        <div id="board">
          <div data-cy="duel-field-board-plane">
            <div data-zone-id="p0:hand"></div>
            <article data-card-id="moved-card"><div class="duel-field-card__art"></div></article>
          </div>
        </div>
      </section>`;
    const root = document.querySelector<HTMLElement>("#field")!;
    const board = document.querySelector<HTMLElement>("#board")!;
    const plane = document.querySelector<HTMLElement>(
      '[data-cy="duel-field-board-plane"]',
    )!;
    const source = document.querySelector<HTMLElement>("[data-zone-id]")!;
    const target = document.querySelector<HTMLElement>("[data-card-id]")!;
    const origin = { x: 400, y: 900 };
    const clientBorder = { x: 7, y: 11 };
    const base = { x: 10 + clientBorder.x, y: 20 + clientBorder.y };
    const m22 = 0.94;
    const m24 = -0.00057;
    const project = (x: number, y: number) => {
      const localX = x - origin.x;
      const localY = y - origin.y;
      const divisor = m24 * localY + 1;
      return {
        x: base.x + origin.x + localX / divisor,
        y: base.y + origin.y + (m22 * localY) / divisor,
      };
    };
    const sourcePoint = project(160, 260);
    const targetPoint = project(570, 720);
    root.getBoundingClientRect = () => rect(10, 20, 800, 900);
    board.getBoundingClientRect = () => rect(10, 20, 800, 900);
    Object.defineProperties(board, {
      clientLeft: { configurable: true, get: () => clientBorder.x },
      clientTop: { configurable: true, get: () => clientBorder.y },
    });
    source.getBoundingClientRect = () =>
      rect(sourcePoint.x, sourcePoint.y, 0, 0);
    target.getBoundingClientRect = () =>
      rect(targetPoint.x, targetPoint.y, 0, 0);
    Object.defineProperties(plane, {
      offsetParent: { configurable: true, get: () => board },
      offsetLeft: { configurable: true, get: () => 0 },
      offsetTop: { configurable: true, get: () => 0 },
      offsetWidth: { configurable: true, get: () => 800 },
      offsetHeight: { configurable: true, get: () => 900 },
    });
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    vi.spyOn(globalThis, "getComputedStyle").mockImplementation((element) =>
      element === plane
        ? ({
            transform:
              "matrix3d(1, 0, 0, 0, 0, 0.94, 0.342, -0.00057, 0, -0.342, 0.94, -0.00157, 0, 0, 0, 1)",
            transformOrigin: "400px 900px",
          } as CSSStyleDeclaration)
        : nativeGetComputedStyle(element),
    );
    const animateMock = vi.fn((keyframes: Keyframe[]) => {
      void keyframes;
      return {
        cancel: vi.fn(),
        finished: new Promise<void>(() => undefined),
      };
    });
    Element.prototype.animate =
      animateMock as unknown as typeof Element.prototype.animate;

    createDomFeedbackController(root, () => undefined).present(moveCommand());

    const firstFrame = animateMock.mock.calls[0]?.[0][0];
    expect(firstFrame).toBeDefined();
    const [x, y] = String(firstFrame?.translate)
      .match(/-?[\d.]+/g)!
      .map(Number);
    expect(x).toBeCloseTo(-410, 5);
    expect(y).toBeCloseTo(-460, 5);
    expect(x).not.toBeCloseTo(sourcePoint.x - targetPoint.x, 0);
    expect(y).not.toBeCloseTo(sourcePoint.y - targetPoint.y, 0);
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

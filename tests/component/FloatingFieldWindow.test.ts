// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FloatingFieldWindow from "../../src/app/components/duel-field/FloatingFieldWindow.svelte";

/* jsdom lays nothing out, so every size the primitive reads is stubbed per
   element: `clientWidth/clientHeight` for the boundary's padding box and
   `offsetWidth/offsetHeight` for the window's border box. */
const SIZES = new WeakMap<
  Element,
  { width: number; height: number; borderWidth?: number }
>();

function stubSize(
  element: Element,
  size: { width: number; height: number },
): void {
  SIZES.set(element, size);
}

const resizeObservers: { callback: ResizeObserverCallback }[] = [];

beforeEach(() => {
  for (const property of [
    "clientWidth",
    "clientHeight",
    "offsetWidth",
    "offsetHeight",
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      get(this: HTMLElement) {
        const size = SIZES.get(this);
        if (size === undefined) return 0;
        return property.endsWith("Width") ? size.width : size.height;
      },
    });
  }
  resizeObservers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObservers.push({ callback });
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const property of [
    "clientWidth",
    "clientHeight",
    "offsetWidth",
    "offsetHeight",
  ] as const)
    Reflect.deleteProperty(HTMLElement.prototype, property);
});

function triggerResize(): void {
  for (const observer of resizeObservers)
    observer.callback([], {} as ResizeObserver);
}

function boundary(width = 800, height = 600): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubSize(element, { width, height });
  return element;
}

function renderWindow(
  props: Partial<{
    windowId: "zoneList" | "confirm";
    ariaLabel: string;
    boundaryElement: HTMLElement | null;
    position: { x: number; y: number } | null;
    dismissOnOutsideClick: boolean;
    dismissOnEscape: boolean;
    active: boolean;
    disabled: boolean;
    onactivate: (id: string) => void;
    onpositionchange: (position: { x: number; y: number }) => void;
    ondismiss: () => void;
  }> = {},
) {
  const onpositionchange = props.onpositionchange ?? vi.fn();
  const ondismiss = props.ondismiss ?? vi.fn();
  const onactivate = props.onactivate ?? vi.fn();
  const windowId = props.windowId ?? "zoneList";
  const rendered = render(FloatingFieldWindow, {
    windowId,
    ariaLabel: props.ariaLabel ?? "Zone list window",
    boundaryElement: props.boundaryElement ?? null,
    position: props.position ?? null,
    dismissOnOutsideClick: props.dismissOnOutsideClick ?? false,
    dismissOnEscape: props.dismissOnEscape ?? false,
    active: props.active ?? false,
    disabled: props.disabled ?? false,
    onactivate,
    onpositionchange,
    ondismiss,
  });
  const root = document.querySelector<HTMLElement>(
    `[data-cy="floating-field-window-${windowId}"]`,
  );
  if (root === null) throw new Error("Missing window root");
  stubSize(root, { width: 200, height: 100 });
  return { rendered, root, onpositionchange, ondismiss, onactivate };
}

function handleOf(root: HTMLElement): HTMLElement {
  const handle = root.querySelector<HTMLElement>('[data-cy$="-handle"]');
  if (handle === null) throw new Error("Missing window handle");
  return handle;
}

function offset(root: HTMLElement): { x: string; y: string } {
  return {
    x: root.style.getPropertyValue("--window-x"),
    y: root.style.getPropertyValue("--window-y"),
  };
}

describe("FloatingFieldWindow", () => {
  it("centres a null position after measurement without emitting one", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: null,
    });
    triggerResize();
    await tick();

    expect(offset(root)).toEqual({ x: "300px", y: "250px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("stays responsively centred while the position is null", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: null,
    });
    triggerResize();
    await tick();

    stubSize(field, { width: 400, height: 300 });
    triggerResize();
    await tick();

    expect(offset(root)).toEqual({ x: "100px", y: "100px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("drag from the handle captures the pointer and moves the window", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 100, y: 100 },
    });
    triggerResize();
    await tick();
    const handle = handleOf(root);
    const setPointerCapture = vi.fn();
    Object.assign(handle, {
      setPointerCapture,
      releasePointerCapture: vi.fn(),
    });

    await fireEvent.pointerDown(handle, {
      clientX: 150,
      clientY: 150,
      pointerId: 7,
    });
    await fireEvent.pointerMove(handle, {
      clientX: 200,
      clientY: 180,
      pointerId: 7,
    });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(offset(root)).toEqual({ x: "150px", y: "130px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("a drag started in the content never moves the window", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 100, y: 100 },
    });
    triggerResize();
    await tick();
    const content = root.querySelector<HTMLElement>('[data-cy$="-content"]');
    if (content === null) throw new Error("Missing window content");

    await fireEvent.pointerDown(content, {
      clientX: 150,
      clientY: 150,
      pointerId: 3,
    });
    await fireEvent.pointerMove(content, {
      clientX: 400,
      clientY: 400,
      pointerId: 3,
    });
    await fireEvent.pointerUp(content, {
      clientX: 400,
      clientY: 400,
      pointerId: 3,
    });

    expect(offset(root)).toEqual({ x: "100px", y: "100px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("an interactive child of the handle never starts a drag", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 100, y: 100 },
    });
    triggerResize();
    await tick();
    const handle = handleOf(root);
    const button = document.createElement("button");
    handle.append(button);

    await fireEvent.pointerDown(button, {
      clientX: 150,
      clientY: 150,
      pointerId: 4,
    });
    await fireEvent.pointerMove(handle, {
      clientX: 300,
      clientY: 300,
      pointerId: 4,
    });
    await fireEvent.pointerUp(handle, {
      clientX: 300,
      clientY: 300,
      pointerId: 4,
    });

    expect(offset(root)).toEqual({ x: "100px", y: "100px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("pointerup emits exactly one clamped position", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 100, y: 100 },
    });
    triggerResize();
    await tick();
    const handle = handleOf(root);

    await fireEvent.pointerDown(handle, {
      clientX: 150,
      clientY: 150,
      pointerId: 1,
    });
    await fireEvent.pointerMove(handle, {
      clientX: 5000,
      clientY: 5000,
      pointerId: 1,
    });
    await fireEvent.pointerUp(handle, {
      clientX: 5000,
      clientY: 5000,
      pointerId: 1,
    });

    expect(onpositionchange).toHaveBeenCalledTimes(1);
    expect(onpositionchange).toHaveBeenCalledWith({ x: 600, y: 500 });
    expect(offset(root)).toEqual({ x: "600px", y: "500px" });
  });

  it("a disabled window does not drag", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 100, y: 100 },
      disabled: true,
    });
    triggerResize();
    await tick();
    const handle = handleOf(root);

    await fireEvent.pointerDown(handle, {
      clientX: 150,
      clientY: 150,
      pointerId: 2,
    });
    await fireEvent.pointerMove(handle, {
      clientX: 300,
      clientY: 300,
      pointerId: 2,
    });
    await fireEvent.pointerUp(handle, {
      clientX: 300,
      clientY: 300,
      pointerId: 2,
    });

    expect(offset(root)).toEqual({ x: "100px", y: "100px" });
    expect(onpositionchange).not.toHaveBeenCalled();
  });

  it("reclamps a persisted position on boundary resize and reports only the change", async () => {
    const field = boundary();
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 500, y: 400 },
    });
    triggerResize();
    await tick();
    expect(offset(root)).toEqual({ x: "500px", y: "400px" });
    expect(onpositionchange).not.toHaveBeenCalled();

    stubSize(field, { width: 400, height: 300 });
    triggerResize();
    await tick();

    expect(onpositionchange).toHaveBeenCalledTimes(1);
    expect(onpositionchange).toHaveBeenCalledWith({ x: 200, y: 200 });
    expect(offset(root)).toEqual({ x: "200px", y: "200px" });
  });

  it("reclamps when the window's own content grows", async () => {
    const field = boundary(400, 300);
    const { root, onpositionchange } = renderWindow({
      boundaryElement: field,
      position: { x: 190, y: 190 },
    });
    triggerResize();
    await tick();
    expect(onpositionchange).not.toHaveBeenCalled();

    stubSize(root, { width: 300, height: 200 });
    triggerResize();
    await tick();

    expect(onpositionchange).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it("outside pointerdown dismisses only when the policy allows it", async () => {
    const field = boundary();
    const dismissible = renderWindow({
      boundaryElement: field,
      dismissOnOutsideClick: true,
    });
    await fireEvent.pointerDown(document.body);
    expect(dismissible.ondismiss).toHaveBeenCalledTimes(1);

    cleanup();
    const persistent = renderWindow({
      windowId: "confirm",
      boundaryElement: field,
      dismissOnOutsideClick: false,
    });
    await fireEvent.pointerDown(document.body);
    expect(persistent.ondismiss).not.toHaveBeenCalled();
  });

  it("pointerdown inside the window never dismisses it", async () => {
    const field = boundary();
    const { root, ondismiss } = renderWindow({
      boundaryElement: field,
      dismissOnOutsideClick: true,
    });

    await fireEvent.pointerDown(handleOf(root));
    const content = root.querySelector<HTMLElement>('[data-cy$="-content"]');
    if (content === null) throw new Error("Missing window content");
    await fireEvent.pointerDown(content);

    expect(ondismiss).not.toHaveBeenCalled();
  });

  it("Escape dismisses only when the policy allows it", async () => {
    const user = userEvent.setup();
    const field = boundary();
    const dismissible = renderWindow({
      boundaryElement: field,
      dismissOnEscape: true,
    });
    await user.keyboard("{Escape}");
    expect(dismissible.ondismiss).toHaveBeenCalledTimes(1);

    cleanup();
    const persistent = renderWindow({
      windowId: "confirm",
      boundaryElement: field,
      dismissOnEscape: false,
    });
    await user.keyboard("{Escape}");
    expect(persistent.ondismiss).not.toHaveBeenCalled();
  });

  it("stops dismissing once destroyed", async () => {
    const field = boundary();
    const { rendered, ondismiss } = renderWindow({
      boundaryElement: field,
      dismissOnOutsideClick: true,
      dismissOnEscape: true,
    });
    rendered.unmount();

    await fireEvent.pointerDown(document.body);
    await fireEvent.keyDown(document, { key: "Escape" });

    expect(ondismiss).not.toHaveBeenCalled();
  });

  it("exposes activation, drag state and per-window selectors", async () => {
    const field = boundary();
    const { root, onactivate } = renderWindow({
      windowId: "confirm",
      boundaryElement: field,
      active: true,
      position: { x: 10, y: 10 },
    });

    expect(root.getAttribute("role")).toBe("dialog");
    expect(root.getAttribute("aria-modal")).toBe("false");
    expect(root.classList.contains("is-active")).toBe(true);
    expect(
      document.querySelectorAll('[data-cy="floating-field-window-confirm"]'),
    ).toHaveLength(1);
    expect(
      document.querySelector(
        '[data-cy="floating-field-window-confirm-handle"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '[data-cy="floating-field-window-confirm-content"]',
      ),
    ).not.toBeNull();

    const handle = handleOf(root);
    await fireEvent.pointerDown(handle, {
      clientX: 20,
      clientY: 20,
      pointerId: 9,
    });
    expect(onactivate).toHaveBeenCalledWith("confirm");
    expect(root.classList.contains("is-dragging")).toBe(true);

    await fireEvent.pointerUp(handle, {
      clientX: 20,
      clientY: 20,
      pointerId: 9,
    });
    expect(root.classList.contains("is-dragging")).toBe(false);
  });
});

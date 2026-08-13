// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverlayScrollbar from "../../src/app/components/OverlayScrollbar.svelte";

const observers: Array<{
  readonly callback: ResizeObserverCallback;
  readonly observe: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
}> = [];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();
      readonly unobserve = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        observers.push({
          callback,
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function dimension(element: Element, name: string, value: number): void {
  Object.defineProperty(element, name, { configurable: true, value });
}

async function mounted(axis: "horizontal" | "vertical", overflow = true) {
  const scrollElement = document.createElement("div");
  document.body.append(scrollElement);
  dimension(scrollElement, axis === "horizontal" ? "clientWidth" : "clientHeight", 100);
  dimension(scrollElement, axis === "horizontal" ? "scrollWidth" : "scrollHeight", overflow ? 400 : 100);
  const rendered = render(OverlayScrollbar, {
    axis,
    scrollElement,
    contentSizeKey: 1,
    dataCyPrefix: "test",
  });
  const track = rendered.container.querySelector<HTMLElement>('[data-cy="test-scrollbar"]')!;
  const thumb = rendered.container.querySelector<HTMLElement>('[data-cy="test-scrollbar-thumb"]')!;
  dimension(track, axis === "horizontal" ? "clientWidth" : "clientHeight", 80);
  observers.forEach(({ callback }) => callback([], {} as ResizeObserver));
  await Promise.resolve();
  return { rendered, scrollElement, track, thumb };
}

describe("OverlayScrollbar", () => {
  it("hides when content fits and keeps finite thumb geometry", async () => {
    const { track, thumb } = await mounted("horizontal", false);
    expect(track.hidden).toBe(true);
    expect(thumb.style.width).not.toContain("NaN");
  });

  it.each(["horizontal", "vertical"] as const)(
    "maps %s native offset to proportional thumb transform",
    async (axis) => {
      const { scrollElement, thumb } = await mounted(axis);
      if (axis === "horizontal") scrollElement.scrollLeft = 150;
      else scrollElement.scrollTop = 150;
      await fireEvent.scroll(scrollElement);
      expect(thumb.style.transform).toContain("30px");
    },
  );

  it("maps thumb drag to native scroll and uses pointer capture", async () => {
    const { scrollElement, thumb } = await mounted("horizontal");
    const capture = vi.fn();
    const release = vi.fn();
    thumb.setPointerCapture = capture;
    thumb.releasePointerCapture = release;
    await fireEvent.pointerDown(thumb, { pointerId: 7, clientX: 10 });
    await fireEvent.pointerMove(thumb, { pointerId: 7, clientX: 30 });
    await fireEvent.pointerUp(thumb, { pointerId: 7 });
    expect(scrollElement.scrollLeft).toBe(100);
    expect(capture).toHaveBeenCalledWith(7);
    expect(release).toHaveBeenCalledWith(7);
  });

  it("normalizes row-reverse negative horizontal offsets and drag writes", async () => {
    const { scrollElement, thumb } = await mounted("horizontal");
    scrollElement.style.flexDirection = "row-reverse";
    scrollElement.scrollLeft = -150;
    await fireEvent.scroll(scrollElement);
    expect(thumb.style.transform).toContain("30px");

    thumb.setPointerCapture = vi.fn();
    thumb.releasePointerCapture = vi.fn();
    scrollElement.scrollLeft = 0;
    await fireEvent.pointerDown(thumb, { pointerId: 9, clientX: 10 });
    await fireEvent.pointerMove(thumb, { pointerId: 9, clientX: 30 });
    expect(scrollElement.scrollLeft).toBe(-100);
  });

  it("disconnects observers/listeners and releases capture on destroy", async () => {
    const { rendered, scrollElement, thumb } = await mounted("horizontal");
    const release = vi.fn();
    thumb.setPointerCapture = vi.fn();
    thumb.releasePointerCapture = release;
    const removeElementListener = vi.spyOn(scrollElement, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    await fireEvent.pointerDown(thumb, { pointerId: 11, clientX: 10 });

    rendered.unmount();

    expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
    expect(removeElementListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(release).toHaveBeenCalledWith(11);

    let scrollWidthReads = 0;
    Object.defineProperty(scrollElement, "scrollWidth", {
      configurable: true,
      get: () => {
        scrollWidthReads += 1;
        return 400;
      },
    });
    await fireEvent.scroll(scrollElement);
    window.dispatchEvent(new Event("resize"));
    observers[0]?.callback([], {} as ResizeObserver);
    expect(scrollWidthReads).toBe(0);
  });

  it("resyncs after content key and observed resize", async () => {
    const { rendered, scrollElement, thumb } = await mounted("horizontal");
    dimension(scrollElement, "scrollWidth", 200);
    await rendered.rerender({ contentSizeKey: 2 });
    observers.forEach(({ callback }) => callback([], {} as ResizeObserver));
    await Promise.resolve();
    expect(thumb.style.width).toBe("40px");
  });
});

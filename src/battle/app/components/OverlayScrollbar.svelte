<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import {
    readStageFrame,
    toFrameDelta,
    type StageFrame,
  } from "../presentation/stage-frame.ts";

  export let axis: "horizontal" | "vertical";
  export let scrollElement: HTMLElement | null = null;
  export let contentSizeKey: string | number = 0;
  export let dataCyPrefix: string;

  let trackElement: HTMLDivElement;
  let thumbElement: HTMLDivElement;
  let observedScrollElement: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let hidden = true;
  let thumbSize = 0;
  let thumbOffset = 0;
  let drag: {
    pointerId: number;
    start: number;
    scroll: number;
    frame: StageFrame;
  } | null = null;

  $: synchronizeContent(contentSizeKey);
  $: reconnect(scrollElement);

  onDestroy(disconnect);

  function synchronizeContent(key: string | number): void {
    String(key);
    void tick().then(sync);
  }

  function reconnect(element: HTMLElement | null): void {
    if (element === observedScrollElement) return;
    disconnect();
    observedScrollElement = element;
    if (element === null) return;
    element.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(sync);
      observer.observe(element);
    }
    void tick().then(() => {
      if (trackElement !== undefined) observer?.observe(trackElement);
      sync();
    });
  }

  function disconnect(): void {
    observedScrollElement?.removeEventListener("scroll", sync);
    window.removeEventListener("resize", sync);
    observer?.disconnect();
    observer = null;
    observedScrollElement = null;
    if (drag !== null && thumbElement !== undefined)
      thumbElement.releasePointerCapture?.(drag.pointerId);
    drag = null;
  }

  function values() {
    const element = observedScrollElement;
    if (element === null || trackElement === undefined) return null;
    const viewport =
      axis === "horizontal" ? element.clientWidth : element.clientHeight;
    const content =
      axis === "horizontal" ? element.scrollWidth : element.scrollHeight;
    const measuredTrack =
      axis === "horizontal"
        ? trackElement.clientWidth
        : trackElement.clientHeight;
    const track = measuredTrack > 0 ? measuredTrack : viewport;
    const reverse =
      axis === "horizontal" &&
      getComputedStyle(element).flexDirection === "row-reverse";
    const rawScroll =
      axis === "horizontal" ? element.scrollLeft : element.scrollTop;
    const scrollTravel = Math.max(0, content - viewport);
    const scroll = Math.min(
      scrollTravel,
      Math.max(0, reverse ? -rawScroll : rawScroll),
    );
    const trackTravel = Math.max(0, track - thumbSize);
    return {
      element,
      viewport,
      content,
      track,
      scroll,
      scrollTravel,
      trackTravel,
      reverse,
    };
  }

  function sync(): void {
    const current = values();
    if (current === null) return;
    hidden = current.content <= current.viewport || current.track <= 0;
    thumbSize =
      current.content > 0
        ? Math.min(
            current.track,
            current.track * (current.viewport / current.content),
          )
        : current.track;
    const trackTravel = Math.max(0, current.track - thumbSize);
    thumbOffset =
      current.scrollTravel > 0
        ? (current.scroll / current.scrollTravel) * trackTravel
        : 0;
  }

  /* The thumb travels along its own axis, which a portrait phone turns a
     quarter turn away from the viewport axis of the same name: dragging the
     finger *down* the screen then has to scroll a horizontal band. Only the
     difference against `drag.start` is ever used, so mapping the raw pointer
     through the frame is enough — and unrotated it is the plain client
     coordinate this always read. */
  function pointerCoordinate(event: PointerEvent, frame: StageFrame): number {
    const point = toFrameDelta(frame, event.clientX, event.clientY);
    return axis === "horizontal" ? point.x : point.y;
  }

  function pointerDown(event: PointerEvent): void {
    const current = values();
    if (current === null) return;
    const frame = readStageFrame(thumbElement);
    drag = {
      pointerId: event.pointerId,
      start: pointerCoordinate(event, frame),
      scroll: current.scroll,
      frame,
    };
    thumbElement.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent): void {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const current = values();
    if (current === null) return;
    const trackTravel = Math.max(0, current.track - thumbSize);
    const next =
      trackTravel > 0
        ? Math.min(
            current.scrollTravel,
            Math.max(
              0,
              drag.scroll +
                ((pointerCoordinate(event, drag.frame) - drag.start) /
                  trackTravel) *
                  current.scrollTravel,
            ),
          )
        : drag.scroll;
    if (axis === "horizontal")
      current.element.scrollLeft = current.reverse ? -next : next;
    else current.element.scrollTop = next;
    sync();
  }

  function pointerEnd(event: PointerEvent): void {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    thumbElement.releasePointerCapture(event.pointerId);
    drag = null;
  }
</script>

<div
  class="overlay-scrollbar"
  class:is-horizontal={axis === "horizontal"}
  class:is-vertical={axis === "vertical"}
  aria-hidden="true"
  {hidden}
  bind:this={trackElement}
  data-cy={`${dataCyPrefix}-scrollbar`}
>
  <!-- svelte-ignore a11y_no_static_element_interactions (aria-hidden custom thumb mirrors native viewport scrolling) -->
  <div
    class="overlay-scrollbar__thumb"
    style={`${axis === "horizontal" ? "width" : "height"}: ${thumbSize}px; transform: translate${axis === "horizontal" ? "X" : "Y"}(${thumbOffset}px);`}
    bind:this={thumbElement}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerEnd}
    onpointercancel={pointerEnd}
    data-cy={`${dataCyPrefix}-scrollbar-thumb`}
  ></div>
</div>

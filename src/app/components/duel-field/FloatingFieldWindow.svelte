<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    clampFieldWindowPosition,
    type FieldWindowId,
    type Size,
  } from "../../presentation/floating-window-position.ts";
  import {
    readStageFrame,
    toFrameDelta,
    UNROTATED_FRAME,
    type StageFrame,
  } from "../../presentation/stage-frame.ts";
  import type { PersistedWindowPosition } from "../../stores/persisted-ui-state.ts";

  export let windowId: FieldWindowId;
  export let ariaLabel: string;
  /* The visible, non-scrolling `.duel-field` root (ADR-017): every coordinate
     below is a top-left CSS pixel offset inside its padding box, which is also
     the containing block this window is absolutely positioned in. */
  export let boundaryElement: HTMLElement | null = null;
  export let position: PersistedWindowPosition | null = null;
  export let dismissOnOutsideClick = false;
  export let dismissOnEscape = false;
  export let active = false;
  export let collapsed = false;
  export let mode: "browse" | "target" | undefined = undefined;
  /* Blocks the drag gesture only. Window content owns its own disabled state,
     and dismissal policy is never suspended by a pending response. */
  export let disabled = false;
  export let onactivate: (id: FieldWindowId) => void = () => undefined;
  export let onpositionchange: (
    position: PersistedWindowPosition,
  ) => void = () => undefined;
  /* The dismissing event travels with the callback so an owner can tell an
     outside press on the control that opened this window from any other. */
  export let ondismiss: (event?: Event) => void = () => undefined;

  /* A control inside the handle answers the pointer itself; only bare handle
     chrome starts a drag. */
  const HANDLE_INTERACTIVE_SELECTOR =
    "button, a[href], input, select, textarea, [role='button'], [data-no-window-drag]";

  let windowElement: HTMLElement | null = null;
  /* The effective position, so a finished drag is not undone by an echo of
     the still-stale prop before the owner writes the new one back. */
  let current: PersistedWindowPosition | null = position;
  let lastProp: PersistedWindowPosition | null = position;
  let x = 0;
  let y = 0;
  let dragging = false;
  let dragPointerId: number | null = null;
  /* The gesture is tracked as a delta from where it started rather than as a
     pointer-minus-position offset: on a portrait phone the field is turned a
     quarter turn, so a viewport delta has to be turned with it before it can
     be added to a position that lives in the field's own coordinates. */
  let dragPointerStartX = 0;
  let dragPointerStartY = 0;
  let dragWindowStartX = 0;
  let dragWindowStartY = 0;
  let dragStageFrame: StageFrame = UNROTATED_FRAME;
  let sizeObserver: ResizeObserver | null = null;
  let observedBoundary: HTMLElement | null = null;
  let lastCollapsed = collapsed;
  let expandedAnchor: PersistedWindowPosition | null = null;

  $: syncPlacement(position, dragging);
  $: syncCollapsed(collapsed);
  $: adoptBoundary(boundaryElement);

  onMount(() => {
    if (typeof ResizeObserver !== "undefined") {
      sizeObserver = new ResizeObserver(() => place());
      if (windowElement !== null) sizeObserver.observe(windowElement);
      observeBoundary(boundaryElement);
    }

    document.addEventListener("pointerdown", documentPointerDown, true);
    document.addEventListener("keydown", documentKeydown);
    place();
    return () => {
      document.removeEventListener("pointerdown", documentPointerDown, true);
      document.removeEventListener("keydown", documentKeydown);
      sizeObserver?.disconnect();
      sizeObserver = null;
      observedBoundary = null;
    };
  });

  /* The field root arrives through the owner's `bind:this`, which can land
     after this window has already mounted, so the boundary is (re)observed
     and the placement redone whenever it changes. */
  function adoptBoundary(element: HTMLElement | null): void {
    observeBoundary(element);
    place();
  }

  function observeBoundary(element: HTMLElement | null): void {
    if (sizeObserver === null || element === observedBoundary) return;
    if (observedBoundary !== null) sizeObserver.unobserve(observedBoundary);
    observedBoundary = element;
    if (element !== null) sizeObserver.observe(element);
  }

  function syncPlacement(
    value: PersistedWindowPosition | null,
    isDragging: boolean,
  ): void {
    /* A live drag owns the coordinates until pointerup writes the final one
       out; a prop echo mid-gesture would fight the pointer. */
    if (isDragging || samePoint(value, lastProp)) return;
    lastProp = value;
    current = value;
    expandedAnchor = null;
    place();
  }

  function syncCollapsed(value: boolean): void {
    if (value === lastCollapsed) return;
    if (value) expandedAnchor = Object.freeze({ x, y });
    else if (expandedAnchor !== null) {
      x = expandedAnchor.x;
      y = expandedAnchor.y;
    }
    lastCollapsed = value;
    void tick().then(() => {
      place();
    });
  }

  function samePoint(
    left: PersistedWindowPosition | null,
    right: PersistedWindowPosition | null,
  ): boolean {
    if (left === null || right === null) return left === right;
    return left.x === right.x && left.y === right.y;
  }

  /* Single placement path for mount, prop change, content resize and field
     resize. A `null` position stays responsively centred and never writes to
     storage; a persisted one is clamped and only a *changed* clamp is
     reported outward. */
  function place(): void {
    const element = windowElement;
    if (element === null) return;
    const boundary = boundarySize(boundaryElement);
    const value = current;
    if (collapsed) {
      if (boundary === null) return;
      const clamped = clampFieldWindowPosition(
        { x, y },
        boundary,
        windowSize(element),
      );
      x = clamped.x;
      y = clamped.y;
      return;
    }
    if (expandedAnchor !== null) {
      if (boundary === null) return;
      const clamped = clampFieldWindowPosition(
        expandedAnchor,
        boundary,
        windowSize(element),
      );
      x = clamped.x;
      y = clamped.y;
      return;
    }
    if (value === null) {
      if (boundary === null) return;
      const size = windowSize(element);
      x = Math.max(0, (boundary.width - size.width) / 2);
      y = Math.max(0, (boundary.height - size.height) / 2);
      return;
    }
    if (boundary === null) {
      /* Unmeasurable boundary (detached or zero-sized): honour the persisted
         point verbatim rather than clamping a real position to the origin. */
      x = value.x;
      y = value.y;
      return;
    }
    const clamped = clampFieldWindowPosition(
      value,
      boundary,
      windowSize(element),
    );
    x = clamped.x;
    y = clamped.y;
    if (!samePoint(clamped, value)) {
      current = clamped;
      onpositionchange(clamped);
    }
  }

  /* Padding box: the exact containing block an absolutely positioned child of
     the field root is laid out in. */
  function boundarySize(element: HTMLElement | null): Size | null {
    if (element === null) return null;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }

  /* Border box: what the clamp must keep inside the boundary. */
  function windowSize(element: HTMLElement): Size {
    return { width: element.offsetWidth, height: element.offsetHeight };
  }

  function raise(): void {
    onactivate(windowId);
  }

  function startDrag(
    event: PointerEvent & { currentTarget: HTMLElement },
  ): void {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const origin = event.target;
    if (
      origin instanceof Element &&
      origin.closest(HANDLE_INTERACTIVE_SELECTOR) !== null
    )
      return;
    expandedAnchor = null;
    dragging = true;
    dragPointerId = event.pointerId;
    dragStageFrame = readStageFrame(boundaryElement ?? event.currentTarget);
    dragPointerStartX = event.clientX;
    dragPointerStartY = event.clientY;
    dragWindowStartX = x;
    dragWindowStartY = y;
    /* Capture keeps move/up on the handle once the pointer travels over the
       board. jsdom implements neither capture method, hence optional calls. */
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    const moved = toFrameDelta(
      dragStageFrame,
      event.clientX - dragPointerStartX,
      event.clientY - dragPointerStartY,
    );
    const next = {
      x: dragWindowStartX + moved.x,
      y: dragWindowStartY + moved.y,
    };
    const boundary = boundarySize(boundaryElement);
    const clamped =
      boundary === null || windowElement === null
        ? next
        : clampFieldWindowPosition(next, boundary, windowSize(windowElement));
    x = clamped.x;
    y = clamped.y;
  }

  function endDrag(event: PointerEvent & { currentTarget: HTMLElement }): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    /* Exactly one outward position per gesture, already clamped. */
    current = Object.freeze({ x, y });
    onpositionchange(current);
  }

  function documentPointerDown(event: Event): void {
    if (!dismissOnOutsideClick || windowElement === null) return;
    const origin = event.target;
    if (origin instanceof Node && windowElement.contains(origin)) return;
    ondismiss(event);
  }

  function documentKeydown(event: KeyboardEvent): void {
    if (!dismissOnEscape || event.key !== "Escape") return;
    event.preventDefault();
    ondismiss(event);
  }
</script>

<div
  class="floating-field-window"
  class:is-active={active}
  class:is-dragging={dragging}
  role="dialog"
  aria-modal="false"
  aria-label={ariaLabel}
  tabindex="-1"
  bind:this={windowElement}
  onpointerdown={raise}
  style:--window-x={`${x}px`}
  style:--window-y={`${y}px`}
  data-window-id={windowId}
  data-mode={mode}
  data-collapsed={String(collapsed)}
  data-cy={`floating-field-window-${windowId}`}
>
  <!-- svelte-ignore a11y_no_static_element_interactions (pointer dragging is a
       progressive enhancement over a window whose position is otherwise fully
       usable from the keyboard through its own controls) -->
  <div
    class="floating-field-window__handle"
    onpointerdown={startDrag}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    data-cy={`floating-field-window-${windowId}-handle`}
  >
    <slot name="handle" />
  </div>
  <div
    class="floating-field-window__content"
    data-cy={`floating-field-window-${windowId}-content`}
  >
    <slot />
  </div>
</div>

<script lang="ts">
  import type { BoardZoneView } from "../../../field/board-view-model.ts";
  import type { FieldPlacement } from "../../../field/duel-field-geometry.ts";

  export let zone: BoardZoneView;
  export let placement: FieldPlacement;
  export let actionable = false;
  export let selected = false;
  export let active = false;
  export let disabled = false;
  /* Presentation only: a local guess at where a dragged card could land. It
     never gates a response — the engine's own place prompt does that. */
  export let dropCandidate = false;
  /* Item 18: distinct emphasis for the candidate directly under the dragged
     card, with its own fade transition (declared in app.css). */
  export let dropHovered = false;
  export let onactivate: () => void = () => undefined;

  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;
  $: positionStyle = `--field-x: ${placement.x}px; --field-y: ${placement.y}px; --field-width: ${placement.width}px; --field-height: ${placement.height}px;`;

  function activate(): void {
    pointerOrigin = null;
    if (pointerMoved) {
      pointerMoved = false;
      return;
    }
    onactivate();
  }
</script>

<svelte:element
  this={actionable ? "button" : "div"}
  type={actionable ? "button" : undefined}
  class:duel-field-zone--shared={zone.player === "shared"}
  class:is-actionable={actionable}
  class:is-drop-candidate={dropCandidate}
  class:is-drop-hovered={dropHovered}
  class:is-selected={selected}
  class:is-navigation-active={active}
  class="duel-field-zone"
  role={actionable ? undefined : "group"}
  aria-label={actionable
    ? `Legal placement, Select ${zone.accessibleLabel}`
    : zone.accessibleLabel}
  aria-pressed={actionable ? selected : undefined}
  data-zone-id={zone.id}
  data-player={zone.player}
  data-zone-kind={zone.kind}
  data-drop-candidate={dropCandidate ? "true" : undefined}
  data-drop-hovered={dropHovered ? "true" : undefined}
  data-field-target={zone.targetId}
  tabindex={active ? 0 : -1}
  style={positionStyle}
  disabled={actionable ? disabled : undefined}
  onpointerdown={(event: PointerEvent) => {
    pointerOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
  }}
  onpointermove={(event: PointerEvent) => {
    if (
      pointerOrigin !== null &&
      Math.hypot(
        event.clientX - pointerOrigin.x,
        event.clientY - pointerOrigin.y,
      ) > 8
    ) {
      pointerMoved = true;
    }
  }}
  onclick={actionable ? activate : undefined}
  data-cy={`field-zone-${zone.id}`}
>
  <span
    class="duel-field-zone__slot"
    aria-hidden="true"
    data-cy={`field-zone-slot-${zone.id}`}
  ></span>
  <span aria-hidden="true" data-cy={`zone-control-label-${zone.id}`}
    >{zone.label}</span
  >
</svelte:element>

<script lang="ts">
  import type { BoardZoneView } from "../../../field/board-view-model.ts";

  export let zone: BoardZoneView;
  export let actionable = false;
  export let selected = false;
  export let active = false;
  export let disabled = false;
  /* Presentation only: a local guess at where a dragged card could land. It
     never gates a response — the engine's own place prompt does that. */
  export let dropCandidate = false;
  export let onactivate: () => void = () => undefined;

  let pointerOrigin: { readonly x: number; readonly y: number } | null = null;
  let pointerMoved = false;
  $: positionStyle = `--field-x: ${zone.x * 100}%; --field-y: ${zone.y * 100}%; --field-width: ${zone.width * 100}%; --field-height: ${zone.height * 100}%;`;

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
  <span aria-hidden="true" data-cy={`zone-control-label-${zone.id}`}
    >{zone.label}</span
  >
</svelte:element>

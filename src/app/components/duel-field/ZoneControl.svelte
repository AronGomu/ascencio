<script lang="ts">
  import type { BoardZoneView } from "../../../field/board-view-model.ts";

  export let zone: BoardZoneView;
  export let actionable = false;
  export let selected = false;
  export let disabled = false;
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
  class:is-selected={selected}
  class="duel-field-zone"
  role={actionable ? undefined : "group"}
  aria-label={actionable ? `Select ${zone.label}` : zone.label}
  aria-pressed={actionable ? selected : undefined}
  data-zone-id={zone.id}
  data-player={zone.player}
  data-zone-kind={zone.kind}
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
>
  <span aria-hidden="true">{zone.label}</span>
</svelte:element>

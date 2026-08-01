<script lang="ts">
  import type { BoardZoneView } from "../../../field/board-view-model.ts";

  export let zone: BoardZoneView;

  $: positionStyle = `--field-x: ${zone.x * 100}%; --field-y: ${zone.y * 100}%; --field-width: ${zone.width * 100}%; --field-height: ${zone.height * 100}%;`;
</script>

<div
  class:duel-field-zone--shared={zone.player === "shared"}
  class="duel-field-zone"
  role="group"
  aria-label={zone.label}
  data-zone-id={zone.id}
  data-player={zone.player}
  data-zone-kind={zone.kind}
  style={positionStyle}
>
  <span aria-hidden="true">{zone.label}</span>
</div>

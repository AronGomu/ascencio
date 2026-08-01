<script lang="ts">
  import type { BoardStackView } from "../../../field/board-view-model.ts";

  export let stack: BoardStackView;

  $: positionStyle = `--field-x: ${stack.x * 100}%; --field-y: ${stack.y * 100}%; --field-width: ${stack.width * 100}%; --field-height: ${stack.height * 100}%;`;
</script>

<div
  class="duel-field-stack"
  role="group"
  aria-label={stack.label}
  data-player={stack.player}
  data-stack-id={stack.id}
  data-stack-zone={stack.zone}
  style={positionStyle}
>
  <span class="duel-field-stack__name" aria-hidden="true">
    {stack.zone === "graveyard" ? "GY" : stack.zone}
  </span>
  <strong class="duel-field-stack__count" aria-hidden="true">
    {stack.count}
  </strong>
</div>

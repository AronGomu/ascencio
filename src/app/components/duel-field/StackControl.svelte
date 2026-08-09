<script lang="ts">
  import type { BoardStackView } from "../../../field/board-view-model.ts";

  export let stack: BoardStackView;
  export let active = false;

  $: positionStyle = `--field-x: ${stack.x * 100}%; --field-y: ${stack.y * 100}%; --field-width: ${stack.width * 100}%; --field-height: ${stack.height * 100}%;`;
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (stack participates in spatial roving focus) -->
<div
  class:is-navigation-active={active}
  class="duel-field-stack"
  role="group"
  aria-label={stack.label}
  data-field-target={stack.targetId}
  tabindex={active ? 0 : -1}
  data-player={stack.player}
  data-stack-id={stack.id}
  data-stack-zone={stack.zone}
  style={positionStyle}
  data-cy={`field-stack-${stack.id}`}
>
  <span
    class="duel-field-stack__name"
    aria-hidden="true"
    data-cy={`stack-control-name-${stack.id}`}
  >
    {stack.zone === "graveyard" ? "GY" : stack.zone}
  </span>
  <strong
    class="duel-field-stack__count"
    aria-hidden="true"
    data-cy={`stack-control-count-${stack.id}`}
  >
    {stack.count}
  </strong>
</div>

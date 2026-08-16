<script lang="ts">
  import type { BoardCardView } from "../../../field/board-view-model.ts";
  import type { InteractionChoice } from "../../prompts/interaction-spec.ts";
  import CardActionChips from "./CardActionChips.svelte";

  export let card: BoardCardView;
  export let anchor: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  export let imageUrl: string;
  export let choices: readonly InteractionChoice[] = [];
  export let disabled = false;
  export let scale = 1.6;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let ondismiss: () => void = () => undefined;
  export let onpointerenter: () => void = () => undefined;
  export let onpointerleave: () => void = () => undefined;

  $: w = anchor.width * scale;
  $: h = anchor.height * scale;
  $: left = Math.max(
    8,
    Math.min(
      anchor.left + anchor.width / 2 - w / 2,
      (typeof globalThis.innerWidth === "number"
        ? globalThis.innerWidth
        : 1280) -
        w -
        8,
    ),
  );
  $: top = Math.max(8, anchor.top + anchor.height - h);
  $: overlayStyle = `left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px;`;
</script>

<div
  class="hand-zoom-overlay"
  data-cy={`hand-zoom-overlay-${card.id}`}
  style={overlayStyle}
  {onpointerenter}
  {onpointerleave}
>
  {#if choices.length > 0}
    <CardActionChips
      cardId={card.id}
      cardLabel={card.label}
      {choices}
      {disabled}
      {onchoose}
      {ondismiss}
    />
  {/if}
  <img
    class="hand-zoom-overlay__art"
    data-cy={`hand-zoom-overlay-image-${card.id}`}
    src={imageUrl}
    alt={card.label}
  />
  <span
    class="hand-zoom-overlay__name"
    data-cy={`hand-zoom-overlay-name-${card.id}`}>{card.label}</span
  >
</div>

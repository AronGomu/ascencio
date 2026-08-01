<script lang="ts">
  import type { BoardViewModel } from "../../../field/board-view-model.ts";
  import CardControl from "./CardControl.svelte";
  import StackControl from "./StackControl.svelte";
  import ZoneControl from "./ZoneControl.svelte";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string>;
  export let cardBackUrl: string;
  export let placeholderUrl: string;

  function cardImageUrl(card: BoardViewModel["cards"][number]): string {
    if (card.image.kind === "back") return cardBackUrl;
    return imageUrls.get(card.image.code) ?? placeholderUrl;
  }
</script>

<div class="duel-field-board" role="group" aria-label="Standard duel board">
  <div class="duel-field-board__surface" aria-hidden="true"></div>
  {#each board.zones as zone (zone.id)}
    <ZoneControl {zone} />
  {/each}
  {#each board.stacks as stack (stack.targetId)}
    <StackControl {stack} />
  {/each}
  {#each board.cards as card (card.id)}
    <CardControl {card} imageUrl={cardImageUrl(card)} />
  {/each}
</div>

<script lang="ts">
  import type { BoardViewModel } from "../../field/board-view-model.ts";
  import FieldBoard from "./duel-field/FieldBoard.svelte";

  const EMPTY_IMAGE_URLS: ReadonlyMap<number, string> = new Map();
  const DEFAULT_CARD_BACK =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2314263c'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%2373daca' stroke-width='3'/%3E%3Cpath d='m12 84 48-64M12 60l32-40M28 92l32-40' stroke='%2346637f' stroke-width='4'/%3E%3C/svg%3E";
  const DEFAULT_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2318243b'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%23697895' stroke-width='2'/%3E%3Ctext x='36' y='57' fill='%23a9b5ca' font-size='28' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string> = EMPTY_IMAGE_URLS;
  export let cardBackUrl = DEFAULT_CARD_BACK;
  export let placeholderUrl = DEFAULT_PLACEHOLDER;

  $: resolvedCardBackUrl = cardBackUrl || DEFAULT_CARD_BACK;
  $: resolvedPlaceholderUrl = placeholderUrl || DEFAULT_PLACEHOLDER;
</script>

<section class="duel-field" aria-label="Duel field">
  <h2 class="visually-hidden">Duel field</h2>
  <FieldBoard
    {board}
    {imageUrls}
    cardBackUrl={resolvedCardBackUrl}
    placeholderUrl={resolvedPlaceholderUrl}
  />
</section>

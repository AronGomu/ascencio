<script lang="ts">
  import type { BoardCardView } from "../../../field/board-view-model.ts";

  export let card: BoardCardView;
  export let imageUrl: string;

  $: positionStyle = `--field-x: ${card.x * 100}%; --field-y: ${card.y * 100}%; --field-width: ${card.width * 100}%; --field-height: ${card.height * 100}%;`;
  $: accessibleLabel =
    card.facing === "opponent" &&
    !card.label.toLocaleLowerCase().includes("opponent")
      ? `Opponent controlled, ${card.label}`
      : card.label;
</script>

<article
  class:is-hidden={card.hidden}
  class:is-opponent={card.facing === "opponent"}
  class:is-sideways={card.orientation === "sideways"}
  class="duel-field-card"
  aria-label={accessibleLabel}
  data-card-id={card.id}
  data-facing={card.facing}
  data-hidden={card.hidden}
  data-orientation={card.orientation}
  data-position={card.position}
  data-card-zone-id={card.zoneId}
  style={positionStyle}
>
  <div class="duel-field-card__art">
    <img
      src={imageUrl}
      alt={card.hidden ? "" : accessibleLabel}
      aria-hidden={card.hidden}
      decoding="async"
    />
  </div>
  <span class="duel-field-card__label" aria-hidden="true">
    {card.hidden ? "Hidden card" : card.label}
  </span>
</article>

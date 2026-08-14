<script lang="ts">
  import type { PlayerIndex } from "../../../duel/contracts/public-duel-state.ts";
  import type {
    BoardCardView,
    BoardTargetId,
    BoardZoneView,
  } from "../../../field/board-view-model.ts";
  import type { FieldPlacement } from "../../../field/duel-field-geometry.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import type { CardDragOrigin } from "../../presentation/drag-ghost-physics.ts";
  import OverlayScrollbar from "../OverlayScrollbar.svelte";
  import CardControl from "./CardControl.svelte";

  export let player: PlayerIndex;
  export let cards: readonly BoardCardView[];
  export let zone: BoardZoneView;
  export let placement: FieldPlacement;
  export let imageUrls: ReadonlyMap<number, string>;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  export let spec: ActiveInteractionSpec | null = null;
  export let selectedTargets: ReadonlySet<BoardTargetId> = new Set();
  export let activeTarget: BoardTargetId | null = null;
  export let disabled = false;
  export let pinnedTarget: BoardTargetId | null = null;
  export let oncardactivate: (
    card: BoardCardView,
    element: HTMLButtonElement,
  ) => void = () => undefined;
  export let oncardchoose: (choice: InteractionChoice) => void = () =>
    undefined;
  export let oncarddismiss: () => void = () => undefined;
  export let oncarddragstart: (
    card: BoardCardView,
    origin: CardDragOrigin,
  ) => void = () => undefined;
  export let oncarddragmove: (x: number, y: number) => void = () => undefined;
  export let oncarddragend: (x: number, y: number) => void = () => undefined;
  export let oncardpreview: (card: BoardCardView) => void = () => undefined;

  const mirrored = player === 1;
  let viewportElement: HTMLDivElement | null = null;

  $: sortedCards = [...cards].sort(
    (left, right) => left.sequence - right.sequence,
  );
  $: contentSizeKey = `${placement.width}:${sortedCards.map((card) => card.id).join(",")}`;

  function cardImageUrl(card: BoardCardView): string {
    if (card.image.kind === "back") return cardBackUrl;
    return imageUrls.get(card.image.code) ?? placeholderUrl;
  }
</script>

<div
  class="duel-field-hand-band"
  class:is-opponent={mirrored}
  style={`--field-x: ${placement.x}px; --field-y: ${placement.y}px; --field-width: ${placement.width}px; --field-height: ${placement.height}px;`}
  role="group"
  aria-label={zone.accessibleLabel}
  data-feedback-zone-id={zone.id}
  data-cy={`field-hand-band-p${player}`}
  data-player={player}
>
  <div
    class="duel-field-hand-band__viewport"
    tabindex="-1"
    bind:this={viewportElement}
    data-cy={`field-hand-p${player}-viewport`}
  >
    {#each sortedCards as card (card.id)}
      <CardControl
        {card}
        layout="hand"
        imageUrl={cardImageUrl(card)}
        {imageLibrary}
        interactionKind={!disabled &&
        spec?.cardChoices.has(card.targetId) === true
          ? spec.kind
          : null}
        actionable={!disabled && spec?.cardChoices.has(card.targetId) === true}
        selected={selectedTargets.has(card.targetId)}
        active={activeTarget === card.targetId}
        {disabled}
        choices={spec?.cardChoices.get(card.targetId) ?? []}
        pinned={pinnedTarget === card.targetId}
        draggable={!disabled &&
          spec?.kind === "cardAction" &&
          spec.cardChoices.has(card.targetId) &&
          card.zoneId === zone.id}
        onactivate={(element) => oncardactivate(card, element)}
        onchoose={oncardchoose}
        ondismiss={oncarddismiss}
        ondragstart={(origin) => oncarddragstart(card, origin)}
        ondragmove={oncarddragmove}
        ondragend={oncarddragend}
        onpreview={() => oncardpreview(card)}
      />
    {/each}
  </div>
  <span
    class="duel-field-hand-band__count"
    data-cy={`field-hand-p${player}-count`}
  >
    {sortedCards.length}
  </span>
  <OverlayScrollbar
    axis="horizontal"
    scrollElement={viewportElement}
    {contentSizeKey}
    dataCyPrefix={`field-hand-p${player}`}
  />
</div>

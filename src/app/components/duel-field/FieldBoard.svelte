<script lang="ts">
  import type {
    BoardCardView,
    BoardTargetId,
    BoardViewModel,
    BoardZoneView,
  } from "../../../field/board-view-model.ts";
  import type { ActiveInteractionSpec } from "../../prompts/interaction-spec.ts";
  import CardControl from "./CardControl.svelte";
  import StackControl from "./StackControl.svelte";
  import ZoneControl from "./ZoneControl.svelte";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string>;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  export let spec: ActiveInteractionSpec | null = null;
  export let selectedTargets: ReadonlySet<BoardTargetId> = new Set();
  export let disabled = false;
  export let oncardactivate: (
    card: BoardCardView,
    element: HTMLButtonElement,
  ) => void = () => undefined;
  export let onzoneactivate: (zone: BoardZoneView) => void = () => undefined;
  export let oninspect: (card: BoardCardView) => void = () => undefined;

  function cardImageUrl(card: BoardViewModel["cards"][number]): string {
    if (card.image.kind === "back") return cardBackUrl;
    return imageUrls.get(card.image.code) ?? placeholderUrl;
  }
</script>

<div class="duel-field-board" role="group" aria-label="Standard duel board">
  <div class="duel-field-board__surface" aria-hidden="true"></div>
  {#each board.zones as zone (zone.id)}
    <ZoneControl
      {zone}
      actionable={spec?.zoneChoices.has(zone.targetId) === true}
      selected={selectedTargets.has(zone.targetId)}
      {disabled}
      onactivate={() => onzoneactivate(zone)}
    />
  {/each}
  {#each board.stacks as stack (stack.targetId)}
    <StackControl {stack} />
  {/each}
  {#each board.cards as card (card.id)}
    <CardControl
      {card}
      imageUrl={cardImageUrl(card)}
      interactionKind={spec?.cardChoices.has(card.targetId) === true
        ? spec.kind
        : null}
      actionable={spec?.cardChoices.has(card.targetId) === true}
      selected={selectedTargets.has(card.targetId)}
      {disabled}
      onactivate={(element) => oncardactivate(card, element)}
      oninspect={() => oninspect(card)}
    />
  {/each}
</div>

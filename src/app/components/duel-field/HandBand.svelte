<script lang="ts">
  import { tick } from "svelte";
  import type { PlayerIndex } from "../../../duel/contracts/public-duel-state.ts";
  import type {
    BoardCardView,
    BoardTargetId,
    BoardZoneView,
  } from "../../../field/board-view-model.ts";
  import { handPage, HAND_PAGE_SIZE } from "../../../field/hand-pagination.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import type { CardDragOrigin } from "../../presentation/drag-ghost-physics.ts";
  import CardControl from "./CardControl.svelte";

  export let player: PlayerIndex;
  export let cards: readonly BoardCardView[];
  export let zone: BoardZoneView;
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

  /* `requestedPage` is only ever written explicitly (arrow click, active-target
     jump). `pageResult` derives from it every render and is the single
     source of truth for what is actually displayed/clamped — never written
     back into `requestedPage`, which would create a reactive cycle. */
  let requestedPage = 0;
  let previousActiveTarget: BoardTargetId | null = null;
  let viewportElement: HTMLDivElement;
  let lastResetPage = -1;

  $: sortedCards = [...cards].sort(
    (left, right) => left.sequence - right.sequence,
  );
  $: syncPageWithActiveTarget(activeTarget, sortedCards);
  $: pageResult = handPage(sortedCards, requestedPage);
  $: void resetScrollOnPageChange(pageResult.page);

  function syncPageWithActiveTarget(
    nextTarget: BoardTargetId | null,
    sorted: readonly BoardCardView[],
  ): void {
    if (nextTarget === previousActiveTarget) return;
    previousActiveTarget = nextTarget;
    if (nextTarget === null) return;
    const activeIndex = sorted.findIndex(
      (card) => card.targetId === nextTarget,
    );
    if (activeIndex >= 0)
      requestedPage = Math.floor(activeIndex / HAND_PAGE_SIZE);
  }

  function cardImageUrl(card: BoardCardView): string {
    if (card.image.kind === "back") return cardBackUrl;
    return imageUrls.get(card.image.code) ?? placeholderUrl;
  }

  function goToPreviousPage(): void {
    if (pageResult.canPrevious) requestedPage = pageResult.page - 1;
  }

  function goToNextPage(): void {
    if (pageResult.canNext) requestedPage = pageResult.page + 1;
  }

  async function resetScrollOnPageChange(currentPage: number): Promise<void> {
    if (currentPage === lastResetPage) return;
    lastResetPage = currentPage;
    await tick();
    if (viewportElement == null || !viewportElement.isConnected) return;
    viewportElement.scrollLeft = mirrored
      ? viewportElement.scrollWidth - viewportElement.clientWidth
      : 0;
  }
</script>

<!--
  `role=group`/`aria-label` give the band the same accessible-name
  invariant every other physical zone offers. `data-feedback-zone-id`
  (deliberately not `data-zone-id`, which the drag-drop hit test treats
  as a legal drop-target boundary) anchors the DOM feedback controller's
  card-move line/highlight lookup for `zone:p{player}:hand`. No border,
  background or visible label span is painted here — those are what this
  ticket removes.
-->
<div
  class="duel-field-hand-band"
  class:is-opponent={mirrored}
  style={`--field-x: ${zone.x * 100}%; --field-y: ${zone.y * 100}%; --field-width: ${zone.width * 100}%;`}
  role="group"
  aria-label={zone.accessibleLabel}
  data-feedback-zone-id={zone.id}
  data-cy={`field-hand-band-p${player}`}
  data-player={player}
>
  <!--
    DOM order deliberately puts the viewport (the hand's own, roving-
    tabindex-managed card buttons) ahead of the arrows in source order:
    both arrows carry `tabindex="-1"` (pointer/click-only, matching every
    other board control's roving-focus-only model — T8 adds no new native
    Tab stop) and CSS `order` alone restores the previous/viewport/next
    visual layout. This keeps a hand card's own actionable button, not a
    disabled page arrow, the first `[role=button]` a caller finds by DOM
    order inside this band.
  -->
  <div class="duel-field-hand-band__row" data-cy={`field-hand-p${player}-row`}>
    <!--
      Chromium implicitly makes an overflowing `overflow-x:auto` element a
      Tab stop (so bare native keyboard scrolling reaches it) once its
      content actually overflows. That would add a second Tab stop inside
      the board on top of the roving-tabindex card buttons — explicit
      `tabindex="-1"` opts back out; wheel/trackpad scroll and the cards'
      own roving Arrow-key navigation (which scrolls a newly active card
      into view) are unaffected.
    -->
    <div
      class="duel-field-hand-band__viewport"
      tabindex="-1"
      bind:this={viewportElement}
      data-cy={`field-hand-p${player}-viewport`}
    >
      {#each pageResult.items as card (card.id)}
        <CardControl
          {card}
          layout="hand"
          imageUrl={cardImageUrl(card)}
          {imageLibrary}
          interactionKind={!disabled &&
          spec?.cardChoices.has(card.targetId) === true
            ? spec.kind
            : null}
          actionable={!disabled &&
            spec?.cardChoices.has(card.targetId) === true}
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
    <button
      type="button"
      class="duel-field-hand-band__arrow duel-field-hand-band__arrow--previous"
      tabindex="-1"
      disabled={!pageResult.canPrevious}
      aria-label={`Previous ${pageResult.pageCount > 1 ? "hand page" : "hand page (none)"}`}
      onclick={goToPreviousPage}
      data-cy={`field-hand-p${player}-previous`}
    >
      ‹
    </button>
    <button
      type="button"
      class="duel-field-hand-band__arrow duel-field-hand-band__arrow--next"
      tabindex="-1"
      disabled={!pageResult.canNext}
      aria-label={`Next ${pageResult.pageCount > 1 ? "hand page" : "hand page (none)"}`}
      onclick={goToNextPage}
      data-cy={`field-hand-p${player}-next`}
    >
      ›
    </button>
  </div>
  <span
    class="visually-hidden"
    aria-live="polite"
    data-cy={`field-hand-p${player}-page-status`}
  >
    {`Page ${pageResult.page + 1} of ${pageResult.pageCount}`}
  </span>
</div>

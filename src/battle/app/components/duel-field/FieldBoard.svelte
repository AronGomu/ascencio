<script lang="ts">
  import { tick } from "svelte";
  import type {
    BoardCardView,
    BoardStackView,
    BoardTargetId,
    BoardViewModel,
    BoardZoneView,
  } from "../../../field/board-view-model.ts";
  import {
    createFieldNavigationState,
    reduceFieldNavigation,
    type FieldNavigationKey,
    type FieldNavigationState,
  } from "../../prompts/field-navigation.ts";
  import type { PhysicalZoneId } from "../../../field/duel-field-layout.ts";
  import {
    ZONE_GAP,
    type FieldPlacement,
    type FieldRenderLayout,
  } from "../../../field/duel-field-geometry.ts";
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import type { CardDragOrigin } from "../../presentation/drag-ghost-physics.ts";
  import CardControl from "./CardControl.svelte";
  import HandBand from "./HandBand.svelte";
  import StackControl from "./StackControl.svelte";
  import ZoneControl from "./ZoneControl.svelte";

  export let board: BoardViewModel;
  export let renderLayout: FieldRenderLayout;
  export let imageUrls: ReadonlyMap<number, string>;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  export let spec: ActiveInteractionSpec | null = null;
  export let selectedTargets: ReadonlySet<BoardTargetId> = new Set();
  export let disabled = false;
  export let pinnedTarget: BoardTargetId | null = null;
  export let dropCandidates: ReadonlySet<PhysicalZoneId> = new Set();
  /* Item 18: the candidate zone directly under the dragged card, distinct
     from the rest of `dropCandidates`, so it can carry its own emphasis. */
  export let dropHoveredZoneId: PhysicalZoneId | null = null;
  export let showZoneOutlines = true;
  export let showZoneCounts = true;
  export let oncardactivate: (
    card: BoardCardView,
    element: HTMLButtonElement,
  ) => void = () => undefined;
  export let onzoneactivate: (zone: BoardZoneView) => void = () => undefined;
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
  export let onstackpreview: (stack: BoardStackView) => void = () => undefined;
  export let onstackactivate: (stack: BoardStackView) => void = () => undefined;
  export let oncardzoomenter: (
    card: BoardCardView,
    element: HTMLElement,
  ) => void = () => undefined;
  export let oncardzoomleave: (related: EventTarget | null) => void = () =>
    undefined;

  let boardElement: HTMLDivElement;
  let navigationState: FieldNavigationState = createFieldNavigationState();

  $: fieldZones = board.zones.filter((zone) => zone.kind !== "hand");
  $: fieldCards = board.cards.filter(
    (card) => card.zoneId !== "p0:hand" && card.zoneId !== "p1:hand",
  );
  $: playerHandZone = board.zones.find((zone) => zone.id === "p0:hand");
  $: opponentHandZone = board.zones.find((zone) => zone.id === "p1:hand");
  $: playerHandCards = board.cards.filter((card) => card.zoneId === "p0:hand");
  $: opponentHandCards = board.cards.filter(
    (card) => card.zoneId === "p1:hand",
  );

  $: actionableTargets = new Set<BoardTargetId>(
    disabled
      ? []
      : [
          ...(spec?.cardChoices.keys() ?? []),
          ...(spec?.zoneChoices.keys() ?? []),
          ...(spec?.stackChoices.keys() ?? []),
        ],
  );
  $: navigationContext =
    spec === null
      ? "inactive"
      : `${spec.key.workerGeneration}:${spec.key.sessionGeneration}:${spec.key.promptId}`;
  $: synchronizeNavigation(board, actionableTargets, navigationContext);

  function placementFor(
    layout: FieldRenderLayout,
    zoneId: PhysicalZoneId,
  ): FieldPlacement {
    const placement = layout.zones.get(zoneId);
    if (placement === undefined)
      throw new Error(`Missing field render placement for ${zoneId}`);
    return placement;
  }

  function cardImageUrl(card: BoardViewModel["cards"][number]): string {
    if (card.image.kind === "back") return cardBackUrl;
    return imageUrls.get(card.image.code) ?? placeholderUrl;
  }

  function synchronizeNavigation(
    value: BoardViewModel,
    actionable: ReadonlySet<BoardTargetId>,
    context: string,
  ): void {
    const shouldRestoreFocus =
      boardElement?.contains(document.activeElement) ?? false;
    const next = reduceFieldNavigation(navigationState, {
      type: "synchronize",
      board: value,
      actionableTargets: actionable,
      context,
    });
    if (next === navigationState) return;
    navigationState = next;
    if (shouldRestoreFocus) void focusActiveTarget();
  }

  function fieldTarget(event: Event): HTMLElement | null {
    const origin = event.target;
    return origin instanceof Element
      ? origin.closest<HTMLElement>("[data-field-target]")
      : null;
  }

  function focusTarget(event: FocusEvent): void {
    const target = fieldTarget(event)?.dataset.fieldTarget as
      BoardTargetId | undefined;
    if (target === undefined) return;
    navigationState = reduceFieldNavigation(navigationState, {
      type: "focus",
      board,
      target,
    });
  }

  function navigate(event: KeyboardEvent): void {
    if (!isNavigationKey(event.key) || fieldTarget(event) === null) return;
    event.preventDefault();
    navigationState = reduceFieldNavigation(navigationState, {
      type: "move",
      board,
      key: event.key,
    });
    void focusActiveTarget();
  }

  async function focusActiveTarget(): Promise<void> {
    await tick();
    if (navigationState.activeTarget === null) return;
    /* Svelte nulls the `bind:this` ref as the element unmounts, which can land
       while this microtask is suspended. Nothing left to focus, then. */
    const target = [
      ...(boardElement?.querySelectorAll<HTMLElement>("[data-field-target]") ??
        []),
    ].find(
      (element) => element.dataset.fieldTarget === navigationState.activeTarget,
    );
    target?.focus({ preventScroll: true });
    if (typeof target?.scrollIntoView === "function")
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function isNavigationKey(key: string): key is FieldNavigationKey {
    return (
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "Home" ||
      key === "End"
    );
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions (delegated events implement roving focus for named controls) -->
<div
  class="duel-field-board"
  role="group"
  aria-label="Standard duel board"
  aria-describedby="duel-field-keyboard-help"
  bind:this={boardElement}
  onfocusin={focusTarget}
  onkeydown={navigate}
  style={`--zone-gap: ${ZONE_GAP}px;`}
  data-cy="duel-field-board"
  data-zone-outlines={showZoneOutlines ? "true" : "false"}
  data-zone-counts={showZoneCounts ? "true" : "false"}
>
  <span
    id="duel-field-keyboard-help"
    class="visually-hidden"
    data-cy="duel-field-board-keyboard-help"
  >
    Use Arrow keys to move between field controls. Home and End move to row
    edges. Enter or Space activates a legal control.
  </span>
  <div
    class="duel-field-board__surface"
    aria-hidden="true"
    data-cy="duel-field-board-surface"
  ></div>
  {#each fieldZones as zone (zone.id)}
    <ZoneControl
      {zone}
      placement={placementFor(renderLayout, zone.id)}
      actionable={!disabled && spec?.zoneChoices.has(zone.targetId) === true}
      selected={selectedTargets.has(zone.targetId)}
      active={navigationState.activeTarget === zone.targetId}
      {disabled}
      dropCandidate={dropCandidates.has(zone.id)}
      dropHovered={dropHoveredZoneId === zone.id}
      onactivate={() => onzoneactivate(zone)}
    />
  {/each}
  {#if playerHandZone !== undefined}
    <HandBand
      player={0}
      cards={playerHandCards}
      zone={playerHandZone}
      placement={placementFor(renderLayout, playerHandZone.id)}
      {imageUrls}
      {imageLibrary}
      {cardBackUrl}
      {placeholderUrl}
      {spec}
      {selectedTargets}
      activeTarget={navigationState.activeTarget}
      {disabled}
      {pinnedTarget}
      {oncardactivate}
      {oncardchoose}
      {oncarddismiss}
      {oncarddragstart}
      {oncarddragmove}
      {oncarddragend}
      {oncardpreview}
      {oncardzoomenter}
      {oncardzoomleave}
    />
  {/if}
  {#if opponentHandZone !== undefined}
    <HandBand
      player={1}
      cards={opponentHandCards}
      zone={opponentHandZone}
      placement={placementFor(renderLayout, opponentHandZone.id)}
      {imageUrls}
      {imageLibrary}
      {cardBackUrl}
      {placeholderUrl}
      {spec}
      {selectedTargets}
      activeTarget={navigationState.activeTarget}
      {disabled}
      {pinnedTarget}
      {oncardactivate}
      {oncardchoose}
      {oncarddismiss}
      {oncarddragstart}
      {oncarddragmove}
      {oncarddragend}
      {oncardpreview}
      {oncardzoomenter}
      {oncardzoomleave}
    />
  {/if}
  {#each board.stacks as stack (stack.targetId)}
    <StackControl
      {stack}
      placement={placementFor(renderLayout, stack.id)}
      active={navigationState.activeTarget === stack.targetId}
      actionable={!disabled && spec?.stackChoices.has(stack.targetId) === true}
      onpreview={() => onstackpreview(stack)}
      onactivate={() => onstackactivate(stack)}
      {imageLibrary}
      {placeholderUrl}
      {cardBackUrl}
    />
  {/each}
  {#each fieldCards as card (card.id)}
    <CardControl
      {card}
      placement={placementFor(renderLayout, card.zoneId)}
      imageUrl={cardImageUrl(card)}
      {imageLibrary}
      interactionKind={!disabled &&
      spec?.cardChoices.has(card.targetId) === true
        ? spec.kind
        : null}
      actionable={!disabled && spec?.cardChoices.has(card.targetId) === true}
      selected={selectedTargets.has(card.targetId)}
      active={navigationState.activeTarget === card.targetId}
      {disabled}
      choices={spec?.cardChoices.get(card.targetId) ?? []}
      pinned={pinnedTarget === card.targetId}
      draggable={false}
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

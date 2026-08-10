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
  import type { CardImageLibrary } from "../../images/card-image-cache.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";
  import CardControl from "./CardControl.svelte";
  import StackControl from "./StackControl.svelte";
  import ZoneControl from "./ZoneControl.svelte";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string>;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  export let spec: ActiveInteractionSpec | null = null;
  export let selectedTargets: ReadonlySet<BoardTargetId> = new Set();
  export let disabled = false;
  export let pinnedTarget: BoardTargetId | null = null;
  export let dropCandidates: ReadonlySet<PhysicalZoneId> = new Set();
  export let oncardactivate: (
    card: BoardCardView,
    element: HTMLButtonElement,
  ) => void = () => undefined;
  export let onzoneactivate: (zone: BoardZoneView) => void = () => undefined;
  export let oncardchoose: (choice: InteractionChoice) => void = () =>
    undefined;
  export let oncarddismiss: () => void = () => undefined;
  export let oncarddragstart: (card: BoardCardView) => void = () => undefined;
  export let oncarddragmove: (x: number, y: number) => void = () => undefined;
  export let oncarddragend: (x: number, y: number) => void = () => undefined;
  export let oncardpreview: (card: BoardCardView) => void = () => undefined;
  export let onstackpreview: (stack: BoardStackView) => void = () => undefined;

  let boardElement: HTMLDivElement;
  let navigationState: FieldNavigationState = createFieldNavigationState();

  $: actionableTargets = new Set<BoardTargetId>(
    disabled
      ? []
      : [
          ...(spec?.cardChoices.keys() ?? []),
          ...(spec?.zoneChoices.keys() ?? []),
        ],
  );
  $: navigationContext =
    spec === null
      ? "inactive"
      : `${spec.key.workerGeneration}:${spec.key.sessionGeneration}:${spec.key.promptId}`;
  $: synchronizeNavigation(board, actionableTargets, navigationContext);

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
  data-cy="duel-field-board"
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
  {#each board.zones as zone (zone.id)}
    <ZoneControl
      {zone}
      actionable={!disabled && spec?.zoneChoices.has(zone.targetId) === true}
      selected={selectedTargets.has(zone.targetId)}
      active={navigationState.activeTarget === zone.targetId}
      {disabled}
      dropCandidate={dropCandidates.has(zone.id)}
      onactivate={() => onzoneactivate(zone)}
    />
  {/each}
  {#each board.stacks as stack (stack.targetId)}
    <StackControl
      {stack}
      active={navigationState.activeTarget === stack.targetId}
      onpreview={() => onstackpreview(stack)}
    />
  {/each}
  {#each board.cards as card (card.id)}
    <CardControl
      {card}
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
      draggable={!disabled &&
        spec?.kind === "cardAction" &&
        spec.cardChoices.has(card.targetId) &&
        card.zoneId === "p0:hand"}
      onactivate={(element) => oncardactivate(card, element)}
      onchoose={oncardchoose}
      ondismiss={oncarddismiss}
      ondragstart={() => oncarddragstart(card)}
      ondragmove={oncarddragmove}
      ondragend={oncarddragend}
      onpreview={() => oncardpreview(card)}
    />
  {/each}
</div>

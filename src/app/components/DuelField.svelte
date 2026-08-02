<script lang="ts">
  import { onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
  import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
  import type { CardImageLibrary } from "../images/card-image-cache.ts";
  import type {
    BoardCardView,
    BoardTargetId,
    BoardViewModel,
    BoardZoneView,
  } from "../../field/board-view-model.ts";
  import {
    createInactiveInteractionSession,
    interactionSessionChoiceIds,
    type InteractionSession,
    type InteractionSessionAction,
    type UnkeyedInteractionSessionAction,
  } from "../prompts/interaction-session.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../prompts/interaction-spec.ts";
  import { validatePromptSelection } from "../prompts/prompt-selection.ts";
  import {
    createDomFeedbackController,
    EMPTY_DOM_FEEDBACK_STATE,
    type DomFeedbackController,
    type DomFeedbackState,
  } from "../presentation/dom-feedback-controller.ts";
  import { presentationCommandForDomEvent } from "../presentation/presentation-command.ts";
  import FieldActionMenu from "./duel-field/FieldActionMenu.svelte";
  import FieldBoard from "./duel-field/FieldBoard.svelte";
  import FieldLines from "./duel-field/FieldLines.svelte";
  import SelectionDock from "./duel-field/SelectionDock.svelte";

  const EMPTY_IMAGE_URLS: ReadonlyMap<number, string> = new Map();
  const EMPTY_TARGETS: ReadonlySet<BoardTargetId> = new Set();
  const DEFAULT_CARD_BACK =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2314263c'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%2373daca' stroke-width='3'/%3E%3Cpath d='m12 84 48-64M12 60l32-40M28 92l32-40' stroke='%2346637f' stroke-width='4'/%3E%3C/svg%3E";
  const DEFAULT_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2318243b'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%23697895' stroke-width='2'/%3E%3Ctext x='36' y='57' fill='%23a9b5ca' font-size='28' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string> = EMPTY_IMAGE_URLS;
  export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
  export let cardBackUrl = DEFAULT_CARD_BACK;
  export let placeholderUrl = DEFAULT_PLACEHOLDER;
  export let prompt: PlayerPrompt | null = null;
  export let spec: ActiveInteractionSpec | null = null;
  export let session: InteractionSession = createInactiveInteractionSession();
  export let pending = false;
  export let presentationEvents: readonly {
    readonly sequence: number;
    readonly event: DuelPresentationEvent;
  }[] = [];
  export let feedbackGeneration = "component";
  export let reducedMotion: boolean | null = null;
  export let injectFailure: boolean = false;
  export let oninteraction: (
    action: InteractionSessionAction,
  ) => unknown = () => false;
  export let oninspect: (card: BoardCardView) => void = () => undefined;

  if (injectFailure) throw new Error("Injected duel field component failure");

  interface FieldMenuAnchor {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
  }

  let fieldRoot: HTMLElement;
  let feedbackController: DomFeedbackController | null = null;
  let feedbackState: DomFeedbackState = EMPTY_DOM_FEEDBACK_STATE;
  let mediaReducedMotion = false;
  let effectiveReducedMotion = false;
  let observedBoard: BoardViewModel | null = null;
  let deferredPresentationEvents: typeof presentationEvents = [];
  let activeFeedbackGeneration: string | null = null;
  let lastPresentationSequence = 0;
  let appliedReducedMotion: boolean | null = null;
  let feedbackSyncSequence = 0;
  let anchorElement: HTMLButtonElement | null = null;
  let anchor: FieldMenuAnchor | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let menuCard: BoardCardView | null = null;

  $: resolvedCardBackUrl = cardBackUrl || DEFAULT_CARD_BACK;
  $: effectiveReducedMotion = reducedMotion ?? mediaReducedMotion;
  $: scheduleFeedbackSync(
    feedbackController,
    feedbackGeneration,
    presentationEvents,
    effectiveReducedMotion,
    board,
  );
  $: resolvedPlaceholderUrl = placeholderUrl || DEFAULT_PLACEHOLDER;
  $: selectedTargets =
    spec === null ? EMPTY_TARGETS : targetSelections(spec, session);
  $: submittedChoiceIds =
    spec === null ? [] : interactionSessionChoiceIds(session, spec);
  $: validation =
    prompt === null || spec === null
      ? { valid: false as const, message: "No active field decision" }
      : validatePromptSelection(prompt, submittedChoiceIds);
  $: menuChoices =
    spec !== null && session.menuTarget !== null
      ? (spec.cardChoices.get(session.menuTarget) ?? [])
      : [];
  $: menuVisible =
    spec?.kind === "cardAction" &&
    session.menuTarget !== null &&
    menuCard !== null &&
    anchor !== null &&
    menuChoices.length > 0;
  $: fieldAnnouncement = pending
    ? "Response sent. Waiting for the engine."
    : prompt === null
      ? ""
      : `${prompt.title}. Use Arrow keys to move through the field.`;
  $: duelStateAnnouncement = stateAnnouncement(presentationEvents);

  onMount(() => {
    const update = (): void => updateAnchor();
    const motionQuery = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    const updateMotion = (): void => {
      mediaReducedMotion = motionQuery?.matches ?? false;
    };
    updateMotion();
    motionQuery?.addEventListener("change", updateMotion);
    feedbackController = createDomFeedbackController(fieldRoot, (state) => {
      feedbackState = state;
    });
    synchronizeFeedback(
      feedbackController,
      feedbackGeneration,
      presentationEvents,
      effectiveReducedMotion,
      board,
    );
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      motionQuery?.removeEventListener("change", updateMotion);
      feedbackSyncSequence += 1;
      feedbackController?.cancel();
      feedbackController = null;
      resizeObserver?.disconnect();
    };
  });

  function scheduleFeedbackSync(
    controller: DomFeedbackController | null,
    generation: string,
    events: typeof presentationEvents,
    motionReduced: boolean,
    currentBoard: BoardViewModel,
  ): void {
    const sequence = ++feedbackSyncSequence;
    void tick().then(() => {
      if (sequence !== feedbackSyncSequence) return;
      synchronizeFeedback(
        controller,
        generation,
        events,
        motionReduced,
        currentBoard,
      );
    });
  }

  function synchronizeFeedback(
    controller: DomFeedbackController | null,
    generation: string,
    events: typeof presentationEvents,
    motionReduced: boolean,
    currentBoard: BoardViewModel,
  ): void {
    if (controller === null) return;
    const boardChanged = currentBoard !== observedBoard;
    const priorBoard = observedBoard;
    observedBoard = currentBoard;
    if (generation !== activeFeedbackGeneration) {
      controller.cancel();
      activeFeedbackGeneration = generation;
      lastPresentationSequence = events.at(-1)?.sequence ?? 0;
      deferredPresentationEvents = [];
      appliedReducedMotion = motionReduced;
      return;
    } else if (motionReduced !== appliedReducedMotion) {
      controller.cancel();
      appliedReducedMotion = motionReduced;
      const latest = events.at(-1);
      if (latest !== undefined) {
        controller.present(
          presentationCommandForDomEvent(
            latest.event,
            {
              currentBoard,
              ...(priorBoard === null ? {} : { previousBoard: priorBoard }),
            },
            motionReduced,
          ),
        );
        lastPresentationSequence = latest.sequence;
      }
      return;
    }
    if (boardChanged && deferredPresentationEvents.length > 0) {
      for (const entry of deferredPresentationEvents)
        presentFeedbackEntry(
          controller,
          entry,
          motionReduced,
          currentBoard,
          priorBoard,
        );
      deferredPresentationEvents = [];
    }
    for (const entry of events) {
      if (entry.sequence <= lastPresentationSequence) continue;
      if (!boardChanged && feedbackNeedsNextBoard(entry.event)) {
        deferredPresentationEvents = [...deferredPresentationEvents, entry];
      } else {
        presentFeedbackEntry(
          controller,
          entry,
          motionReduced,
          currentBoard,
          priorBoard,
        );
      }
      lastPresentationSequence = entry.sequence;
    }
  }

  function presentFeedbackEntry(
    controller: DomFeedbackController,
    entry: (typeof presentationEvents)[number],
    motionReduced: boolean,
    currentBoard: BoardViewModel,
    priorBoard: BoardViewModel | null,
  ): void {
    controller.present(
      presentationCommandForDomEvent(
        entry.event,
        {
          currentBoard,
          ...(priorBoard === null ? {} : { previousBoard: priorBoard }),
        },
        motionReduced,
      ),
    );
  }

  function feedbackNeedsNextBoard(event: DuelPresentationEvent): boolean {
    return (
      event.type === "cardMoved" ||
      event.type === "summon" ||
      event.type === "specialSummon" ||
      event.type === "flipSummon" ||
      event.type === "set" ||
      event.type === "positionChanged"
    );
  }

  function dispatch(action: UnkeyedInteractionSessionAction): void {
    if (spec === null || pending) return;
    oninteraction({ ...action, key: spec.key } as InteractionSessionAction);
  }

  function activateCard(card: BoardCardView, element: HTMLButtonElement): void {
    if (spec === null) return;
    const choices = spec.cardChoices.get(card.targetId);
    const choice = choices?.[0];
    if (choice === undefined) return;
    switch (spec.kind) {
      case "cardAction":
        menuCard = card;
        anchorElement = element;
        observeAnchor(element);
        updateAnchor();
        dispatch({ type: "openMenu", target: card.targetId });
        break;
      case "cardSelection":
        dispatch({ type: "toggleChoice", choiceId: choice.id });
        break;
      case "counterAllocation":
        dispatch({ type: "adjustAllocation", choiceId: choice.id, delta: 1 });
        break;
      case "order":
        break;
      case "placeSelection":
      case "nonField":
        break;
    }
  }

  function activateZone(zone: BoardZoneView): void {
    if (spec === null) return;
    const choice = spec.zoneChoices.get(zone.targetId)?.[0];
    if (choice !== undefined)
      dispatch({ type: "toggleChoice", choiceId: choice.id });
  }

  function chooseMenuAction(choice: InteractionChoice): void {
    anchorElement?.focus({ preventScroll: true });
    dispatch({ type: "chooseChoice", choiceId: choice.id });
    clearMenuAnchor();
  }

  function inspectMenuCard(): void {
    if (menuCard !== null) oninspect(menuCard);
    void closeMenu();
  }

  async function closeMenu(returnFocus = true): Promise<void> {
    const returnTarget = anchorElement;
    dispatch({ type: "closeMenu" });
    clearMenuAnchor();
    await tick();
    if (returnFocus && returnTarget?.isConnected) returnTarget.focus();
  }

  function clearMenuAnchor(): void {
    resizeObserver?.disconnect();
    anchorElement = null;
    anchor = null;
    menuCard = null;
  }

  function observeAnchor(element: HTMLButtonElement): void {
    resizeObserver?.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    resizeObserver = new ResizeObserver(() => updateAnchor());
    resizeObserver.observe(element);
  }

  function updateAnchor(): void {
    if (anchorElement === null) return;
    const rect = anchorElement.getBoundingClientRect();
    anchor = { left: rect.left, top: rect.top, bottom: rect.bottom };
  }

  function stateAnnouncement(events: typeof presentationEvents): string {
    const latest = [...events]
      .reverse()
      .find(
        ({ event }) =>
          event.type === "turnStarted" || event.type === "phaseChanged",
      )?.event;
    if (latest?.type === "turnStarted")
      return `Turn ${latest.turn}. ${latest.player === 0 ? "Your turn" : "Opponent turn"}.`;
    if (latest?.type === "phaseChanged")
      return `Phase ${latest.phase.replaceAll(/([a-z])(\d)/g, "$1 $2")}.`;
    return "";
  }

  function targetSelections(
    value: ActiveInteractionSpec,
    draft: InteractionSession,
  ): ReadonlySet<BoardTargetId> {
    const selected = new SvelteSet(draft.selectedChoiceIds);
    const result = new SvelteSet<BoardTargetId>();
    for (const [target, choices] of [
      ...value.cardChoices,
      ...value.zoneChoices,
    ]) {
      if (choices.some(({ id }) => selected.has(id))) result.add(target);
    }
    return result;
  }
</script>

<section class="duel-field" aria-label="Duel field" bind:this={fieldRoot}>
  <h2 class="visually-hidden">Duel field</h2>
  <p
    class="visually-hidden"
    aria-label="Field updates"
    aria-live="polite"
    aria-atomic="true"
  >
    {fieldAnnouncement}
  </p>
  <p
    class="visually-hidden"
    aria-label="Duel state updates"
    aria-live="polite"
    aria-atomic="true"
  >
    {duelStateAnnouncement}
  </p>
  <FieldBoard
    {board}
    {imageUrls}
    {imageLibrary}
    cardBackUrl={resolvedCardBackUrl}
    placeholderUrl={resolvedPlaceholderUrl}
    {spec}
    {selectedTargets}
    disabled={pending}
    oncardactivate={activateCard}
    onzoneactivate={activateZone}
    {oninspect}
  />
  {#if feedbackState.line}
    <FieldLines line={feedbackState.line} />
  {/if}
  {#if feedbackState.kind !== null}
    <p
      class="duel-field-feedback"
      class:is-life-points={feedbackState.kind === "life-points"}
      class:is-chain={feedbackState.kind === "chain"}
      role="status"
      aria-live="polite"
      data-feedback-kind={feedbackState.kind}
      data-feedback-duration={feedbackState.durationMs}
    >
      {feedbackState.label}
    </p>
  {/if}
  {#if menuVisible && menuCard && anchor}
    <FieldActionMenu
      label={menuCard.label}
      choices={menuChoices}
      {anchor}
      disabled={pending}
      onchoose={chooseMenuAction}
      oninspect={inspectMenuCard}
      onclose={closeMenu}
    />
  {/if}
  {#if prompt && spec && spec.fieldCapable}
    <SelectionDock
      {prompt}
      {spec}
      {session}
      disabled={pending}
      confirmValid={validation.valid}
      validationMessage={validation.valid ? "" : validation.message}
      {oninteraction}
    />
  {/if}
</section>

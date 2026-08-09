<script lang="ts">
  import { onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
  import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
  import type { DuelPhase } from "../../duel/contracts/public-duel-state.ts";
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
  import {
    fieldActionBarRequired,
    type ActiveInteractionSpec,
  } from "../prompts/interaction-spec.ts";
  import { dropChoiceForZone } from "../prompts/drop-target.ts";
  import { validatePromptSelection } from "../prompts/prompt-selection.ts";
  import { placementZoneCandidates } from "../../field/placement-candidates.ts";
  import type { PhysicalZoneId } from "../../field/duel-field-layout.ts";
  import {
    createDomFeedbackController,
    EMPTY_DOM_FEEDBACK_STATE,
    type DomFeedbackController,
    type DomFeedbackState,
  } from "../presentation/dom-feedback-controller.ts";
  import { presentationCommandForDomEvent } from "../presentation/presentation-command.ts";
  import FieldActionBar from "./duel-field/FieldActionBar.svelte";
  import FieldBoard from "./duel-field/FieldBoard.svelte";
  import FieldLines from "./duel-field/FieldLines.svelte";
  import EndTurnButton from "./duel-field/EndTurnButton.svelte";
  import FieldStatusPills from "./duel-field/FieldStatusPills.svelte";
  import LifePointsPill from "./duel-field/LifePointsPill.svelte";

  const EMPTY_IMAGE_URLS: ReadonlyMap<number, string> = new Map();
  const EMPTY_TARGETS: ReadonlySet<BoardTargetId> = new Set();
  const EMPTY_ZONE_IDS: ReadonlySet<PhysicalZoneId> = new Set();
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
  /* Injectable so a component test can drive a drop without a layout engine
     (assumption A5). The default is the only thing the app ever uses. */
  export let hitTest: (x: number, y: number) => Element | null = (x, y) =>
    document.elementFromPoint(x, y);
  export let onplacementintent: (zoneId: PhysicalZoneId) => unknown = () =>
    false;
  export let onpreview: (card: BoardCardView) => void = () => undefined;
  export let phase: DuelPhase = "unknown";
  export let hasPriority = false;
  export let lifePoints: readonly [number, number] | null = null;

  if (injectFailure) throw new Error("Injected duel field component failure");

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
  let actionBarHeight = 0;
  let dragCard: BoardCardView | null = null;
  let dropCandidates: ReadonlySet<PhysicalZoneId> = EMPTY_ZONE_IDS;

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
  $: actionBarVisible =
    prompt !== null &&
    spec !== null &&
    spec.fieldCapable &&
    fieldActionBarRequired(spec);
  onMount(() => {
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
    return () => {
      motionQuery?.removeEventListener("change", updateMotion);
      feedbackSyncSequence += 1;
      feedbackController?.cancel();
      feedbackController = null;
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

  function activateCard(card: BoardCardView): void {
    if (spec === null) return;
    const choices = spec.cardChoices.get(card.targetId);
    const choice = choices?.[0];
    if (choice === undefined) return;
    switch (spec.kind) {
      case "cardAction":
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

  /* The halo is a local guess at where the engine might accept this card. It
     is presentation only and never gates a response: the follow-up place
     prompt stays authoritative. */
  function startCardDrag(card: BoardCardView): void {
    if (spec === null || spec.kind !== "cardAction") return;
    if (card.zoneId !== "p0:hand") return;
    const candidates = new SvelteSet<PhysicalZoneId>();
    for (const choice of spec.cardChoices.get(card.targetId) ?? []) {
      for (const zoneId of placementZoneCandidates(choice.action, board))
        candidates.add(zoneId);
    }
    dragCard = card;
    dropCandidates = candidates;
  }

  /* Deliberately inert: the halo does not track the pointer in this slice, so
     a drag does no per-move DOM work. The signature stays so the gesture can
     grow a follower later without touching CardControl. */
  function moveCardDrag(x: number, y: number): void {
    void x;
    void y;
  }

  function endCardDrag(x: number, y: number): void {
    const card = dragCard;
    const candidates = dropCandidates;
    dragCard = null;
    dropCandidates = EMPTY_ZONE_IDS;
    if (card === null || spec === null) return;
    /* `pointercancel` reports NaN: the gesture was abandoned, not dropped. */
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    const zoneId = zoneIdAtPoint(x, y);
    if (zoneId === null || !candidates.has(zoneId)) return;
    const zone = board.zones.find((value) => value.id === zoneId);
    if (zone === undefined) return;
    const choice = dropChoiceForZone(
      zone,
      spec.cardChoices.get(card.targetId) ?? [],
    );
    if (choice === null) return;
    onplacementintent(zone.id);
    dispatch({ type: "chooseChoice", choiceId: choice.id });
  }

  /* Never trust the topmost element: action chips sit above the zones and can
     be visible mid-drag, and a zone's own label span is a child of the zone.
     Only an enclosing `[data-zone-id]` counts, and anything else is a miss. */
  function zoneIdAtPoint(x: number, y: number): PhysicalZoneId | null {
    const hit = hitTest(x, y);
    if (hit === null) return null;
    const zoneElement = hit.closest("[data-zone-id]");
    if (zoneElement === null) return null;
    return zoneElement.getAttribute("data-zone-id") as PhysicalZoneId | null;
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

<section
  class="duel-field"
  aria-label="Duel field"
  bind:this={fieldRoot}
  data-cy="duel-field"
  data-field-action-bar={actionBarVisible ? "true" : undefined}
  data-dragging={dragCard === null ? undefined : "true"}
  data-prompt-kind={prompt === null ? undefined : prompt.kind}
  style:--field-action-bar-height={actionBarVisible
    ? `${actionBarHeight}px`
    : undefined}
>
  <FieldBoard
    {board}
    {imageUrls}
    {imageLibrary}
    cardBackUrl={resolvedCardBackUrl}
    placeholderUrl={resolvedPlaceholderUrl}
    {spec}
    {selectedTargets}
    disabled={pending}
    pinnedTarget={session.menuTarget}
    {dropCandidates}
    oncardactivate={activateCard}
    onzoneactivate={activateZone}
    oncardchoose={(choice) => {
      dispatch({ type: "chooseChoice", choiceId: choice.id });
    }}
    oncarddismiss={() => dispatch({ type: "closeMenu" })}
    oncarddragstart={startCardDrag}
    oncarddragmove={moveCardDrag}
    oncarddragend={endCardDrag}
    oncardpreview={onpreview}
  />
  <FieldStatusPills {hasPriority} {phase} />
  {#if lifePoints !== null}
    <LifePointsPill player={1} lifePoints={lifePoints[1]} />
    <LifePointsPill player={0} lifePoints={lifePoints[0]} />
  {/if}
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
      data-cy="duel-field-feedback"
    >
      {feedbackState.label}
    </p>
  {/if}
  {#if actionBarVisible && prompt && spec}
    <FieldActionBar
      {prompt}
      {spec}
      {session}
      disabled={pending}
      confirmValid={validation.valid}
      validationMessage={validation.valid ? "" : validation.message}
      bind:clientHeight={actionBarHeight}
      {oninteraction}
    />
  {/if}
  <EndTurnButton {spec} disabled={pending} {oninteraction} />
</section>

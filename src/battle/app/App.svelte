<script lang="ts">
  import { afterUpdate, getContext, onMount, tick } from "svelte";
  import type {
    ContentReadPort,
    ContentSetRef,
    InstalledGameplay,
  } from "../../content/index.ts";
  import type { DuelDeckSelection } from "../duel/contracts/duel-deck-selection.ts";
  import type { DuelDiagnosticTrace } from "../duel/contracts/duel-diagnostics.ts";
  import type { DuelError } from "../duel/contracts/duel-error.ts";
  import type { PlayerPrompt } from "../duel/contracts/player-prompt.ts";
  import { snapshotId, type PromptId } from "../duel/contracts/ids.ts";
  import type {
    PlayerIndex,
    PublicCard,
    PublicDuelState,
  } from "../duel/contracts/public-duel-state.ts";
  import {
    mapSnapshotToBoard,
    type BoardCardText,
    type BoardCardView,
    type BoardMappingResult,
    type BoardStackView,
  } from "../field/board-view-model.ts";
  import { zoneListsForBoard, type ZoneListEntry } from "../field/zone-list.ts";
  import {
    offFieldTargetEntries,
    type OffFieldTargetEntry,
  } from "../field/off-field-target-list.ts";
  import type { PhysicalZoneId } from "../field/duel-field-layout.ts";
  import {
    CardPreviewPanel,
    TOAST_CONTEXT_KEY,
    type ToastPublisher,
    type ToastTone,
  } from "../../shell/index.ts";
  import DuelRail from "./components/DuelRail.svelte";
  import PhaseBar from "./components/PhaseBar.svelte";
  import DeckPicker from "./components/DeckPicker.svelte";
  import DuelErrorDialog from "./components/DuelErrorDialog.svelte";
  import DuelResultDialog from "./components/DuelResultDialog.svelte";
  import MenuDialog from "./components/MenuDialog.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import DuelFieldErrorBoundary from "./components/duel-field/DuelFieldErrorBoundary.svelte";
  import DuelHud from "./components/duel-field/DuelHud.svelte";
  import DuelLog from "./components/duel-field/DuelLog.svelte";
  import LoadingOverlay from "./components/LoadingOverlay.svelte";
  import { SnapshotStore } from "../storage/snapshot-store.ts";
  import { downloadDuelDiagnostics } from "./diagnostics/download-diagnostics.ts";
  import { DuelWorkerClient } from "./DuelWorkerClient.ts";
  import {
    createInstalledCardImageLibrary,
    type CardImageLibrary,
  } from "./images/card-image-cache.ts";
  import PromptControls from "./prompts/PromptControls.svelte";
  import PromptDialog from "./components/PromptDialog.svelte";
  import {
    lastActionActor,
    ownEffectChainPassResponse,
    trivialPromptResponse,
  } from "./prompts/auto-response.ts";
  import { centralPlacementResponse } from "./prompts/auto-placement.ts";
  import { mapPromptToInteractionSpec } from "./prompts/interaction-spec.ts";
  import {
    cardPreviewForCode,
    cardPreviewForPublicCard,
    stackTopCode,
    type CardPreviewView,
  } from "./presentation/card-preview.ts";
  import { duelRailStatusFor } from "./presentation/duel-rail-status.ts";
  import {
    reduceEndTurnAutomation,
    type EndTurnAutomationState,
  } from "./presentation/end-turn-automation.ts";
  import { promptContextMessage } from "./presentation/prompt-context-message.ts";
  import { promptSurface } from "./prompts/prompt-surface.ts";
  import {
    findSelectableDeck,
    type SelectableDeck,
  } from "../decks/selectable-decks.ts";
  import { installedSelectableDecks } from "../decks/installed-selectable-decks.ts";
  import {
    catalogByCode,
    PROTOTYPE_RULESET,
  } from "../../decks/catalog/pinned-ruleset.ts";
  import { installedDeckCatalog } from "../../decks/catalog/installed-gameplay-cards.ts";
  import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
  import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";
  import {
    battleFacadeFailure,
    battleResultForDuelResult,
    toDuelDeckSelection,
    type BattleFacadeResult,
    type BattleRequest,
  } from "../battle-contracts.ts";
  import {
    createDuelStore,
    type DuelViewState,
    type SequencedPresentationEvent,
  } from "./stores/duel-store.ts";
  import {
    DEFAULT_PERSISTED_UI_STATE,
    hasPersistedUiState,
    type PersistedWindowPosition,
  } from "./stores/persisted-ui-state.ts";
  import { createPersistedUiStore } from "./stores/persisted-ui-store.ts";
  import {
    createUiSettingsStore,
    DEFAULT_UI_SETTINGS,
    type UiSettingsState,
  } from "./stores/ui-settings-store.ts";

  export let content: ContentSetRef;
  export let gameplay: InstalledGameplay;
  export let reader: ContentReadPort;

  /* Set by the battle facade when a host is waiting for this duel's outcome.
     Left undefined in standalone mode, where the duel reports nothing
     outwards and behaves exactly as it did before the facade existed. */
  export let onbattlecomplete:
    ((result: BattleFacadeResult) => void) | undefined = undefined;
  /* The seats a host chose before this duel mounted. The picker below is what
     `null` means: the duel asks for itself. One object per match, because the
     dispatch below fires once per request identity — a host that rebuilt an
     equal request every render would restart the duel on every flush. */
  export let request: BattleRequest | null = null;
  /* The host's exit from the match, offered inside the duel menu beside
     Surrender. `null` where the host owns its own way out. */
  export let onleavematch: (() => void) | null = null;

  const installedCatalog = installedDeckCatalog(gameplay);
  let activeCards: readonly DeckBuilderCardView[] = installedCatalog.cards;
  $: activeCardTexts = new Map(
    activeCards.map((card) => [card.code, card] as const),
  );
  const EMPTY_ZONE_LISTS: ReadonlyMap<
    PhysicalZoneId,
    readonly ZoneListEntry[]
  > = new Map();
  const EMPTY_OFF_FIELD_TARGETS: readonly OffFieldTargetEntry[] = [];
  let deckBuilderCatalog: ReadonlyMap<number, DeckBuilderCardView> =
    catalogByCode(activeCards);
  const defaultOpponent = gameplay.opponents.find(
    ({ id }) => id === gameplay.defaults.opponentId,
  );
  if (defaultOpponent === undefined)
    throw new Error("Installed gameplay default opponent is missing");
  const FIXED_OPPONENT_KEY = `chapter:${defaultOpponent.deckId}`;
  const DEFAULT_CARD_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2318243b'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%23697895' stroke-width='2'/%3E%3Ctext x='36' y='57' fill='%23a9b5ca' font-size='28' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E";
  const client = new DuelWorkerClient();
  const duel = createDuelStore(client, content);
  const persistedUi = createPersistedUiStore();
  const uiSettings = createUiSettingsStore({
    ...DEFAULT_UI_SETTINGS,
    ...$persistedUi.settings,
  });
  /* A request already names both decks, so the picker never opens for it: the
     player chose one screen ago, and this seat's opponent is fixed below. */
  let pickerOpen = request === null;
  let dispatchedRequest: BattleRequest | null = null;
  let duelFieldSlot: HTMLElement | null = null;
  let menuOpen = false;
  let settingsOpen = false;
  let menubarTrigger: HTMLButtonElement | null = null;
  let generationContext = "";
  let promptPanel: HTMLElement;
  let errorHeading: HTMLHeadingElement;
  let previousErrorKey = "";
  let imageLibrary: CardImageLibrary | null = null;
  let imageLoading = true;
  let retryImages: () => void = () => undefined;
  $: imagesMatchRuntime =
    imageLibrary !== null &&
    $duel.runtimeSnapshotId !== null &&
    imageLibrary.snapshotId === $duel.runtimeSnapshotId;
  let imageProgress = 0;
  let imageWarning: string | null = null;
  let previewCard: CardPreviewView | null = null;
  let autoResolvedPromptId: PromptId | null = null;
  /* Ctrl is a hold, not a mode: it raises Full Control for as long as it is
     down and drops it on release, while the checkbox keeps whatever the
     player set. A blurred window never sees the keyup, so blur clears it. */
  let ctrlHeld = false;
  $: effectiveFullControl = $uiSettings.fullControl || ctrlHeld;
  let endTurnAutomation: EndTurnAutomationState = {
    status: "idle",
    sessionGeneration: null,
    lastDispatchedKey: null,
  };
  let injectDuelFieldFailure = false;
  let diagnosticPending = false;
  /* Whether the trace the store is about to hand over is one the player asked
     for. Kept apart from `diagnosticPending`, which the failed-duel branch of
     `afterUpdate` clears on every update: this one has to survive from the
     click until the Worker answers it. */
  let diagnosticsRequested = false;
  let diagnosticMessage: string | null = null;
  const toasts = getContext<ToastPublisher | undefined>(TOAST_CONTEXT_KEY);

  function showTransient(message: string, tone: ToastTone): void {
    if (toasts === undefined) diagnosticMessage = message;
    else toasts.show({ message, tone });
  }
  /* The error a restore was asked for. `restore` reports its outcome as an
     event, not a promise, so the pending label lives until the store either
     retires that error (rebuilt), types a failure against it, or replaces it
     with the command watchdog's own `process_timeout`. */
  let restoreRequestedFor: DuelError | null = null;
  /* The error whose restore the client refused outright. A refusal never
     reaches the Worker, so no `restore_failed` follows it: without this the
     button would do nothing and say nothing about it. Both are keyed to the
     error so neither outcome survives into the next failure. */
  let restoreRefusedFor: DuelError | null = null;
  $: restorePending =
    restoreRequestedFor !== null &&
    $duel.error === restoreRequestedFor &&
    $duel.restoreFailure === null;
  $: restoreFailure =
    restoreRefusedFor !== null && $duel.error === restoreRefusedFor
      ? ("refused" as const)
      : $duel.restoreFailure;
  /* The last trace this component has seen, downloaded or merely held. */
  let observedDiagnostics = $duel.diagnostics;
  /* The held trace the download button may still fall back to. Separate from
     `observedDiagnostics`, which only says what arrived: a trace answers for
     the duel it was taken from, and it is retired the moment that duel stops
     being the one on screen. */
  let serveableDiagnostics = $duel.diagnostics;
  $: diagnosticsAvailable =
    !diagnosticPending &&
    ($duel.context.sessionGeneration > 0 || serveableDiagnostics !== null);
  /* Whether the last update showed a duel in play, so that a restore — which
     puts the failure's own duel back into play — is visible as an edge. */
  let duelInPlay = false;
  const snapshotStorageStatus = {
    activeSnapshotId: snapshotId(content.snapshot.runtimeSnapshotId),
    fallbackSnapshotId: null,
  };
  let battleCompletionReported = false;
  /* Subscribed rather than derived with `$:`: reactive statements run once per
     flush, so two results arriving in the same tick would report the later
     one. The host is promised the first ending the duel reached. */
  const stopBattleCompletionReports = duel.subscribe(reportBattleCompletion);
  /* The Worker posts every event as its own message and each one replaces
     `$duel` whole, so the board used to be remapped once per message even
     though only three parts of the state can change it — and every rebuild
     handed the field a new object to diff. A snapshot is frozen and only a
     state event replaces it, so identity is a sound key: a message that
     touched none of the three gets the previous board back, unchanged. */
  let mappedBoardSnapshot: PublicDuelState | null = null;
  let mappedBoardCardTexts: ReadonlyMap<number, BoardCardText> | null = null;
  let mappedBoardPrompt: PlayerPrompt | null = null;
  let mappedBoardResult: BoardMappingResult | null = null;
  function memoizedBoardResult(
    snapshot: PublicDuelState | null,
    cardTexts: ReadonlyMap<number, BoardCardText>,
    prompt: PlayerPrompt | null,
  ): BoardMappingResult | null {
    if (snapshot === null) return null;
    if (
      mappedBoardResult !== null &&
      snapshot === mappedBoardSnapshot &&
      cardTexts === mappedBoardCardTexts &&
      prompt === mappedBoardPrompt
    )
      return mappedBoardResult;
    mappedBoardSnapshot = snapshot;
    mappedBoardCardTexts = cardTexts;
    mappedBoardPrompt = prompt;
    mappedBoardResult = mapSnapshotToBoard(snapshot, cardTexts, prompt);
    return mappedBoardResult;
  }
  $: boardResult = memoizedBoardResult(
    $duel.snapshot,
    activeCardTexts,
    $duel.prompt,
  );
  $: duelBoard = boardResult?.ok === true ? boardResult.value : null;
  /* Engine legality and visible geometry disagree about the shared Extra
     Monster Zones. Nothing may hide, auto-answer or generically recover from
     that: the whole prompt path is gated off until it is fixed. */
  $: layoutProfileConflict =
    boardResult?.ok === false &&
    boardResult.error.type === "layout_profile_conflict"
      ? boardResult.error
      : null;
  $: effectivePrompt = layoutProfileConflict === null ? $duel.prompt : null;
  /* The decision window says what it is asking about, not just what to press.
     Only the app holds all three inputs — the snapshot's chain, the batch's
     events and the card texts — so the line is built once here and handed to
     whichever surface shows the prompt. */
  $: promptContextSegments =
    promptContextMessage({
      prompt: effectivePrompt,
      snapshot: $duel.snapshot,
      events: $duel.presentationEvents.map(({ event }) => event),
      cardTexts: activeCardTexts,
    }) ?? [];
  $: duelViewportOnly =
    layoutProfileConflict === null &&
    (duelBoard !== null || $duel.snapshot !== null) &&
    imageWarning === null &&
    $duel.error === null &&
    diagnosticMessage === null &&
    !$uiSettings.showDuelHud &&
    !$uiSettings.showWorkspace;
  $: zoneLists =
    duelBoard === null
      ? EMPTY_ZONE_LISTS
      : zoneListsForBoard(duelBoard, $duel.snapshot, activeCardTexts);
  $: mappedInteractionSpec = mapPromptToInteractionSpec(
    effectivePrompt,
    $duel.snapshot,
    duelBoard,
    $duel.context,
  );
  $: fieldInteractionSpec =
    mappedInteractionSpec.kind === "inactive" ? null : mappedInteractionSpec;
  $: endTurnAutomationFinished =
    $duel.result !== null ||
    ($duel.status !== "active" && $duel.status !== "awaiting-input");
  $: synchronizeEndTurnAutomation(
    $duel.snapshot?.turnPlayer ?? 1,
    endTurnAutomationFinished,
    $duel.responsePending,
    $duel.context.sessionGeneration,
    fieldInteractionSpec,
  );
  /* T16: the target list is joined here, once, from the same sanitized
     snapshot the board came from. `fieldInteractionSpec` is derived from
     `effectivePrompt`, so the layout-conflict gate still holds. */
  $: offFieldTargets =
    fieldInteractionSpec === null || $duel.snapshot === null
      ? EMPTY_OFF_FIELD_TARGETS
      : offFieldTargetEntries(
          fieldInteractionSpec,
          $duel.snapshot,
          activeCardTexts,
        );
  $: currentPromptSurface = promptSurface(
    effectivePrompt,
    mappedInteractionSpec,
    $uiSettings.showWorkspace,
    duelBoard !== null,
  );
  $: railStatus = duelRailStatusFor({
    prompt: effectivePrompt,
    snapshot: $duel.snapshot,
    responsePending: $duel.responsePending,
  });
  $: appAnnouncement =
    imageWarning ??
    diagnosticMessage ??
    ($duel.responsePending
      ? "Response sent. Waiting for the engine"
      : imageLoading
        ? "Preparing installed card images"
        : $duel.loading
          ? `Loading ${phaseLabel($duel.loading.stage)}`
          : "");

  onMount(() => {
    let disposed = false;
    let imageLoadGeneration = 0;
    let imageAbortController: AbortController | null = null;
    injectDuelFieldFailure =
      new URLSearchParams(globalThis.location.search).get(
        "duelFieldFailure",
      ) === "once";

    const loadImages = async (): Promise<void> => {
      const generation = ++imageLoadGeneration;
      imageAbortController?.abort(
        new DOMException("Card image attempt replaced", "AbortError"),
      );
      const controller = new AbortController();
      imageAbortController = controller;
      imageLoading = true;
      imageProgress = 0;
      imageWarning = null;
      imageLibrary?.dispose();
      imageLibrary = null;
      try {
        const library = await createInstalledCardImageLibrary(
          reader,
          gameplay,
          (completed, total) => {
            if (generation === imageLoadGeneration)
              imageProgress = completed / Math.max(total, 1);
          },
          controller.signal,
        );
        if (disposed || generation !== imageLoadGeneration) library.dispose();
        else {
          imageLibrary = library;
          activeCards = installedCatalog.cards.map((card) => ({
            ...card,
            imageUrl: library.lease(card.code).url,
          }));
          deckBuilderCatalog = catalogByCode(activeCards);
          void refreshSelectableDecks();
        }
      } catch (error) {
        if (!disposed && generation === imageLoadGeneration)
          imageWarning = `Installed card images are unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`;
      } finally {
        if (!disposed && generation === imageLoadGeneration)
          imageLoading = false;
      }
    };
    retryImages = () => void loadImages();

    duel.initialize();
    void refreshSelectableDecks();
    void loadImages();
    return () => {
      disposed = true;
      resetEndTurnAutomation();
      deckListingGeneration += 1;
      stopBattleCompletionReports();
      imageAbortController?.abort(
        new DOMException("Application disposed", "AbortError"),
      );
      imageLibrary?.dispose();
      void duel.destroy().catch((error: unknown) => {
        console.error({ event: "duel.app.destroy.failed", err: error });
      });
    };
  });

  afterUpdate(() => {
    const context = `${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`;
    if (context !== generationContext) {
      generationContext = context;
      diagnosticPending = false;
      diagnosticsRequested = false;
      serveableDiagnostics = null;
      /* A new worker or session means new cards and a new image library
         generation, so the previewed card — and the image lease behind it —
         must not survive into the next duel. */
      previewCard = null;
    }
    if ($duel.error !== null) diagnosticPending = false;
    /* A restore rebuilds the duel the held trace was taken from, so from here
       that trace reports on a duel that no longer exists. Serving it to a
       later failure would put the wrong duel's seed on disk under a
       "downloaded" notice; the button says "unavailable" instead. */
    const inPlay =
      $duel.status === "active" || $duel.status === "awaiting-input";
    if (inPlay && !duelInPlay) serveableDiagnostics = null;
    duelInPlay = inPlay;
    const errorKey = $duel.error
      ? `${context}:${$duel.error.code}:${$duel.error.message}`
      : "";
    if (errorKey !== "" && errorKey !== previousErrorKey) errorHeading?.focus();
    previousErrorKey = errorKey;
  });

  /* A trace only leaves as a file when the player asked for one. The Worker
     also pushes a trace nobody requested — a boundary failure reports one on
     its way out — and that push must not put the production seed on disk by
     itself. It is still kept: the same failure replaces the Worker, so every
     later request is refused and this copy is the only one the download button
     will ever have. */
  $: if (
    $duel.diagnostics !== null &&
    $duel.diagnostics !== observedDiagnostics
  ) {
    const requested = diagnosticsRequested;
    // eslint-disable-next-line no-useless-assignment -- retained across reactive runs
    observedDiagnostics = $duel.diagnostics;
    serveableDiagnostics = $duel.diagnostics;
    diagnosticPending = false;
    diagnosticsRequested = false;
    if (requested) handleDiagnosticsDownload($duel.diagnostics);
  }

  $: startRequestedDuel(request, $duel.status, $duel.coreVersion);

  function synchronizeEndTurnAutomation(
    turnPlayer: PlayerIndex,
    duelFinished: boolean,
    responsePending: boolean,
    sessionGeneration: number,
    spec: typeof fieldInteractionSpec,
  ): void {
    const reduction = reduceEndTurnAutomation(endTurnAutomation, {
      type: "sync",
      input: {
        turnPlayer,
        duelFinished,
        responsePending,
        sessionGeneration,
        spec,
      },
    });
    if (reduction.state !== endTurnAutomation)
      endTurnAutomation = reduction.state;
    if (reduction.action !== null) duel.dispatchInteraction(reduction.action);
  }

  function startEndTurnAutomation(): void {
    endTurnAutomation = reduceEndTurnAutomation(endTurnAutomation, {
      type: "arm",
    }).state;
    synchronizeEndTurnAutomation(
      $duel.snapshot?.turnPlayer ?? 1,
      endTurnAutomationFinished,
      $duel.responsePending,
      $duel.context.sessionGeneration,
      fieldInteractionSpec,
    );
  }

  function resetEndTurnAutomation(): void {
    endTurnAutomation = reduceEndTurnAutomation(endTurnAutomation, {
      type: "reset",
    }).state;
  }

  $: maybeAutoResolvePrompt(
    effectivePrompt,
    $duel.responsePending,
    endTurnAutomation.status === "armed",
    $uiSettings,
    effectiveFullControl,
    $duel.snapshot,
    $duel.presentationEvents,
  );

  /* The duel already ends in exactly two places — a result from the engine and
     a fatal error — so the outward report hangs off those, not off any new
     lifecycle of its own. A stop the engine never finished stays a failure:
     reporting it as a loss would advance a host past a duel that never ran. */
  function reportBattleCompletion(state: DuelViewState): void {
    if (onbattlecomplete === undefined || battleCompletionReported) return;
    const completion =
      state.result !== null
        ? battleResultForDuelResult(state.result)
        : state.status === "failed" && state.error !== null
          ? battleFacadeFailure(state.error.message)
          : null;
    if (completion === null) return;
    battleCompletionReported = true;
    onbattlecomplete(completion);
  }

  function maybeAutoResolvePrompt(
    prompt: PlayerPrompt | null,
    responsePending: boolean,
    endTurnArmed: boolean,
    settings: UiSettingsState,
    fullControl: boolean,
    snapshot: PublicDuelState | null,
    events: readonly SequencedPresentationEvent[],
  ): void {
    if (prompt === null) {
      autoResolvedPromptId = null;
      return;
    }
    if (responsePending || autoResolvedPromptId === prompt.id) return;
    /* End Turn automation may only dispatch engine-offered endPhase choices.
       Any other prompt stays with the player until their manual response lets
       the reducer inspect the next keyed choice. */
    if (endTurnArmed) return;
    /* Full Control answers nothing, and claims the prompt on the way out:
       dropping Ctrl while the player is looking at a window must not hand
       that same window to an automation behind their back. */
    if (fullControl) {
      autoResolvedPromptId = prompt.id;
      return;
    }
    const actor = lastActionActor(
      events.map(({ event }) => event),
      snapshot?.turnPlayer ?? 0,
    );
    const choiceIds =
      (settings.autoResolveTrivialPrompts
        ? trivialPromptResponse(prompt)
        : null) ??
      ownEffectChainPassResponse(prompt, snapshot, actor) ??
      (settings.autoPlaceCards ? centralPlacementResponse(prompt) : null);
    if (choiceIds === null) return;
    autoResolvedPromptId = prompt.id;
    queueMicrotask(() => duel.respond(choiceIds));
  }

  function handleDiagnosticsDownload(trace: DuelDiagnosticTrace): void {
    try {
      downloadDuelDiagnostics(trace, {
        buildId: __APP_BUILD_ID__,
        userAgent: navigator.userAgent,
        language: navigator.language,
        activeSnapshotId: snapshotId(content.snapshot.runtimeSnapshotId),
        fallbackSnapshotId: null,
        imageCache: {
          provider: imageLibrary?.provider ?? "unavailable",
          snapshotId: imageLibrary?.snapshotId ?? null,
          verified: imageLibrary !== null,
          cacheHits:
            imageLibrary?.diagnostics.filter(
              ({ status }) => status === "cache-hit",
            ).length ?? 0,
          cacheMisses:
            imageLibrary?.diagnostics.filter(
              ({ status }) => status === "cache-miss",
            ).length ?? 0,
          missing:
            imageLibrary?.diagnostics.filter(
              ({ status }) => status === "missing",
            ).length ?? 0,
          invalid:
            imageLibrary?.diagnostics.filter(
              ({ status }) => status === "invalid",
            ).length ?? 0,
        },
      });
      const resultType = $duel.result?.type ?? "diagnostic";
      void (async () => {
        const store = await SnapshotStore.open();
        try {
          await store.recordDebugRun({
            id: crypto.randomUUID(),
            snapshotId: trace.snapshotId,
            createdAt: new Date().toISOString(),
            resultType,
            traceEntries: trace.entries.length,
          });
        } finally {
          store.close();
        }
      })().catch((error: unknown) => {
        showTransient(
          error instanceof Error
            ? `Debug-run metadata was not saved: ${error.message}`
            : "Debug-run metadata was not saved.",
          "error",
        );
      });
      showTransient(
        "Diagnostics downloaded. The file contains the production seed; share it carefully.",
        "success",
      );
    } catch (error) {
      showTransient(
        error instanceof Error
          ? `Unable to download diagnostics: ${error.message}`
          : "Unable to download diagnostics.",
        "error",
      );
    }
  }

  /* The button serves a held trace only when the client can no longer produce
     a fresh one. A boundary failure pushes a trace and then replaces the
     Worker, and the replacement has no session to report on, so asking again
     would answer "unavailable" while the evidence is sitting in the store. A
     restored duel is a different case: the session is still live and owes a
     trace of its own, so it must be asked — and once it has been rebuilt, the
     trace it left behind is no longer served at all. */
  function requestDiagnostics(): void {
    diagnosticMessage = null;
    diagnosticsRequested = duel.requestDiagnostics();
    diagnosticPending = diagnosticsRequested;
    if (diagnosticsRequested) return;
    const held = serveableDiagnostics;
    if (held !== null) {
      handleDiagnosticsDownload(held);
      return;
    }
    showTransient("Diagnostics are unavailable for this session.", "warning");
  }

  function requestRestore(): void {
    const accepted = duel.restore();
    restoreRequestedFor = accepted ? $duel.error : null;
    restoreRefusedFor = accepted ? null : $duel.error;
  }

  let selectableDecks: readonly SelectableDeck[] = [];
  /* The row the player marked as their default in the editor, once it has been
     matched against a deck this build can actually play. Null until the local
     library has been read, and null again if that deck no longer qualifies. */
  let defaultDeckKey: string | null = null;
  let pickerFallbackNotice = false;
  let pickerStartError: string | null = null;
  /* Every refresh is racing the one before it — the picker reopens while a
     mount-time listing is still reading IndexedDB — and only the newest may
     write, or a deck deleted a second ago comes back on screen. */
  let deckListingGeneration = 0;

  /** One reading of the local library: what a seat may be given, and which of
      those rows the player marked as their default. */
  interface DeckListing {
    readonly decks: readonly SelectableDeck[];
    readonly defaultDeckKey: string | null;
  }

  async function refreshSelectableDecks(): Promise<void> {
    const generation = (deckListingGeneration += 1);
    const listing = await listDecksOrBundledOnly();
    if (generation !== deckListingGeneration) return;
    selectableDecks = listing.decks;
    defaultDeckKey = listing.defaultDeckKey;
    reconcilePersistedDeckKeys();
  }

  async function listDecksOrBundledOnly(): Promise<DeckListing> {
    let repository: IndexedDbDeckRepository | null = null;
    try {
      repository = await IndexedDbDeckRepository.open();
      const decks = await installedSelectableDecks(
        gameplay,
        repository,
        deckBuilderCatalog,
        PROTOTYPE_RULESET,
      );
      const defaultDeckId = await repository.getDefaultDeck();
      const defaultPrefix =
        defaultDeckId === null ? null : `local:${defaultDeckId}:`;
      return {
        decks,
        defaultDeckKey:
          defaultPrefix === null
            ? null
            : (decks.find(
                (deck) =>
                  deck.selection !== null && deck.key.startsWith(defaultPrefix),
              )?.key ?? null),
      };
    } catch {
      const decks = await installedSelectableDecks(
        gameplay,
        { list: async () => [], load: async () => null },
        deckBuilderCatalog,
        PROTOTYPE_RULESET,
      );
      return { decks, defaultDeckKey: null };
    } finally {
      repository?.close();
    }
  }

  /* A persisted key names a deck and the revision it had. Deleting or editing
     that deck makes the key unresolvable, and the honest answer is the pair
     this build can always play plus one sentence saying why — not a selection
     that looks intact until Start refuses it. */
  function reconcilePersistedDeckKeys(): void {
    if (selectableDecks.length === 0) return;
    const { playerKey, opponentKey } = $persistedUi.decks;
    /* A profile with nothing stored has made no choice to keep, so the stored
       default deck wins there and only there: once a key has been written,
       what the player picked outranks what the editor calls their default. */
    const chose = hasPersistedUiState();
    const chosen = chose
      ? findSelectableDeck(selectableDecks, playerKey)
      : null;
    /* Only a profile that had a key and lost it is told anything. A first run
       has nothing to have lost, and a notice there reads as a fault. */
    if (chose && chosen === null) {
      if (toasts === undefined) pickerFallbackNotice = true;
      else
        toasts.show({
          message:
            "A deck you had chosen is no longer available. Installed starter deck selected.",
          tone: "warning",
        });
    }
    const nextPlayerKey =
      chosen?.key ??
      defaultDeckKey ??
      `chapter:${gameplay.defaults.starterDeckId}`;
    if (nextPlayerKey !== playerKey || opponentKey !== FIXED_OPPONENT_KEY)
      persistedUi.setDecks(nextPlayerKey, FIXED_OPPONENT_KEY);
  }

  /** Starts the duel a host asked for, once the Worker can take it.

      Gated on `coreVersion` for the same reason the picker is: the Worker
      answers `ready` before it will create a session, and a start dispatched
      earlier is one the store refuses. Fires once per request, so a reset from
      the duel menu does not silently restart the match the host began. */
  function startRequestedDuel(
    requested: BattleRequest | null,
    status: DuelViewState["status"],
    coreVersion: DuelViewState["coreVersion"],
  ): void {
    if (requested === null || requested === dispatchedRequest) return;
    if (status !== "idle" || coreVersion === null) return;
    dispatchedRequest = requested;
    pickerStartError = null;
    try {
      if (
        duel.start(
          toDuelDeckSelection(requested.player),
          toDuelDeckSelection(requested.opponent),
        )
      )
        return;
      pickerStartError = "The duel could not be started. Try again.";
    } catch (error) {
      /* The host parsed this request against the same contract, so reaching
         here means the two drifted apart. The player gets the broken rule by
         name and the duel's own picker, rather than a duel that never starts. */
      pickerStartError =
        error instanceof Error
          ? `That deck cannot be played: ${error.message}`
          : "That deck cannot be played.";
    }
    pickerOpen = true;
  }

  function selectDecks(playerKey: string, opponentKey: string): void {
    pickerFallbackNotice = false;
    pickerStartError = null;
    persistedUi.setDecks(playerKey, opponentKey);
  }

  function moveZoneListWindow(position: PersistedWindowPosition): void {
    persistedUi.setWindowPosition("zoneList", position);
  }

  function moveConfirmWindow(position: PersistedWindowPosition): void {
    persistedUi.setWindowPosition("confirm", position);
  }

  function setShowZoneOutlines(value: boolean): void {
    uiSettings.setShowZoneOutlines(value);
    persistedUi.setDisplaySettings({
      ...$persistedUi.settings,
      showZoneOutlines: value,
    });
  }

  function setShowZoneCounts(value: boolean): void {
    uiSettings.setShowZoneCounts(value);
    persistedUi.setDisplaySettings({
      ...$persistedUi.settings,
      showZoneCounts: value,
    });
  }

  function setShowCardShadows(value: boolean): void {
    uiSettings.setShowCardShadows(value);
    persistedUi.setDisplaySettings({
      ...$persistedUi.settings,
      showCardShadows: value,
    });
  }

  function setShowZoneLabels(value: boolean): void {
    uiSettings.setShowZoneLabels(value);
    persistedUi.setDisplaySettings({
      ...$persistedUi.settings,
      showZoneLabels: value,
    });
  }

  function resetUiSettings(): void {
    uiSettings.reset();
    persistedUi.setDisplaySettings(DEFAULT_PERSISTED_UI_STATE.settings);
  }

  function startSelectedDuel(): void {
    pickerFallbackNotice = false;
    pickerStartError = null;
    const player = findSelectableDeck(
      selectableDecks,
      $persistedUi.decks.playerKey,
    );
    const opponent = findSelectableDeck(
      selectableDecks,
      $persistedUi.decks.opponentKey,
    );
    /* Reachable when the library changed in another tab between the listing
       and this click. Re-listing is what turns it back into a live choice. */
    if (player === null || opponent === null) {
      pickerStartError =
        "A deck you chose is no longer available. Choose another deck.";
      void refreshSelectableDecks();
      return;
    }
    if (player.selection === null || opponent.selection === null) {
      pickerStartError =
        player.blockReason ??
        opponent.blockReason ??
        "A chosen deck is not legal.";
      return;
    }
    let seats: readonly [DuelDeckSelection, DuelDeckSelection];
    /* Defensive, and expected to stay that way: the picker only offers decks
       `resolveDeck` called ready, and the Worker's own deck rules are the ones
       that ruleset enforces. If the two ever drift apart, the player gets the
       broken rule by name here instead of a duel that dies on creation. */
    try {
      seats = [
        toDuelDeckSelection(player.selection),
        toDuelDeckSelection(opponent.selection),
      ];
    } catch (error) {
      pickerStartError =
        error instanceof Error
          ? `That deck cannot be played: ${error.message}`
          : "That deck cannot be played.";
      return;
    }
    const [playerSeat, opponentSeat] = seats;
    pickerOpen = false;
    if (duel.start(playerSeat, opponentSeat)) return;
    pickerOpen = true;
    pickerStartError = "The duel could not be started. Try again.";
  }

  async function changeDecks(): Promise<void> {
    pickerOpen = true;
    pickerStartError = null;
    await duel.reset();
    await refreshSelectableDecks();
  }

  function previewFieldCard(card: BoardCardView): void {
    if (card.code === undefined) return;
    const next = cardPreviewForCode(card.code, activeCardTexts);
    if (next !== null) previewCard = next;
  }

  function previewStackCard(stack: BoardStackView): void {
    const code = stackTopCode(stack);
    if (code === undefined) return;
    const next = cardPreviewForCode(code, activeCardTexts);
    if (next !== null) previewCard = next;
  }

  function previewZoneListEntry(entry: ZoneListEntry): void {
    if (entry.code === undefined) return;
    const next = cardPreviewForCode(entry.code, activeCardTexts);
    if (next !== null) previewCard = next;
  }

  /* Still wired to `DuelHud`'s `oninspect`, so the HUD and the card trays need
     no change: the trigger button they hand over is irrelevant now that the
     panel replaces the modal inspector. ADR-014: a projected `PublicCard.code`
     is itself the projector-attested local-viewer capability, so
     `cardPreviewForPublicCard` reads that attestation instead of re-deriving
     identity visibility from face orientation. */
  function previewHudCard(card: PublicCard): void {
    const next = cardPreviewForPublicCard(card, activeCardTexts);
    if (next !== null) previewCard = next;
  }

  function retryCardImageLoading(): void {
    retryImages();
  }

  function phaseLabel(value: string): string {
    return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
  }

  async function dismissRecoverableError(): Promise<void> {
    duel.clearError();
    await tick();
    promptPanel?.focus();
  }

  function openMenu(): void {
    const activeElement = document.activeElement;
    menubarTrigger =
      activeElement instanceof HTMLButtonElement &&
      activeElement.matches('[data-cy="duel-right-rail-options"]')
        ? activeElement
        : document.querySelector<HTMLButtonElement>(
            '[data-cy="duel-right-rail-options"]',
          );
    menuOpen = true;
  }

  async function closeMenu(): Promise<void> {
    menuOpen = false;
    await tick();
    menubarTrigger?.focus();
  }

  function openSettings(): void {
    settingsOpen = true;
  }

  async function closeSettings(): Promise<void> {
    settingsOpen = false;
    await tick();
    menubarTrigger?.focus();
  }

  /* Held keys repeat, and every repeated keydown would otherwise reassign
     `ctrlHeld` and re-run everything reading it, so only a real change is
     written. */
  function trackCtrlKey(event: KeyboardEvent): void {
    if (event.key !== "Control") return;
    const held = event.type === "keydown";
    if (ctrlHeld !== held) ctrlHeld = held;
  }
</script>

<svelte:head>
  <title>Installed Duel · YGO Story Duel Simulator</title>
</svelte:head>

<svelte:window
  onkeydown={trackCtrlKey}
  onkeyup={trackCtrlKey}
  onblur={() => (ctrlHeld = false)}
/>

<main
  data-cy="app-main"
  class:is-duel-viewport={duelViewportOnly}
  data-duel-viewport={duelViewportOnly ? "true" : undefined}
>
  {#if imageLoading}
    <LoadingOverlay
      label="Preparing active card images"
      progress={imageProgress}
    />
  {:else if $duel.loading}
    <LoadingOverlay
      label={`Loading ${phaseLabel($duel.loading.stage)}`}
      progress={$duel.loading.progress ?? null}
    />
  {/if}
  <p
    class="visually-hidden"
    aria-live="polite"
    aria-atomic="true"
    data-cy="app-announcement"
  >
    {appAnnouncement}
  </p>

  {#if imageWarning}
    <section
      class="message-panel image-warning"
      data-cy="app-image-warning-panel"
    >
      <div data-cy="app-image-warning-body">
        <p class="eyebrow" data-cy="app-image-warning-eyebrow">
          Card image fallback
        </p>
        <p data-cy="app-image-warning-message">{imageWarning}</p>
      </div>
      <button
        type="button"
        class="secondary"
        disabled={imageLoading}
        data-cy="app-retry-images-button"
        onclick={retryCardImageLoading}>Retry card images</button
      >
    </section>
  {/if}

  {#if $duel.error && $duel.status === "failed"}
    <DuelErrorDialog
      error={$duel.error}
      canRestore={$duel.canRestore}
      diagnosticsAvailable={$duel.context.sessionGeneration > 0}
      {diagnosticPending}
      {diagnosticMessage}
      {restorePending}
      {restoreFailure}
      ondownload={requestDiagnostics}
      onrestore={requestRestore}
      onretry={() => void duel.retry()}
    />
  {:else if $duel.error}
    <section
      class:recoverable={$duel.error.recoverable}
      class="message-panel error-panel"
      role="alert"
      aria-labelledby="duel-error-heading"
      data-cy="app-error-panel"
    >
      <div data-cy="app-error-body">
        <p class="eyebrow" data-cy="app-error-eyebrow">
          Choice needs attention
        </p>
        <h2
          id="duel-error-heading"
          tabindex="-1"
          bind:this={errorHeading}
          data-cy="app-error-heading"
        >
          {$duel.error.message}
        </h2>
        <p data-cy="app-error-code">Error code: {$duel.error.code}</p>
      </div>
      <div class="button-row" data-cy="app-error-actions">
        <button
          type="button"
          class="secondary"
          data-cy="app-dismiss-error-button"
          onclick={() => void dismissRecoverableError()}>Dismiss</button
        >
      </div>
    </section>
  {/if}

  {#if diagnosticMessage}
    <p class="diagnostic-message" data-cy="app-diagnostic-message">
      {diagnosticMessage}
    </p>
  {/if}

  {#if pickerOpen && $duel.status === "idle" && $duel.coreVersion !== null && !$duel.snapshot}
    <DeckPicker
      decks={selectableDecks}
      playerKey={$persistedUi.decks.playerKey}
      opponentName={defaultOpponent.name}
      fallbackNotice={pickerFallbackNotice}
      startError={pickerStartError}
      onselect={(key) => selectDecks(key, FIXED_OPPONENT_KEY)}
      onstart={startSelectedDuel}
    />
  {/if}

  {#if duelBoard || $duel.snapshot}
    <div class="duel-shell" data-cy="duel-shell">
      <CardPreviewPanel
        preview={previewCard}
        imageLibrary={imagesMatchRuntime ? imageLibrary : null}
        placeholderUrl={imageLibrary?.placeholderUrl ??
          DEFAULT_CARD_PLACEHOLDER}
      />
      <div class="duel-field-column" data-cy="duel-field-column">
        {#if $duel.snapshot}
          <PhaseBar
            phase={$duel.snapshot.phase}
            turnPlayer={$duel.snapshot.turnPlayer}
            spec={fieldInteractionSpec}
            disabled={$duel.responsePending}
            oninteraction={duel.dispatchInteraction}
          />
        {/if}
        {#if layoutProfileConflict}
          <section
            class="field-error"
            role="alert"
            data-cy="layout-profile-conflict"
            data-conflict-zone-id={layoutProfileConflict.zoneId}
            data-conflict-source={layoutProfileConflict.source}
          >
            <h2 data-cy="layout-profile-conflict-heading">
              Duel field and rules disagree
            </h2>
            <p data-cy="layout-profile-conflict-copy">
              This duel runs without shared Extra Monster Zones, but the engine
              still offers {layoutProfileConflict.zoneId} ({layoutProfileConflict.source}).
              Decisions are paused so no legal choice is hidden or answered for
              you.
            </p>
          </section>
        {:else if duelBoard}
          <div
            class="duel-field-slot"
            data-cy="duel-field-slot"
            bind:this={duelFieldSlot}
          >
            {#key `${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`}
              <DuelFieldErrorBoundary
                board={duelBoard}
                layoutBoundaryElement={duelFieldSlot}
                imageLibrary={imagesMatchRuntime ? imageLibrary : null}
                cardBackUrl={imageLibrary?.cardBackUrl ?? ""}
                placeholderUrl={imageLibrary?.placeholderUrl ?? ""}
                prompt={effectivePrompt}
                spec={fieldInteractionSpec}
                session={$duel.interactionSession}
                pending={$duel.responsePending}
                presentationEvents={$duel.presentationEvents}
                feedbackGeneration={`${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`}
                injectFailure={injectDuelFieldFailure}
                oninteraction={duel.dispatchInteraction}
                onplacementintent={duel.armPlacementIntent}
                onpreview={previewFieldCard}
                onstackpreview={previewStackCard}
                {zoneLists}
                {offFieldTargets}
                onzonelistpreview={previewZoneListEntry}
                zoneListWindowPosition={$persistedUi.windows.zoneList}
                confirmWindowPosition={$persistedUi.windows.confirm}
                showZoneOutlines={$uiSettings.showZoneOutlines}
                showZoneCounts={$uiSettings.showZoneCounts}
                showCardShadows={$uiSettings.showCardShadows}
                showZoneLabels={$uiSettings.showZoneLabels}
                onzoneListWindowPositionChange={moveZoneListWindow}
                onconfirmWindowPositionChange={moveConfirmWindow}
                contextMessage={promptContextSegments}
                fullControl={$uiSettings.fullControl}
                fullControlHeld={ctrlHeld}
                onfullcontrolchange={uiSettings.setFullControl}
                endTurnArmed={endTurnAutomation.status === "armed"}
                onendturnstart={startEndTurnAutomation}
              />
            {/key}
          </div>
        {:else if $duel.snapshot}
          <section
            class="field-error"
            role="alert"
            data-cy="app-field-error-panel"
          >
            <h2 data-cy="app-field-error-heading">Duel field unavailable</h2>
            <p data-cy="app-field-error-copy">
              Prompt controls remain available.
            </p>
          </section>
        {/if}
      </div>
      {#if $duel.snapshot}
        <DuelRail
          turn={$duel.snapshot.turn}
          phase={$duel.snapshot.phase}
          turnPlayer={$duel.snapshot.turnPlayer}
          lifePoints={[
            $duel.snapshot.players[0].lifePoints,
            $duel.snapshot.players[1].lifePoints,
          ]}
          playerAvatarUrl=""
          opponentAvatarUrl=""
          status={railStatus}
          onopensettings={openMenu}
        />
      {/if}
    </div>
  {/if}

  {#if currentPromptSurface === "dialog" && effectivePrompt}
    {#key effectivePrompt.id}
      <PromptDialog
        prompt={effectivePrompt}
        disabled={$duel.responsePending}
        onsubmit={duel.respond}
        contextMessage={promptContextSegments}
      />
    {/key}
  {/if}

  {#if $duel.snapshot}
    {#if $uiSettings.showDuelHud}
      <DuelHud
        snapshot={$duel.snapshot}
        cardTexts={activeCardTexts}
        imageLibrary={imagesMatchRuntime ? imageLibrary : null}
        placeholderUrl={imageLibrary?.placeholderUrl ??
          DEFAULT_CARD_PLACEHOLDER}
        oninspect={previewHudCard}
      />
    {/if}
  {:else if $duel.status === "active"}
    <section
      class="message-panel"
      aria-live="polite"
      data-cy="app-preparing-duel-panel"
    >
      <div data-cy="app-preparing-duel-body">
        <p class="eyebrow" data-cy="app-preparing-duel-eyebrow">
          Preparing duel
        </p>
        <h2 data-cy="app-preparing-duel-heading">
          Waiting for the first public state…
        </h2>
      </div>
    </section>
  {/if}

  {#if $uiSettings.showWorkspace}
    <div class="workspace-grid" data-cy="workspace-grid">
      <section
        class="prompt-panel"
        aria-label="Current decision"
        tabindex="-1"
        bind:this={promptPanel}
        data-cy="prompt-panel"
      >
        {#if effectivePrompt}
          {#key effectivePrompt.id}
            <PromptControls
              prompt={effectivePrompt}
              disabled={$duel.responsePending}
              onsubmit={duel.respond}
              contextMessage={promptContextSegments}
            />
          {/key}
        {:else}
          <p class="eyebrow" data-cy="prompt-panel-eyebrow">Current decision</p>
          <h2 data-cy="prompt-panel-heading">No decision pending</h2>
          <p class="empty-copy" data-cy="prompt-panel-empty-copy">
            {$duel.responsePending
              ? "Your response was sent. Waiting for the engine…"
              : "The engine will pause here when your input is required."}
          </p>
        {/if}
      </section>

      <DuelLog entries={$duel.duelLog} />
    </div>
  {/if}

  {#if menuOpen}
    <MenuDialog
      surrenderAvailable={($duel.status === "active" ||
        $duel.status === "awaiting-input") &&
        !$duel.result}
      responsePending={$duel.responsePending}
      onopensettings={() => {
        menuOpen = false;
        openSettings();
      }}
      onsurrender={() => duel.surrender()}
      {onleavematch}
      onclose={() => void closeMenu()}
    />
  {/if}

  {#if settingsOpen}
    <SettingsDialog
      settings={$uiSettings}
      coreVersion={$duel.coreVersion}
      activeSnapshotId={snapshotStorageStatus.activeSnapshotId}
      fallbackSnapshotId={snapshotStorageStatus.fallbackSnapshotId}
      onshowduelhud={uiSettings.setShowDuelHud}
      onshowworkspace={uiSettings.setShowWorkspace}
      onautoplacecards={uiSettings.setAutoPlaceCards}
      onautoresolvetrivialprompts={uiSettings.setAutoResolveTrivialPrompts}
      onshowzoneoutlines={setShowZoneOutlines}
      onshowzonecounts={setShowZoneCounts}
      onshowcardshadows={setShowCardShadows}
      onshowzonelabels={setShowZoneLabels}
      onreset={resetUiSettings}
      ondownloaddiagnostics={diagnosticsAvailable ? requestDiagnostics : null}
      onclose={() => void closeSettings()}
    />
  {/if}

  {#if $duel.result}
    <DuelResultDialog
      result={$duel.result}
      completed={$duel.status === "completed"}
      {diagnosticPending}
      onrestart={() => void duel.restart()}
      onchangedecks={() => void changeDecks()}
      ondownloaddiagnostics={requestDiagnostics}
    />
  {/if}
</main>

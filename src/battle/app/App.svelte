<script lang="ts">
  import { afterUpdate, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { DuelDeckSelection } from "../duel/contracts/duel-deck-selection.ts";
  import type { DuelDiagnosticTrace } from "../duel/contracts/duel-diagnostics.ts";
  import type { PlayerPrompt } from "../duel/contracts/player-prompt.ts";
  import {
    snapshotId,
    type PromptId,
    type SnapshotId,
  } from "../duel/contracts/ids.ts";
  import type {
    PublicCard,
    PublicDuelState,
  } from "../duel/contracts/public-duel-state.ts";
  import {
    mapSnapshotToBoard,
    type BoardCardView,
    type BoardStackView,
  } from "../field/board-view-model.ts";
  import { zoneListsForBoard, type ZoneListEntry } from "../field/zone-list.ts";
  import {
    offFieldTargetEntries,
    type OffFieldTargetEntry,
  } from "../field/off-field-target-list.ts";
  import type { PhysicalZoneId } from "../field/duel-field-layout.ts";
  import DuelRail from "./components/DuelRail.svelte";
  import DeckPicker from "./components/DeckPicker.svelte";
  import DuelResultDialog from "./components/DuelResultDialog.svelte";
  import MenuDialog from "./components/MenuDialog.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import CardPreviewPanel from "./components/CardPreviewPanel.svelte";
  import DuelFieldErrorBoundary from "./components/duel-field/DuelFieldErrorBoundary.svelte";
  import FullControlToggle from "./components/duel-field/FullControlToggle.svelte";
  import DuelHud from "./components/duel-field/DuelHud.svelte";
  import DuelLog from "./components/duel-field/DuelLog.svelte";
  import LoadingOverlay from "./components/LoadingOverlay.svelte";
  import { downloadDuelDiagnostics } from "./diagnostics/download-diagnostics.ts";
  import { DuelWorkerClient } from "./DuelWorkerClient.ts";
  import {
    CardImageCache,
    createPlaceholderCardImageLibrary,
    type CardImageLibrary,
  } from "./images/card-image-cache.ts";
  import {
    pruneRevisionCaches,
    withSnapshotUpdateLock,
  } from "../storage/revision-cache-cleanup.ts";
  import {
    SnapshotStore,
    type SnapshotArtifactReceipt,
    type SnapshotStorageStatus,
  } from "../storage/snapshot-store.ts";
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
  import { promptSurface } from "./prompts/prompt-surface.ts";
  import { DECK_CATALOG } from "../duel/presets/deck-catalog.ts";
  import {
    findSelectableDeck,
    listSelectableDecks,
    presetSelectableDecks,
    supportedDuelCardCodes,
    type SelectableDeck,
  } from "../decks/selectable-decks.ts";
  import {
    catalogByCode,
    PROTOTYPE_RULESET,
  } from "../../decks/catalog/pinned-ruleset.ts";
  import { activeCatalog } from "../../decks/catalog/active-catalog.ts";
  import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";
  import {
    battleFacadeFailure,
    battleResultForDuelResult,
    toDuelDeckSelection,
    type BattleFacadeResult,
  } from "../battle-contracts.ts";
  import {
    createDuelStore,
    type DuelViewState,
    type SequencedPresentationEvent,
  } from "./stores/duel-store.ts";
  import {
    DEFAULT_PERSISTED_UI_STATE,
    type PersistedWindowPosition,
  } from "./stores/persisted-ui-state.ts";
  import { createPersistedUiStore } from "./stores/persisted-ui-store.ts";
  import {
    createUiSettingsStore,
    DEFAULT_UI_SETTINGS,
    type UiSettingsState,
  } from "./stores/ui-settings-store.ts";

  /* Set by the battle facade when a host is waiting for this duel's outcome.
     Left undefined in standalone mode, where the duel reports nothing
     outwards and behaves exactly as it did before the facade existed. */
  export let onbattlecomplete:
    ((result: BattleFacadeResult) => void) | undefined = undefined;

  const CURRENT_RUNTIME_SNAPSHOT_ID = snapshotId(__RUNTIME_SNAPSHOT_ID__);
  const CURRENT_ACTIVATION_SNAPSHOT_ID = snapshotId(__ACTIVATION_SNAPSHOT_ID__);
  const DEFAULT_CARD_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2318243b'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%23697895' stroke-width='2'/%3E%3Ctext x='36' y='57' fill='%23a9b5ca' font-size='28' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E";
  /* Every card this build packages, which is both what the field needs a name
     and effect text for and what a local deck may hold. One read, so the
     duel's copy and the editor's catalog cannot name different card sets. */
  const ACTIVE_CARDS = activeCatalog();
  const ACTIVE_CARD_TEXTS = new Map(
    ACTIVE_CARDS.map((card) => [card.code, card] as const),
  );
  const EMPTY_ZONE_LISTS: ReadonlyMap<
    PhysicalZoneId,
    readonly ZoneListEntry[]
  > = new Map();
  const EMPTY_OFF_FIELD_TARGETS: readonly OffFieldTargetEntry[] = [];
  const CURRENT_ARTIFACT_RECEIPTS: readonly SnapshotArtifactReceipt[] = [
    { id: "runtime-package", sha256: __RUNTIME_MANIFEST_SHA256__ },
    { id: "active-images", sha256: __ACTIVE_IMAGE_MANIFEST_SHA256__ },
  ];
  /* The pinned catalog every local deck is validated against: the same cards
     the editor offered when the deck was built, because both derive it from
     this build's packaged card set. Built once, it is fixed for the life of
     the build. */
  const DECK_BUILDER_CATALOG = catalogByCode(ACTIVE_CARDS);
  const client = new DuelWorkerClient();
  const duel = createDuelStore(client);
  const persistedUi = createPersistedUiStore();
  const uiSettings = createUiSettingsStore({
    ...DEFAULT_UI_SETTINGS,
    ...$persistedUi.settings,
  });
  let pickerOpen = true;
  let duelFieldSlot: HTMLElement | null = null;
  let menuOpen = false;
  let settingsOpen = false;
  let menubarTrigger: HTMLButtonElement | null = null;
  let generationContext = "";
  let promptPanel: HTMLElement;
  let errorHeading: HTMLHeadingElement;
  let previousErrorKey = "";
  let imageLibrary: CardImageLibrary | null = null;
  let imageLibraryVerified = false;
  let imageLoading = true;
  let retryImages: () => void = () => undefined;
  let requestFallbackImages: (
    snapshot: SnapshotId,
    manifestSha256: string,
  ) => void = () => undefined;
  let prepareFallbackImages: () => void = () => undefined;
  let fallbackImageAttempted: SnapshotId | null = null;
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
  let injectDuelFieldFailure = false;
  let diagnosticPending = false;
  let diagnosticMessage: string | null = null;
  let downloadedDiagnostics = $duel.diagnostics;
  let snapshotStore: SnapshotStore | null = null;
  let snapshotStorageStatus: SnapshotStorageStatus = {
    activeSnapshotId: null,
    fallbackSnapshotId: null,
    generation: 0,
  };
  let storageWarning: string | null = null;
  let retryStorage: () => void = () => undefined;
  let snapshotStaged = false;
  let snapshotActivationPending = false;
  let snapshotActivationAttempted = false;
  let appDisposed = false;
  let battleCompletionReported = false;
  /* Subscribed rather than derived with `$:`: reactive statements run once per
     flush, so two results arriving in the same tick would report the later
     one. The host is promised the first ending the duel reached. */
  const stopBattleCompletionReports = duel.subscribe(reportBattleCompletion);
  const pendingStorageOperations = new SvelteSet<Promise<unknown>>();
  $: boardResult =
    $duel.snapshot === null
      ? null
      : mapSnapshotToBoard($duel.snapshot, ACTIVE_CARD_TEXTS, $duel.prompt);
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
  $: duelViewportOnly =
    layoutProfileConflict === null &&
    (duelBoard !== null || $duel.snapshot !== null) &&
    storageWarning === null &&
    !snapshotActivationPending &&
    imageWarning === null &&
    $duel.error === null &&
    diagnosticMessage === null &&
    !$uiSettings.showDuelHud &&
    !$uiSettings.showWorkspace;
  $: zoneLists =
    duelBoard === null
      ? EMPTY_ZONE_LISTS
      : zoneListsForBoard(duelBoard, $duel.snapshot, ACTIVE_CARD_TEXTS);
  $: mappedInteractionSpec = mapPromptToInteractionSpec(
    effectivePrompt,
    $duel.snapshot,
    duelBoard,
    $duel.context,
  );
  $: fieldInteractionSpec =
    mappedInteractionSpec.kind === "inactive" ? null : mappedInteractionSpec;
  /* T16: the target list is joined here, once, from the same sanitized
     snapshot the board came from. `fieldInteractionSpec` is derived from
     `effectivePrompt`, so the layout-conflict gate still holds. */
  $: offFieldTargets =
    fieldInteractionSpec === null || $duel.snapshot === null
      ? EMPTY_OFF_FIELD_TARGETS
      : offFieldTargetEntries(
          fieldInteractionSpec,
          $duel.snapshot,
          ACTIVE_CARD_TEXTS,
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
    storageWarning ??
    imageWarning ??
    diagnosticMessage ??
    (snapshotActivationPending
      ? "Activating verified snapshot"
      : $duel.responsePending
        ? "Response sent. Waiting for the engine"
        : imageLoading
          ? "Preparing active card images"
          : $duel.loading
            ? `Loading ${phaseLabel($duel.loading.stage)}`
            : "");

  onMount(() => {
    let disposed = false;
    injectDuelFieldFailure =
      new URLSearchParams(globalThis.location.search).get(
        "duelFieldFailure",
      ) === "once";
    appDisposed = false;
    let imageLoadGeneration = 0;
    let imageAbortController: AbortController | null = null;
    const applicationBaseUrl = new URL(
      import.meta.env.BASE_URL,
      globalThis.location.origin,
    ).href;
    const cardImageCache = new CardImageCache({ applicationBaseUrl });

    const initializeStorage = async (): Promise<void> => {
      storageWarning = null;
      const previousStore = snapshotStore;
      snapshotStore = null;
      previousStore?.close();
      const openOperation = SnapshotStore.open();
      let abandoned = false;
      void openOperation.then(
        (store) => {
          if (abandoned) store.close();
        },
        () => undefined,
      );
      try {
        const store = await withDeadline(
          openOperation,
          3_000,
          "Snapshot storage did not open in time",
        );
        if (disposed) {
          store.close();
          return;
        }
        snapshotStore = store;
        snapshotStorageStatus = await withDeadline(
          store.status(),
          3_000,
          "Snapshot status lookup timed out",
        );
        if (disposed) return;
        await store.cleanupAbandonedStaging(
          new Date(Date.now() - 24 * 60 * 60 * 1_000),
        );
        if (disposed) return;
        const stageOperation = store.stageSnapshot({
          snapshotId: CURRENT_ACTIVATION_SNAPSHOT_ID,
          revisions: __RUNTIME_REVISIONS__,
          requiredArtifacts: CURRENT_ARTIFACT_RECEIPTS,
        });
        try {
          await withDeadline(
            stageOperation,
            3_000,
            "Snapshot staging timed out",
          );
          if (disposed) return;
          snapshotStaged = true;
        } catch (error) {
          void stageOperation
            .then(() =>
              store.discardStagedSnapshot(CURRENT_ACTIVATION_SNAPSHOT_ID),
            )
            .catch((cleanupError: unknown) => {
              console.warn({
                event: "duel.app.snapshot_staging.cleanup_failed",
                err: cleanupError,
              });
            });
          throw error;
        }
      } catch (error) {
        abandoned = true;
        if (disposed) return;
        storageWarning =
          error instanceof Error
            ? `Snapshot storage is unavailable: ${error.message}`
            : "Snapshot storage is unavailable.";
      }
    };

    type ImageLoadRequest = {
      readonly snapshotId: SnapshotId;
      readonly manifestSha256: string;
    } | null;
    let lastImageRequest: ImageLoadRequest = null;
    const loadImages = async (
      request: ImageLoadRequest = null,
    ): Promise<void> => {
      lastImageRequest = request;
      const generation = ++imageLoadGeneration;
      imageAbortController?.abort(
        new DOMException("Card image attempt replaced", "AbortError"),
      );
      const controller = new AbortController();
      imageAbortController = controller;
      const imageDeadline = setTimeout(
        () =>
          controller.abort(
            new DOMException("Active image preload timed out", "TimeoutError"),
          ),
        15_000,
      );
      imageLoading = true;
      imageProgress = 0;
      imageWarning = null;
      imageLibraryVerified = false;
      try {
        const onProgress = (completed: number, total: number): void => {
          if (generation === imageLoadGeneration)
            imageProgress = completed / Math.max(total, 1);
        };
        const library =
          request === null
            ? await cardImageCache.preload(
                __ACTIVE_IMAGE_MANIFEST__,
                __ACTIVE_IMAGE_MANIFEST_SHA256__,
                onProgress,
                controller.signal,
              )
            : await cardImageCache.preloadCachedSnapshot(
                request.snapshotId,
                request.manifestSha256,
                onProgress,
                controller.signal,
              );
        if (disposed || generation !== imageLoadGeneration) library.dispose();
        else {
          imageLibrary?.dispose();
          imageLibrary = library;
          imageLibraryVerified = true;
          const unavailable = library.diagnostics.filter(
            ({ status }) => status === "missing" || status === "invalid",
          ).length;
          imageWarning =
            unavailable === 0
              ? request === null
                ? null
                : "Using card images from the last verified cached snapshot."
              : `${unavailable} card image${unavailable === 1 ? " is" : "s are"} using a placeholder.`;
        }
      } catch (error) {
        if (!disposed && generation === imageLoadGeneration) {
          const detail =
            error instanceof Error
              ? `Card image cache is unavailable: ${error.message}`
              : "Card image cache is unavailable.";
          imageLibrary?.dispose();
          const placeholderManifest =
            request === null
              ? __ACTIVE_IMAGE_MANIFEST__
              : {
                  ...__ACTIVE_IMAGE_MANIFEST__,
                  snapshotId: request.snapshotId,
                };
          imageLibrary = createPlaceholderCardImageLibrary(
            placeholderManifest,
            request?.manifestSha256 ?? __ACTIVE_IMAGE_MANIFEST_SHA256__,
            detail,
          );
          imageWarning = detail;
        }
      } finally {
        clearTimeout(imageDeadline);
        if (!disposed && generation === imageLoadGeneration)
          imageLoading = false;
      }
    };
    retryStorage = () =>
      trackStorageOperation("initialize-retry", initializeStorage());
    retryImages = () => void loadImages(lastImageRequest);
    prepareFallbackImages = () => {
      imageLoadGeneration += 1;
      imageAbortController?.abort(
        new DOMException("Switching to fallback images", "AbortError"),
      );
      imageLibraryVerified = false;
      imageLoading = true;
    };
    requestFallbackImages = (snapshot, manifestSha256) =>
      void loadImages({ snapshotId: snapshot, manifestSha256 });

    duel.initialize();
    trackStorageOperation("initialize", initializeStorage());
    void loadImages();
    void refreshSelectableDecks();
    return () => {
      disposed = true;
      appDisposed = true;
      deckListingGeneration += 1;
      stopBattleCompletionReports();
      imageAbortController?.abort(
        new DOMException("Application disposed", "AbortError"),
      );
      imageLibrary?.dispose();
      const storeToClose = snapshotStore;
      snapshotStore = null;
      void Promise.allSettled([...pendingStorageOperations]).finally(() =>
        storeToClose?.close(),
      );
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
      /* A new worker or session means new cards and a new image library
         generation, so the previewed card — and the image lease behind it —
         must not survive into the next duel. */
      previewCard = null;
    }
    if ($duel.error !== null) diagnosticPending = false;
    if (
      snapshotStaged &&
      !snapshotActivationPending &&
      !snapshotActivationAttempted &&
      imageLibrary !== null &&
      imageLibraryVerified &&
      $duel.coreVersion !== null &&
      $duel.runtimeSnapshotId === CURRENT_RUNTIME_SNAPSHOT_ID
    ) {
      snapshotActivationAttempted = true;
      trackStorageOperation("activate", finalizeSnapshotActivation());
    }
    if (
      $duel.coreVersion !== null &&
      $duel.runtimeSnapshotId !== null &&
      $duel.runtimeSnapshotId !== CURRENT_RUNTIME_SNAPSHOT_ID
    ) {
      if (storageWarning === null)
        storageWarning =
          "The current snapshot was unavailable. Using the last verified cached runtime.";
      const fallbackSnapshotId = $duel.runtimeSnapshotId;
      if (fallbackImageAttempted !== fallbackSnapshotId) {
        fallbackImageAttempted = fallbackSnapshotId;
        prepareFallbackImages();
        const imageDigest = $duel.activeImageManifestSha256;
        if (imageDigest === null) {
          imageWarning =
            "Verified fallback image metadata is unavailable; using placeholders.";
          imageLoading = false;
        } else requestFallbackImages(fallbackSnapshotId, imageDigest);
      }
    }
    const errorKey = $duel.error
      ? `${context}:${$duel.error.code}:${$duel.error.message}`
      : "";
    if (errorKey !== "" && errorKey !== previousErrorKey) errorHeading?.focus();
    previousErrorKey = errorKey;
  });

  $: if (
    $duel.diagnostics !== null &&
    $duel.diagnostics !== downloadedDiagnostics
  ) {
    // eslint-disable-next-line no-useless-assignment -- retained across reactive runs
    downloadedDiagnostics = $duel.diagnostics;
    diagnosticPending = false;
    handleDiagnosticsDownload($duel.diagnostics);
  }

  $: maybeAutoResolvePrompt(
    effectivePrompt,
    $duel.responsePending,
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

  async function finalizeSnapshotActivation(): Promise<void> {
    if (appDisposed) return;
    const store = snapshotStore;
    const images = imageLibrary;
    if (store === null || images === null || !imageLibraryVerified) return;
    snapshotActivationPending = true;
    const activationGuard = snapshotStorageStatus;
    try {
      const receipts: readonly SnapshotArtifactReceipt[] = [
        { id: "runtime-package", sha256: __RUNTIME_MANIFEST_SHA256__ },
        { id: "active-images", sha256: images.imageManifestSha256 },
      ];
      await store.verifyStagedSnapshot(
        CURRENT_ACTIVATION_SNAPSHOT_ID,
        receipts,
      );
      if (appDisposed) return;
      await withSnapshotUpdateLock(async () => {
        if (appDisposed) return;
        snapshotStorageStatus = await store.activateSnapshot(
          CURRENT_ACTIVATION_SNAPSHOT_ID,
          activationGuard.activeSnapshotId,
          activationGuard.generation,
        );
        const retained = new Set(await store.retainedRevisionCacheNames());
        await pruneRevisionCaches(retained).catch((error: unknown) => {
          console.warn({
            event: "duel.app.revision_cache.cleanup_failed",
            err: error,
          });
        });
      });
    } catch (error) {
      const latest = await store.status().catch(() => null);
      if (latest?.activeSnapshotId === CURRENT_ACTIVATION_SNAPSHOT_ID)
        snapshotStorageStatus = latest;
      else {
        storageWarning =
          error instanceof Error
            ? `Verified snapshot activation failed: ${error.message}`
            : "Verified snapshot activation failed.";
      }
    } finally {
      snapshotActivationPending = false;
    }
  }

  function trackStorageOperation(
    operationName: string,
    operation: Promise<unknown>,
  ): void {
    pendingStorageOperations.add(operation);
    void operation
      .catch((error: unknown) => {
        console.warn({
          event: "duel.app.storage.operation_failed",
          operation: operationName,
          snapshotId: $duel.runtimeSnapshotId,
          err: error,
        });
      })
      .finally(() => pendingStorageOperations.delete(operation));
  }

  function handleDiagnosticsDownload(trace: DuelDiagnosticTrace): void {
    try {
      downloadDuelDiagnostics(trace, {
        buildId: __APP_BUILD_ID__,
        userAgent: navigator.userAgent,
        language: navigator.language,
        activeSnapshotId: snapshotStorageStatus.activeSnapshotId,
        fallbackSnapshotId: snapshotStorageStatus.fallbackSnapshotId,
        imageCache: {
          provider: imageLibrary?.provider ?? "unavailable",
          snapshotId: imageLibrary?.snapshotId ?? null,
          verified: imageLibraryVerified,
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
      if (snapshotStore !== null) {
        void snapshotStore
          .recordDebugRun({
            id: crypto.randomUUID(),
            snapshotId: trace.snapshotId,
            createdAt: new Date().toISOString(),
            resultType: $duel.result?.type ?? "diagnostic",
            traceEntries: trace.entries.length,
          })
          .catch((error: unknown) => {
            storageWarning =
              error instanceof Error
                ? `Debug-run metadata was not saved: ${error.message}`
                : "Debug-run metadata was not saved.";
          });
      }
      diagnosticMessage =
        "Diagnostics downloaded. The file contains the production seed; share it carefully.";
    } catch (error) {
      diagnosticMessage =
        error instanceof Error
          ? `Unable to download diagnostics: ${error.message}`
          : "Unable to download diagnostics.";
    }
  }

  function requestDiagnostics(): void {
    diagnosticMessage = null;
    diagnosticPending = duel.requestDiagnostics();
    if (!diagnosticPending)
      diagnosticMessage = "Diagnostics are unavailable for this session.";
  }

  /* Seeded with the bundled decks so the picker is never briefly empty and
     Start is never briefly dead: reading the local library is what takes a
     moment, and it only ever adds rows. */
  let selectableDecks: readonly SelectableDeck[] =
    presetSelectableDecks(DECK_CATALOG);
  let pickerFallbackNotice = false;
  let pickerStartError: string | null = null;
  /* Every refresh is racing the one before it — the picker reopens while a
     mount-time listing is still reading IndexedDB — and only the newest may
     write, or a deck deleted a second ago comes back on screen. */
  let deckListingGeneration = 0;

  async function refreshSelectableDecks(): Promise<void> {
    const generation = (deckListingGeneration += 1);
    const listed = await listDecksOrBundledOnly();
    if (generation !== deckListingGeneration) return;
    selectableDecks = listed;
    reconcilePersistedDeckKeys();
  }

  /**
   * Re-reads the local deck library and drops anything this build could not
   * play. Nothing is repaired: a deck that misses the ruleset by one card is
   * simply absent, and stays exactly as its owner saved it.
   *
   * A library that will not open, or will not read, is not an error here. The
   * bundled decks are compiled into this build, so the picker still works; the
   * player just does not see decks the browser would not hand over.
   */
  async function listDecksOrBundledOnly(): Promise<readonly SelectableDeck[]> {
    let repository: IndexedDbDeckRepository | null = null;
    try {
      repository = await IndexedDbDeckRepository.open();
      return await listSelectableDecks(
        DECK_CATALOG,
        repository,
        DECK_BUILDER_CATALOG,
        PROTOTYPE_RULESET,
        supportedDuelCardCodes(),
      );
    } catch {
      return presetSelectableDecks(DECK_CATALOG);
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
    if (
      findSelectableDeck(selectableDecks, playerKey) !== null &&
      findSelectableDeck(selectableDecks, opponentKey) !== null
    )
      return;
    pickerFallbackNotice = true;
    persistedUi.setDecks(
      DEFAULT_PERSISTED_UI_STATE.decks.playerKey,
      DEFAULT_PERSISTED_UI_STATE.decks.opponentKey,
    );
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
    const next = cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS);
    if (next !== null) previewCard = next;
  }

  function previewStackCard(stack: BoardStackView): void {
    const code = stackTopCode(stack);
    if (code === undefined) return;
    const next = cardPreviewForCode(code, ACTIVE_CARD_TEXTS);
    if (next !== null) previewCard = next;
  }

  function previewZoneListEntry(entry: ZoneListEntry): void {
    if (entry.code === undefined) return;
    const next = cardPreviewForCode(entry.code, ACTIVE_CARD_TEXTS);
    if (next !== null) previewCard = next;
  }

  /* Still wired to `DuelHud`'s `oninspect`, so the HUD and the card trays need
     no change: the trigger button they hand over is irrelevant now that the
     panel replaces the modal inspector. ADR-014: a projected `PublicCard.code`
     is itself the projector-attested local-viewer capability, so
     `cardPreviewForPublicCard` reads that attestation instead of re-deriving
     identity visibility from face orientation. */
  function previewHudCard(card: PublicCard): void {
    const next = cardPreviewForPublicCard(card, ACTIVE_CARD_TEXTS);
    if (next !== null) previewCard = next;
  }

  function retryCardImageLoading(): void {
    if (
      $duel.runtimeSnapshotId !== null &&
      $duel.runtimeSnapshotId !== CURRENT_RUNTIME_SNAPSHOT_ID
    ) {
      fallbackImageAttempted = null;
      imageWarning = null;
      return;
    }
    retryImages();
  }

  function withDeadline<T>(
    operation: Promise<T>,
    milliseconds: number,
    message: string,
  ): Promise<T> {
    return Promise.race([
      operation,
      new Promise<T>((_resolve, reject) =>
        setTimeout(() => reject(new Error(message)), milliseconds),
      ),
    ]);
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
  <title>Preset Duel · YGO Story Duel Simulator</title>
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
  {:else if snapshotActivationPending}
    <LoadingOverlay label="Activating verified snapshot" />
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

  {#if storageWarning || snapshotActivationPending}
    <section
      class="message-panel storage-warning"
      aria-busy={snapshotActivationPending}
      data-cy="app-storage-warning-panel"
    >
      <div data-cy="app-storage-warning-body">
        <p class="eyebrow" data-cy="app-storage-warning-eyebrow">
          Local snapshot storage
        </p>
        <p data-cy="app-storage-warning-message">
          {snapshotActivationPending
            ? "Activating verified snapshot…"
            : storageWarning}
        </p>
      </div>
      {#if storageWarning && snapshotStaged && $duel.runtimeSnapshotId === CURRENT_RUNTIME_SNAPSHOT_ID}
        <button
          type="button"
          class="secondary"
          disabled={snapshotActivationPending}
          data-cy="app-retry-snapshot-activation-button"
          onclick={() => {
            storageWarning = null;
            snapshotActivationAttempted = false;
          }}
          >{snapshotActivationPending
            ? "Activating snapshot…"
            : "Retry snapshot activation"}</button
        >
      {:else if storageWarning && !snapshotStaged}
        <button
          type="button"
          class="secondary"
          data-cy="app-retry-storage-button"
          onclick={retryStorage}>Retry local storage</button
        >
      {/if}
    </section>
  {/if}

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

  {#if $duel.error}
    <section
      class:recoverable={$duel.error.recoverable}
      class="message-panel error-panel"
      role="alert"
      aria-labelledby="duel-error-heading"
      data-cy="app-error-panel"
    >
      <div data-cy="app-error-body">
        <p class="eyebrow" data-cy="app-error-eyebrow">
          {$duel.status === "failed"
            ? "Duel stopped"
            : "Choice needs attention"}
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
        {#if $duel.error.recoverable && $duel.status !== "failed"}
          <button
            type="button"
            class="secondary"
            data-cy="app-dismiss-error-button"
            onclick={() => void dismissRecoverableError()}>Dismiss</button
          >
        {:else}
          <button
            type="button"
            data-cy="app-retry-duel-button"
            onclick={() => void duel.retry()}>Try again</button
          >
        {/if}
        {#if $duel.context.sessionGeneration > 0 && $duel.status === "failed"}
          <span class="sensitive-note" data-cy="app-error-sensitive-note"
            >Contains the production seed.</span
          >
          <button
            type="button"
            class="secondary"
            disabled={diagnosticPending}
            data-cy="app-error-download-diagnostics-button"
            onclick={requestDiagnostics}
            >{diagnosticPending
              ? "Preparing diagnostics…"
              : "Download diagnostics"}</button
          >
        {/if}
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
      opponentKey={$persistedUi.decks.opponentKey}
      fallbackNotice={pickerFallbackNotice}
      startError={pickerStartError}
      onselect={selectDecks}
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
              phase={$duel.snapshot?.phase ?? "unknown"}
              zoneListWindowPosition={$persistedUi.windows.zoneList}
              confirmWindowPosition={$persistedUi.windows.confirm}
              showZoneOutlines={$uiSettings.showZoneOutlines}
              showZoneCounts={$uiSettings.showZoneCounts}
              onzoneListWindowPositionChange={moveZoneListWindow}
              onconfirmWindowPositionChange={moveConfirmWindow}
            />
          {/key}
          <FullControlToggle
            effective={effectiveFullControl}
            onchange={uiSettings.setFullControl}
          />
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
      />
    {/key}
  {/if}

  {#if $duel.snapshot}
    {#if $uiSettings.showDuelHud}
      <DuelHud
        snapshot={$duel.snapshot}
        cardTexts={ACTIVE_CARD_TEXTS}
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
      onreset={resetUiSettings}
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

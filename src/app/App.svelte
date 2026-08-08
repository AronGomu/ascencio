<script lang="ts">
  import { afterUpdate, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { isCardIdentityVisible } from "../duel/card-visibility.ts";
  import type { DuelDiagnosticTrace } from "../duel/contracts/duel-diagnostics.ts";
  import { snapshotId, type SnapshotId } from "../duel/contracts/ids.ts";
  import type { PublicCard } from "../duel/contracts/public-duel-state.ts";
  import {
    mapSnapshotToBoard,
    type BoardCardView,
  } from "../field/board-view-model.ts";
  import AppMenubar from "./components/AppMenubar.svelte";
  import MenuDialog from "./components/MenuDialog.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import CardInspector from "./components/duel-field/CardInspector.svelte";
  import DuelFieldErrorBoundary from "./components/duel-field/DuelFieldErrorBoundary.svelte";
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
  import { mapPromptToInteractionSpec } from "./prompts/interaction-spec.ts";
  import { promptSurface } from "./prompts/prompt-surface.ts";
  import { createDuelStore } from "./stores/duel-store.ts";
  import { createUiSettingsStore } from "./stores/ui-settings-store.ts";

  const CURRENT_RUNTIME_SNAPSHOT_ID = snapshotId(__RUNTIME_SNAPSHOT_ID__);
  const CURRENT_ACTIVATION_SNAPSHOT_ID = snapshotId(__ACTIVATION_SNAPSHOT_ID__);
  const DEFAULT_CARD_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 104'%3E%3Crect width='72' height='104' rx='5' fill='%2318243b'/%3E%3Cpath d='M8 8h56v88H8z' fill='none' stroke='%23697895' stroke-width='2'/%3E%3Ctext x='36' y='57' fill='%23a9b5ca' font-size='28' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E";
  const ACTIVE_CARD_TEXTS = new Map(
    __ACTIVE_CARD_TEXTS__.map((record) => [record.code, record] as const),
  );
  const CURRENT_ARTIFACT_RECEIPTS: readonly SnapshotArtifactReceipt[] = [
    { id: "runtime-package", sha256: __RUNTIME_MANIFEST_SHA256__ },
    { id: "active-images", sha256: __ACTIVE_IMAGE_MANIFEST_SHA256__ },
  ];
  const client = new DuelWorkerClient();
  const duel = createDuelStore(client);
  const uiSettings = createUiSettingsStore();
  const autoStartedWorkerGenerations = new SvelteSet<number>();
  let menuOpen = false;
  let settingsOpen = false;
  let menubarTrigger: HTMLButtonElement | null = null;
  let generationContext = "";
  let promptPanel: HTMLElement;
  let resultHeading: HTMLHeadingElement;
  let errorHeading: HTMLHeadingElement;
  let cardInspectorTrigger: HTMLButtonElement | null = null;
  let previousErrorKey = "";
  let previousStatus = $duel.status;
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
  let inspectedCard: PublicCard | null = null;
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
  const pendingStorageOperations = new SvelteSet<Promise<unknown>>();
  $: boardResult =
    $duel.snapshot === null
      ? null
      : mapSnapshotToBoard($duel.snapshot, ACTIVE_CARD_TEXTS);
  $: duelBoard = boardResult?.ok === true ? boardResult.value : null;
  $: mappedInteractionSpec = mapPromptToInteractionSpec(
    $duel.prompt,
    $duel.snapshot,
    duelBoard,
    $duel.context,
  );
  $: fieldInteractionSpec =
    mappedInteractionSpec.kind === "inactive" ? null : mappedInteractionSpec;
  $: currentPromptSurface = promptSurface(
    $duel.prompt,
    mappedInteractionSpec,
    $uiSettings.showWorkspace,
  );
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

    menubarTrigger = document.querySelector<HTMLButtonElement>(
      '[data-cy="app-menubar-settings-button"]',
    );

    duel.initialize();
    trackStorageOperation("initialize", initializeStorage());
    void loadImages();
    return () => {
      disposed = true;
      appDisposed = true;
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
      inspectedCard = null;
    }
    if ($duel.error !== null) diagnosticPending = false;
    if (inspectedCard !== null) {
      const currentCard = findPublicCard(inspectedCard.instanceId);
      if (currentCard === null || !isInspectableCard(currentCard))
        inspectedCard = null;
      else if (currentCard !== inspectedCard) inspectedCard = currentCard;
    }
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
    if ($duel.status === "completed" && previousStatus !== "completed")
      resultHeading?.focus();
    previousStatus = $duel.status;
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

  $: if (
    $duel.status === "idle" &&
    $duel.coreVersion !== null &&
    !autoStartedWorkerGenerations.has($duel.context.workerGeneration)
  ) {
    autoStartedWorkerGenerations.add($duel.context.workerGeneration);
    queueMicrotask(() => duel.start());
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

  function inspectFieldCard(card: BoardCardView): void {
    if (card.instanceId === undefined) return;
    const publicCard = findPublicCard(card.instanceId);
    if (publicCard === null || !isInspectableCard(publicCard)) return;
    cardInspectorTrigger = null;
    inspectedCard = publicCard;
  }

  function inspectHudCard(card: PublicCard, trigger: HTMLButtonElement): void {
    if (!isInspectableCard(card)) return;
    cardInspectorTrigger = trigger;
    inspectedCard = card;
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

  function findPublicCard(instanceId: string): PublicCard | null {
    const snapshot = $duel.snapshot;
    if (snapshot === null) return null;
    for (const player of snapshot.players) {
      const card = [
        ...player.hand,
        ...player.extraDeck,
        ...player.monsters,
        ...player.spellsAndTraps,
        ...player.graveyard,
        ...player.banished,
      ].find((candidate) => candidate.instanceId === instanceId);
      if (card !== undefined) return card;
    }
    return null;
  }

  function isInspectableCard(card: PublicCard): boolean {
    return (
      card.code !== undefined &&
      isCardIdentityVisible(0, card.controller, card.location, card.position)
    );
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

  async function closeCardInspector(): Promise<void> {
    inspectedCard = null;
    await tick();
    cardInspectorTrigger?.focus();
    cardInspectorTrigger = null;
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && inspectedCard !== null) {
      event.preventDefault();
      void closeCardInspector();
    }
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
</script>

<svelte:head>
  <title>Preset Duel · YGO Story Duel Simulator</title>
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />

<AppMenubar onopensettings={openMenu} />

<main data-cy="app-main">
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

  {#if $duel.result}
    <section
      class="message-panel result-panel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={$duel.status !== "completed"}
      aria-labelledby="duel-result-heading"
      data-cy="app-result-panel"
    >
      <div data-cy="app-result-body">
        <p class="eyebrow" data-cy="app-result-eyebrow">Duel complete</p>
        <h2
          id="duel-result-heading"
          tabindex="-1"
          bind:this={resultHeading}
          data-cy="app-result-heading"
        >
          {#if $duel.result.type === "completed"}
            {$duel.result.winner === 0 ? "You won" : "Opponent won"}
          {:else if $duel.result.type === "surrendered"}
            Duel surrendered
          {:else if $duel.result.type === "unsupported"}
            Unsupported duel message
          {:else}
            Engine error
          {/if}
        </h2>
        {#if $duel.result.type === "completed"}
          <p data-cy="app-result-finish-reason">
            Finish reason {$duel.result.reason}
          </p>
        {:else if $duel.result.type === "unsupported"}
          <p data-cy="app-result-unsupported-detail">
            {$duel.result.detail}
          </p>
        {:else if $duel.result.type === "engineError"}
          <p data-cy="app-result-engine-error-detail">
            {$duel.result.detail}
          </p>
        {/if}
      </div>
      <div class="button-row" data-cy="app-result-actions">
        <button
          type="button"
          disabled={$duel.status !== "completed"}
          data-cy="app-restart-duel-button"
          onclick={() => void duel.restart()}
          >{$duel.status === "completed"
            ? "Start another duel"
            : "Starting another duel…"}</button
        >
        <span class="sensitive-note" data-cy="app-result-sensitive-note"
          >Contains the production seed.</span
        >
        <button
          type="button"
          class="secondary"
          disabled={diagnosticPending}
          data-cy="app-result-download-diagnostics-button"
          onclick={requestDiagnostics}
          >{diagnosticPending
            ? "Preparing diagnostics…"
            : "Download diagnostics"}</button
        >
      </div>
    </section>
  {/if}

  {#if diagnosticMessage}
    <p class="diagnostic-message" data-cy="app-diagnostic-message">
      {diagnosticMessage}
    </p>
  {/if}

  {#if duelBoard}
    {#key `${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`}
      <DuelFieldErrorBoundary
        board={duelBoard}
        imageLibrary={imagesMatchRuntime ? imageLibrary : null}
        cardBackUrl={imageLibrary?.cardBackUrl ?? ""}
        placeholderUrl={imageLibrary?.placeholderUrl ?? ""}
        prompt={$duel.prompt}
        spec={fieldInteractionSpec}
        session={$duel.interactionSession}
        pending={$duel.responsePending}
        presentationEvents={$duel.presentationEvents}
        feedbackGeneration={`${$duel.context.workerGeneration}:${$duel.context.sessionGeneration}`}
        injectFailure={injectDuelFieldFailure}
        oninteraction={duel.dispatchInteraction}
        oninspect={inspectFieldCard}
      />
    {/key}
  {:else if $duel.snapshot}
    <section class="field-error" role="alert" data-cy="app-field-error-panel">
      <h2 data-cy="app-field-error-heading">Duel field unavailable</h2>
      <p data-cy="app-field-error-copy">Prompt controls remain available.</p>
    </section>
  {/if}

  {#if currentPromptSurface === "dialog" && $duel.prompt}
    {#key $duel.prompt.id}
      <PromptDialog
        prompt={$duel.prompt}
        disabled={$duel.responsePending}
        imageLibrary={imagesMatchRuntime ? imageLibrary : null}
        placeholderUrl={imageLibrary?.placeholderUrl ??
          DEFAULT_CARD_PLACEHOLDER}
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
        oninspect={inspectHudCard}
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

  {#if inspectedCard}
    <CardInspector
      card={inspectedCard}
      cardTexts={ACTIVE_CARD_TEXTS}
      imageLibrary={imagesMatchRuntime ? imageLibrary : null}
      placeholderUrl={imageLibrary?.placeholderUrl ?? DEFAULT_CARD_PLACEHOLDER}
      onclose={() => void closeCardInspector()}
    />
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
        {#if $duel.prompt}
          {#key $duel.prompt.id}
            <PromptControls
              prompt={$duel.prompt}
              disabled={$duel.responsePending}
              onsubmit={duel.respond}
              imageLibrary={imagesMatchRuntime ? imageLibrary : null}
              placeholderUrl={imageLibrary?.placeholderUrl ??
                DEFAULT_CARD_PLACEHOLDER}
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
      onsurrender={() => {
        duel.surrender();
        menuOpen = false;
      }}
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
      onclose={() => void closeSettings()}
    />
  {/if}
</main>

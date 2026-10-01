<script lang="ts">
  import { onMount, setContext, tick, untrack } from "svelte";
  import type {
    FreeplayInputs,
    SessionByMode,
    ShellApplication,
  } from "./core/shell-application.ts";
  import type { SqliteApplicationStatus } from "./application/sqlite-application-service.ts";
  import { readonly, writable } from "svelte/store";
  import type { ShellGameplay } from "./core/installed-inputs.ts";
  import {
    loadCoreStartup,
    routeForCoreGate,
    type CoreGate,
  } from "./core/core-gate.ts";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import { createHandoffCoordinator } from "./handoff/handoff-coordinator.ts";
  import { STAGE_CONTEXT_KEY, TOAST_CONTEXT_KEY } from "./index.ts";
  import ToastHost from "./toast/ToastHost.svelte";
  import { createToastStore } from "./toast/toast-store.ts";
  import {
    collectionRoute,
    deckRoute,
    deckRouteContext,
    HOME_ROUTE,
    INSTALL_CONTENT_ROUTE,
    routeLabel,
    type AppRoute,
    type RouteContext,
  } from "./routes.ts";
  import { deckId } from "../decks/contracts/index.ts";
  import type { DeckContext } from "../decks/repository/index.ts";
  import type { CardOwnership } from "../decks/validation/index.ts";
  import type { Cards } from "../cards/index.ts";
  import type { StoryRelease, StoryMedia } from "../story/ports/index.ts";
  import type {
    GenerationSaveRepository,
    StorySlotKey,
    StoryBinding,
  } from "../story/saves/index.ts";
  import type { CardImageSource } from "../cards/images/index.ts";
  import type {
    BattlePresentationInput,
    BattleRuntimeSource,
  } from "../battle/ports/index.ts";
  import DomainLoadError from "./screens/DomainLoadError.svelte";
  import MainMenuScreen from "./screens/MainMenuScreen.svelte";
  import type { BattleFacadeResult, BattleRequest } from "../battle/index.ts";
  import type {
    CollectionCatalog,
    StoryDuelResolution,
    StoryEncounterRequest,
    StoryState,
  } from "../story/index.ts";
  import {
    createShellSettingsStore,
    type ShellSettingsStore,
  } from "./settings/shell-settings-store.ts";
  import type { UserPersistenceOwner } from "./application/user-persistence-owner.ts";
  import { unavailableUserServicesForTests } from "./core/unavailable-user-services.ts";
  import { defaultPersistedUiState } from "../battle/ports/index.ts";
  import { DEFAULT_STORY_PLAYBACK_SETTINGS } from "../story/playback/index.ts";
  import { DEFAULT_SHELL_SETTINGS } from "./settings/index.ts";
  import type {
    AdminResetResult,
    AdminStorageTarget,
  } from "./admin/admin-actions.ts";
  import type { StorageFailure } from "../storage/index.ts";
  import {
    createShellStore,
    writeLocationHash,
    type ShellStore,
    type StoryEntryIntent,
  } from "./shell-store.ts";
  import { computeStageBox, type StageBox } from "./stage-layout.ts";
  import type { AppUpdateController } from "./application/app-update-controller.ts";
  import {
    createManualContentController,
    type ManualContentController,
  } from "./application/manual-content-controller.ts";

  export let store: ShellStore = createShellStore(
    globalThis.location.hash,
    writeLocationHash,
  );
  export let loaders: DomainLoaders = DEFAULT_DOMAIN_LOADERS;
  export let settings: ShellSettingsStore | null = null;
  let activeSettings: ShellSettingsStore =
    settings ?? createShellSettingsStore();
  let users = unavailableUserServicesForTests();
  let initialStoryPlayback = DEFAULT_STORY_PLAYBACK_SETTINGS;
  let initialStoryReadLog: ReadonlySet<string> = new Set();
  let userPersistence: UserPersistenceOwner | null = null;
  let manualContent: ManualContentController | null = null;
  let userPersistenceError: StorageFailure["code"] | null = null;
  let applicationStatus: SqliteApplicationStatus = { warnings: [] };
  let unsubscribeApplicationStatus: (() => void) | null = null;
  let disposeRoot: (() => Promise<void>) | null = null;

  function observeUserFailure(error: StorageFailure): void {
    userPersistenceError = error.code;
  }

  function applyUserPersistence(owner: UserPersistenceOwner): void {
    if (userPersistence === owner) return;
    userPersistence = owner;
    users = owner.services;
    applyHydratedUserState(owner);
    if (manualContent !== null)
      void manualContent
        .dispose()
        .catch((error: unknown) =>
          console.warn("MANUAL_CONTENT_DISPOSAL_FAILED", error),
        );
    manualContent =
      owner.storage === null
        ? null
        : createManualContentController({
            storage: owner.storage,
            backups: owner,
            isSessionActive: () =>
              domainSession !== null || opening !== null || closingSession,
            onRestored: async () => refreshRootAfterRestore(owner),
            initialMediaWarnings: applicationStatus.warnings,
          });
    userPersistenceError = owner.failure?.code ?? null;
  }

  function applyHydratedUserState(owner: UserPersistenceOwner): void {
    initialStoryPlayback = owner.hydrated.storyPlayback;
    initialStoryReadLog = owner.hydrated.storyReadLog;
    if (settings === null)
      activeSettings = createShellSettingsStore(
        owner.hydrated.shell,
        owner.services.preferences.shell,
        observeUserFailure,
      );
  }

  async function refreshRootAfterRestore(
    owner: UserPersistenceOwner,
  ): Promise<void> {
    applyHydratedUserState(owner);
    handoff.invalidate();
    handback = null;
    sessionRequest = null;
    sessionHandoffId = null;
    hostedHandoffId = null;
    storyAutosaveRevision = 0;
    storyDeckToken += 1;
    collectionToken += 1;
    editorContext = null;
    collection = null;
    await import("./screens/free-play-deck-listing.ts").then((listing) =>
      listing.invalidateFreePlayDeckCache(),
    );
    application?.clear();
    // Installer owns the route here. Invalidate only: mounting consumers would
    // re-enter adapter admission while the restore barrier is held.
    boundDeckWorld = null;
    boundCollectionWorld = null;
  }

  async function resetUserTarget(
    target: AdminStorageTarget,
  ): Promise<AdminResetResult> {
    if (
      target.kind !== "user" ||
      userPersistence === null ||
      target.namespaces === undefined
    )
      throw new Error("USER_DATA_UNAVAILABLE");
    const result = await userPersistence.reset(target.namespaces);
    if (result.kind === "failed") {
      observeUserFailure(result.error);
      throw new Error(result.error.code);
    }
    if (target.namespaces.includes("preferences")) {
      initialStoryPlayback = DEFAULT_STORY_PLAYBACK_SETTINGS;
      if (settings === null)
        activeSettings = createShellSettingsStore(
          DEFAULT_SHELL_SETTINGS,
          users.preferences.shell,
          observeUserFailure,
        );
    }
    if (target.namespaces.includes("story-read-log"))
      initialStoryReadLog = new Set();
    return { outcome: "deleted" };
  }
  export let initialCoreGate: CoreGate | null = null;
  export let application: ShellApplication | null = null;
  export let appUpdates: AppUpdateController | null = null;
  let domainSession: SessionByMode[keyof SessionByMode] | null = null;
  let freeplayInputs: FreeplayInputs | null = null;
  let domainReady = false;
  let opening: AbortController | null = null;
  let openingMode: keyof SessionByMode | null = null;
  let closing: Promise<void> = Promise.resolve();
  let closingSession = false;
  let destroyed = false;
  let adminSeed: Promise<void> | null = null;
  let adminSeedAbort: AbortController | null = null;
  async function seedAdminDeck(signal: AbortSignal): Promise<void> {
    if (adminSeed !== null) throw new Error("APP_SESSION_ACTIVE");
    const app = application;
    if (app === null) throw new Error("APP_STORAGE_UNAVAILABLE");
    const controller = new AbortController();
    adminSeedAbort = controller;
    const linked = AbortSignal.any([signal, controller.signal]);
    const work = (async () => {
      await closing;
      linked.throwIfAborted();
      if (destroyed || requestedRoute.kind !== "admin")
        throw new DOMException("The operation was aborted.", "AbortError");
      const { seedAdminTestDeck } = await import("./admin/admin-actions.ts");
      await seedAdminTestDeck(app, linked);
    })();
    adminSeed = work;
    try {
      await work;
    } finally {
      adminSeed = null;
      adminSeedAbort = null;
    }
  }
  const disposals: Promise<void>[] = [];
  let recoveryMessage: string | null = null;
  let recovering = false;
  let menuRepository: GenerationSaveRepository | null;
  $: menuRepository =
    application === null ? saves : (userPersistence?.saves ?? null);
  let boundApplication: ShellApplication | null = null;
  let unsubscribeApplication: (() => void) | null = null;
  $: bindApplication(application);
  function bindApplication(app: ShellApplication | null): void {
    if (app === boundApplication) return;
    unsubscribeApplication?.();
    boundApplication = app;
    unsubscribeApplication = app?.subscribe(() => undefined) ?? null;
  }

  function applySession(session: SessionByMode[keyof SessionByMode]): void {
    if (session.kind === "freeplay") {
      freeplayInputs = session.inputs;
      users = session.inputs.users;
      cardImages = session.inputs.images;
    } else {
      users = session.inputs.users;
      gameplay = session.inputs.gameplay;
      storyRelease = session.inputs.release;
      storyCards = session.inputs.cards;
      storyMedia = session.inputs.media;
      saves = session.inputs.saves;
      cardImages = session.inputs.gameplay.editor().images;
    }
    queueMicrotask(refreshModeConsumers);
  }
  function closeDomain(): void {
    opening?.abort();
    domainReady = false;
    syncDomain(requestedRoute, application, coreGate.kind === "ready");
  }

  function routeMode(current: AppRoute): keyof SessionByMode | null {
    if (
      current.kind === "free-play" ||
      current.kind === "free-play-decks" ||
      current.kind === "free-play-deck" ||
      current.kind === "free-play-collection"
    )
      return "freeplay";
    if (
      current.kind === "story" ||
      current.kind === "story-decks" ||
      current.kind === "story-deck" ||
      current.kind === "story-collection" ||
      current.kind === "duel-session"
    )
      return "story";
    return null;
  }

  function syncDomain(
    current: AppRoute,
    app: ShellApplication | null,
    ready: boolean,
  ): void {
    if (app === null) return; // Explicit fixture injection only.
    const requestedMode = (requested = requestedRoute) =>
      destroyed ||
      manualContent?.view.navigationBlocked === true ||
      appUpdates?.view.phase === "approving" ||
      appUpdates?.view.phase === "committing" ||
      recovering ||
      application !== app ||
      coreGate.kind !== "ready"
        ? null
        : routeMode(requested);
    const mode = ready ? requestedMode(current) : null;
    if (opening !== null && (openingMode !== mode || destroyed))
      opening.abort();
    if (domainSession?.kind !== mode) domainReady = false;
    if (closingSession) return;
    if (domainSession?.kind === mode && domainReady) return;
    if (mode === null && domainSession === null) return;
    closingSession = true;
    closing = (async () => {
      // One reconciler owns acquire, teardown and release. Route changes only
      // invalidate its request; every await rechecks the latest target.
      while (true) {
        const target = requestedMode();
        const session = domainSession;
        if (session !== null) {
          if (session.kind === target) {
            domainReady = true;
            return;
          }
          domainReady = false;
          await tick(); // Battle teardown may return to the same Story session.
          await Promise.all(disposals.splice(0));
          if (session.kind === requestedMode()) continue;
          // Keep the session's save capability alive until admitted checkpoint
          // writes and revision-bound cleanup have finished.
          await handoff.reset().catch(domainError);
          domainSession = null;
          freeplayInputs = null;
          gameplay = null;
          storyRelease = null;
          storyCards = null;
          storyMedia = null;
          saves = null;
          cardImages = null;
          handback = null;
          await session.close();
          continue;
        }
        if (target === null) return;
        const controller = new AbortController();
        opening = controller;
        openingMode = target;
        let acquired: SessionByMode[keyof SessionByMode];
        try {
          acquired = await app.acquire(
            target,
            controller.signal,
            target === "story"
              ? {
                  intent: storyEntryIntent,
                  checkpoint: requestedRoute.kind === "duel-session",
                }
              : undefined,
          );
        } catch (error) {
          if (controller.signal.aborted) continue;
          throw error;
        } finally {
          opening = null;
          openingMode = null;
        }
        if (
          controller.signal.aborted ||
          application !== app ||
          requestedMode() !== acquired.kind
        ) {
          await acquired.close();
          continue;
        }
        domainSession = acquired;
        applySession(acquired);
        domainReady = true;
      }
    })()
      .catch((error: unknown) => {
        if (destroyed) console.warn("APP_DISPOSAL_FAILED");
        else recover(error);
      })
      .finally(() => {
        closingSession = false;
        syncDomain(requestedRoute, application, coreGate.kind === "ready");
      });
  }
  function recover(error: unknown): void {
    if (recovering) return;
    const reason =
      error instanceof Error && error.message === "APP_STORAGE_UNAVAILABLE"
        ? "storage-unavailable"
        : "content-invalid";
    recovering = true;
    recoveryMessage =
      "This session stopped because its required data became unavailable. Your saved progress was not replaced.";
    hostedHandoffId = null;
    store.navigate(HOME_ROUTE, { replace: true });
    closeDomain();
    void closing.then(
      () => {
        application?.clear();
        gameplay = null;
        saves = null;
        storyRelease = null;
        storyCards = null;
        coreGate = { kind: "locked", reason };
        recovering = false;
      },
      () => {
        // Disposal failure is visible, never reported as restored readiness.
        coreGate = { kind: "locked", reason: "storage-unavailable" };
        recovering = false;
      },
    );
  }
  const domainError = (error: unknown) => {
    if (application !== null) recover(error);
  };
  const trackDisposal = (done: Promise<void>) => {
    disposals.push(done);
  };
  let coreGate: CoreGate = initialCoreGate ?? { kind: "checking" };
  let duelDomain: ReturnType<DomainLoaders["duel"]> | null = null;
  const loadDuelDomain = (): ReturnType<DomainLoaders["duel"]> =>
    (duelDomain ??= loaders.duel());
  let gameplay: ShellGameplay | null = null;
  let battleRuntimeSource: BattleRuntimeSource | null;
  let battlePresentation: BattlePresentationInput | null;
  $: if (freeplayInputs !== null) {
    battleRuntimeSource = freeplayInputs.battle;
    battlePresentation = freeplayInputs.presentation;
  } else if (gameplay !== null) {
    battleRuntimeSource = gameplay.battle;
    battlePresentation = gameplay.presentation;
  } else {
    battleRuntimeSource = null;
    battlePresentation = null;
  }
  let cardImages: CardImageSource | null = null;
  /* Story progress is written by the shell only for the pre-duel checkpoint.
     The default reaches the repository through the visual novel's own lazy
     chunk, so `#/free-play` and its decks never load the story to hold it. */
  export let saves: GenerationSaveRepository | null = null;
  export let storyRelease: StoryRelease | null = null;
  export let storyCards: Cards | null = null;
  export let storyMedia: StoryMedia | null = null;

  let stage: HTMLElement | undefined;
  /* The two decks the match setup produced, and what decides whether
     `#/free-play` shows that setup or the duel: no request is the screen where
     both seats are chosen, a request is the duel it names. Held as one object
     for the whole match — the
     duel dispatches a request once per identity, so rebuilding an equal one
     here would restart the duel on every flush. */
  let matchRequest: BattleRequest | null = null;
  /* The same state for a story encounter, and held for the same reason: one
     frozen object for the whole duel. `null` is a session the shell could not
     build a request for, which leaves the duel to open its own picker rather
     than throwing the player out of an encounter that is already checkpointed. */
  let sessionRequest: BattleRequest | null = null;

  // T9 supplies selected generation under Shell lifecycle lease. Never infer legacy binding.
  function openStorySaves(): GenerationSaveRepository {
    if (saves === null || (application !== null && domainSession === null))
      throw new Error("STORY_MIGRATION_FAILED");
    return saves;
  }
  const lazySaves: GenerationSaveRepository = {
    read: async (slot: StorySlotKey) => openStorySaves().read(slot),
    write: async (
      slot: StorySlotKey,
      state: StoryState,
      expected: number | null,
      binding: StoryBinding,
    ) => openStorySaves().write(slot, state, expected, binding),
    list: async () => openStorySaves().list(),
    clear: async (slot: StorySlotKey, expected?: number) => {
      await openStorySaves().clear(slot, expected);
    },
  };

  /* The story builds its own deck context: the repository over the save, what
     that save owns and the name the editor puts on screen all come out of one
     read, so no pairing of them can be got wrong here (ADR-050). Reached
     through the same lazy import as the saves above — a static one would make
     the visual novel eager and collapse its chunk into the entry. */
  async function openStoryDeckContext(): Promise<DeckContext | null> {
    const story = await import("../story/index.ts");
    return await story.openStoryDeckContext(saves ?? lazySaves);
  }

  /* What the story is handed when it comes back from a duel: the state that
     was checkpointed before it started, and the one result it produced. Held
     only until the story adopts it, so a later remount cannot replay it. */
  let handback: {
    readonly state: StoryState;
    readonly story: StoryBinding;
    readonly resolution: StoryDuelResolution | null;
  } | null = null;
  let checkpointReadError: string | null = null;
  let sessionHandoffId: string | null = null;
  let sessionReady = false;
  /* The session the mounted duel belongs to. `syncSession` below runs as a
     pre-effect, so the route has already left the session by the time the duel
     region is torn down; this holds the id until that teardown result has been
     handed over, and only `settleSession` or a new session clears it. */
  let hostedHandoffId: string | null = null;

  const handoff = createHandoffCoordinator({
    saves: lazySaves,
    onReadError: (result) => {
      checkpointReadError =
        result.kind === "corrupt"
          ? `${result.slot}: ${result.reason}`
          : `${result.slot}: save schema ${String(result.found)} is incompatible`;
    },
    navigate: (target, options) => store.navigate(target, options),
    onResolution: (resolution) => {
      /* `onRestore` always ran first: a resolution can only exist for a duel
         whose checkpoint this coordinator wrote or restored. */
      if (handback !== null) handback = { ...handback, resolution };
    },
    onRestore: (state, story) => {
      handback = { state, story, resolution: null };
    },
  });

  /* Built before the checkpoint is written, and set before the navigation that
     mounts the duel: `App` decides whether to open its own deck picker from the
     request it is handed on mount, so a request arriving one flush late would
     leave the picker over a duel that had already started from it. */
  async function startEncounter(request: StoryEncounterRequest) {
    let built: BattleRequest;
    try {
      if (gameplay === null) return "deck-rejected";
      const [{ storyBattleRequest }, battle] = await Promise.all([
        import("./handoff/handoff-request.ts"),
        loadDuelDomain(),
      ]);
      built = storyBattleRequest(battle, request.deck, gameplay);
    } catch (error) {
      /* The duel's own parser refused the snapshot the briefing accepted, which
         means the two contracts drifted apart. The story says so and keeps the
         player on the screen they can change the deck from. */
      if (error instanceof Error && error.name === "BattleRequestError")
        return "deck-rejected" as const;
      domainError(error);
      throw error;
    }
    sessionRequest = built;
    const outcome = await handoff.begin(
      {
        handoffId: crypto.randomUUID(),
        encounterId: request.encounterId,
        label: request.label,
      },
      request.state,
      request.story,
    );
    if (outcome !== "ready") sessionRequest = null;
    return outcome;
  }

  /** The request a resumed session runs on, rebuilt from the checkpoint.

      A reload has nothing in memory, and the checkpoint carries the whole save
      — its decks, its default and its collection — so the deck resolves to the
      same snapshot the encounter started with. Reached through the story's lazy
      entry, which the checkpoint read on this route has already loaded, and
      through `loaders.duel()`, which the duel about to mount needs anyway. */
  async function restoredSessionRequest(
    state: StoryState,
  ): Promise<BattleRequest | null> {
    try {
      const story = await import("../story/index.ts");
      if (gameplay === null) return null;
      if (storyCards === null) return null;
      const deck = await story.encounterDeck(
        state,
        storyCards,
        gameplay.editor().ruleset,
      );
      /* The battle module is asked for second and only when there is a deck to
         seat with it: a checkpoint naming no fieldable deck must not pay for
         the largest chunk in the build to learn that. */
      if (deck === null || gameplay === null) return null;
      const [{ storyBattleRequest }, battle] = await Promise.all([
        import("./handoff/handoff-request.ts"),
        loadDuelDomain(),
      ]);
      return storyBattleRequest(battle, deck, gameplay);
    } catch (error) {
      domainError(error);
      return null;
    }
  }

  function settleSession(result: BattleFacadeResult): void {
    const settled = hostedHandoffId;
    hostedHandoffId = null;
    if (settled !== null) handoff.settle(settled, result);
  }

  /* A duel only mounts once its checkpoint has been found, so a route nobody
     can resume never becomes half a duel: `resume` sends it back to the story
     itself, and this region shows only that it is still looking. */
  function syncSession(current: AppRoute): void {
    if (
      current.kind === "duel-session" &&
      application !== null &&
      untrack(() => domainSession)?.kind !== "story"
    ) {
      sessionHandoffId = null;
      sessionReady = false;
      sessionRequest = null;
      hostedHandoffId = null;
      return;
    }
    if (current.kind !== "duel-session") {
      sessionHandoffId = null;
      sessionReady = false;
      sessionRequest = null;
      /* Leaving a session for free play is a mode change the player asked for,
         so the abort its teardown produces belongs to nobody: settling it here
         would send them straight back to the story they just left. Every other
         route the duel unmounts on still owes the story that abort. */
      if (current.kind === "free-play") hostedHandoffId = null;
      return;
    }
    if (sessionHandoffId === current.handoffId) return;
    const requested: string = current.handoffId;
    sessionHandoffId = requested;
    sessionReady = false;
    void handoff
      .resume(requested)
      .then(async (outcome) => {
        if (sessionHandoffId !== requested) return;
        /* Only ever the reload: the encounter that started this session in this
         tab already built its request, and rebuilding it would hand the duel a
         second object and restart the match it is running. `resume` restores
         the checkpoint before it answers, so the state is there to rebuild
         from whenever it answered `restored`. */
        const restored = handback?.state ?? null;
        if (
          outcome === "restored" &&
          sessionRequest === null &&
          restored !== null
        ) {
          const rebuilt = await restoredSessionRequest(restored);
          if (sessionHandoffId !== requested) return;
          sessionRequest = rebuilt;
        }
        sessionReady = outcome === "restored";
        if (sessionReady) hostedHandoffId = requested;
      })
      .catch(domainError);
  }

  let requestedRoute: AppRoute = HOME_ROUTE;
  let route: AppRoute;
  let previousRoute: AppRoute | null = null;
  let storyEntryIntent: StoryEntryIntent | null = null;
  let storyAutosaveRevision = 0;
  const unsubscribe = store.subscribe((state) => {
    // Covers hash/back/keyboard/programmatic routes before Story reset or mode
    // acquisition; button disabling alone cannot protect a destructive restore.
    if (
      (manualContent?.view.navigationBlocked === true ||
        appUpdates?.view.phase === "committing") &&
      state.route.kind !== "install-content"
    ) {
      store.navigate(INSTALL_CONTENT_ROUTE, { replace: true });
      return;
    }
    if (
      state.route.kind !== "install-content" &&
      (appUpdates?.view.phase === "approving" ||
        appUpdates?.view.phase === "checking")
    )
      appUpdates.cancel();
    if (state.storyEntryIntent === "new" && storyEntryIntent !== "new") {
      // Invalidate synchronously; observe and track cleanup without delaying
      // publication of the newest route/entry behind an older async callback.
      trackDisposal(handoff.reset().catch(domainError));
      handback = null;
      storyAutosaveRevision = 0;
    }
    if (state.route.kind !== "admin") adminSeedAbort?.abort();
    if (state.route.kind !== "story" && state.route.kind !== "duel-session")
      checkpointReadError = null;
    requestedRoute = state.route;
    previousRoute = state.previousRoute;
    storyEntryIntent = state.storyEntryIntent;
  });
  /* Project the requested route before every reactive binding below. During the
     bootstrap check a direct gameplay hash already renders CORE; once failure is
     known, replace that unsafe history entry with the canonical installer. */
  $: domainGateReady = coreGate.kind === "ready";
  $: syncDomain(requestedRoute, application, domainGateReady);
  $: route =
    application !== null &&
    routeMode(requestedRoute) !== null &&
    (!domainReady || domainSession?.kind !== routeMode(requestedRoute)) &&
    coreGate.kind === "ready"
      ? HOME_ROUTE
      : routeForCoreGate(requestedRoute, coreGate);
  $: if (
    coreGate.kind === "locked" &&
    requestedRoute.kind !== "home" &&
    requestedRoute.kind !== "install-content"
  )
    store.navigate(INSTALL_CONTENT_ROUTE, { replace: true });
  $: syncSession(route);
  /* Which pairing the duel below mounts on: the one free play's setup screen
     produced, or the one the story's encounter chose. `#/duel` standalone has
     neither and opens the duel's own picker, which is what it has always done.
     Both sides hold one object per match, so this reads a reference rather
     than building one — a fresh equal object here would restart the duel. */
  $: duelRequest =
    route.kind === "free-play"
      ? matchRequest
      : route.kind === "duel-session"
        ? sessionRequest
        : null;
  /* Leaving free play ends its match, so coming back opens on the seats rather
     than on a duel nobody asked to resume. */
  $: if (route.kind !== "free-play") leaveMatch();
  /* Which deck library the route names, so one editor region serves both
     contexts and hands navigation back in the one it was reached from. */
  $: deckContext = deckRouteContext(route);
  $: bindDeckContext(deckContext);
  $: editorReturnRoute =
    deckContext === null
      ? HOME_ROUTE
      : previousRoute === null || deckRouteContext(previousRoute) !== null
        ? deckRoute(deckContext, null)
        : previousRoute;
  $: editorReturnLabel =
    previousRoute === null || deckRouteContext(previousRoute) !== null
      ? "Deck Selection"
      : routeLabel(previousRoute);
  /* The same question for the collection, which is two routes over one screen
     for the same reason the editor is two over one: a save's cards and free
     play's database are the same browsing, over a different pool. */
  $: collectionContext = collectionContextFor(route);
  $: bindCollection(collectionContext);

  function leaveMatch(): void {
    matchRequest = null;
  }

  /** Starts the reads free play opens on, before the player has asked for it.

      Both are the shell's own lazy imports: the setup screen's chunk and, from
      the module it carries, the battle entry and the deck library it lists.
      Called when a player reaches for Free Play rather than when the main menu
      mounts — the whole packaged card database is behind that listing, and a
      player who came for the story must not pay for it. */
  function warmFreePlay(): void {
    // Selected domains start their reads under the route lease, never a menu hover.
    if (application !== null) return;
    void (async () => {
      const [listing] = await Promise.all([
        import("./screens/free-play-deck-listing.ts"),
        import("./screens/FreePlayMatchSetup.svelte"),
      ]);
      if (gameplay !== null)
        listing.warmFreePlayDecks(
          loadDuelDomain,
          gameplay.presentation,
          users.createDeckRepository,
          gameplay.editor().ruleset,
          domainError,
        );
    })().catch(domainError);
  }

  /* Which world the mounted editor writes into, and the world it was bound for.
     Held apart so moving between a library and one of its decks keeps the one
     binding: rebuilding it would drop the editing session the story adapter
     holds in that closure — its undo log and last-opened deck.

     Free play is a value, so the editor is bound before the first paint. A save
     has to be read first, and until it answers the region shows nothing rather
     than an editor over the wrong library. */
  let boundDeckWorld: RouteContext | null = null;
  let editorContext: DeckContext | null = null;
  let storyDeckToken = 0;

  function bindDeckContext(world: RouteContext | null): void {
    if (world === boundDeckWorld) return;
    boundDeckWorld = world;
    editorContext =
      world === "free-play"
        ? { kind: "free-play", createRepository: users.createDeckRepository }
        : null;
    const requested = ++storyDeckToken;
    if (world !== "story") return;
    if (application !== null && untrack(() => domainSession)?.kind !== "story")
      return;
    void openStoryDeckContext().then(
      (bound) => {
        if (requested !== storyDeckToken) return;
        /* No save is loaded, so there are no decks to edit and nothing to name.
           The main menu is where a story route with nothing to show goes
           (ADR-051); replaced rather than pushed, because the player asked for
           a deck library rather than for this correction. */
        if (bound === null) store.navigate(HOME_ROUTE, { replace: true });
        else editorContext = bound;
      },
      () => {
        if (requested === storyDeckToken)
          if (application === null)
            store.navigate(HOME_ROUTE, { replace: true });
          else recover(new Error("APP_REQUIRED_INPUT_FAILED"));
      },
    );
  }

  /* The collection screen is not part of the visual novel's own surface, so it
     ships as its own chunk behind `loadCollectionScreen` rather than inside the
     story entry. This is the type of what that loader hands back. */
  type CollectionScreenComponent = Awaited<
    ReturnType<(typeof import("../story/index.ts"))["loadCollectionScreen"]>
  >;

  /* What the collection region renders, or `null` while it is still being
     read. Held as one object so the pool, what owns it and the world it was
     opened for can never be paired wrong — the same reason `DeckContext`
     carries its ownership rather than sitting beside it. */
  interface OpenCollection {
    readonly context: RouteContext;
    readonly ownership: CardOwnership;
    readonly catalog: CollectionCatalog;
    readonly Screen: CollectionScreenComponent;
  }

  let collection: OpenCollection | null = null;
  let boundCollectionWorld: RouteContext | null = null;
  let collectionToken = 0;

  function bindCollection(world: RouteContext | null): void {
    if (world === boundCollectionWorld) return;
    boundCollectionWorld = world;
    collection = null;
    const requested = ++collectionToken;
    if (world === null) return;
    const mode = world === "story" ? "story" : "freeplay";
    if (application !== null && untrack(() => domainSession)?.kind !== mode)
      return;
    void openCollection(world, requested).then(
      (opened) => {
        if (requested !== collectionToken) return;
        /* No save is loaded, so there is no collection to browse. The main menu
           is where a story route with nothing to show goes (ADR-051), and it is
           replaced rather than pushed because the player asked for their cards
           rather than for this correction. */
        if (opened === null) store.navigate(HOME_ROUTE, { replace: true });
        else collection = opened;
      },
      () => {
        if (requested === collectionToken)
          if (application === null)
            store.navigate(HOME_ROUTE, { replace: true });
          else recover(new Error("APP_REQUIRED_INPUT_FAILED"));
      },
    );
  }

  function collectionContextFor(current: AppRoute): RouteContext | null {
    return current.kind === "story-collection"
      ? "story"
      : current.kind === "free-play-collection"
        ? "free-play"
        : null;
  }

  function refreshModeConsumers(): void {
    boundDeckWorld = null;
    bindDeckContext(deckRouteContext(requestedRoute));
    boundCollectionWorld = null;
    bindCollection(collectionContextFor(requestedRoute));
  }

  /** The pool a collection route browses, or `null` for a story route with no
      save behind it.

      Both halves come from the visual novel's lazy entry: free play's ownership
      is the shared one from `src/decks/`, but the card database read and the
      rarity every tile is grouped by are resolved from the shop's set data,
      which only the story may reach. */
  async function openCollection(
    world: RouteContext,
    requested: number,
  ): Promise<OpenCollection | null> {
    const [story, { unlimitedCardOwnership }] = await Promise.all([
      import("../story/index.ts"),
      import("../decks/validation/index.ts"),
    ]);
    let ownership: CardOwnership = unlimitedCardOwnership();
    if (world === "story") {
      const bound = await story.openStoryDeckContext(saves ?? lazySaves);
      if (bound === null || bound.kind !== "story") return null;
      ownership = bound.ownership;
    }
    /* Collection keeps global search metadata in memory but leaves media on
       injected CardImageSource. CardPreviewHost acquires only selected cards
       and releases each lease on selection/navigation. */
    const currentFreeplay = world === "free-play" && application !== null;
    const definitions = currentFreeplay
      ? freeplayInputs?.cards
      : gameplay?.cards;
    const sets = currentFreeplay
      ? freeplayInputs?.collectionSets
      : gameplay?.sets;
    if (definitions === undefined || sets === undefined) return null;
    const [catalog, Screen] = await Promise.all([
      story.loadCollectionCatalog(definitions, sets),
      story.loadCollectionScreen(),
    ]);
    if (requested !== collectionToken) return null;
    return { context: world, ownership, catalog, Screen };
  }

  const readViewportBox = (): StageBox =>
    computeStageBox(globalThis.innerWidth, globalThis.innerHeight);

  /* The shell is the only place the viewport is measured: domains read the
     resulting box through `STAGE_CONTEXT_KEY` instead of measuring again. The
     stage's own pixel box is not taken from here — `.app-stage` derives it in
     CSS so it lands in the same layout pass as the resize, and this store only
     mirrors it for domains and for `data-stage-mode`. */
  const stageBox = writable<StageBox>(readViewportBox());
  setContext(STAGE_CONTEXT_KEY, readonly(stageBox));
  const toasts = createToastStore();
  setContext(TOAST_CONTEXT_KEY, toasts);
  let box: StageBox;
  const unsubscribeStage = stageBox.subscribe((value) => {
    box = value;
  });

  onMount(() => {
    let mounted = true;
    if (initialCoreGate === null) {
      const appBaseUrl = new URL(
        import.meta.env.BASE_URL,
        globalThis.location.origin,
      ).href;
      void loadCoreStartup(
        (input, init) => globalThis.fetch(input, init),
        appBaseUrl,
        globalThis.indexedDB,
      )
        .then(async (startup) => {
          if (!mounted) {
            if (startup.dispose !== undefined) await startup.dispose();
            else {
              startup.application?.close();
              await startup.userPersistence?.close();
            }
            return;
          }
          application = startup.application ?? null;
          appUpdates = startup.appUpdates ?? null;
          disposeRoot = startup.dispose ?? null;
          applicationStatus = startup.applicationStatus ?? { warnings: [] };
          unsubscribeApplicationStatus?.();
          unsubscribeApplicationStatus =
            startup.subscribeApplicationStatus?.((status) => {
              applicationStatus = status;
              manualContent?.updateMediaWarnings(status.warnings);
            }) ?? null;
          if (startup.userPersistence !== undefined)
            applyUserPersistence(startup.userPersistence);
          coreGate = startup.gate;
        })
        .catch(recover);
    }

    const asyncFailure = (event: PromiseRejectionEvent) => {
      if (application !== null && domainSession !== null) {
        event.preventDefault();
        recover(event.reason);
      }
    };
    const syncFailure = (event: ErrorEvent) => {
      if (
        event.message ===
          "ResizeObserver loop completed with undelivered notifications." &&
        (event.error === undefined || event.error === null)
      )
        return;
      if (application !== null && domainSession !== null) {
        event.preventDefault();
        recover(event.error);
      }
    };
    globalThis.addEventListener("unhandledrejection", asyncFailure);
    globalThis.addEventListener("error", syncFailure);
    const syncFromLocation = () => store.syncFromHash(globalThis.location.hash);
    globalThis.addEventListener("hashchange", syncFromLocation);
    const protectRestore = (event: BeforeUnloadEvent): void => {
      if (
        manualContent?.view.navigationBlocked !== true &&
        appUpdates?.view.phase !== "committing"
      )
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", protectRestore);
    const syncVisibility = () => toasts.setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();

    const measure = () => stageBox.set(readViewportBox());
    measure();
    /* `ResizeObserver` also fires for viewport changes a `resize` event misses
       (mobile URL bar collapse, virtual keyboards); the listener is the
       fallback where the observer is unavailable. */
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(measure)
        : undefined;
    if (observer === undefined) globalThis.addEventListener("resize", measure);
    else observer.observe(document.documentElement);

    return () => {
      mounted = false;
      destroyed = true;
      adminSeedAbort?.abort();
      unsubscribeApplication?.();
      unsubscribeApplicationStatus?.();
      const updateDisposal = appUpdates?.dispose();
      const manualDisposal = manualContent?.dispose();
      globalThis.removeEventListener("unhandledrejection", asyncFailure);
      globalThis.removeEventListener("error", syncFailure);
      closeDomain();
      void closing.then(async () => {
        try {
          // The seed action owns its short-lived session until flush/release.
          // Its caller reports failure; teardown still must drain its settlement.
          await Promise.allSettled(adminSeed === null ? [] : [adminSeed]);
          await updateDisposal;
          await manualDisposal;
          await handoff.reset().catch(domainError);
          if (disposeRoot !== null) await disposeRoot();
          else {
            application?.close();
            await userPersistence?.close();
          }
        } catch (error) {
          console.warn("USER_PERSISTENCE_CLOSE_FAILED", error);
        }
      }, domainError);
      observer?.disconnect();
      globalThis.removeEventListener("resize", measure);
      globalThis.removeEventListener("hashchange", syncFromLocation);
      globalThis.removeEventListener("beforeunload", protectRestore);
      document.removeEventListener("visibilitychange", syncVisibility);
      toasts.destroy();
      unsubscribeStage();
      unsubscribe();
      collectionToken += 1;
    };
  });
</script>

<!-- `data-stage-rotated` reports the mode, not a measurement: the quarter turn
     itself lives in `src/styles/app.css` so it lands in the same layout pass as
     the viewport change. `data-stage-route` reports the route for the same
     reason: the stylesheet decides which routes keep the 16:9 width law and
     which spend the pillarbox (only the duel does today). -->
<div
  class="app-stage"
  data-cy="app-stage"
  data-stage-mode={box.mode}
  data-stage-rotated={box.rotated ? "true" : undefined}
  data-stage-route={route.kind}
  bind:this={stage}
>
  <svelte:boundary
    onerror={(error, reset) => {
      recover(error);
      void closing.then(reset, reset);
    }}
  >
    {#if recoveryMessage !== null}
      <p role="alert" data-cy="application-recovery-message">
        {recoveryMessage}
      </p>
    {/if}
    {#if userPersistenceError !== null}
      <p role="alert" data-cy="user-persistence-error">
        User data is unavailable ({userPersistenceError}). Content navigation
        remains available; changes will not be reported as saved.
      </p>
    {/if}
    {#if applicationStatus.warnings.length > 0}
      {@const warning = applicationStatus.warnings.at(-1)!}
      <aside role="status" data-cy="optional-media-package-warning">
        Optional media unavailable: {warning.packageId}/{warning.path} ({warning.reason}).
        You can keep playing. {applicationStatus.warnings.length.toLocaleString()}
        warning{applicationStatus.warnings.length === 1 ? "" : "s"} recorded.
      </aside>
    {/if}
    {#if route.kind === "home"}
      <div class="shell-region shell-region--home" data-cy="shell-region-home">
        {#key coreGate.kind === "ready" ? coreGate.generation : coreGate.kind}
          <MainMenuScreen
            saves={menuRepository}
            {store}
            {coreGate}
            storyAvailable={coreGate.kind === "ready" &&
              !(coreGate.missing ?? []).includes("chapter-01")}
            freeplayAvailable={coreGate.kind === "ready"}
            resumeAvailable={coreGate.kind === "ready"}
            onfreeplaywarm={warmFreePlay}
          />
        {/key}
      </div>
    {:else if route.kind === "install-content"}
      <div
        class="shell-region shell-region--install-content"
        data-cy="shell-region-install-content"
      >
        {#await import("./screens/InstallContentScreen.svelte") then module}
          <svelte:boundary onerror={domainError}>
            <svelte:component
              this={module.default}
              gate={coreGate}
              {appUpdates}
              manual={manualContent}
              storageFailure={userPersistenceError === null
                ? null
                : { code: userPersistenceError }}
              onback={() => store.navigate(HOME_ROUTE)}
            />
          </svelte:boundary>
        {:catch error}
          <DomainLoadError
            onerror={domainError}
            label="Content installer"
            cy="content-installer"
            {error}
          />
        {/await}
      </div>
    {:else if collectionContext !== null}
      <div
        class="shell-region shell-region--collection"
        data-cy="shell-region-collection"
      >
        {#if collection === null}
          <!-- The save and the card database are still being read. Nothing of the
             screen mounts until both are in hand, so a route with no save never
             becomes an empty collection. -->
          <p class="visually-hidden" data-cy="collection-pending">
            Opening your collection
          </p>
        {:else}
          {@const opened = collection}
          <svelte:boundary onerror={domainError}>
            <svelte:component
              this={opened.Screen}
              ownership={opened.ownership}
              cards={opened.catalog.cards}
              rarityByCode={opened.catalog.rarityByCode}
              imageSource={cardImages}
              onback={() => store.navigate(deckRoute(opened.context, null))}
            />
          </svelte:boundary>
        {/if}
      </div>
    {:else if deckContext !== null}
      {@const context = deckContext}
      <div
        class="shell-region shell-region--decks"
        data-cy="shell-region-decks"
      >
        <!-- Keyed on the world, so crossing between the two deck libraries — with
           Back, or a pasted hash — mounts a new editor rather than handing the
           old one a new banner. The repository is opened once per mount, so a
           reused instance would keep writing into the library it was mounted
           for while naming the one the player is now looking at. -->
        {#key context}
          {#if editorContext === null}
            <!-- The save behind a story deck route is still being read. Nothing
               of the editor mounts until it is found, so a route with no save
               never becomes an editor over the free-play library. -->
            <p class="visually-hidden" data-cy="story-decks-pending">
              Opening your story decks
            </p>
          {:else if freeplayInputs !== null || gameplay !== null}
            {@const bound = editorContext}
            {@const installed = gameplay}
            {@const images = cardImages}
            {#await Promise.all( [loaders.decks(), Promise.resolve(freeplayInputs?.editor ?? installed!.editor(images ?? undefined))] ) then [module, catalogInput]}
              <svelte:boundary onerror={domainError}>
                <svelte:component
                  this={module.default}
                  context={bound}
                  {catalogInput}
                  deckId={route.kind === "free-play-deck" ||
                  route.kind === "story-deck"
                    ? route.deckId
                    : null}
                  onnavigate={({ deckId }) =>
                    store.navigate(deckRoute(context, deckId))}
                  oncollection={() => store.navigate(collectionRoute(context))}
                  onexit={() => store.navigate(HOME_ROUTE)}
                  returnLabel={editorReturnLabel}
                  onreturn={() => store.navigate(editorReturnRoute)}
                />
              </svelte:boundary>
            {:catch error}
              <DomainLoadError
                onerror={domainError}
                label="Deck Editor"
                cy="decks"
                {error}
              />
            {/await}
          {/if}
        {/key}
      </div>
    {:else if route.kind === "admin"}
      <div
        class="shell-region shell-region--admin"
        data-cy="shell-region-admin"
      >
        {#await import("./admin/AdminConsole.svelte") then module}
          <svelte:boundary onerror={domainError}>
            <svelte:component
              this={module.default}
              {store}
              seedDeck={seedAdminDeck}
              {resetUserTarget}
            />
          </svelte:boundary>
        {:catch error}
          <DomainLoadError
            onerror={domainError}
            label="Developer console"
            cy="admin"
            {error}
          />
        {/await}
      </div>
    {:else if route.kind === "story"}
      <div
        class="shell-region shell-region--story"
        data-cy="shell-region-story"
      >
        {#if storyRelease !== null && storyCards !== null && saves !== null}
          {#await loaders.story() then module}
            <svelte:boundary onerror={domainError}>
              <svelte:component
                this={module.default}
                release={storyRelease}
                cards={storyCards}
                {saves}
                media={storyMedia}
                imageSource={cardImages}
                playbackSettingsPort={users.preferences.storyPlayback}
                initialPlaybackSettings={initialStoryPlayback}
                readLogPort={users.preferences.storyReadLog}
                initialReadLog={initialStoryReadLog}
                ruleset={gameplay!.editor().ruleset}
                initialStorageError={checkpointReadError}
                initialAutosaveRevision={domainSession?.kind === "story"
                  ? (domainSession.inputs.entry?.autosaveRevision ??
                    storyAutosaveRevision)
                  : storyAutosaveRevision}
                onautosaverevision={(revision) =>
                  (storyAutosaveRevision = revision)}
                onencounter={startEncounter}
                {storyEntryIntent}
                ondecks={() => store.navigate(deckRoute("story", null))}
                onmainmenu={() => store.navigate(HOME_ROUTE)}
                resumeState={handback?.state ??
                  (domainSession?.kind === "story"
                    ? (domainSession.inputs.entry?.state ?? null)
                    : null)}
                resumeStory={handback?.story ??
                  (domainSession?.kind === "story"
                    ? (domainSession.inputs.entry?.story ?? null)
                    : null)}
                resolution={handback?.resolution ?? null}
                onhandled={() => {
                  handback = null;
                }}
              />
            </svelte:boundary>
          {:catch error}
            <DomainLoadError
              onerror={domainError}
              label="Visual novel"
              cy="story"
              {error}
            />
          {/await}
        {:else if application !== null}
          <p class="visually-hidden" data-cy="story-session-pending">
            Opening Story
          </p>
        {:else}
          <DomainLoadError
            label="Visual novel"
            cy="story"
            error={new Error("APP_REQUIRED_INPUT_FAILED")}
          />
        {/if}
      </div>
    {:else if route.kind === "free-play" && matchRequest === null}
      <!-- Free play opens on the seats themselves: choosing two decks is the only
         thing this mode asks before a duel, and a menu in front of it was one
         click that named the screen behind it (ADR-054). Both seats are chosen
         here rather than inside the duel, whose own picker fixes the opponent.
         The duel still mounts in the region below and nowhere else:
         shared stage geometry maps every viewport
         coordinate through `shell-region-duel`.

         Loaded rather than imported, for the reason the domains are: reading
         the free-play library pulls in the deck repository and the card
         catalog, and measured statically that is 24,989 bytes of the shell's
         115,000-byte budget for a screen only a free-play match opens. -->
      <div
        class="shell-region shell-region--free-play"
        data-cy="shell-region-free-play-setup"
      >
        {#if freeplayInputs !== null || gameplay !== null}
          {@const freeplayPresentation =
            freeplayInputs?.presentation ?? gameplay!.presentation}
          {#await import("./screens/FreePlayMatchSetup.svelte") then module}
            <svelte:boundary onerror={domainError}>
              <svelte:component
                this={module.default}
                presentation={freeplayPresentation}
                ruleset={freeplayInputs?.editor.ruleset ??
                  gameplay!.editor().ruleset}
                settings={activeSettings}
                createRepository={users.createDeckRepository}
                loadBattle={loadDuelDomain}
                onerror={domainError}
                onstart={(request) => (matchRequest = request)}
                onback={() => store.navigate(HOME_ROUTE)}
                ondecks={() => store.navigate(deckRoute("free-play", null))}
                onopendeck={(id) =>
                  store.navigate(deckRoute("free-play", deckId(id)))}
              />
            </svelte:boundary>
          {:catch error}
            <DomainLoadError
              onerror={domainError}
              label="Match setup"
              cy="free-play-match"
              {error}
            />
          {/await}
        {/if}
      </div>
    {:else}
      <div class="shell-region shell-region--duel" data-cy="shell-region-duel">
        {#if route.kind === "duel-session" && !sessionReady}
          <!-- The checkpoint is still being read. Nothing of the duel mounts
             until it is found, so a session that cannot be resumed leaves the
             player on the story rather than inside half a duel. -->
          <p class="visually-hidden" data-cy="battle-session-pending">
            Preparing the story duel
          </p>
        {:else if battleRuntimeSource !== null && battlePresentation !== null}
          {#await loadDuelDomain() then module}
            <!-- The duel is rotated by the stylesheet, so the notice explaining
               it belongs to the duel; its one-time dismissal is a shell
               setting, so the flag and its setter cross as plain props. -->
            <svelte:boundary onerror={domainError}>
              <svelte:component
                this={module.BattleFacade}
                runtimeSource={battleRuntimeSource}
                presentation={battlePresentation}
                ruleset={freeplayInputs?.editor.ruleset ??
                  gameplay!.editor().ruleset}
                imageSource={cardImages}
                request={duelRequest}
                hosted={route.kind === "duel-session"}
                oncomplete={settleSession}
                onfatal={domainError}
                ondispose={trackDisposal}
                createRepository={users.createDeckRepository}
                persistedUiPort={users.preferences.battle}
                initialPersistedUi={userPersistence?.hydrated.battle ??
                  defaultPersistedUiState()}
                initialPersistedUiPresent={userPersistence?.hydrated
                  .battlePresent ?? false}
                rotated={box.rotated}
                rotationNoticeDismissed={$activeSettings.rotationNoticeDismissed}
                onrotationnoticedismiss={() =>
                  activeSettings.dismissRotationNotice()}
                onleavematch={route.kind === "free-play" ? leaveMatch : null}
              />
            </svelte:boundary>
          {:catch error}
            <DomainLoadError
              onerror={domainError}
              label="Duel Simulator"
              cy="duel"
              {error}
            />
          {/await}
        {/if}
      </div>
    {/if}
    <ToastHost store={toasts} />
    {#snippet failed(error, reset)}
      <p
        role="alert"
        aria-label={error instanceof Error
          ? "Session error"
          : "Unknown session error"}
        data-cy="application-boundary-recovery"
      >
        Session stopped. Saved progress was not replaced.
      </p>
      <button
        type="button"
        data-cy="application-boundary-home"
        onclick={() => {
          store.navigate(HOME_ROUTE, { replace: true });
          reset();
        }}>Main Menu</button
      >
    {/snippet}
  </svelte:boundary>
</div>

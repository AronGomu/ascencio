<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { readonly, writable } from "svelte/store";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import { createHandoffCoordinator } from "./handoff/handoff-coordinator.ts";
  import { STAGE_CONTEXT_KEY } from "./index.ts";
  import {
    deckRoute,
    deckRouteContext,
    HOME_ROUTE,
    type AppRoute,
    type RouteContext,
  } from "./routes.ts";
  import type { DeckContext } from "../decks/deck-repository-context.ts";
  import DomainLoadError from "./screens/DomainLoadError.svelte";
  import FreePlayMenuScreen from "./screens/FreePlayMenuScreen.svelte";
  import MainMenuScreen from "./screens/MainMenuScreen.svelte";
  import type { BattleFacadeResult, BattleRequest } from "../battle/index.ts";
  import type {
    StoryDuelResolution,
    StoryEncounterRequest,
    StorySaveRepository,
    StorySlotKey,
    StoryState,
  } from "../story/index.ts";
  import {
    createShellSettingsStore,
    type ShellSettingsStore,
  } from "./settings/shell-settings-store.ts";
  import {
    createShellStore,
    writeLocationHash,
    type ShellStore,
    type StoryEntryIntent,
  } from "./shell-store.ts";
  import { computeStageBox, type StageBox } from "./stage-layout.ts";

  export let store: ShellStore = createShellStore(
    globalThis.location.hash,
    writeLocationHash,
  );
  export let loaders: DomainLoaders = DEFAULT_DOMAIN_LOADERS;
  export let settings: ShellSettingsStore = createShellSettingsStore();
  /* Story progress is written by the shell only for the pre-duel checkpoint.
     The default reaches the repository through the visual novel's own lazy
     chunk, so `#/free-play` and its decks never load the story to hold it. */
  export let saves: StorySaveRepository | null = null;

  let stage: HTMLElement | undefined;
  let storySaves: Promise<StorySaveRepository> | null = null;
  /* A free-play match is a state of the free-play menu rather than a route of
     its own, so it is what decides whether `#/free-play` shows the menu or the
     duel. The battle domain is loaded by the region below, which is what keeps
     the menu itself free of it. */
  let matchStarted = false;
  /* The two decks the match setup produced, and the second half of that state:
     a started match with no request yet is the setup screen, and one with a
     request is the duel it names. Held as one object for the whole match — the
     duel dispatches a request once per identity, so rebuilding an equal one
     here would restart the duel on every flush. */
  let matchRequest: BattleRequest | null = null;

  async function openStorySaves(): Promise<StorySaveRepository> {
    storySaves ??= import("../story/index.ts").then((story) =>
      story.createStorySaveRepository(globalThis.indexedDB),
    );
    return await storySaves;
  }

  const lazySaves: StorySaveRepository = {
    read: async (slot: StorySlotKey) =>
      await (await openStorySaves()).read(slot),
    write: async (
      slot: StorySlotKey,
      state: StoryState,
      expected: number | null,
    ) => await (await openStorySaves()).write(slot, state, expected),
    list: async () => await (await openStorySaves()).list(),
    clear: async (slot: StorySlotKey) => {
      await (await openStorySaves()).clear(slot);
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
    readonly resolution: StoryDuelResolution | null;
  } | null = null;
  let sessionHandoffId: string | null = null;
  let sessionReady = false;
  /* The session the mounted duel belongs to. `syncSession` below runs as a
     pre-effect, so the route has already left the session by the time the duel
     region is torn down; this holds the id until that teardown result has been
     handed over, and only `settleSession` or a new session clears it. */
  let hostedHandoffId: string | null = null;

  const handoff = createHandoffCoordinator({
    saves: saves ?? lazySaves,
    navigate: (target, options) => store.navigate(target, options),
    onResolution: (resolution) => {
      /* `onRestore` always ran first: a resolution can only exist for a duel
         whose checkpoint this coordinator wrote or restored. */
      if (handback !== null) handback = { state: handback.state, resolution };
    },
    onRestore: (state) => {
      handback = { state, resolution: null };
    },
  });

  async function startEncounter(request: StoryEncounterRequest) {
    return await handoff.begin(
      {
        handoffId: crypto.randomUUID(),
        encounterId: request.encounterId,
        label: request.label,
      },
      request.state,
    );
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
    if (current.kind !== "duel-session") {
      sessionHandoffId = null;
      sessionReady = false;
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
    void handoff.resume(requested).then((outcome) => {
      if (sessionHandoffId !== requested) return;
      sessionReady = outcome === "restored";
      if (sessionReady) hostedHandoffId = requested;
    });
  }

  let route: AppRoute;
  let storyEntryIntent: StoryEntryIntent | null = null;
  const unsubscribe = store.subscribe((state) => {
    route = state.route;
    storyEntryIntent = state.storyEntryIntent;
  });
  $: syncSession(route);
  /* Leaving the free-play menu ends its match, so coming back opens on the menu
     rather than on a duel nobody asked to resume. */
  $: if (route.kind !== "free-play") leaveMatch();
  /* Which deck library the route names, so one editor region serves both
     contexts and hands navigation back in the one it was reached from. */
  $: deckContext = deckRouteContext(route);
  $: bindDeckContext(deckContext);

  function leaveMatch(): void {
    matchStarted = false;
    matchRequest = null;
  }

  /* Which world the mounted editor writes into, and the world it was bound for.
     Held apart so moving between a library and one of its decks keeps the one
     binding: rebuilding it would drop the editing session the story adapter
     holds in that closure — its favourites, its undo log, its last-opened deck.

     Free play is a value, so the editor is bound before the first paint. A save
     has to be read first, and until it answers the region shows nothing rather
     than an editor over the wrong library. */
  let boundDeckWorld: RouteContext | null = null;
  let editorContext: DeckContext | null = null;
  let storyDeckToken = 0;

  function bindDeckContext(world: RouteContext | null): void {
    if (world === boundDeckWorld) return;
    boundDeckWorld = world;
    editorContext = world === "free-play" ? { kind: "free-play" } : null;
    if (world !== "story") return;
    const requested = ++storyDeckToken;
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
          store.navigate(HOME_ROUTE, { replace: true });
      },
    );
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
  let box: StageBox;
  const unsubscribeStage = stageBox.subscribe((value) => {
    box = value;
  });

  onMount(() => {
    const syncFromLocation = () => store.syncFromHash(globalThis.location.hash);
    globalThis.addEventListener("hashchange", syncFromLocation);

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
      observer?.disconnect();
      globalThis.removeEventListener("resize", measure);
      globalThis.removeEventListener("hashchange", syncFromLocation);
      unsubscribeStage();
      unsubscribe();
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
  <!-- The collection screens land in T29. Until they exist their routes show
       the main menu, which is where a story route with nothing to show goes
       anyway (ADR-051), rather than an empty region. -->
  {#if route.kind === "home" || route.kind === "free-play-collection" || route.kind === "story-collection"}
    <div class="shell-region shell-region--home" data-cy="shell-region-home">
      <MainMenuScreen {store} />
    </div>
  {:else if deckContext !== null}
    {@const context = deckContext}
    <div class="shell-region shell-region--decks" data-cy="shell-region-decks">
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
        {:else}
          {@const bound = editorContext}
          {#await loaders.decks() then module}
            <svelte:component
              this={module.default}
              context={bound}
              deckId={route.kind === "free-play-deck" ||
              route.kind === "story-deck"
                ? route.deckId
                : null}
              onnavigate={({ deckId }) =>
                store.navigate(deckRoute(context, deckId))}
            />
          {:catch error}
            <DomainLoadError label="Deck Editor" cy="decks" {error} />
          {/await}
        {/if}
      {/key}
    </div>
  {:else if route.kind === "admin"}
    <div class="shell-region shell-region--admin" data-cy="shell-region-admin">
      {#await import("./admin/AdminConsole.svelte") then module}
        <svelte:component this={module.default} {store} />
      {:catch error}
        <DomainLoadError label="Developer console" cy="admin" {error} />
      {/await}
    </div>
  {:else if route.kind === "story"}
    <div class="shell-region shell-region--story" data-cy="shell-region-story">
      {#await loaders.story() then module}
        <svelte:component
          this={module.default}
          onencounter={startEncounter}
          {storyEntryIntent}
          resumeState={handback?.state ?? null}
          resolution={handback?.resolution ?? null}
          onhandled={() => {
            handback = null;
          }}
        />
      {:catch error}
        <DomainLoadError label="Visual novel" cy="story" {error} />
      {/await}
    </div>
  {:else if route.kind === "free-play" && !matchStarted}
    <div
      class="shell-region shell-region--free-play"
      data-cy="shell-region-free-play"
    >
      <FreePlayMenuScreen {store} onstartmatch={() => (matchStarted = true)} />
    </div>
  {:else if route.kind === "free-play" && matchRequest === null}
    <!-- Both seats are chosen here rather than inside the duel, whose own
         picker fixes the opponent. The duel still mounts in the region below
         and nowhere else: `src/battle/app/presentation/stage-frame.ts` maps
         every viewport coordinate through `shell-region-duel`.

         Loaded rather than imported, for the reason the domains are: reading
         the free-play library pulls in the deck repository and the card
         catalog, and measured statically that is 24,989 bytes of the shell's
         115,000-byte budget for a screen only a free-play match opens. -->
    <div
      class="shell-region shell-region--free-play"
      data-cy="shell-region-free-play-setup"
    >
      {#await import("./screens/FreePlayMatchSetup.svelte") then module}
        <svelte:component
          this={module.default}
          {settings}
          loadBattle={loaders.duel}
          onstart={(request) => (matchRequest = request)}
          onback={leaveMatch}
        />
      {:catch error}
        <DomainLoadError label="Match setup" cy="free-play-match" {error} />
      {/await}
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
      {:else}
        {#await loaders.duel() then module}
          <!-- The duel is rotated by the stylesheet, so the notice explaining
               it belongs to the duel; its one-time dismissal is a shell
               setting, so the flag and its setter cross as plain props. -->
          <svelte:component
            this={module.BattleFacade}
            request={route.kind === "free-play" ? matchRequest : null}
            hosted={route.kind === "duel-session"}
            oncomplete={settleSession}
            rotated={box.rotated}
            rotationNoticeDismissed={$settings.rotationNoticeDismissed}
            onrotationnoticedismiss={() => settings.dismissRotationNotice()}
          />
        {:catch error}
          <DomainLoadError label="Duel Simulator" cy="duel" {error} />
        {/await}
      {/if}
      {#if route.kind === "free-play"}
        <!-- The way back to the free-play menu, painted over the duel rather
             than laid out above it; the stylesheet says why. A story session
             gets no such control: the story owns that exit. -->
        <button
          class="secondary free-play-leave-match"
          type="button"
          data-cy="free-play-leave-match"
          onclick={leaveMatch}>Leave match</button
        >
      {/if}
    </div>
  {/if}
</div>

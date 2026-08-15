<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { readonly, writable } from "svelte/store";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import { isFullscreen, requestAppFullscreen } from "./fullscreen.ts";
  import { createHandoffCoordinator } from "./handoff/handoff-coordinator.ts";
  import { STAGE_CONTEXT_KEY } from "./index.ts";
  import type { AppRoute } from "./routes.ts";
  import HomeScreen from "./screens/HomeScreen.svelte";
  import type { BattleFacadeResult } from "../battle/index.ts";
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
  import { createShellStore, type ShellStore } from "./shell-store.ts";
  import { computeStageBox, type StageBox } from "./stage-layout.ts";

  export let store: ShellStore = createShellStore(
    globalThis.location.hash,
    (hash) => {
      globalThis.location.hash = hash;
    },
  );
  export let loaders: DomainLoaders = DEFAULT_DOMAIN_LOADERS;
  export let settings: ShellSettingsStore = createShellSettingsStore();
  /* Story progress is written by the shell only for the pre-duel checkpoint.
     The default reaches the repository through the visual novel's own lazy
     chunk, so `#/duel` and `#/decks` never load the story to hold it. */
  export let saves: StorySaveRepository | null = null;

  let stage: HTMLElement | undefined;
  let storySaves: Promise<StorySaveRepository> | null = null;

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
    navigate: (target) => store.navigate(target),
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
      /* The standalone duel route keeps the same facade mounted rather than
         tearing it down, and it is unhosted there, so its result would belong
         to nobody. Every other route unmounts the region, and that teardown
         still owes the story its abort. */
      if (current.kind === "duel") hostedHandoffId = null;
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
  const unsubscribe = store.subscribe((state) => {
    route = state.route;
  });
  $: syncSession(route);

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

    /* A stored fullscreen preference can only be honoured from inside a user
       gesture, so the shell waits for the first one and then stops listening.
       The helper already resolves a rejected request to `false`. */
    const onFirstGesture = () => {
      let preferred = false;
      settings.subscribe((state) => {
        preferred = state.fullscreenPreferred;
      })();
      if (!preferred || stage === undefined || isFullscreen(document)) return;
      void requestAppFullscreen(stage);
    };
    globalThis.addEventListener("pointerdown", onFirstGesture, { once: true });
    globalThis.addEventListener("keydown", onFirstGesture, { once: true });

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
      globalThis.removeEventListener("pointerdown", onFirstGesture);
      globalThis.removeEventListener("keydown", onFirstGesture);
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
     the viewport change. -->
<div
  class="app-stage"
  data-cy="app-stage"
  data-stage-mode={box.mode}
  data-stage-rotated={box.rotated ? "true" : undefined}
  bind:this={stage}
>
  {#if route.kind === "home"}
    <div class="shell-region shell-region--home" data-cy="shell-region-home">
      <HomeScreen {store} {settings} />
    </div>
  {:else if route.kind === "decks" || route.kind === "deck"}
    <div class="shell-region shell-region--decks" data-cy="shell-region-decks">
      {#await loaders.decks() then module}
        <svelte:component
          this={module.default}
          deckId={route.kind === "deck" ? route.deckId : null}
          onnavigate={({ deckId }) =>
            store.navigate(
              deckId === null ? { kind: "decks" } : { kind: "deck", deckId },
            )}
        />
      {/await}
    </div>
  {:else if route.kind === "admin"}
    <div class="shell-region shell-region--admin" data-cy="shell-region-admin">
      {#await import("./admin/AdminConsole.svelte") then module}
        <svelte:component this={module.default} {store} />
      {/await}
    </div>
  {:else if route.kind === "story"}
    <div class="shell-region shell-region--story" data-cy="shell-region-story">
      {#await loaders.story() then module}
        <svelte:component
          this={module.default}
          onencounter={startEncounter}
          resumeState={handback?.state ?? null}
          resolution={handback?.resolution ?? null}
          onhandled={() => {
            handback = null;
          }}
        />
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
            request={null}
            hosted={route.kind === "duel-session"}
            oncomplete={settleSession}
            rotated={box.rotated}
            rotationNoticeDismissed={$settings.rotationNoticeDismissed}
            onrotationnoticedismiss={() => settings.dismissRotationNotice()}
          />
        {/await}
      {/if}
    </div>
  {/if}
</div>

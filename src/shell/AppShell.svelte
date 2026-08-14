<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { readonly, writable } from "svelte/store";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import { isFullscreen, requestAppFullscreen } from "./fullscreen.ts";
  import { STAGE_CONTEXT_KEY } from "./index.ts";
  import type { AppRoute } from "./routes.ts";
  import HomeScreen from "./screens/HomeScreen.svelte";
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

  let stage: HTMLElement | undefined;

  let route: AppRoute;
  const unsubscribe = store.subscribe((state) => {
    route = state.route;
  });

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

<div
  class="app-stage"
  data-cy="app-stage"
  data-stage-mode={box.mode}
  bind:this={stage}
>
  {#if route.kind === "home"}
    <div class="shell-region shell-region--home" data-cy="shell-region-home">
      <HomeScreen {store} {settings} />
    </div>
  {:else if route.kind === "decks" || route.kind === "deck"}
    <div class="shell-region shell-region--decks" data-cy="shell-region-decks">
      {#await loaders.decks() then module}
        <svelte:component this={module.default} />
      {/await}
    </div>
  {:else if route.kind === "story" || route.kind === "admin"}
    <p class="shell-placeholder" data-cy="shell-placeholder">
      Not available yet
    </p>
  {:else}
    <div class="shell-region shell-region--duel" data-cy="shell-region-duel">
      {#await loaders.duel() then module}
        <svelte:component this={module.default} />
      {/await}
    </div>
  {/if}
</div>

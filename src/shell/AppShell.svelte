<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { readonly, writable } from "svelte/store";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import { STAGE_CONTEXT_KEY } from "./index.ts";
  import type { AppRoute } from "./routes.ts";
  import { createShellStore, type ShellStore } from "./shell-store.ts";
  import { computeStageBox, type StageBox } from "./stage-layout.ts";

  export let store: ShellStore = createShellStore(
    globalThis.location.hash,
    (hash) => {
      globalThis.location.hash = hash;
    },
  );
  export let loaders: DomainLoaders = DEFAULT_DOMAIN_LOADERS;

  let route: AppRoute;
  const unsubscribe = store.subscribe((state) => {
    route = state.route;
  });

  const readViewportBox = (): StageBox =>
    computeStageBox(globalThis.innerWidth, globalThis.innerHeight);

  /* The shell is the only place the viewport is measured: domains read the
     resulting box through `STAGE_CONTEXT_KEY` instead of measuring again. */
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

<div
  class="app-stage"
  data-cy="app-stage"
  data-stage-mode={box.mode}
  style="--stage-w: {box.width}px; --stage-h: {box.height}px"
>
  {#if route.kind === "decks" || route.kind === "deck"}
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

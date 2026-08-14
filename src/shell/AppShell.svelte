<script lang="ts">
  import { onMount } from "svelte";
  import {
    DEFAULT_DOMAIN_LOADERS,
    type DomainLoaders,
  } from "./domain-loaders.ts";
  import type { AppRoute } from "./routes.ts";
  import { createShellStore, type ShellStore } from "./shell-store.ts";

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

  onMount(() => {
    const syncFromLocation = () => store.syncFromHash(globalThis.location.hash);
    globalThis.addEventListener("hashchange", syncFromLocation);
    return () => {
      globalThis.removeEventListener("hashchange", syncFromLocation);
      unsubscribe();
    };
  });
</script>

{#if route.kind === "decks" || route.kind === "deck"}
  <div class="shell-region shell-region--decks" data-cy="shell-region-decks">
    {#await loaders.decks() then module}
      <svelte:component this={module.default} />
    {/await}
  </div>
{:else if route.kind === "story" || route.kind === "admin"}
  <p class="shell-placeholder" data-cy="shell-placeholder">Not available yet</p>
{:else}
  <div class="shell-region shell-region--duel" data-cy="shell-region-duel">
    {#await loaders.duel() then module}
      <svelte:component this={module.default} />
    {/await}
  </div>
{/if}

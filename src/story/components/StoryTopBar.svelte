<script lang="ts">
  import DeckIcon from "./icons/DeckIcon.svelte";
  import GearIcon from "./icons/GearIcon.svelte";
  import ShopIcon from "./icons/ShopIcon.svelte";

  export let dp = 0;
  export let showShop = true;
  export let showDecks = true;
  export let title: string | null = null;
  export let objective: string | null = null;
  export let showSettings = true;
  export let onshop: () => void = () => undefined;
  export let ondecks: () => void = () => undefined;
  export let onsettings: () => void = () => undefined;
</script>

<header class="top-bar" data-cy="story-top-bar">
  <span class="dp" data-cy="story-top-bar-dp">{dp} DP</span>
  {#if showShop}
    <button
      type="button"
      class="secondary compact"
      data-cy="story-top-bar-shop"
      aria-label="Open shop"
      onclick={onshop}><ShopIcon cy="story-top-bar-shop-icon" /></button
    >
  {/if}
  {#if showDecks}
    <button
      type="button"
      class="secondary compact"
      data-cy="story-top-bar-decks"
      aria-label="Open deck builder"
      onclick={ondecks}><DeckIcon cy="story-top-bar-decks-icon" /></button
    >
  {/if}
  {#if title !== null}<h1
      id="story-top-bar-title"
      class="title"
      {title}
      data-cy="story-top-bar-title"
    >
      {title}
    </h1>{/if}
  {#if objective !== null}<p
      class="objective"
      title={objective}
      data-cy="story-top-bar-objective"
    >
      <strong data-cy="story-top-bar-objective-label">Objective</strong>
      <span data-cy="story-top-bar-objective-value">{objective}</span>
    </p>{/if}
  <slot />
  {#if showSettings}<button
      type="button"
      class="secondary compact settings"
      data-cy="story-top-bar-settings"
      aria-label="Open settings"
      onclick={onsettings}><GearIcon cy="story-top-bar-settings-icon" /></button
    >{/if}
</header>

<style>
  .top-bar {
    position: relative;
    z-index: 30;
    width: 100%;
    min-width: 0;
    min-height: 3.5rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    overflow: hidden;
    padding: 0.35rem clamp(0.5rem, 1.5cqw, 1rem);
    border-bottom: 1px solid var(--gold-line);
    background: color-mix(in srgb, var(--bg) 88%, var(--glass-strong));
    box-shadow: 0 0.35rem 1.25rem
      color-mix(in srgb, var(--shadow) 42%, transparent);
    backdrop-filter: blur(12px);
  }
  .dp {
    flex: 0 0 auto;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: var(--glass-strong);
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .top-bar .compact {
    flex: 0 0 44px;
    width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    border-color: var(--line-soft);
    border-radius: var(--radius-sm);
    background: var(--glass);
  }
  .top-bar .title {
    flex: 0 1 18rem;
    min-width: 0;
    overflow: hidden;
    margin: 0;
    color: var(--text);
    font: 400 clamp(1rem, 2.4cqw, 1.35rem)/1 var(--font-display);
    letter-spacing: 0.1em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .objective {
    flex: 1 1 24rem;
    min-width: 0;
    display: flex;
    gap: 0.45rem;
    overflow: hidden;
    margin: 0;
    color: var(--muted);
    font-size: clamp(0.72rem, 1.65cqw, 0.9rem);
    line-height: 1.2;
    white-space: nowrap;
  }
  .objective strong {
    flex: 0 0 auto;
    color: var(--accent);
    font-family: var(--font-display);
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .objective span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .settings {
    margin-left: auto;
  }
</style>

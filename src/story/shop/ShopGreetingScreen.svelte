<script lang="ts">
  export let onnavigate: (target: "buy" | "sell") => void = () => undefined;
  export let onleave: () => void = () => undefined;

  const GREETING_BEATS = [
    {
      speaker: "Shopkeeper",
      text: "Welcome in. Shipment day — everything you see is fresh.",
    },
    {
      speaker: "Shopkeeper",
      text: "Buying packs? Selling doubles? Either way, DP talks.",
    },
  ] as const;

  let beatIndex = 0;
  $: beat = GREETING_BEATS[Math.min(beatIndex, GREETING_BEATS.length - 1)]!;
  $: showMenu = beatIndex >= GREETING_BEATS.length;

  function advance(): void {
    if (!showMenu) beatIndex += 1;
  }

  function isControl(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      target.closest("button, input, select, textarea, [role='dialog']") !==
        null
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (showMenu || event.repeat) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      advance();
    }
  }

  function handleStageClick(event: MouseEvent): void {
    if (event.detail > 1 || showMenu || isControl(event.target)) return;
    advance();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="shop-greeting"
  aria-label="Shop greeting"
  data-cy="story-shop-greeting"
  onclick={handleStageClick}
>
  {#if !showMenu}
    <div class="dialogue" data-cy="story-shop-greeting-dialogue">
      <p class="speaker" data-cy="story-shop-greeting-speaker">
        {beat.speaker}
      </p>
      <p class="line" data-cy="story-shop-greeting-text">{beat.text}</p>
      <span aria-hidden="true" data-cy="story-shop-greeting-cue">◆</span>
    </div>
  {:else}
    <nav aria-label="Shop actions" data-cy="story-shop-greeting-menu">
      <button
        type="button"
        data-cy="story-shop-greeting-buy"
        onclick={() => onnavigate("buy")}>Buy Cards</button
      >
      <button
        type="button"
        disabled
        title="Coming in a later slice"
        data-cy="story-shop-greeting-sell"
        onclick={() => onnavigate("sell")}>Sell Cards</button
      >
      <button
        type="button"
        data-cy="story-shop-greeting-leave"
        onclick={onleave}>Leave Shop</button
      >
    </nav>
  {/if}
</section>

<style>
  .shop-greeting {
    position: relative;
    min-height: 100svh;
    display: grid;
    place-items: end center;
    padding: clamp(1rem, 4vw, 3rem);
    background:
      radial-gradient(circle at 70% 20%, var(--field-glow), transparent 30%),
      var(--bg);
  }
  .dialogue {
    width: min(56rem, 100%);
    min-height: 8rem;
    padding: 1.2rem 3rem 1.2rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--bg) 91%, transparent);
    box-shadow: 0 1rem 3rem color-mix(in srgb, var(--shadow) 60%, transparent);
    position: relative;
  }
  .speaker {
    width: fit-content;
    margin: -2.2rem 0 0.7rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.35rem;
    background: var(--surface-chain);
    color: var(--accent);
    font-weight: 800;
  }
  .line {
    max-width: 70ch;
    margin: 0;
    font-size: clamp(1rem, 2.3vw, 1.35rem);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .shop-greeting span[aria-hidden] {
    position: absolute;
    right: 1.2rem;
    bottom: 1rem;
    color: var(--story-accent);
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1.5rem;
    border: 1px solid var(--story-border);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--bg) 91%, transparent);
    box-shadow: 0 1rem 3rem color-mix(in srgb, var(--shadow) 60%, transparent);
  }
</style>

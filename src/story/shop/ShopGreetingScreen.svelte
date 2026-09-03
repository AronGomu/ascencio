<script lang="ts">
  import ChoiceList from "../components/ChoiceList.svelte";

  export let onnavigate: (target: "buy" | "sell") => void = () => undefined;
  export let onleave: () => void = () => undefined;

  /* The same shape a narrative branch offers, because it is the same control:
     leaving is the way out of the shop, so it is the red one. */
  const MENU = [
    { id: "buy", label: "Buy Cards", dataCy: "story-shop-greeting-buy" },
    { id: "sell", label: "Sell Cards", dataCy: "story-shop-greeting-sell" },
    {
      id: "leave",
      label: "Leave Shop",
      dataCy: "story-shop-greeting-leave",
      danger: true,
    },
  ] as const;

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

  function choose(id: string): void {
    if (id === "buy" || id === "sell") onnavigate(id);
    else onleave();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="shop-greeting"
  class:menu={showMenu}
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
    <ChoiceList
      choices={MENU}
      dataCy="story-shop-greeting-menu"
      label="Shop actions"
      onchoose={choose}
    />
  {/if}
</section>

<style>
  .shop-greeting {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: grid;
    place-items: safe end center;
    overflow: auto;
    padding: clamp(1rem, 4cqw, 3rem);
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
    font-size: clamp(1rem, 2.3cqw, 1.35rem);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  /* The dialogue sits where a visual novel puts it, at the foot of the screen;
     the menu that replaces it is a decision, so it meets the player in the
     middle exactly as a narrative branch does. */
  .shop-greeting.menu {
    place-items: center;
  }
  .shop-greeting span[aria-hidden] {
    position: absolute;
    right: 1.2rem;
    bottom: 1rem;
    color: var(--story-accent);
  }
</style>

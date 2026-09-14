<script lang="ts">
  import { OverlayScrollbar } from "../scrollbar/index.ts";
  import type { CardPreviewView } from "./card-preview-view.ts";

  export let preview: CardPreviewView | null;
  export let dataCyPrefix: string;
  export let emptyLabel: string;

  let failedImageUrl: string | null = null;
  let textScroller: HTMLElement | null = null;

  $: resolvedImageUrl = preview?.imageUrl ?? null;
  $: if (failedImageUrl !== null && failedImageUrl !== resolvedImageUrl)
    failedImageUrl = null;

  function markImageFailed(event: Event): void {
    const failedUrl = (event.currentTarget as HTMLImageElement).dataset
      .previewImageUrl;
    if (failedUrl === resolvedImageUrl) failedImageUrl = failedUrl;
  }

  function scrollTextByKeyboard(event: KeyboardEvent): void {
    const scroller = event.currentTarget as HTMLElement;
    if (event.key === "Home") scroller.scrollTop = 0;
    else if (event.key === "End") scroller.scrollTop = scroller.scrollHeight;
    else if (event.key === "PageUp")
      scroller.scrollTop -= scroller.clientHeight;
    else if (event.key === "PageDown")
      scroller.scrollTop += scroller.clientHeight;
    else return;
    event.preventDefault();
  }
</script>

<aside
  class="card-preview-panel"
  aria-label="Card preview"
  data-cy={`${dataCyPrefix}-panel`}
>
  {#if preview === null}
    <p data-cy={`${dataCyPrefix}-empty`}>{emptyLabel}</p>
  {:else}
    <div class="card-preview-panel__art" data-cy={`${dataCyPrefix}-art`}>
      {#if resolvedImageUrl !== null && resolvedImageUrl !== failedImageUrl}
        {#key resolvedImageUrl}
          <img
            src={resolvedImageUrl}
            alt={preview.imageAlt}
            decoding="async"
            onerror={markImageFailed}
            data-preview-image-url={resolvedImageUrl}
            data-cy={`${dataCyPrefix}-image`}
          />
        {/key}
      {:else}
        <div
          class="card-preview-image-placeholder"
          role="img"
          aria-label={`Card image unavailable for ${preview.name}`}
          data-cy={`${dataCyPrefix}-image-placeholder`}
        >
          <span
            class="card-preview-placeholder-mark"
            aria-hidden="true"
            data-cy={`${dataCyPrefix}-placeholder-mark`}>✦</span
          >
          <span
            class="card-preview-placeholder-label"
            aria-hidden="true"
            data-cy={`${dataCyPrefix}-placeholder-label`}
            >{preview.placeholderLabel}</span
          >
        </div>
      {/if}
    </div>
    <div class="card-preview-panel__body" data-cy={`${dataCyPrefix}-body`}>
      <h2 data-cy={`${dataCyPrefix}-name`}>{preview.name}</h2>
      {#if preview.statsLine}<p
          class="card-preview-panel__stats"
          data-cy={`${dataCyPrefix}-stats`}
        >
          {preview.statsLine}
        </p>{/if}
      <div
        class="card-preview-panel__text-region"
        data-cy={`${dataCyPrefix}-text-region`}
      >
        <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions (native effect-text scroller is intentionally keyboard reachable) -->
        <div
          class="card-preview-panel__text"
          tabindex="0"
          role="region"
          aria-label="Card effect text"
          onkeydown={scrollTextByKeyboard}
          bind:this={textScroller}
          data-cy={`${dataCyPrefix}-text`}
        >
          {preview.description}
        </div>
        <OverlayScrollbar
          axis="vertical"
          scrollElement={textScroller}
          contentSizeKey={`${preview.key}:${preview.description.length}`}
          dataCyPrefix={`${dataCyPrefix}-text`}
        />
      </div>
    </div>
  {/if}
</aside>

<style>
  .card-preview-image-placeholder {
    position: relative;
    display: grid;
    width: 100%;
    max-height: min(22rem, calc(var(--stage-h, 100svh) * 0.48));
    aspect-ratio: 59 / 86;
    overflow: hidden;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 48%, var(--border));
    border-radius: 0.5rem;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--accent) 18%, transparent),
        transparent 48%
      ),
      var(--surface-panel);
    color: var(--muted);
    isolation: isolate;
  }

  .card-preview-image-placeholder::before,
  .card-preview-image-placeholder::after {
    position: absolute;
    z-index: 0;
    width: 72%;
    aspect-ratio: 1;
    transform: rotate(45deg);
    border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
    content: "";
  }

  .card-preview-image-placeholder::after {
    width: 48%;
  }

  .card-preview-placeholder-mark,
  .card-preview-placeholder-label {
    z-index: 1;
    grid-area: 1 / 1;
  }

  .card-preview-placeholder-mark {
    color: var(--accent);
    font-size: clamp(2rem, 8vw, 4rem);
    transform: translateY(-0.75rem);
  }

  .card-preview-placeholder-label {
    align-self: end;
    padding: 0 0.75rem 1rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>

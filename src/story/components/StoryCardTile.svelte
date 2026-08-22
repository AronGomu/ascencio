<script lang="ts">
  /** One card's art, for every story surface that shows cards: the set list and
      its preview, the sell screen, both reveal screens and the collection. The
      deck editor's tile is the reference, so a card here looks like the same
      card there — whole, at the card's own proportions.

      The selector is handed in rather than derived, because each surface
      already names its cards differently: by code, by reveal index, or by both.
      `dataCyPrefix` plus `dataCyId` reproduces what each one already renders,
      which is also what keeps one tile from colliding with itself when two
      surfaces are mounted at once. */
  export let name: string;
  export let imageUrl: string | null;
  export let dataCyPrefix: string;
  export let dataCyId: string | number;

  /* Art is a URL by convention for every code, so a card this build packages no
     image for is the normal case rather than an error: the tile keeps the glyph
     instead of a broken-image icon. The failure is remembered as the URL that
     failed rather than as a flag, so a tile recycled onto another card is not
     still hiding art because the card before it had none. */
  let failedArtUrl: string | null = null;
  $: artUrl = imageUrl === failedArtUrl ? null : imageUrl;
  /* The card is named in text beside every tile, so the image is decorative
     rather than a second announcement of the same name. */
  $: glyph = name.slice(0, 1).toUpperCase();
</script>

{#if artUrl !== null}
  <img
    class="card-art"
    loading="lazy"
    decoding="async"
    src={artUrl}
    alt=""
    onerror={() => (failedArtUrl = artUrl)}
    data-cy={`${dataCyPrefix}-art-${dataCyId}`}
  />
{:else}
  <span
    class="card-art art-placeholder"
    aria-hidden="true"
    data-cy={`${dataCyPrefix}-placeholder-${dataCyId}`}
  >
    <span data-cy={`${dataCyPrefix}-placeholder-glyph-${dataCyId}`}
      >{glyph}</span
    >
  </span>
{/if}

<style>
  /* `contain` rather than the editor's `cover`: the two render the same picture
     for a packaged card, whose proportions are this box's, and only `contain`
     still shows the whole card when one is not. */
  .card-art {
    width: 100%;
    aspect-ratio: 421 / 614;
    border-radius: 0.3rem;
    object-fit: contain;
  }

  .art-placeholder {
    display: grid;
    place-items: center;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--accent) 16%, transparent),
        transparent 52%
      ),
      var(--surface-panel);
    font-size: clamp(1rem, 2vw, 2rem);
    font-weight: 650;
  }
</style>

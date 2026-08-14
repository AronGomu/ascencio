<script lang="ts">
  /* Shown once, the first time a player reaches the duel on a portrait phone,
     because the board arriving side-on is surprising rather than broken. It is
     laid out inside the rotated duel region, so it reads the same way up as
     the board it explains. */
  export let ondismiss: () => void = () => undefined;
</script>

<!-- The strip never blocks play: only the button takes pointer events, so a
     tap anywhere else still reaches the card underneath it. -->
<div class="rotation-notice" data-cy="duel-rotation-notice" role="status">
  <p class="rotation-notice__text" data-cy="duel-rotation-text">
    Your screen is upright, so the duel is turned a quarter turn. Turn the phone
    sideways to play it the usual way up.
  </p>
  <button
    class="secondary rotation-notice__dismiss"
    type="button"
    data-cy="duel-rotation-dismiss"
    onclick={ondismiss}>Got it</button
  >
</div>

<style>
  .rotation-notice {
    position: absolute;
    z-index: var(--duel-field-layer-menu);
    bottom: 0.5rem;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: min(28rem, calc(100% - 1rem));
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    box-shadow: 0 0.5rem 1.5rem
      color-mix(in srgb, var(--shadow) 45%, transparent);
    transform: translateX(-50%);
    /* Presentation only: the duel underneath keeps every tap it would have
       had, and only the dismiss button opts back in. */
    pointer-events: none;
    animation: rotation-notice-in var(--motion-base) ease-out;
  }

  .rotation-notice__text {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .rotation-notice__dismiss {
    flex: 0 0 auto;
    min-height: 2.75rem;
    pointer-events: auto;
  }

  @keyframes rotation-notice-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rotation-notice {
      animation: none;
    }
  }
</style>

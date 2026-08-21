<script lang="ts">
  import { HOME_ROUTE, type AppRoute } from "../routes.ts";
  import type { ShellStore } from "../shell-store.ts";

  export let store: ShellStore;
  /* The match is a state of this menu rather than a route, so starting one is
     the host's business: it opens the deck setup, and the duel that follows
     mounts in the shell's own duel region — the element its stylesheet rotates
     and its geometry measures against
     (`src/battle/app/presentation/stage-frame.ts`). */
  export let onstartmatch: () => void = () => undefined;

  const DECKS_ROUTE: AppRoute = { kind: "free-play-decks" };
</script>

<main class="main-menu" data-cy="free-play-menu-screen">
  <h1 class="main-menu__title" data-cy="free-play-menu-title">Free Play</h1>
  <p class="main-menu__tagline" data-cy="free-play-menu-tagline">
    Every card available. No story, no stakes.
  </p>

  <nav
    class="main-menu__entries"
    aria-label="Free Play"
    data-cy="free-play-menu-entries"
  >
    <button type="button" data-cy="free-play-start-match" onclick={onstartmatch}
      >Start a match</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="free-play-deck-builder"
      onclick={() => store.navigate(DECKS_ROUTE)}>Deck builder</button
    >
    <button
      type="button"
      class="secondary"
      data-cy="free-play-return"
      onclick={() => store.navigate(HOME_ROUTE)}>Return to main menu</button
    >
  </nav>
</main>

<script lang="ts">
  import { onDestroy } from "svelte";
  import App from "./app/App.svelte";
  import type {
    BattleFacadeResult,
    BattleRequest,
  } from "./battle-contracts.ts";
  import RotationNotice from "./components/RotationNotice.svelte";
  import { settleOnce } from "./settle-once.ts";

  /* `null` is standalone mode: the duel renders its own deck picker, owns the
     whole session and reports nothing back, which is exactly what `#/duel`
     did before this facade existed. A request means a host is waiting for one
     result and has already chosen both seats, so the duel starts from it
     instead of opening a picker that would ask again — and would fix the
     opponent to one deck, discarding the one the host picked. */
  export let request: BattleRequest | null = null;
  /* The other way to say "a host is waiting for one result": T19's story
     handoff hands the player to the duel's own picker rather than a prebuilt
     request, and still needs exactly one result back. */
  export let hosted = false;
  export let oncomplete: (result: BattleFacadeResult) => void = () => undefined;
  /* T15: the stylesheet turns the duel a quarter turn on a portrait phone. The
     host tells the duel that happened, and owns the one-time dismissal, so the
     duel never has to read a shell setting or measure the viewport itself. */
  export let rotated = false;
  export let rotationNoticeDismissed = false;
  export let onrotationnoticedismiss: () => void = () => undefined;

  const settle = settleOnce<BattleFacadeResult>((result) => oncomplete(result));

  $: hostWaiting = hosted || request !== null;

  onDestroy(() => {
    /* The duel disposes itself through `App`'s own teardown when this
       component is destroyed, so the facade adds no second disposal; what it
       owes the host is the missing result. Leaving mid-duel is an exit, and
       `settleOnce` keeps it from overwriting a result that already arrived. */
    if (hostWaiting) settle({ kind: "aborted", reason: "exit" });
  });
</script>

<div class="battle-root" data-cy="battle-root">
  <App {request} onbattlecomplete={hostWaiting ? settle : undefined} />
  {#if rotated && !rotationNoticeDismissed}
    <RotationNotice ondismiss={onrotationnoticedismiss} />
  {/if}
</div>

<style>
  /* The facade is a boundary, not a box: `contents` keeps the duel root the
     direct grid item of whichever region hosts it, so mounting through the
     facade cannot move a single pixel of the duel field. */
  .battle-root {
    display: contents;
  }
</style>

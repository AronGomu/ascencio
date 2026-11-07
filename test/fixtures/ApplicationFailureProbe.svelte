<script lang="ts">
  import { onDestroy } from "svelte";
  export let failRender = true;
  export let onfatal: ((error: unknown) => void) | undefined = undefined;
  export let ondispose: ((done: Promise<void>) => void) | undefined = undefined;
  export let disposal: Promise<void> = Promise.resolve();
  onDestroy(() => ondispose?.(disposal));
  if (failRender) throw new Error("fixture render failure");
</script>

<p data-cy="application-failure-probe">Mounted</p>
<button
  data-cy="application-failure-trigger"
  onclick={() => onfatal?.(new Error("fixture Worker failure"))}>Fail</button
>

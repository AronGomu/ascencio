<script lang="ts">
  import { battleFacadeProps } from "./battle-facade-probe.ts";

  export let onleavematch: (() => void) | null = null;

  $: battleFacadeProps.current = { onleavematch };
</script>

<div data-cy="battle-facade-probe"></div>

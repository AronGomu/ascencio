<script lang="ts">
  import type {
    ContentSetRef,
    InstalledGameplay,
  } from "../../src/content/index.ts";
  import { battleFacadeProps } from "./battle-facade-probe.ts";

  export let content: ContentSetRef;
  export let gameplay: InstalledGameplay;
  export let onleavematch: (() => void) | null = null;

  $: battleFacadeProps.current = { onleavematch };
</script>

<div data-cy="battle-facade-probe"></div>

<script lang="ts">
  import type {
    BattlePresentationInput,
    BattleRuntimeSource,
  } from "../../src/battle/ports/index.ts";
  import { battleFacadeProps } from "./battle-facade-probe.ts";

  export let runtimeSource: BattleRuntimeSource;
  export let presentation: BattlePresentationInput;
  export let onleavematch: (() => void) | null = null;

  $: battleFacadeProps.current = { onleavematch };
</script>

<div data-cy="battle-facade-probe"></div>

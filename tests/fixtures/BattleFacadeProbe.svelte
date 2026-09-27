<script lang="ts">
  import type {
    BattlePresentationInput,
    BattleRuntimeSource,
  } from "../../src/battle/ports/index.ts";
  import type { PinnedDeckRuleset } from "../../src/decks/validation/index.ts";
  import { battleFacadeProps } from "./battle-facade-probe.ts";

  export let runtimeSource: BattleRuntimeSource;
  export let presentation: BattlePresentationInput;
  export let ruleset: PinnedDeckRuleset;
  export let onleavematch: (() => void) | null = null;

  $: battleFacadeProps.current = { onleavematch };
</script>

<div
  data-cy="battle-facade-probe"
  data-ruleset-id={ruleset.id}
  data-ruleset-revision={ruleset.revision}
></div>

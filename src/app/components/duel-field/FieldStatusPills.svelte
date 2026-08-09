<script lang="ts">
  import type { DuelPhase } from "../../../duel/contracts/public-duel-state.ts";
  import { duelPhaseLabel } from "../../presentation/duel-phase-label.ts";

  export let hasPriority = false;
  export let phase: DuelPhase = "unknown";
</script>

<div
  class="field-status-pills"
  data-cy="field-status-pills"
  aria-live="polite"
  aria-atomic="true"
>
  <span class="prio-pill" class:is-priority={hasPriority} data-cy="prio-pill">
    {hasPriority ? "Choose Action" : "Waiting Opponent"}
  </span>
  <span
    class="field-status-pills-separator"
    data-cy="field-status-pills-separator"
    aria-hidden="true"
  >
    -
  </span>
  <span class="field-phase-pill" data-cy="phase-pill">
    {duelPhaseLabel(phase)}
  </span>
</div>

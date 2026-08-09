<script lang="ts">
  import type { PlayerIndex } from "../../../duel/contracts/public-duel-state.ts";

  export let player: PlayerIndex;
  export let lifePoints: number;
</script>

<p
  class="life-pill"
  class:is-opponent={player === 1}
  class:is-self={player === 0}
  data-cy={`life-pill-p${player}`}
  aria-label={`${player === 0 ? "Your" : "Opponent"} life points, ${lifePoints}`}
>
  {`${lifePoints.toLocaleString()} LP`}
</p>

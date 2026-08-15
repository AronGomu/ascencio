<script lang="ts">
  import type {
    DuelPhase,
    PlayerIndex,
  } from "../../duel/contracts/public-duel-state.ts";
  import type { DuelRailStatus } from "../presentation/duel-rail-status.ts";
  import { DUEL_PHASE_LABELS } from "../presentation/duel-phase-label.ts";
  const AVATAR_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='19' fill='%2318243b' stroke='%23697895' stroke-width='2'/%3E%3C/svg%3E";
  export let turn: number;
  export let phase: DuelPhase;
  export let turnPlayer: PlayerIndex;
  export let lifePoints: readonly [number, number];
  export let playerAvatarUrl: string;
  export let opponentAvatarUrl: string;
  export let status: DuelRailStatus;
  export let onopensettings: () => void;
</script>

<aside
  class="duel-right-rail"
  data-cy="duel-right-rail"
  aria-label="Duel status"
>
  <div class="duel-right-rail__top" data-cy="duel-right-rail-top">
    <strong data-cy="duel-right-rail-turn-phase"
      >Turn {turn} · {DUEL_PHASE_LABELS[phase] ?? "Unknown phase"}</strong
    >
    <button
      type="button"
      class="secondary duel-right-rail__options"
      aria-label="Options"
      data-cy="duel-right-rail-options"
      onclick={onopensettings}>⚙</button
    >
  </div>
  <div
    class:active={turnPlayer === 1}
    class="duel-right-rail__identity"
    data-cy="duel-right-rail-opponent"
  >
    <img
      src={opponentAvatarUrl || AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-player-avatar-1"
    />
    <p data-cy="duel-right-rail-life-points-1">
      {lifePoints[1].toLocaleString()} LP
    </p>
  </div>
  <div
    class="duel-right-rail__status"
    aria-live="polite"
    aria-atomic="true"
    data-cy="duel-right-rail-status"
  >
    <h2 data-cy="duel-right-rail-status-title">{status.title}</h2>
    <p data-cy="duel-right-rail-status-subtitle">{status.subtitle}</p>
    {#if status.thinking}<span
        class="duel-right-rail__dots"
        aria-hidden="true"
        data-cy="duel-right-rail-status-dots"
        ><i style="opacity: 1" data-cy="duel-right-rail-status-dot-1"></i><i
          style="opacity: 1"
          data-cy="duel-right-rail-status-dot-2"
        ></i><i style="opacity: 1" data-cy="duel-right-rail-status-dot-3"
        ></i></span
      >{/if}
  </div>
  <div
    class:active={turnPlayer === 0}
    class="duel-right-rail__identity"
    data-cy="duel-right-rail-player"
  >
    <p data-cy="duel-right-rail-life-points-0">
      {lifePoints[0].toLocaleString()} LP
    </p>
    <img
      src={playerAvatarUrl || AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-player-avatar-0"
    />
  </div>
</aside>

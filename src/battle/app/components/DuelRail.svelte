<script lang="ts">
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import type {
    DuelPhase,
    PlayerIndex,
  } from "../../duel/contracts/public-duel-state.ts";
  import type { DuelRailStatus } from "../presentation/duel-rail-status.ts";
  import { DUEL_PHASE_LABELS } from "../presentation/duel-phase-label.ts";

  const AVATAR_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%2318243b'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%23697895'/%3E%3Cpath d='M16 88c4-20 18-28 32-28s28 8 32 28z' fill='%23697895'/%3E%3C/svg%3E";

  export let turn: number;
  export let phase: DuelPhase;
  export let turnPlayer: PlayerIndex;
  export let lifePoints: readonly [number, number];
  export let playerAvatarUrl: string;
  export let opponentAvatarUrl: string;
  export let status: DuelRailStatus;
  export let onopensettings: () => void;

  const reducedMotion =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
    false;
  const TWEEN_DURATION = reducedMotion ? 0 : 600;

  // Animated LP counter — svelte/store only (safe in Node/SSR; RAF called lazily).
  function animatedValue(initial: number, duration: number) {
    const store = writable(initial);
    let current = initial;
    let frame: number | null = null;
    /* A pending frame outlives the component unless it is cancelled, and its
       tick would keep setting an orphaned store for the rest of the tween. */
    function cancel(): void {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    }
    return {
      subscribe: store.subscribe,
      cancel,
      set(target: number): void {
        cancel();
        if (duration <= 0 || typeof requestAnimationFrame === "undefined") {
          current = target;
          store.set(target);
          return;
        }
        const from = current;
        const t0 = performance.now();
        const tick = (now: number): void => {
          const p = Math.min((now - t0) / duration, 1);
          current = from + (target - from) * p;
          store.set(Math.round(current));
          frame = p < 1 ? requestAnimationFrame(tick) : null;
        };
        frame = requestAnimationFrame(tick);
      },
    };
  }

  const displayed0 = animatedValue(lifePoints[0], TWEEN_DURATION);
  const displayed1 = animatedValue(lifePoints[1], TWEEN_DURATION);

  $: displayed0.set(lifePoints[0]);
  $: displayed1.set(lifePoints[1]);

  onDestroy(() => {
    displayed0.cancel();
    displayed1.cancel();
  });
</script>

<aside
  class="duel-right-rail"
  data-cy="duel-right-rail"
  aria-label="Duel status"
>
  <header class="duel-right-rail__header" data-cy="duel-right-rail-header">
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
  </header>
  <div class="duel-right-rail__identity" data-cy="duel-right-rail-opponent">
    <img
      class:active={turnPlayer === 1}
      src={opponentAvatarUrl || AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-player-avatar-1"
    />
    <p
      class="duel-right-rail__life"
      class:active={turnPlayer === 1}
      class:is-high={lifePoints[1] > 4000}
      class:is-mid={lifePoints[1] >= 2000 && lifePoints[1] <= 4000}
      class:is-low={lifePoints[1] < 2000}
      data-cy="duel-right-rail-life-points-1"
    >
      LP {$displayed1}
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
  <div class="duel-right-rail__identity" data-cy="duel-right-rail-player">
    <p
      class="duel-right-rail__life"
      class:active={turnPlayer === 0}
      class:is-high={lifePoints[0] > 4000}
      class:is-mid={lifePoints[0] >= 2000 && lifePoints[0] <= 4000}
      class:is-low={lifePoints[0] < 2000}
      data-cy="duel-right-rail-life-points-0"
    >
      LP {$displayed0}
    </p>
    <img
      class:active={turnPlayer === 0}
      src={playerAvatarUrl || AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-player-avatar-0"
    />
  </div>
</aside>

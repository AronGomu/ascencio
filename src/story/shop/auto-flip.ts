/** The pacing behind the reveal screen's "flip them for me" checkbox: one card
    per tick, left to right, until the pack is out.

    A module rather than a `setInterval` inside the screen, because the pacing
    is the part worth pinning — a test drives it with a fake clock and no DOM at
    all, and the screen is left owning only what a flip looks like.

    Chained `setTimeout` rather than `setInterval`: the run ends by not
    scheduling the next tick, so a finished pack leaves no timer behind, and
    `stop()` has exactly one handle to clear whatever the state. */

/** Roughly the beat a Hearthstone pack reveals on — slow enough to read the
    card that just turned, fast enough that nine of them is not a wait. */
export const AUTO_FLIP_INTERVAL_MS = 450;

export interface AutoFlipOptions {
  /** How many cards the pack holds. The run ends after the last index. */
  readonly total: number;
  readonly intervalMs?: number;
  /** Called with the index to turn over. Flipping a card the player already
      turned over by hand is the caller's no-op, not this module's: the pacing
      stays a straight walk left to right either way. */
  readonly onFlip: (index: number) => void;
}

export interface AutoFlip {
  /** Idempotent: a second call while a run is in flight keeps the one clock
      rather than adding a second one to the same pack. */
  start(): void;
  /** Cancels the pending tick and keeps the position, so switching the
      checkbox back on resumes where the pack was left. */
  stop(): void;
}

export function createAutoFlip({
  total,
  intervalMs = AUTO_FLIP_INTERVAL_MS,
  onFlip,
}: AutoFlipOptions): AutoFlip {
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule(): void {
    if (next >= total) return;
    timer = setTimeout(() => {
      timer = null;
      const index = next;
      next += 1;
      onFlip(index);
      schedule();
    }, intervalMs);
  }

  return {
    start(): void {
      if (timer !== null) return;
      schedule();
    },
    stop(): void {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    },
  };
}

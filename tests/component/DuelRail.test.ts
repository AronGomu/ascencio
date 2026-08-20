// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelRail from "../../src/battle/app/components/DuelRail.svelte";
afterEach(cleanup);
const props = {
  turn: 3,
  phase: "main1" as const,
  turnPlayer: 1 as const,
  lifePoints: [8000, 7300] as const,
  playerAvatarUrl: "player.png",
  opponentAvatarUrl: "opponent.png",
  status: {
    title: "Opponent is thinking",
    subtitle: "Waiting for the opponent's next action.",
    thinking: true,
  },
  onopensettings: vi.fn(),
};

function mockMotionPreference(reduced: boolean): () => void {
  const original = (globalThis as Record<string, unknown>).matchMedia;
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((_query: string) => ({
      matches: reduced,
      media: _query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  return () => {
    if (original === undefined) {
      delete (globalThis as Record<string, unknown>).matchMedia;
    } else {
      (globalThis as Record<string, unknown>).matchMedia = original;
    }
  };
}

/* The LP counter tweens over requestAnimationFrame, so the frames and the
   clock the tween reads its progress from both have to be driven by hand. */
function mockAnimationFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let clock = 0;
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const cancelSpy = vi.fn((id: number) => {
    frames.delete(id);
  });
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    nextId += 1;
    frames.set(nextId, callback);
    return nextId;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame =
    cancelSpy as typeof globalThis.cancelAnimationFrame;
  const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
  return {
    cancelSpy,
    pendingFrames: () => frames.size,
    async advanceTo(time: number): Promise<void> {
      clock = time;
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(time);
      await tick();
    },
    restore(): void {
      nowSpy.mockRestore();
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    },
  };
}

function lifeText(player: 0 | 1): string {
  return (
    document.querySelector(`[data-cy="duel-right-rail-life-points-${player}"]`)
      ?.textContent ?? ""
  );
}
describe("DuelRail", () => {
  it("renders turn, ordered identities, status and dots", () => {
    render(DuelRail, props);
    const rail = document.querySelector('[data-cy="duel-right-rail"]')!;
    expect(
      rail.querySelector('[data-cy="duel-right-rail-turn-phase"]')?.textContent,
    ).toBe("Turn 3 · Main 1");
    expect(rail.textContent).not.toContain("Preset Duel");
    const nodes = [
      ...rail.querySelectorAll(
        '[data-cy="duel-player-avatar-1"], [data-cy="duel-right-rail-life-points-1"], [data-cy="duel-right-rail-life-points-0"], [data-cy="duel-player-avatar-0"]',
      ),
    ];
    expect(nodes.map((node) => node.getAttribute("data-cy"))).toEqual([
      "duel-player-avatar-1",
      "duel-right-rail-life-points-1",
      "duel-right-rail-life-points-0",
      "duel-player-avatar-0",
    ]);
    expect(
      rail
        .querySelector('[data-cy="duel-right-rail-status"]')
        ?.getAttribute("aria-live"),
    ).toBe("polite");
    expect(
      rail.querySelectorAll('[data-cy^="duel-right-rail-status-dot-"]'),
    ).toHaveLength(3);
  });
  it("falls back to the avatar placeholder when no avatar url is given", () => {
    render(DuelRail, { ...props, playerAvatarUrl: "", opponentAvatarUrl: "" });
    const avatar0 = document.querySelector(
      '[data-cy="duel-player-avatar-0"]',
    ) as HTMLImageElement;
    const avatar1 = document.querySelector(
      '[data-cy="duel-player-avatar-1"]',
    ) as HTMLImageElement;
    expect(avatar0.src).toMatch(/^data:image\/svg\+xml/);
    expect(avatar0.src).toContain("M16 88c4-20");
    expect(avatar1.src).toMatch(/^data:image\/svg\+xml/);
    expect(avatar1.src).toContain("M16 88c4-20");
  });

  it("renders a header row and bordered life points", () => {
    render(DuelRail, props);
    expect(
      document.querySelector('[data-cy="duel-right-rail-header"]'),
    ).not.toBeNull();
    const lp0 = document.querySelector(
      '[data-cy="duel-right-rail-life-points-0"]',
    )!;
    expect(lp0.classList.contains("duel-right-rail__life")).toBe(true);
    expect(lp0.textContent).toBe("LP 8000");
  });

  it("life plates carry their state class", async () => {
    const { rerender } = render(DuelRail, {
      ...props,
      lifePoints: [8000, 3000] as const,
    });
    const lp0 = document.querySelector(
      '[data-cy="duel-right-rail-life-points-0"]',
    )!;
    const lp1 = document.querySelector(
      '[data-cy="duel-right-rail-life-points-1"]',
    )!;
    expect(lp0.classList.contains("is-high")).toBe(true);
    expect(lp1.classList.contains("is-mid")).toBe(true);

    await rerender({ ...props, lifePoints: [1500, 8000] as const });
    expect(lp0.classList.contains("is-low")).toBe(true);
    expect(lp1.classList.contains("is-high")).toBe(true);
  });

  it("life updates settle on the new value", async () => {
    const restore = mockMotionPreference(true);
    try {
      const { rerender } = render(DuelRail, {
        ...props,
        lifePoints: [8000, 7300] as const,
      });
      await rerender({ ...props, lifePoints: [5000, 7300] as const });
      const lp0 = document.querySelector(
        '[data-cy="duel-right-rail-life-points-0"]',
      )!;
      expect(lp0.textContent).toBe("LP 5000");
    } finally {
      restore();
    }
  });

  it("life interpolates frame by frame and converges on the target", async () => {
    const restoreMotion = mockMotionPreference(false);
    const raf = mockAnimationFrames();
    try {
      const { rerender } = render(DuelRail, {
        ...props,
        lifePoints: [8000, 7300] as const,
      });
      // Drain the no-op tween the initial assignment schedules.
      await raf.advanceTo(1000);
      expect(lifeText(0)).toBe("LP 8000");

      await rerender({ ...props, lifePoints: [5000, 7300] as const });
      // Quarter of the 600ms tween: a value strictly between the two.
      await raf.advanceTo(1150);
      expect(lifeText(0)).toBe("LP 7250");
      await raf.advanceTo(1300);
      expect(lifeText(0)).toBe("LP 6500");
      expect(raf.pendingFrames()).toBeGreaterThan(0);

      await raf.advanceTo(1600);
      expect(lifeText(0)).toBe("LP 5000");
      expect(lifeText(1)).toBe("LP 7300");
      expect(raf.pendingFrames()).toBe(0);
    } finally {
      raf.restore();
      restoreMotion();
    }
  });

  it("unmounting mid-tween cancels the pending frame", async () => {
    const restoreMotion = mockMotionPreference(false);
    const raf = mockAnimationFrames();
    try {
      const { rerender, unmount } = render(DuelRail, {
        ...props,
        lifePoints: [8000, 7300] as const,
      });
      await raf.advanceTo(1000);
      await rerender({ ...props, lifePoints: [5000, 2000] as const });
      await raf.advanceTo(1150);
      expect(raf.pendingFrames()).toBe(2);

      unmount();
      expect(raf.cancelSpy).toHaveBeenCalledTimes(2);
      expect(raf.pendingFrames()).toBe(0);

      await raf.advanceTo(1600);
      expect(raf.pendingFrames()).toBe(0);
    } finally {
      raf.restore();
      restoreMotion();
    }
  });

  it("opens options and omits dots when idle", async () => {
    const onopensettings = vi.fn();
    render(DuelRail, {
      ...props,
      status: { ...props.status, thinking: false },
      onopensettings,
    });
    await userEvent
      .setup()
      .click(
        document.querySelector(
          '[data-cy="duel-right-rail-options"]',
        ) as HTMLButtonElement,
      );
    expect(onopensettings).toHaveBeenCalledOnce();
    expect(
      document.querySelectorAll('[data-cy^="duel-right-rail-status-dot-"]'),
    ).toHaveLength(0);
  });
});

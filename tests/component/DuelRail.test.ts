// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelRail from "../../src/app/components/DuelRail.svelte";
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

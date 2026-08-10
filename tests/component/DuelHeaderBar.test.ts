// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelHeaderBar from "../../src/app/components/DuelHeaderBar.svelte";

afterEach(() => cleanup());

describe("DuelHeaderBar", () => {
  it("renders both life-point readouts", () => {
    render(DuelHeaderBar, {
      lifePoints: [8000, 7300],
      onopensettings: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="duel-header-life-points-p0"]')
        ?.textContent,
    ).toBe("8,000 LP");
    expect(
      document.querySelector('[data-cy="duel-header-life-points-p1"]')
        ?.textContent,
    ).toBe("7,300 LP");
  });

  it("renders an em dash before the first snapshot", () => {
    render(DuelHeaderBar, {
      lifePoints: null,
      onopensettings: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="duel-header-life-points-p0"]')
        ?.textContent,
    ).toBe("—");
    expect(
      document.querySelector('[data-cy="duel-header-life-points-p1"]')
        ?.textContent,
    ).toBe("—");
  });

  it("uses the supplied avatar url for both players", () => {
    render(DuelHeaderBar, {
      selfAvatarUrl: "a.png",
      opponentAvatarUrl: "b.png",
      onopensettings: vi.fn(),
    });

    expect(
      document
        .querySelector('[data-cy="duel-header-avatar-p0"]')
        ?.getAttribute("src"),
    ).toBe("a.png");
    expect(
      document
        .querySelector('[data-cy="duel-header-avatar-p1"]')
        ?.getAttribute("src"),
    ).toBe("b.png");
  });

  it("opens settings from the gear button", async () => {
    const user = userEvent.setup();
    const onopensettings = vi.fn();
    render(DuelHeaderBar, { onopensettings });

    const button = screen.getByRole("button", { name: "Settings" });
    expect(
      document.querySelector('[data-cy="app-menubar-settings-button"]'),
    ).toBe(button);

    await user.click(button);
    expect(onopensettings).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-cy="duel-header-settings-icon"]'),
    ).not.toBeNull();
  });
});

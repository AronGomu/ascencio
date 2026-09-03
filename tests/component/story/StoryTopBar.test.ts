// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StoryTopBar from "../../../src/story/components/StoryTopBar.svelte";

afterEach(() => {
  cleanup();
  globalThis.location.hash = "";
});

describe("StoryTopBar", () => {
  it("renders the complete header contract in stable order", () => {
    const { container } = render(StoryTopBar, {
      dp: 1000,
      showShop: true,
      showDecks: true,
      title: "City signal map",
      objective: "Meet Rin at the Old Arena",
      showSettings: true,
    });
    const bar = container.querySelector('[data-cy="story-top-bar"]');
    expect(bar).not.toBeNull();
    expect(
      Array.from(bar!.children).map((element) =>
        element.getAttribute("data-cy"),
      ),
    ).toEqual([
      "story-top-bar-dp",
      "story-top-bar-shop",
      "story-top-bar-decks",
      "story-top-bar-title",
      "story-top-bar-objective",
      "story-top-bar-settings",
    ]);
    expect(
      container.querySelector('[data-cy="story-top-bar-dp"]')?.textContent,
    ).toBe("1000 DP");
    expect(
      container.querySelector('[data-cy="story-top-bar-title"]')?.textContent,
    ).toBe("City signal map");
    expect(
      container.querySelector('[data-cy="story-top-bar-objective"]')
        ?.textContent,
    ).toContain("Meet Rin at the Old Arena");
  });

  it("fires shop, deck and settings actions with accessible names", async () => {
    const onshop = vi.fn();
    const ondecks = vi.fn();
    const onsettings = vi.fn();
    render(StoryTopBar, {
      dp: 0,
      showShop: true,
      showDecks: true,
      showSettings: true,
      onshop,
      ondecks,
      onsettings,
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open shop" }));
    await user.click(screen.getByRole("button", { name: "Open deck builder" }));
    await user.click(screen.getByRole("button", { name: "Open settings" }));

    expect(onshop).toHaveBeenCalledOnce();
    expect(ondecks).toHaveBeenCalledOnce();
    expect(onsettings).toHaveBeenCalledOnce();
  });

  it("omits hidden controls and empty text slots", () => {
    const { container } = render(StoryTopBar, {
      dp: 0,
      showShop: false,
      showDecks: false,
      title: null,
      objective: null,
      showSettings: false,
    });

    for (const suffix of ["shop", "decks", "title", "objective", "settings"])
      expect(
        container.querySelector(`[data-cy="story-top-bar-${suffix}"]`),
      ).toBeNull();
  });

  /* The save's own decks, not free play's library: a player inside a story who
     builds a deck has to find it in that story (ADR-051). */
  it("defaults to the story's deck builder route", async () => {
    render(StoryTopBar, { dp: 0, showDecks: true });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Open deck builder" }));
    expect(globalThis.location.hash).toBe("#/story/decks");
  });
});

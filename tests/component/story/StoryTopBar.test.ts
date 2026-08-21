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
  it("shows the wallet", () => {
    const { container } = render(StoryTopBar, { dp: 1000 });
    const dp = container.querySelector('[data-cy="story-top-bar-dp"]');
    expect(dp).not.toBeNull();
    expect(dp!.textContent).toContain("1000");
    expect(dp!.textContent).toContain("DP");
  });

  it("shop button fires", async () => {
    const onshop = vi.fn();
    render(StoryTopBar, { dp: 0, onshop });
    const btn = screen.getByRole("button", { name: "Open shop" });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBe("Open shop");
    await userEvent.setup().click(btn);
    expect(onshop).toHaveBeenCalledOnce();
  });

  /* The save's own decks, not free play's library: a player inside a story who
     builds a deck has to find it in that story (ADR-051). */
  it("deck button navigates to the story's deck builder", async () => {
    render(StoryTopBar, { dp: 0 });
    const btn = screen.getByRole("button", { name: "Open deck builder" });
    expect(btn).toBeTruthy();
    await userEvent.setup().click(btn);
    expect(globalThis.location.hash).toBe("#/story/decks");
  });

  it("inside the shop the shop button disappears", () => {
    const { container } = render(StoryTopBar, { dp: 0, inShop: true });
    expect(
      container.querySelector('[data-cy="story-top-bar-shop"]'),
    ).toBeNull();
  });
});

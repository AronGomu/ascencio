// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import StoryApp from "../../../src/story/StoryApp.svelte";

afterEach(() => {
  cleanup();
  globalThis.localStorage.clear();
});

describe("StoryApp", () => {
  it("mounts from the story domain straight onto the title screen", async () => {
    render(StoryApp);
    expect(
      screen.getByRole("heading", { name: "Echoes of the Draw" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy(),
    );
  });

  /* The reviewer harness was the prototype's entry point; the production
     domain has to open on the story itself, with no reviewer surface left
     anywhere in the tree. */
  it("exposes no reviewer launcher or drawer", () => {
    render(StoryApp);
    expect(
      screen.queryByRole("button", { name: "Start full flow" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Jump to screen or state" }),
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Reviewer tools" }),
    ).toBeNull();
  });

  it("plays New Game into the first narrative beat", async () => {
    render(StoryApp);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "New Game" }));
    expect(screen.getByText(/Rain turned/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open pause menu" }),
    ).toBeTruthy();
  });

  /* Story styling has to stay inside its own root: the shell mounts duel and
     deck editor in the same document, so a bare `button`/`body` rule would
     repaint them. */
  it("renders under a single scoping root element", () => {
    const { container } = render(StoryApp);
    expect(container.querySelector(".story-app")).not.toBeNull();
  });
});

// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import StoryApp from "../../../src/story/StoryApp.svelte";

afterEach(async () => {
  cleanup();
  await deleteDB(STORY_SAVES_DATABASE_NAME);
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

  /* The save overlay's backing store is the thing that changed, so the proof
     has to outlive the component: a save made by one mount is offered by the
     next one, which only holds if it reached IndexedDB. */
  it("saves through the overlay into a store the next mount reads back", async () => {
    const user = userEvent.setup();
    const first = render(StoryApp);
    await user.click(screen.getByRole("button", { name: "New Game" }));
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await user.click(screen.getByRole("button", { name: "Confirm overwrite" }));
    await waitFor(() => expect(screen.getByText(/Save complete/)).toBeTruthy());
    first.unmount();
    cleanup();

    render(StoryApp);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/Rain turned/)).toBeTruthy();
  });

  /* A slot this build cannot parse must cost the player their progress and
     nothing else — the title screen still has to come up and play. */
  it("degrades a corrupt slot to no save instead of a blank screen", async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STORY_SAVES_DATABASE_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("saves", "readwrite");
    transaction.objectStore("saves").put("not a save", "manual:1");
    await new Promise((resolve) => (transaction.oncomplete = resolve));
    database.close();

    render(StoryApp);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/manual:1/),
    );
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "New Game" }));
    expect(screen.getByText(/Rain turned/)).toBeTruthy();
  });
});

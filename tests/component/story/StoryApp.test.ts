// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
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
  });

  it("map screen shows floating menu gear, narrative does not", async () => {
    const mapState = {
      ...createInitialStoryState(),
      screen: "map" as const,
      savedScreen: "map" as const,
    };
    const { container } = render(StoryApp, { resumeState: mapState });
    // On map: floating gear present with aria-label
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
    expect(
      container.querySelector('[data-cy="story-global-menu"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="story-global-pause"]'),
    ).toBeNull();
  });

  it("narrative screen hides the floating menu gear", async () => {
    const { container } = render(StoryApp);
    // Drive to narrative via New Game
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "New Game" }));
    // On narrative: floating gear (story-global-menu) must be absent;
    // narrative bar's own gear (story-narrative-menu) may still be present
    expect(container.querySelector('[data-cy="story-global-menu"]')).toBeNull();
  });

  /* Story styling has to stay inside its own root: the shell mounts duel and
     deck editor in the same document, so a bare `button`/`body` rule would
     repaint them. */
  it("top bar rides narrative, map and shop, not title", async () => {
    // title: absent
    const { container: titleContainer } = render(StoryApp);
    expect(
      titleContainer.querySelector('[data-cy="story-top-bar"]'),
    ).toBeNull();
    cleanup();

    // narrative: present
    const narrativeState = {
      ...createInitialStoryState(),
      screen: "narrative" as const,
      savedScreen: "narrative" as const,
    };
    const { container: narrativeContainer } = render(StoryApp, {
      resumeState: narrativeState,
    });
    expect(
      narrativeContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
    cleanup();

    // map: present
    const mapState = {
      ...createInitialStoryState(),
      screen: "map" as const,
      savedScreen: "map" as const,
    };
    const { container: mapContainer } = render(StoryApp, {
      resumeState: mapState,
    });
    expect(
      mapContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
    cleanup();

    // shop-greeting: present
    const shopState = {
      ...createInitialStoryState(),
      screen: "shop-greeting" as const,
      savedScreen: "shop-greeting" as const,
    };
    const { container: shopContainer } = render(StoryApp, {
      resumeState: shopState,
    });
    expect(
      shopContainer.querySelector('[data-cy="story-top-bar"]'),
    ).not.toBeNull();
  });

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
    // T1 consolidated Save into gear menu — open gear first
    await user.click(screen.getByRole("button", { name: "Open menu" }));
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

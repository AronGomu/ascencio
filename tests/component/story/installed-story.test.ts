// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import StoryApp from "../../../src/story/StoryApp.svelte";
import { createStoryMigrationPort } from "../../../src/story/saves/index.ts";
import {
  storyReleaseFixture,
  storyCardsFixture,
} from "../../fixtures/story-release.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
afterEach(cleanup);
it("Optional Story media: null map boots narrative/map UI with usable placeholder", async () => {
  const release = storyReleaseFixture();
  const port = createStoryMigrationPort(new IDBFactory());
  const seal = await port.prepare(null, release);
  const media = {
    acquireMap: vi.fn(async () => null),
    acquireSetImage: vi.fn(async () => null),
  };
  const mounted = render(StoryApp, {
    release,
    cards: storyCardsFixture(),
    saves: port.repository(seal.generationId),
    media,
  });
  expect(
    screen.getByText(release.chapters[0]!.document!.beats[0]!.text),
  ).toBeTruthy();
  mounted.unmount();
  render(StoryApp, {
    release,
    cards: storyCardsFixture(),
    saves: port.repository(seal.generationId),
    media,
    resumeState: { ...createInitialStoryState(), screen: "map" },
  });
  await waitFor(() => expect(media.acquireMap).toHaveBeenCalled());
  expect(
    document.querySelector('[data-cy="story-map-placeholder"]'),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Old Arena, battle marker/ }),
  ).toBeTruthy();
});
it("Optional set media null never requests raw fallback art or blocks buying packs", async () => {
  const release = storyReleaseFixture();
  const port = createStoryMigrationPort(new IDBFactory());
  const seal = await port.prepare(null, release);
  render(StoryApp, {
    release,
    cards: storyCardsFixture(),
    saves: port.repository(seal.generationId),
    media: { acquireMap: async () => null, acquireSetImage: async () => null },
    resumeState: { ...createInitialStoryState(), screen: "shop-browse" },
  });
  await waitFor(() =>
    expect(
      document.querySelector('[data-cy="story-shop-browse"]'),
    ).toBeTruthy(),
  );
  expect(
    [...document.querySelectorAll("img")].some((img) =>
      img.src.includes("runtime/sets/"),
    ),
  ).toBe(false);
  const user = userEvent.setup();
  await user.click(
    document.querySelector('[data-cy="story-shop-set-installed-set"]')!,
  );
  await user.click(document.querySelector('[data-cy="story-shop-buy-one"]')!);
  expect(
    document.querySelector('[data-cy="story-top-bar-dp"]')?.textContent,
  ).toContain("850 DP");
});
it("handoff resume preserves completed chapter binding through autosave", async () => {
  const release = storyReleaseFixture();
  const port = createStoryMigrationPort(new IDBFactory());
  const seal = await port.prepare(null, release);
  const saves = port.repository(seal.generationId);
  const story = {
    chapterId: "chapter-01",
    contentId: "prototype-prologue-v1" as const,
    revision: 1,
    completedChapterIds: ["chapter-01"],
  };
  render(StoryApp, {
    release,
    cards: storyCardsFixture(),
    saves,
    resumeState: { ...createInitialStoryState(), screen: "map" },
    resumeStory: story,
  });
  await waitFor(() =>
    expect(document.querySelector('[data-cy="story-map-screen"]')).toBeTruthy(),
  );
  await import("@testing-library/user-event").then(async ({ userEvent }) => {
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Open deck builder" }));
  });
  await waitFor(async () => {
    const result = await saves.read("autosave");
    expect(result.kind === "ready" && result.envelope.story).toEqual(story);
  });
});

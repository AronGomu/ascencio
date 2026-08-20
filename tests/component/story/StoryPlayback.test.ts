// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROLOGUE } from "../../../src/story/content/prologue.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { writeStoryPlaybackSettings } from "../../../src/story/playback/story-playback-settings.ts";
import {
  readStoryReadLog,
  writeStoryReadLog,
} from "../../../src/story/playback/story-read-log.ts";
import StoryApp from "../../../src/story/StoryApp.svelte";

/* Only the timer functions are faked: `fake-indexeddb` and the save
   repository still need a real microtask queue to answer the mount. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

function beatId(index: number): string {
  return PROLOGUE.beats[index]!.id;
}

/** Runs the fake clock in small steps, letting Svelte flush between them so
    each advance can schedule the next one exactly as it does in a browser. */
async function runPlayback(totalMs: number, stepMs = 60): Promise<void> {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    vi.advanceTimersByTime(stepMs);
    await tick();
  }
}

async function startNewGame(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(StoryApp);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy(),
  );
  await user.click(screen.getByRole("button", { name: "New Game" }));
  expect(screen.getByText(/Rain turned/)).toBeTruthy();
  return user;
}

describe("story auto and skip playback", () => {
  it("auto advances the scene on its own and yields to the next manual input", async () => {
    const user = await startNewGame();
    const auto = screen.getByRole("button", { name: "Auto" });
    await user.click(auto);
    expect(auto.getAttribute("aria-pressed")).toBe("true");

    await runPlayback(3200, 400);
    expect(screen.getByText(/Rin said midnight/)).toBeTruthy();

    await user.click(screen.getByTestId("narrative-stage"));
    expect(
      screen.getByRole("button", { name: "Auto" }).getAttribute("aria-pressed"),
    ).toBe("false");
    const afterClick = screen.getByTestId("narrative-cursor").textContent;
    await runPlayback(6000, 400);
    expect(screen.getByTestId("narrative-cursor").textContent).toBe(afterClick);
  });

  it("skip says why it stopped instead of doing nothing when nothing was read", async () => {
    const user = await startNewGame();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await runPlayback(600);

    expect(screen.getByTestId("narrative-cursor").textContent).toContain(
      "Beat 1",
    );
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("not read yet");
    expect(
      screen.getByRole("button", { name: "Skip" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("skip fast-forwards read beats and hands back control at the first unread one", async () => {
    writeStoryReadLog(new Set([0, 1, 2, 3].map(beatId)));
    const user = await startNewGame();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await runPlayback(900);

    expect(screen.getByText(/You made it sound urgent/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("not read yet");
  });

  it("the skip-unread setting carries skip through unread text up to the first choice", async () => {
    writeStoryPlaybackSettings({ autoSpeedSeconds: 3, skipUnread: true });
    const user = await startNewGame();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await runPlayback(2400);

    expect(screen.getByTestId("narrative-cursor").textContent).toContain(
      "Beat 14",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "choose a response",
    );
  });

  it("records every beat it showed, so a later session can skip what this one read", async () => {
    const user = await startNewGame();
    await user.click(screen.getByTestId("narrative-stage"));
    await user.click(screen.getByTestId("narrative-stage"));
    expect([...readStoryReadLog()]).toEqual([beatId(0), beatId(1), beatId(2)]);
  });
});

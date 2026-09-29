// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { rmSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import StoryApp from "../../../src/story/StoryApp.svelte";
import {
  storyAppProps,
  resetStorySessionFixture,
} from "../../fixtures/story-session.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/sqlite-story-repository.ts";
import type { StorySaveReadResult } from "../../../src/story/saves/index.ts";
import { createUserDataFixture } from "../../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../../unit/storage/runtime-fixtures.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";

const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  cleanup();
  await resetStorySessionFixture();
  for (const close of owned.splice(0)) await close();
});
function database() {
  const fixture = createUserDataFixture();
  const files = createNodeFileStore();
  const runtime = new UserDataRuntime({
    database: databaseAdapter(fixture.database),
    files,
    randomId: () => crypto.randomUUID(),
  });
  owned.push(async () => {
    await runtime.close();
    rmSync(fixture.file);
    rmSync(files.root, { recursive: true });
  });
  return {
    runtime,
    saves: createSqliteStoryRepository(runtime),
    rows: () =>
      fixture.database
        .prepare("SELECT * FROM user_records ORDER BY record_key")
        .all(),
  };
}
async function openSave() {
  await fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  await fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
}
async function seed(h: ReturnType<typeof database>) {
  for (const slot of ["manual:1", "autosave", "checkpoint:pre-duel"] as const)
    expect(
      (
        await h.saves.write(
          slot,
          createInitialStoryState(),
          0,
          storyBindingFixture(),
        )
      ).kind,
    ).toBe("written");
}

it("R7 empty Save action reads first, offers no destructive confirmation, writes expected0", async () => {
  const h = database();
  const read = vi.fn(h.saves.read),
    write = vi.fn(h.saves.write),
    list = vi.fn(h.saves.list);
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, read, write, list },
    storyEntryIntent: "new",
  });
  expect(read).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  await openSave();
  const save = await screen.findByRole("button", {
    name: "Save to manual slot 1",
  });
  expect(read).toHaveBeenCalledExactlyOnceWith("manual:1");
  expect(
    screen.queryByRole("button", { name: "Confirm overwrite" }),
  ).toBeNull();
  expect(write).not.toHaveBeenCalled();
  await fireEvent.click(save);
  await waitFor(() => expect(screen.getByText(/Save complete/)).toBeTruthy());
  expect(write.mock.calls[0]![2]).toBe(0);
});

it("R7 occupied confirmation binds captured revision; newer SQLite row survives stale write", async () => {
  const h = database();
  await seed(h);
  const read = vi.fn(h.saves.read),
    write = vi.fn(h.saves.write);
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, read, write },
    storyEntryIntent: "new",
  });
  await openSave();
  const confirm = await screen.findByRole("button", {
    name: "Confirm overwrite",
  });
  expect(read).toHaveBeenCalledExactlyOnceWith("manual:1");
  expect(write).not.toHaveBeenCalled();
  expect(
    (
      await h.saves.write(
        "manual:1",
        { ...createInitialStoryState(), narrativeIndex: 5 },
        1,
        storyBindingFixture(),
      )
    ).kind,
  ).toBe("written");
  const before = h.rows();
  await fireEvent.click(confirm);
  await waitFor(() =>
    expect(screen.getByText(/Save was changed elsewhere/)).toBeTruthy(),
  );
  expect(write.mock.calls[0]![2]).toBe(1);
  expect(read).toHaveBeenCalledOnce();
  expect(h.rows()).toEqual(before);
  await fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByRole("button", { name: "Confirm overwrite" });
  expect(write).toHaveBeenCalledOnce();
  expect(h.rows()).toEqual(before);
});

it("R7 occupied Save writes only after confirmation using captured snapshot", async () => {
  const h = database();
  await seed(h);
  const write = vi.fn(h.saves.write);
  const props = storyAppProps();
  const chapter = props.release.chapters[0]!;
  const main = [
    ...chapter.decks.find((d) => d.id === chapter.defaults.starterDeckId)!.main,
  ];
  render(StoryApp, {
    ...props,
    saves: { ...h.saves, write },
    storyEntryIntent: "new",
  });
  await openSave();
  await fireEvent.click(
    await screen.findByRole("button", { name: "Confirm overwrite" }),
  );
  await waitFor(() => expect(screen.getByText(/Save complete/)).toBeTruthy());
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0]![1].decks[0]?.main).toEqual(main);
  expect(write.mock.calls[0]![2]).toBe(1);
});

it.each(["cancel", "navigation"] as const)(
  "R7 %s invalidates late Save read without writes",
  async (action) => {
    const h = database();
    await seed(h);
    const pending = Promise.withResolvers<StorySaveReadResult>();
    const write = vi.fn(h.saves.write);
    const mounted = render(StoryApp, {
      ...storyAppProps(),
      saves: { ...h.saves, read: () => pending.promise, write },
      storyEntryIntent: "new",
    });
    await openSave();
    expect(screen.getByText("Reading manual slot…")).toBeTruthy();
    if (action === "cancel")
      await fireEvent.click(
        screen.getByRole("button", { name: "Close Save and load" }),
      );
    else mounted.unmount();
    pending.resolve(await h.saves.read("manual:1"));
    await Promise.resolve();
    expect(
      screen.queryByRole("button", { name: "Confirm overwrite" }),
    ).toBeNull();
    expect(write).not.toHaveBeenCalled();
  },
);

it("R7 read failure is visible; never authorizes a write", async () => {
  const h = database();
  const write = vi.fn(h.saves.write);
  render(StoryApp, {
    ...storyAppProps(),
    saves: {
      ...h.saves,
      read: async () => {
        throw new Error("STORAGE_UNAVAILABLE");
      },
      write,
    },
    storyEntryIntent: "new",
  });
  await openSave();
  await waitFor(() =>
    expect(screen.getByText(/STORAGE_UNAVAILABLE/)).toBeTruthy(),
  );
  expect(write).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Confirm overwrite" }),
  ).toBeNull();
});

it("G1 prepared current inputs mount fresh opening/grant without reading old saves", async () => {
  const h = database();
  await seed(h);
  const props = storyAppProps();
  const chapter = props.release.chapters[0]!;
  const currentDeck = {
    ...chapter.decks[0]!,
    id: "current-starter",
    name: "Current starter",
  };
  const release = {
    ...props.release,
    revision: 2,
    chapters: [
      {
        ...chapter,
        defaults: { ...chapter.defaults, starterDeckId: currentDeck.id },
        decks: [currentDeck],
        document: {
          ...chapter.document!,
          beats: [
            {
              ...chapter.document!.beats[0]!,
              id: "current-opening",
              text: "Current opening.",
            },
          ],
        },
      },
    ],
  };
  const read = vi.fn(h.saves.read),
    list = vi.fn(h.saves.list),
    write = vi.fn(h.saves.write);
  render(StoryApp, {
    ...props,
    release,
    saves: { ...h.saves, read, list, write },
    storyEntryIntent: "new",
  });
  expect(screen.getByText("Current opening.")).toBeTruthy();
  expect(read).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  await openSave();
  await fireEvent.click(
    await screen.findByRole("button", { name: "Confirm overwrite" }),
  );
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  expect(write.mock.calls[0]![1].decks[0]?.name).toBe("Current starter");
  expect(write.mock.calls[0]![1].narrativeIndex).toBe(0);
});

it("G3 fresh editor autosave preserves old manual/autosave/checkpoint SQLite rows", async () => {
  const h = database();
  await seed(h);
  const before = h.rows();
  const ondecks = vi.fn();
  const write = vi.fn(h.saves.write),
    read = vi.fn(h.saves.read);
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, write, read },
    storyEntryIntent: "new",
    ondecks,
  });
  await fireEvent.click(
    screen.getByRole("button", { name: "Open deck builder" }),
  );
  await waitFor(() =>
    expect(screen.getByText(/Save was changed elsewhere/)).toBeTruthy(),
  );
  expect(ondecks).not.toHaveBeenCalled();
  expect(write.mock.calls[0]![2]).toBe(0);
  expect(read).not.toHaveBeenCalled();
  expect(h.rows()).toEqual(before);
});

it("G3 fresh handback reward never adopts old autosave revision, including retry", async () => {
  const h = database();
  await seed(h);
  const before = h.rows();
  const write = vi.fn(h.saves.write),
    read = vi.fn(h.saves.read);
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, write, read },
    initialAutosaveRevision: 0,
    resumeState: {
      ...createInitialStoryState(),
      screen: "outcome",
      outcome: "win",
      encounterId: "old-arena",
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Continue story" }));
  await waitFor(() => expect(screen.getByText(/Autosave failed/)).toBeTruthy());
  await fireEvent.click(screen.getByRole("button", { name: "Retry autosave" }));
  await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write.mock.calls.map((c) => c[2])).toEqual([0, 0]);
  expect(read).not.toHaveBeenCalled();
  expect(h.rows()).toEqual(before);
});

it("G3 current-run handback reward updates only owned autosave revision", async () => {
  const h = database();
  await seed(h);
  const before = h.rows().filter((row) => row.record_key !== "autosave");
  const write = vi.fn(h.saves.write),
    read = vi.fn(h.saves.read),
    onautosaverevision = vi.fn();
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, write, read },
    initialAutosaveRevision: 1,
    onautosaverevision,
    resumeState: {
      ...createInitialStoryState(),
      screen: "outcome",
      outcome: "win",
      encounterId: "old-arena",
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Continue story" }));
  await waitFor(() =>
    expect(screen.getByText(/Autosave complete/)).toBeTruthy(),
  );
  expect(write.mock.calls[0]![2]).toBe(1);
  expect(onautosaverevision).toHaveBeenCalledWith(2);
  expect(read).not.toHaveBeenCalled();
  expect(h.rows().filter((row) => row.record_key !== "autosave")).toEqual(
    before,
  );
});

it("G3 deliberate Continue captures autosave revision for legitimate editor progress", async () => {
  const h = database();
  await seed(h);
  expect(
    (
      await h.saves.write(
        "autosave",
        {
          ...createInitialStoryState(),
          progressExists: true,
          screen: "map",
          savedScreen: "map",
        },
        1,
        storyBindingFixture(),
      )
    ).kind,
  ).toBe("written");
  const before = h.rows().filter((row) => row.record_key !== "autosave");
  const write = vi.fn(h.saves.write),
    ondecks = vi.fn();
  render(StoryApp, {
    ...storyAppProps(),
    saves: { ...h.saves, write },
    storyEntryIntent: "continue",
    ondecks,
  });
  await fireEvent.click(
    await screen.findByRole("button", { name: "Open deck builder" }),
  );
  await waitFor(() => expect(ondecks).toHaveBeenCalledOnce());
  expect(write.mock.calls[0]![2]).toBe(2);
  expect(h.rows().filter((row) => row.record_key !== "autosave")).toEqual(
    before,
  );
});

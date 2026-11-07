// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import StoryEventMedia from "../../../src/story/components/StoryEventMedia.svelte";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("completes a video exactly once after a hung media request times out", async () => {
  vi.useFakeTimers();
  const completed = vi.fn();
  const view = render(StoryEventMedia, {
    event: { kind: "video", logicalId: "intro.mp4", timeoutMs: 2000 },
    chapterId: "chapter-01",
    media: {
      acquireMap: async () => null,
      acquireSetImage: async () => null,
      acquireEvent: () => new Promise(() => {}),
    },
    oncomplete: completed,
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(completed).toHaveBeenCalledOnce();
  await fireEvent.click(view.getByRole("button", { name: "Skip video" }));
  expect(completed).toHaveBeenCalledOnce();
});
it("releases late replies when the story moves on before media arrives", async () => {
  let resolve!: (value: { url: string; release: () => void }) => void;
  const release = vi.fn();
  const view = render(StoryEventMedia, {
    event: { kind: "video", logicalId: "intro.mp4", timeoutMs: 2000 },
    chapterId: "chapter-01",
    media: {
      acquireMap: async () => null,
      acquireSetImage: async () => null,
      acquireEvent: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    oncomplete: vi.fn(),
  });
  view.unmount();
  resolve({ url: "blob:late", release });
  await waitFor(() => expect(release).toHaveBeenCalledOnce());
});
it("keeps a missing image lease alive so a corrected visible file can appear", async () => {
  let changed: ((url: string) => void) | undefined;
  const release = vi.fn();
  const unsubscribe = vi.fn();
  const view = render(StoryEventMedia, {
    event: { kind: "image", logicalId: "portrait.png", timeoutMs: 2000 },
    chapterId: "chapter-01",
    oncomplete: vi.fn(),
    media: {
      acquireMap: async () => null,
      acquireSetImage: async () => null,
      acquireEvent: async () => ({
        url: "",
        release,
        subscribe: (listener: (url: string) => void) => {
          changed = listener;
          return unsubscribe;
        },
      }),
    },
  });
  await waitFor(() => expect(changed).toBeTypeOf("function"));
  changed!("blob:corrected");
  await waitFor(() =>
    expect(view.container.querySelector("img")?.src).toBe("blob:corrected"),
  );
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(release).toHaveBeenCalledOnce();
});

it.each(["skip", "timeout"] as const)(
  "cancels pending video acquisition and discards late media after %s",
  async (action) => {
    vi.useFakeTimers();
    const pending = Promise.withResolvers<{ url: string; release(): void }>();
    let signal: AbortSignal | undefined;
    const release = vi.fn();
    const complete = vi.fn();
    const view = render(StoryEventMedia, {
      event: { kind: "video", logicalId: "intro.mp4", timeoutMs: 2000 },
      chapterId: "chapter-01",
      media: {
        acquireMap: async () => null,
        acquireSetImage: async () => null,
        acquireEvent: (
          _chapter: string,
          _id: string,
          requestSignal: AbortSignal,
        ) => {
          signal = requestSignal;
          return pending.promise;
        },
      },
      oncomplete: complete,
    });
    if (action === "skip")
      await fireEvent.click(view.getByRole("button", { name: "Skip video" }));
    else await vi.advanceTimersByTimeAsync(2000);
    expect(signal?.aborted).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
    pending.resolve({ url: "blob:late", release });
    await vi.advanceTimersByTimeAsync(0);
    expect(release).toHaveBeenCalledOnce();
    expect(view.container.querySelector("video")).toBeNull();
    view.unmount();
    expect(release).toHaveBeenCalledOnce();
  },
);

it("cannot replay a skipped video after a late canplay event", async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const release = vi.fn();
  const unsubscribe = vi.fn();
  const complete = vi.fn();
  const view = render(StoryEventMedia, {
    event: { kind: "video", logicalId: "intro.mp4", timeoutMs: 2000 },
    chapterId: "chapter-01",
    media: {
      acquireMap: async () => null,
      acquireSetImage: async () => null,
      acquireEvent: async () => ({
        url: "blob:video",
        release,
        subscribe: () => unsubscribe,
      }),
    },
    oncomplete: complete,
  });
  await waitFor(() =>
    expect(view.container.querySelector("video")).not.toBeNull(),
  );
  const video = view.container.querySelector("video")!;
  await fireEvent.click(view.getByRole("button", { name: "Skip video" }));
  await fireEvent.canPlay(video);
  expect(play).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(release).toHaveBeenCalledOnce();
  view.unmount();
  expect(release).toHaveBeenCalledOnce();
});

import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastStore } from "../../src/shell/toast/toast-store.ts";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => vi.useRealTimers());

  it("publishes a toast then removes it after four seconds", () => {
    const store = createToastStore();
    store.show({ message: "Deck imported.", tone: "success" });

    expect(get(store)).toMatchObject([
      { message: "Deck imported.", tone: "success" },
    ]);
    vi.advanceTimersByTime(3_999);
    expect(get(store)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(get(store)).toHaveLength(0);
  });

  it("caps custom durations at four seconds", () => {
    const store = createToastStore();
    store.show({ message: "Capped", durationMs: 60_000 });

    vi.advanceTimersByTime(4_000);

    expect(get(store)).toHaveLength(0);
  });

  it("manual dismiss removes a toast immediately", () => {
    const store = createToastStore();
    const id = store.show({
      message: "Copy limit 3 reached.",
      tone: "warning",
    });

    store.dismiss(id);

    expect(get(store)).toHaveLength(0);
  });

  it("pointer and focus pauses both have to clear before time resumes", () => {
    const store = createToastStore();
    const id = store.show({ message: "Paused" });
    vi.advanceTimersByTime(1_000);
    store.pause(id, "pointer");
    store.pause(id, "focus");
    vi.advanceTimersByTime(5_000);
    store.resume(id, "pointer");
    vi.advanceTimersByTime(5_000);
    expect(get(store)).toHaveLength(1);

    store.resume(id, "focus");
    vi.advanceTimersByTime(2_999);
    expect(get(store)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(get(store)).toHaveLength(0);
  });

  it("keeps the three newest notifications", () => {
    const store = createToastStore();
    for (const message of ["One", "Two", "Three", "Four"])
      store.show({ message });

    expect(get(store).map(({ message }) => message)).toEqual([
      "Two",
      "Three",
      "Four",
    ]);
  });

  it("page visibility pauses every active toast", () => {
    const store = createToastStore();
    store.show({ message: "Hidden" });
    vi.advanceTimersByTime(1_500);
    store.setPageHidden(true);
    vi.advanceTimersByTime(5_000);
    expect(get(store)).toHaveLength(1);

    store.setPageHidden(false);
    vi.advanceTimersByTime(2_500);
    expect(get(store)).toHaveLength(0);
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckSelectScreen from "../../../src/deck-select/DeckSelectScreen.svelte";
import { tile } from "./tile-builder.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function find(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function cy(value: string): HTMLElement {
  const element = find(value);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    mode: "duel-start" as const,
    eyebrow: "Free play",
    title: "Choose your deck",
    tiles: [tile({ key: "k1", name: "Aurora Fleet" })],
    selectedKey: "k1",
    oncreate: vi.fn(),
    forceNarrow: false,
    ...overrides,
  };
}

function actionOrder(): readonly string[] {
  return [...cy("deck-select-kebab-menu").querySelectorAll("button")].map(
    (element) => element.getAttribute("data-cy") ?? "",
  );
}

describe("DeckSelectScreen compact bars", () => {
  it("compacts and restores the header through the test override", async () => {
    const base = props({ forceCompact: true });
    const { rerender } = render(DeckSelectScreen, base);

    expect(find("deck-select-eyebrow")).toBeNull();
    expect(find("deck-select-titlebar-sep")).toBeNull();
    expect(cy("deck-select-title").textContent).toBe("Select Deck");

    await rerender({ ...base, forceCompact: false });

    expect(cy("deck-select-eyebrow").textContent).toBe("Free play");
    expect(find("deck-select-titlebar-sep")).not.toBeNull();
    expect(cy("deck-select-title").textContent).toBe("Choose your deck");
  });

  it("swaps the manage cluster for a kebab with all five actions", async () => {
    render(DeckSelectScreen, props({ forceCompact: true }));

    expect(find("deck-select-manage")).toBeNull();
    const kebab = cy("deck-select-kebab");
    expect(kebab.getAttribute("aria-label")).toBe("Deck actions");
    expect(kebab.getAttribute("aria-expanded")).toBe("false");

    await userEvent.setup().click(kebab);

    expect(kebab.getAttribute("aria-expanded")).toBe("true");
    expect(actionOrder()).toEqual([
      "deck-select-delete",
      "deck-select-rename",
      "deck-select-duplicate",
      "deck-select-open",
      "deck-select-create",
    ]);
  });

  it("action press closes the menu", async () => {
    const onopen = vi.fn();
    render(DeckSelectScreen, props({ forceCompact: true, onopen }));

    await userEvent.setup().click(cy("deck-select-kebab"));
    await userEvent.setup().click(cy("deck-select-open"));

    expect(onopen).toHaveBeenCalledWith("k1");
    expect(find("deck-select-kebab-menu")).toBeNull();
  });

  it("Escape closes the menu and returns focus to the kebab", async () => {
    render(DeckSelectScreen, props({ forceCompact: true }));
    const kebab = cy("deck-select-kebab");

    await userEvent.setup().click(kebab);
    await fireEvent.keyDown(cy("deck-select-kebab-menu"), { key: "Escape" });

    expect(find("deck-select-kebab-menu")).toBeNull();
    expect(document.activeElement).toBe(kebab);
  });

  it("outside press closes the menu", async () => {
    render(DeckSelectScreen, props({ forceCompact: true }));

    await userEvent.setup().click(cy("deck-select-kebab"));
    await fireEvent.pointerDown(cy("deck-select-grid"));

    expect(find("deck-select-kebab-menu")).toBeNull();
  });

  it("gates the compact menu to Open when management is unavailable", async () => {
    render(
      DeckSelectScreen,
      props({ forceCompact: true, manageable: false, oncreate: vi.fn() }),
    );

    await userEvent.setup().click(cy("deck-select-kebab"));

    expect(actionOrder()).toEqual(["deck-select-open"]);
    expect(find("deck-select-create")).toBeNull();
  });

  it("keeps screen shortcuts inert while the compact menu is open", async () => {
    render(DeckSelectScreen, props({ forceCompact: true }));

    await userEvent.setup().click(cy("deck-select-kebab"));
    await fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).not.toBe(cy("deck-select-filter"));
    expect(find("deck-select-kebab-menu")).not.toBeNull();
  });

  it("measures full probes and uncompacts when space returns", async () => {
    const observerState: { resize?: () => void } = {};
    let available = 20;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observerState.resize = () =>
          callback([], this as unknown as ResizeObserver);
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.matches(".titlebar, footer") ? available : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.matches(".bar-probe") ? 40 : 0;
      },
    );

    render(DeckSelectScreen, props({ forceCompact: null }));
    observerState.resize?.();
    await waitFor(() =>
      expect(cy("deck-select-title").textContent).toBe("Select Deck"),
    );

    available = 60;
    observerState.resize?.();
    await waitFor(() =>
      expect(cy("deck-select-title").textContent).toBe("Choose your deck"),
    );
  });
});

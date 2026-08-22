// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";
import { AUTO_FLIP_INTERVAL_MS } from "../../../src/story/shop/auto-flip.ts";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  writeStoryPlaybackSettings,
} from "../../../src/story/playback/story-playback-settings.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

const SOURCE = readFileSync(
  "src/story/shop/BoosterOpeningScreen.svelte",
  "utf8",
);

const RARITIES: readonly ShopRarity[] = [
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
];

function cardView(code: number, name: string): DeckBuilderCardView {
  return {
    code,
    name,
    description: `${name} effect text`,
    family: "monster",
    subtypes: ["Normal"],
    attribute: "DARK",
    race: "Spellcaster",
    levelRankLink: 7,
    ratingLabel: "Level",
    attack: 2500,
    defense: 2100,
    pendulumScales: null,
    linkMarkers: [],
    canonicalZone: "main",
    imageUrl: null,
    scope: 3,
    rawType: 1,
  };
}

/** A pack, one card per index, each with the catalog view the zoom inspector
    needs — the shop hands both over together. */
function pack(size = 9) {
  return Array.from({ length: size }, (_, index) => ({
    code: 100 + index,
    name: `Card ${index}`,
    imageUrl: null as string | null,
    rarity: RARITIES[index % RARITIES.length]!,
    view: cardView(100 + index, `Card ${index}`),
  }));
}

function tile(container: HTMLElement, index: number): HTMLButtonElement {
  return container.querySelector(
    `[data-cy="story-shop-opening-card-${index}"]`,
  ) as HTMLButtonElement;
}

function isFaceUp(container: HTMLElement, index: number): boolean {
  return (
    container.querySelector(`[data-cy="story-shop-opening-art-${index}"]`) !==
      null ||
    container.querySelector(
      `[data-cy="story-shop-opening-placeholder-${index}"]`,
    ) !== null
  );
}

/* Svelte measures the zoom window's height through a `ResizeObserver`, which
   jsdom does not implement. */
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();
      readonly unobserve = vi.fn();
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("booster reveal", () => {
  it("all cards start face down", () => {
    const { container } = render(BoosterOpeningScreen, { cards: pack() });
    for (let index = 0; index < 9; index += 1) {
      expect(tile(container, index)).not.toBeNull();
      expect(isFaceUp(container, index)).toBe(false);
    }
  });

  it("clicking a card flips only that card", async () => {
    const user = userEvent.setup();
    const { container } = render(BoosterOpeningScreen, { cards: pack() });

    await user.click(tile(container, 2));

    expect(isFaceUp(container, 2)).toBe(true);
    expect(
      container.querySelector('[data-cy="story-shop-opening-name-2"]')
        ?.textContent,
    ).toContain("Card 2");
    for (const index of [0, 1, 3, 4, 5, 6, 7, 8])
      expect(isFaceUp(container, index)).toBe(false);
  });

  it("hovering a face-down card shows its rarity halo", async () => {
    const user = userEvent.setup();
    const { container } = render(BoosterOpeningScreen, { cards: pack() });
    const third = tile(container, 2);

    expect(third.classList.contains("rarity-halo")).toBe(true);
    expect(third.hasAttribute("data-rarity")).toBe(false);

    await user.hover(third);
    expect(third.dataset["rarity"]).toBe("super-rare");
    /* The rarity arrives before the face does — that is the whole point of the
       halo on a card still face down. */
    expect(isFaceUp(container, 2)).toBe(false);

    await user.unhover(third);
    expect(third.hasAttribute("data-rarity")).toBe(false);
  });

  it("hovering shows the zoom inspector once the card is face up", async () => {
    const user = userEvent.setup();
    const { container } = render(BoosterOpeningScreen, { cards: pack() });
    const first = tile(container, 0);

    /* Face down, the inspector would show the face the halo is standing in
       for, so it stays away until the card is flipped. */
    await user.hover(first);
    expect(
      container.querySelector('[data-cy="card-zoom-inspector"]'),
    ).toBeNull();

    await user.click(first);
    await user.hover(first);
    expect(
      container.querySelector('[data-cy="card-zoom-inspector"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-name"]')
        ?.textContent,
    ).toContain("Card 0");

    await user.unhover(first);
    expect(
      container.querySelector('[data-cy="card-zoom-inspector"]'),
    ).toBeNull();
  });

  it("keyboard reaches the same halo, zoom and flip a pointer does", async () => {
    const user = userEvent.setup();
    const { container } = render(BoosterOpeningScreen, { cards: pack() });
    const first = tile(container, 0);

    first.focus();
    await tick();
    expect(first.dataset["rarity"]).toBe("common");

    await user.keyboard("{Enter}");
    expect(isFaceUp(container, 0)).toBe(true);
    expect(
      container.querySelector('[data-cy="card-zoom-inspector"]'),
    ).not.toBeNull();
  });

  it("auto-flip reveals in order", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(BoosterOpeningScreen, { cards: pack() });

    await user.click(
      container.querySelector(
        '[data-cy="story-shop-opening-auto-flip"]',
      ) as HTMLInputElement,
    );

    for (const revealed of [1, 2, 3]) {
      vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
      await tick();
      for (let index = 0; index < 9; index += 1)
        expect(isFaceUp(container, index)).toBe(index < revealed);
    }
  });

  it("auto-flip defaults to off and leaves the pack alone", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { container } = render(BoosterOpeningScreen, { cards: pack() });
    const checkbox = container.querySelector(
      '[data-cy="story-shop-opening-auto-flip"]',
    ) as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS * 3);
    await tick();
    expect(isFaceUp(container, 0)).toBe(false);
  });

  it("auto-flip preference survives a remount", async () => {
    const user = userEvent.setup();
    const first = render(BoosterOpeningScreen, { cards: pack() });
    await user.click(
      first.container.querySelector(
        '[data-cy="story-shop-opening-auto-flip"]',
      ) as HTMLInputElement,
    );
    first.unmount();

    const second = render(BoosterOpeningScreen, { cards: pack() });
    expect(
      (
        second.container.querySelector(
          '[data-cy="story-shop-opening-auto-flip"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("a remembered preference opens the next pack without being asked again", async () => {
    /* The point of remembering it: the player ticked the box on one pack and
       the next pack starts turning itself over, rather than starting ticked
       and stopped. */
    writeStoryPlaybackSettings({
      ...DEFAULT_STORY_PLAYBACK_SETTINGS,
      autoFlip: true,
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { container } = render(BoosterOpeningScreen, { cards: pack() });

    expect(isFaceUp(container, 0)).toBe(false);
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS * 2);
    await tick();
    expect(isFaceUp(container, 0)).toBe(true);
    expect(isFaceUp(container, 1)).toBe(true);
    expect(isFaceUp(container, 2)).toBe(false);
  });

  it("reduced motion keeps the pacing and drops only the animation", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(BoosterOpeningScreen, { cards: pack() });

    await user.click(
      container.querySelector(
        '[data-cy="story-shop-opening-auto-flip"]',
      ) as HTMLInputElement,
    );
    vi.advanceTimersByTime(AUTO_FLIP_INTERVAL_MS);
    await tick();
    expect(isFaceUp(container, 0)).toBe(true);
    expect(isFaceUp(container, 1)).toBe(false);

    /* The pacing is a timer, so it is the same for every reader. The motion is
       CSS, switched on only where a reader has asked for no less of it — a JS
       branch would be dead code beside the story's blanket `reduce` block. */
    const noPreferenceAt = SOURCE.indexOf(
      "@media (prefers-reduced-motion: no-preference)",
    );
    expect(noPreferenceAt).toBeGreaterThan(-1);
    const flipSites = [...SOURCE.matchAll(/transition:\s*transform/g)];
    expect(flipSites).toHaveLength(1);
    expect(flipSites[0]!.index).toBeGreaterThan(noPreferenceAt);
  });

  it("lays the nine cards out on one row on a desktop width", () => {
    const desktop = SOURCE.slice(SOURCE.indexOf("@media (min-width: 1024px)"));
    expect(desktop).toContain("repeat(9, minmax(0, 1fr))");
  });

  it("finish appears only once every card is face up", async () => {
    const user = userEvent.setup();
    const onfinish = vi.fn();
    const { container } = render(BoosterOpeningScreen, {
      cards: pack(),
      onfinish,
    });

    expect(
      container.querySelector('[data-cy="story-shop-opening-finish"]'),
    ).toBeNull();
    for (let index = 0; index < 9; index += 1)
      await user.click(tile(container, index));

    const finish = container.querySelector(
      '[data-cy="story-shop-opening-finish"]',
    ) as HTMLButtonElement;
    expect(finish).not.toBeNull();
    await user.click(finish);
    expect(onfinish).toHaveBeenCalledOnce();
  });
});

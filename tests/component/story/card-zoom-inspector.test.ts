// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardZoomInspector from "../../../src/story/components/CardZoomInspector.svelte";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

/* Svelte measures a `bind:clientHeight` through a `ResizeObserver`, which jsdom
   does not implement; the same stub the shell's overlay scrollbar test uses. */
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
  cleanup();
  vi.unstubAllGlobals();
});

const MONSTER: DeckBuilderCardView = {
  code: 4007,
  name: "Dark Magician",
  description: "The ultimate wizard in terms of attack and defense.",
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
  imageUrl: "/art/4007.jpg",
  scope: 3,
  rawType: 1,
};

const SPELL: DeckBuilderCardView = {
  ...MONSTER,
  code: 5318,
  name: "Monster Reborn",
  description: "Target 1 monster in either GY; Special Summon it.",
  family: "spell",
  subtypes: ["Normal"],
  attribute: null,
  race: null,
  levelRankLink: null,
  ratingLabel: null,
  attack: null,
  defense: null,
  imageUrl: null,
};

/* A tile in the middle of jsdom's 1024x768 window, so nothing under test is
   clamped by an edge — the clamps themselves are the placement module's own
   unit tests. */
const ANCHOR = { left: 100, top: 300, width: 100, height: 146 } as const;

function inspector(
  card: DeckBuilderCardView = MONSTER,
  rarity: ShopRarity | null = null,
) {
  /* Nested under `props` because `anchor` is also a Testing Library render
     option, and a bare `anchor` key would be read as one. */
  return render(CardZoomInspector, {
    props: { card, rarity, anchor: ANCHOR },
  });
}

const STYLES = readFileSync("src/story/styles.css", "utf8");

describe("CardZoomInspector", () => {
  it("magnifies the card twice", () => {
    const { container } = inspector();
    const frame = container.querySelector(
      '[data-cy="card-zoom-inspector-card"]',
    ) as HTMLElement;
    expect(frame.style.width).toBe("200px");
    expect(frame.style.height).toBe("292px");
  });

  it("renders the same whole-card tile the story's other surfaces render", () => {
    const { container } = inspector();
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-art-4007"]'),
    ).not.toBeNull();
  });

  it("renders name, stats and effect text", () => {
    const { container } = inspector();
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-name"]')
        ?.textContent,
    ).toContain("Dark Magician");
    const stats = container.querySelector(
      '[data-cy="card-zoom-inspector-stats"]',
    )?.textContent;
    expect(stats).toContain("DARK");
    expect(stats).toContain("Spellcaster");
    expect(stats).toContain("Level 7");
    expect(stats).toContain("ATK 2500 / DEF 2100");
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-text"]')
        ?.textContent,
    ).toContain("The ultimate wizard");
  });

  it("omits the stats row for a card that has no monster stats", () => {
    const { container } = inspector(SPELL);
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-stats"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-text"]')
        ?.textContent,
    ).toContain("Special Summon it");
  });

  it("applies the rarity halo", () => {
    const { container } = inspector(MONSTER, "secret-rare");
    const frame = container.querySelector(
      '[data-cy="card-zoom-inspector-card"]',
    ) as HTMLElement;
    expect(frame.classList.contains("rarity-halo")).toBe(true);
    expect(frame.dataset["rarity"]).toBe("secret-rare");
  });

  it("carries no rarity attribute when the caller names no rarity", () => {
    const { container } = inspector();
    const frame = container.querySelector(
      '[data-cy="card-zoom-inspector-card"]',
    ) as HTMLElement;
    expect(frame.hasAttribute("data-rarity")).toBe(false);
  });

  it("floats the text window beside the magnified card", () => {
    const { container } = inspector();
    const frame = container.querySelector(
      '[data-cy="card-zoom-inspector-card"]',
    ) as HTMLElement;
    const window_ = container.querySelector(
      '[data-cy="card-zoom-inspector-window"]',
    ) as HTMLElement;
    expect(window_.dataset["side"]).toBe("right");
    expect(Number.parseFloat(window_.style.left)).toBeGreaterThanOrEqual(
      Number.parseFloat(frame.style.left) +
        Number.parseFloat(frame.style.width),
    );
  });

  it("never lets the window hang off the bottom of the viewport", () => {
    const window_ = inspector().container.querySelector(
      '[data-cy="card-zoom-inspector-window"]',
    ) as HTMLElement;
    /* The cap holds from the very first paint, before the window has been
       measured once and the placement clamp has anything to clamp. */
    expect(
      Number.parseFloat(window_.style.top) +
        Number.parseFloat(window_.style.maxHeight),
    ).toBe(globalThis.innerHeight - 8);
  });

  it("reads an unknown ATK or DEF the way the duel reads it", () => {
    /* The OCG spells `?` as a negative number. */
    const { container } = inspector({
      ...MONSTER,
      name: "Sanwitch",
      attack: -2,
      defense: -2,
    });
    expect(
      container.querySelector('[data-cy="card-zoom-inspector-stats"]')
        ?.textContent,
    ).toContain("ATK ? / DEF ?");
  });

  it("is decoration: it takes no pointer, traps no focus and is not read out", () => {
    const { container } = inspector();
    const root = container.querySelector(
      '[data-cy="card-zoom-inspector"]',
    ) as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(
      root.querySelectorAll("button, a, input, [tabindex], [aria-modal]"),
    ).toHaveLength(0);
    /* jsdom applies no stylesheet, so the rule itself is the evidence, the same
       way the shared tile proves its fit. */
    expect(STYLES).toMatch(
      /\.card-zoom-inspector\s*\{[^}]*pointer-events:\s*none/,
    );
  });

  it("drops the fade under reduced motion", () => {
    /* The fade is switched on in exactly one place and that place is inside the
       no-preference query, so a reader who asked for less motion is never
       handed one — and the story's blanket `reduce` branch zeroes any animation
       duration on top of that. */
    const noPreferenceAt = STYLES.indexOf(
      "@media (prefers-reduced-motion: no-preference)",
    );
    expect(noPreferenceAt).toBeGreaterThan(-1);
    const fadeSites = [...STYLES.matchAll(/animation:\s*story-card-zoom-in/g)];
    expect(fadeSites).toHaveLength(1);
    expect(fadeSites[0]!.index).toBeGreaterThan(noPreferenceAt);
    expect(STYLES).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms/,
    );
  });
});

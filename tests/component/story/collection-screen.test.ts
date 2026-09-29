// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CollectionScreen from "../../../src/story/collection/CollectionScreen.svelte";
import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "../../../src/decks/validation/index.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/index.ts";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import {
  createInitialStoryState,
  type ShopRarity,
} from "../../../src/story/model/story-state.ts";

afterEach(() => cleanup());

/* Names deliberately do not follow code order, so alphabetical ordering is
   visible as an ordering rather than as the order the fixture was written in. */
const CATALOG: readonly DeckBuilderCardView[] = [
  card(4007, "Dark Magician"),
  card(4008, "Blue-Eyes White Dragon"),
  card(4009, "Alpha the Magnet Warrior"),
  card(4010, "Zombie Master"),
  card(4011, "Celtic Guardian"),
];

/* Four of the seven rarities, with two commons so the alphabetical sort inside
   a group has something to sort. */
const RARITY: ReadonlyMap<number, ShopRarity> = new Map<number, ShopRarity>([
  [4007, "ultra-rare"],
  [4008, "common"],
  [4009, "common"],
  [4010, "ghost-rare"],
  [4011, "rare"],
]);

/** The save from the ticket's test plan: two copies of one card, one of another. */
const OWNS_TWO: CardOwnership = storyCardOwnership({
  ...createInitialStoryState(),
  collection: { 4007: 2, 4008: 1 },
});

function card(code: number, name: string): DeckBuilderCardView {
  return {
    code,
    name,
    description: `${name} card text`,
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
    imageUrl: `/art/${code}.jpg`,
    scope: 3,
    rawType: 1,
  };
}

function mount(props: {
  ownership: CardOwnership;
  cards?: readonly DeckBuilderCardView[];
  rarityByCode?: ReadonlyMap<number, ShopRarity>;
  onback?: () => void;
}) {
  return render(CollectionScreen, {
    cards: CATALOG,
    rarityByCode: RARITY,
    onback: () => undefined,
    ...props,
  });
}

/** The codes of the rendered tiles, in document order. */
function tileCodes(container: HTMLElement): number[] {
  return [...container.querySelectorAll('[data-cy^="collection-card-"]')].map(
    (tile) =>
      Number(tile.getAttribute("data-cy")!.replace("collection-card-", "")),
  );
}

function names(container: HTMLElement): string[] {
  return tileCodes(container).map(
    (code) => CATALOG.find((entry) => entry.code === code)!.name,
  );
}

describe("CollectionScreen", () => {
  it("story collection lists owned cards with counts", () => {
    const { container } = mount({ ownership: OWNS_TWO });
    expect(tileCodes(container).sort()).toEqual([4007, 4008]);
    expect(
      container.querySelector('[data-cy="collection-count-4007"]')!.textContent,
    ).toBe("2");
    expect(
      container.querySelector('[data-cy="collection-count-4008"]')!.textContent,
    ).toBe("1");
  });

  it("unowned cards are hidden by default", () => {
    const { container } = mount({ ownership: OWNS_TWO });
    expect(tileCodes(container)).toHaveLength(2);
    const showAll = container.querySelector(
      '[data-cy="collection-show-all"]',
    ) as HTMLInputElement;
    expect(showAll.checked).toBe(false);
  });

  it("show-all reveals unowned cards dimmed", async () => {
    const { container } = mount({ ownership: OWNS_TWO });
    await userEvent
      .setup()
      .click(container.querySelector('[data-cy="collection-show-all"]')!);
    expect(tileCodes(container)).toHaveLength(5);
    for (const code of [4009, 4010, 4011])
      expect(
        container
          .querySelector(`[data-cy="collection-card-${code}"]`)!
          .classList.contains("collection-tile--unowned"),
        `unowned dimming on ${code}`,
      ).toBe(true);
    for (const code of [4007, 4008])
      expect(
        container
          .querySelector(`[data-cy="collection-card-${code}"]`)!
          .classList.contains("collection-tile--unowned"),
        `owned card ${code} is not dimmed`,
      ).toBe(false);
  });

  it("free play shows the whole database without counts", () => {
    const { container } = mount({ ownership: unlimitedCardOwnership() });
    expect(tileCodes(container)).toHaveLength(5);
    expect(
      container.querySelectorAll('[data-cy^="collection-count-"]'),
    ).toHaveLength(0);
    /* Nothing is unowned in free play, so the control that reveals the unowned
       has nothing to reveal and is not offered. */
    expect(
      container.querySelector('[data-cy="collection-show-all"]'),
    ).toBeNull();
  });

  it("grouping by rarity orders groups and sorts inside", () => {
    const { container } = mount({ ownership: unlimitedCardOwnership() });
    expect(
      [...container.querySelectorAll('[data-cy^="collection-section-"]')].map(
        (section) =>
          section.getAttribute("data-cy")!.replace("collection-section-", ""),
      ),
    ).toEqual(["common", "rare", "ultra-rare", "ghost-rare"]);
    expect(names(container)).toEqual([
      "Alpha the Magnet Warrior",
      "Blue-Eyes White Dragon",
      "Celtic Guardian",
      "Dark Magician",
      "Zombie Master",
    ]);
  });

  it("ungrouped is alphabetical", async () => {
    const { container } = mount({ ownership: unlimitedCardOwnership() });
    await userEvent
      .setup()
      .click(container.querySelector('[data-cy="collection-group-toggle"]')!);
    expect(
      container.querySelectorAll('[data-cy^="collection-section-"]'),
    ).toHaveLength(1);
    expect(names(container)).toEqual([
      "Alpha the Magnet Warrior",
      "Blue-Eyes White Dragon",
      "Celtic Guardian",
      "Dark Magician",
      "Zombie Master",
    ]);
  });

  it("selecting a card fills the shared preview", async () => {
    const { container } = mount({ ownership: unlimitedCardOwnership() });
    await userEvent
      .setup()
      .click(container.querySelector('[data-cy="collection-card-4007"]')!);
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]')!
        .textContent,
    ).toBe("Dark Magician");
  });

  it("clears an unowned preview when show-all hides that card", async () => {
    const { container } = mount({ ownership: OWNS_TWO });
    const user = userEvent.setup();
    const showAll = container.querySelector('[data-cy="collection-show-all"]')!;

    await user.click(showAll);
    await user.click(
      container.querySelector('[data-cy="collection-card-4010"]')!,
    );
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]')
        ?.textContent,
    ).toBe("Zombie Master");

    await user.click(showAll);
    expect(
      container.querySelector('[data-cy="collection-card-4010"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Hover a card to see its details.");
  });

  it.each(["mouseEnter", "click", "focus"] as const)(
    "%s previews a late catalog card without rewalking the catalog",
    async (event) => {
      let codeReads = 0;
      const cards = Array.from({ length: 1_000 }, (_, index) => ({
        ...card(index + 1, index === 999 ? "A late card" : `Z ${index}`),
        get code() {
          codeReads += 1;
          return index + 1;
        },
      }));
      const { container } = mount({
        ownership: unlimitedCardOwnership(),
        cards,
        rarityByCode: new Map(),
      });
      const tile = container.querySelector('[data-cy="collection-card-1000"]')!;

      codeReads = 0;
      await fireEvent[event](tile);

      expect(
        container.querySelector('[data-cy="collection-preview-card-name"]')
          ?.textContent,
      ).toBe("A late card");
      /* Preview reads are bounded; a membership scan reads all 1,000 codes. */
      expect(codeReads).toBeLessThan(20);
    },
  );

  it("refreshes preview membership when the catalog changes", async () => {
    const { container, rerender } = mount({
      ownership: unlimitedCardOwnership(),
    });
    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="collection-card-4007"]')!,
    );

    await rerender({ cards: CATALOG.filter(({ code }) => code !== 4010) });
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]')
        ?.textContent,
    ).toBe("Dark Magician");

    await rerender({ cards: CATALOG.filter(({ code }) => code !== 4007) });
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Hover a card to see its details.");

    await rerender({ cards: CATALOG });
    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="collection-card-4007"]')!,
    );
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]')
        ?.textContent,
    ).toBe("Dark Magician");
  });

  it("clears the preview when updated ownership removes the selected card", async () => {
    const { container, rerender } = mount({ ownership: OWNS_TWO });
    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="collection-card-4007"]')!,
    );
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]')
        ?.textContent,
    ).toBe("Dark Magician");

    await rerender({
      ownership: storyCardOwnership({
        ...createInitialStoryState(),
        collection: { 4008: 1 },
      }),
    });
    expect(
      container.querySelector('[data-cy="collection-preview-card-name"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Hover a card to see its details.");
  });

  it("back hands control to the caller", async () => {
    const onback = vi.fn();
    const { container } = mount({
      ownership: unlimitedCardOwnership(),
      onback,
    });
    await userEvent
      .setup()
      .click(container.querySelector('[data-cy="collection-back"]')!);
    expect(onback).toHaveBeenCalledOnce();
  });
});

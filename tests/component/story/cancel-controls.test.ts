// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import CollectionScreen from "../../../src/story/collection/CollectionScreen.svelte";
import { storyCardOwnership } from "../../../src/story/decks/card-ownership.ts";
import {
  createInitialStoryState,
  type ShopRarity,
} from "../../../src/story/model/story-state.ts";
import IllustratedMapScreen from "../../../src/story/screens/IllustratedMapScreen.svelte";
import LoadScreen from "../../../src/story/screens/LoadScreen.svelte";
import BoosterInventoryDialog from "../../../src/story/shop/BoosterInventoryDialog.svelte";
import BoosterOpeningScreen from "../../../src/story/shop/BoosterOpeningScreen.svelte";
import ShopBrowseScreen from "../../../src/story/shop/ShopBrowseScreen.svelte";
import ShopCardListScreen from "../../../src/story/shop/ShopCardListScreen.svelte";
import ShopSellScreen from "../../../src/story/shop/ShopSellScreen.svelte";

afterEach(() => cleanup());

/* The owner's rule, from `feedback-vn.md` General item 5: "Make button action
   that cancel or return to previous state red : exemple 'leave shop' button".
   "Leave shop" is the example, not the rule — every control whose whole job is
   to put the player back where they came from wears the same red, so the way
   out of a screen never reads as the way through it.

   One red, the shared `.story-app .story-danger` treatment `ChoiceList` already
   paints the shop's Leave choice with. jsdom loads no stylesheet, so the class
   is the evidence, exactly as the choice list's own danger test reads it — and
   the class has to *replace* `secondary` rather than join it: `.story-app
   button.secondary` outranks `.story-app .story-danger` on specificity, so a
   button carrying both would keep the transparent background and lose the red
   entirely. */
const CARD: DeckBuilderCardView = {
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

const noop = () => undefined;

const RETURN_CONTROLS: readonly {
  readonly what: string;
  readonly dataCy: string;
  readonly mount: () => { container: HTMLElement };
}[] = [
  {
    what: "the load screen's Back",
    dataCy: "story-load-back",
    mount: () => render(LoadScreen, { onback: noop }),
  },
  {
    what: "the city map's contextual return",
    dataCy: "story-map-return",
    mount: () =>
      render(IllustratedMapScreen, {
        locations: [{ id: "old-arena", access: "available", completed: false }],
        returnLabel: "Dialog",
        onreturn: noop,
      }),
  },
  {
    what: "the shop browser's Back",
    dataCy: "story-shop-browse-back",
    mount: () =>
      render(ShopBrowseScreen, { sets: [], onbuy: noop, onback: noop }),
  },
  {
    what: "the set list's Back",
    dataCy: "story-shop-cards-back",
    mount: () =>
      render(ShopCardListScreen, {
        setName: "LOB",
        dp: 0,
        cards: [
          {
            code: 4007,
            name: CARD.name,
            description: CARD.description,
            imageUrl: CARD.imageUrl,
            rarity: "common" as ShopRarity,
            priceDp: 40,
          },
        ],
        onback: noop,
      }),
  },
  {
    what: "the sell screen's Back",
    dataCy: "story-shop-sell-back",
    mount: () => render(ShopSellScreen, { cards: [], onback: noop }),
  },
  {
    /* Only the single-pack exit: Skip beside it moves the player on to the
       recap, which is forward, not back. */
    what: "the single pack reveal's Back",
    dataCy: "story-shop-opening-back",
    mount: () =>
      render(BoosterOpeningScreen, {
        cards: [
          {
            code: 4007,
            name: CARD.name,
            imageUrl: CARD.imageUrl,
            rarity: "common" as ShopRarity,
          },
        ],
        onback: noop,
      }),
  },
  {
    what: "the collection's Back",
    dataCy: "collection-back",
    mount: () =>
      render(CollectionScreen, {
        ownership: storyCardOwnership({
          ...createInitialStoryState(),
          collection: { 4007: 2 },
        }),
        cards: [CARD],
        rarityByCode: new Map<number, ShopRarity>([[4007, "ultra-rare"]]),
        onback: noop,
      }),
  },
  {
    what: "the pack dialog's Close",
    dataCy: "story-shop-booster-close",
    mount: () =>
      render(BoosterInventoryDialog, { boosters: { lob: 2 }, onclose: noop }),
  },
  {
    /* Rendered by `OverlayShell`, so every overlay the story opens — settings,
       saves, the pack dialog — gets the same red header Close from one file. */
    what: "an overlay's header Close",
    dataCy: "story-overlay-close-booster-dialog-title",
    mount: () =>
      render(BoosterInventoryDialog, { boosters: { lob: 2 }, onclose: noop }),
  },
];

describe("every control that returns the player to where they came from is red", () => {
  it.each(RETURN_CONTROLS)("$what", ({ dataCy, mount }) => {
    const { container } = mount();
    const control = container.querySelector(
      `[data-cy="${dataCy}"]`,
    ) as HTMLElement | null;
    expect(control, dataCy).not.toBeNull();
    expect(
      control!.classList.contains("story-danger"),
      `${dataCy} carries the shared danger class`,
    ).toBe(true);
    expect(
      control!.classList.contains("secondary"),
      `${dataCy} no longer carries secondary, which would outrank the red`,
    ).toBe(false);
  });
});

/* The one dialog the rule is not applied to, and why. Its subject *is* a
   destructive action: red there already means "this is the one that destroys
   something", sitting on `Delete save`. Painting the cancel red as well would
   leave both buttons of a two-button confirmation in the same colour and
   remove the only signal telling them apart — and the one it would push the
   player towards is the irreversible one. The owner's rule is about the way out
   of a screen; inside a delete confirmation the way out is the plain button and
   the danger colour is spent on the deletion. */
describe("a destructive confirmation keeps the red on the destructive button", () => {
  it("delete is red and its cancel is not", () => {
    const { container } = render(LoadScreen, { showCorrupt: false });
    const trigger = container.querySelector(
      '[data-cy="story-load-slot-manual-delete"]',
    ) as HTMLButtonElement;
    trigger.click();
    return Promise.resolve().then(() => {
      const confirm = container.querySelector(
        '[data-cy="story-load-delete-confirm"]',
      ) as HTMLElement;
      const cancel = container.querySelector(
        '[data-cy="story-load-delete-cancel"]',
      ) as HTMLElement;
      expect(confirm, "the delete confirmation").not.toBeNull();
      expect(confirm.classList.contains("danger")).toBe(true);
      expect(cancel.classList.contains("danger")).toBe(false);
      expect(cancel.classList.contains("story-danger")).toBe(false);
    });
  });
});

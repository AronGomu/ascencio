// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import ShopCardListScreen from "../../../src/story/shop/ShopCardListScreen.svelte";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

afterEach(() => cleanup());

type CardEntry = {
  code: number;
  name: string;
  imageUrl: string | null;
  rarity: ShopRarity;
  priceDp: number;
};

/* Deliberately neither alphabetical nor rarity-ordered: the ungrouped list has
   to keep this order, and the grouped one has to impose its own. */
const SET_CARDS: readonly CardEntry[] = [
  {
    code: 1,
    name: "Zombie Master",
    imageUrl: null,
    rarity: "common",
    priceDp: 40,
  },
  {
    code: 2,
    name: "Dark Magician",
    imageUrl: null,
    rarity: "ultra-rare",
    priceDp: 400,
  },
  {
    code: 3,
    name: "Alpha the Magnet Warrior",
    imageUrl: null,
    rarity: "common",
    priceDp: 40,
  },
  {
    code: 4,
    name: "Celtic Guardian",
    imageUrl: null,
    rarity: "rare",
    priceDp: 100,
  },
  {
    code: 5,
    name: "Blue-Eyes White Dragon",
    imageUrl: null,
    rarity: "ultra-rare",
    priceDp: 400,
  },
  {
    code: 6,
    name: "Exodia the Forbidden One",
    imageUrl: null,
    rarity: "secret-rare",
    priceDp: 1000,
  },
];

const SOURCE_ORDER = SET_CARDS.map(({ name }) => name);

function mount() {
  return render(ShopCardListScreen, {
    setName: "Legend of Blue-Eyes White Dragon",
    dp: 9999,
    cards: SET_CARDS,
    onbuysingle: () => undefined,
    onback: () => undefined,
  });
}

function sortButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector(
    '[data-cy="story-shop-cards-rarity-sort"]',
  );
  expect(button, "the rarity sort button").not.toBeNull();
  return button as HTMLButtonElement;
}

function headings(container: HTMLElement): readonly string[] {
  return [
    ...container.querySelectorAll('[data-cy^="story-shop-cards-group-"]'),
  ].map((heading) => (heading as HTMLElement).dataset["rarity"] ?? "");
}

function renderedNames(container: HTMLElement): readonly string[] {
  return [
    ...container.querySelectorAll('[data-cy^="story-shop-card-name-"]'),
  ].map((name) => name.textContent!.trim());
}

/** The grouped list read back as it is rendered: heading, then its cards. */
function groups(
  container: HTMLElement,
): readonly { rarity: string; names: string[] }[] {
  const read: { rarity: string; names: string[] }[] = [];
  for (const element of container.querySelectorAll(
    '[data-cy^="story-shop-cards-group-"], [data-cy^="story-shop-card-name-"]',
  )) {
    const rarity = (element as HTMLElement).dataset["rarity"];
    if (element.getAttribute("data-cy")!.startsWith("story-shop-cards-group-"))
      read.push({ rarity: rarity ?? "", names: [] });
    else read.at(-1)?.names.push(element.textContent!.trim());
  }
  return read;
}

async function click(button: HTMLButtonElement, times: number): Promise<void> {
  const user = userEvent.setup();
  for (let i = 0; i < times; i += 1) await user.click(button);
}

describe("the set card list's rarity sort", () => {
  it("starts ungrouped", () => {
    const { container } = mount();
    const button = sortButton(container);

    expect(headings(container)).toEqual([]);
    expect(button.dataset["state"]).toBe("off");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(renderedNames(container)).toEqual(SOURCE_ORDER);
  });

  it("first click groups common to rarest", async () => {
    const { container } = mount();
    const button = sortButton(container);

    await click(button, 1);

    expect(headings(container)).toEqual([
      "common",
      "rare",
      "ultra-rare",
      "secret-rare",
    ]);
    expect(button.dataset["state"]).toBe("common-first");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("second click reverses the groups", async () => {
    const { container } = mount();
    const button = sortButton(container);

    await click(button, 2);

    expect(headings(container)).toEqual([
      "secret-rare",
      "ultra-rare",
      "rare",
      "common",
    ]);
    expect(button.dataset["state"]).toBe("rarest-first");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("third click removes grouping", async () => {
    const { container } = mount();
    const button = sortButton(container);

    await click(button, 3);

    expect(headings(container)).toEqual([]);
    expect(button.dataset["state"]).toBe("off");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(renderedNames(container)).toEqual(SOURCE_ORDER);
  });

  it("labels every state it cycles through", async () => {
    const { container } = mount();
    const button = sortButton(container);
    const labels: string[] = [button.textContent!.trim()];

    for (let i = 0; i < 3; i += 1) {
      await click(button, 1);
      labels.push(button.textContent!.trim());
    }

    expect(new Set(labels.slice(0, 3)).size, `distinct labels: ${labels}`).toBe(
      3,
    );
    expect(labels[3]).toBe(labels[0]);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });

  it("cards are alphabetical inside a group", async () => {
    const { container } = mount();

    await click(sortButton(container), 1);

    expect(groups(container)).toEqual([
      {
        rarity: "common",
        names: ["Alpha the Magnet Warrior", "Zombie Master"],
      },
      { rarity: "rare", names: ["Celtic Guardian"] },
      {
        rarity: "ultra-rare",
        names: ["Blue-Eyes White Dragon", "Dark Magician"],
      },
      { rarity: "secret-rare", names: ["Exodia the Forbidden One"] },
    ]);
  });

  it("every card still appears exactly once in every state", async () => {
    const { container } = mount();
    const button = sortButton(container);

    for (let state = 0; state < 4; state += 1) {
      const names = renderedNames(container);
      expect(names, `state ${state}`).toHaveLength(SET_CARDS.length);
      expect(new Set(names).size, `state ${state}`).toBe(SET_CARDS.length);
      await click(button, 1);
    }
  });

  it("the preview still follows the cards while grouped", async () => {
    const { container } = mount();

    await click(sortButton(container), 1);
    await fireEvent.mouseEnter(
      container.querySelector('[data-cy="story-shop-card-6"]')!,
    );

    expect(
      container.querySelector('[data-cy="story-shop-cards-preview-name"]')!
        .textContent,
    ).toBe("Exodia the Forbidden One");
    expect(
      container.querySelector('[data-cy="story-shop-cards-preview-rarity"]')!
        .textContent,
    ).toBe("secret-rare");
  });
});

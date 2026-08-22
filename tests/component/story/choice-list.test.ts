// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChoiceList from "../../../src/story/components/ChoiceList.svelte";
import { PROLOGUE } from "../../../src/story/content/prologue.ts";
import NarrativeScreen from "../../../src/story/screens/NarrativeScreen.svelte";
import ShopGreetingScreen from "../../../src/story/shop/ShopGreetingScreen.svelte";

afterEach(() => cleanup());

const THREE_CHOICES = [
  { id: "first", label: "First", dataCy: "story-test-choice-first" },
  { id: "second", label: "Second", dataCy: "story-test-choice-second" },
  { id: "leave", label: "Leave", dataCy: "story-test-choice-leave" },
] as const;

function ruleBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(
    start,
    `${selector} not found in src/story/styles.css`,
  ).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start) + 1);
}

async function openShopMenu(container: HTMLElement): Promise<void> {
  const root = container.querySelector(
    '[data-cy="story-shop-greeting"]',
  ) as HTMLElement;
  await fireEvent.click(root);
  await fireEvent.click(root);
}

describe("ChoiceList", () => {
  it("renders one button per choice in order", () => {
    const { container } = render(ChoiceList, {
      choices: THREE_CHOICES,
      dataCy: "story-test-choices",
      label: "Test choices",
    });
    const list = container.querySelector(
      '[data-cy="story-test-choices"]',
    ) as HTMLElement;
    expect(list.getAttribute("role")).toBe("group");
    expect(list.getAttribute("aria-label")).toBe("Test choices");
    /* DOM order is the keyboard order, and a single column makes it the visual
       order too: Tab walks the choices exactly as the player reads them. */
    expect(
      [...list.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["First", "Second", "Leave"]);
  });

  it("focuses the first choice on mount", () => {
    const { container } = render(ChoiceList, {
      choices: THREE_CHOICES,
      dataCy: "story-test-choices",
      label: "Test choices",
    });
    expect(document.activeElement).toBe(
      container.querySelector('[data-cy="story-test-choice-first"]'),
    );
  });

  it("invokes the choice callback with its id", async () => {
    const onchoose = vi.fn();
    const { container } = render(ChoiceList, {
      choices: THREE_CHOICES,
      dataCy: "story-test-choices",
      label: "Test choices",
      onchoose,
    });
    await userEvent
      .setup()
      .click(
        container.querySelector(
          '[data-cy="story-test-choice-second"]',
        ) as HTMLElement,
      );
    expect(onchoose.mock.calls).toEqual([["second"]]);
  });

  /* The whole story is advanced through this list, so the keyboard path is the
     product rather than an accessibility extra: focus lands on the first
     choice, Tab reaches the next one, and Enter takes it. */
  it("takes a choice from the keyboard alone", async () => {
    const onchoose = vi.fn();
    render(ChoiceList, {
      choices: THREE_CHOICES,
      dataCy: "story-test-choices",
      label: "Test choices",
      onchoose,
    });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement?.textContent).toBe("Second");
    await user.keyboard("{Enter}");
    expect(onchoose.mock.calls).toEqual([["second"]]);
  });

  it("a cancelling choice carries the danger class", () => {
    const { container } = render(ChoiceList, {
      choices: [
        { id: "stay", label: "Stay", dataCy: "story-test-choice-stay" },
        {
          id: "leave",
          label: "Leave",
          dataCy: "story-test-choice-leave",
          danger: true,
        },
      ],
      dataCy: "story-test-choices",
      label: "Test choices",
    });
    const stay = container.querySelector(
      '[data-cy="story-test-choice-stay"]',
    ) as HTMLElement;
    const leave = container.querySelector(
      '[data-cy="story-test-choice-leave"]',
    ) as HTMLElement;
    expect(leave.classList.contains("story-danger")).toBe(true);
    expect(stay.classList.contains("story-danger")).toBe(false);
  });

  /* A one-shot action is not a toggle: only a choice that stays on screen after
     it is taken reports a pressed state, so the shop's menu buttons carry no
     `aria-pressed` at all. */
  it("reports a pressed state only where the caller asks for one", () => {
    const { container } = render(ChoiceList, {
      choices: [
        {
          id: "taken",
          label: "Taken",
          dataCy: "story-test-choice-taken",
          pressed: true,
        },
        { id: "plain", label: "Plain", dataCy: "story-test-choice-plain" },
      ],
      dataCy: "story-test-choices",
      label: "Test choices",
    });
    expect(
      container
        .querySelector('[data-cy="story-test-choice-taken"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      container
        .querySelector('[data-cy="story-test-choice-plain"]')
        ?.hasAttribute("aria-pressed"),
    ).toBe(false);
  });
});

describe("the story's choice surfaces share the component", () => {
  it("narrative choices use the component", () => {
    const { container } = render(NarrativeScreen, {
      beat: PROLOGUE.beats[13]!,
      choices: PROLOGUE.choices,
    });
    const list = container.querySelector(".story-choice-list") as HTMLElement;
    expect(list).not.toBeNull();
    expect(
      [...list.querySelectorAll("button")].map((b) =>
        b.getAttribute("data-cy"),
      ),
    ).toEqual([
      "story-choice-trust-rin",
      "story-choice-challenge-rin",
      "story-choice-observe-first",
    ]);
  });

  it("shop greeting uses the component and marks leaving as danger", async () => {
    const { container } = render(ShopGreetingScreen, {});
    await openShopMenu(container);
    const list = container.querySelector(".story-choice-list") as HTMLElement;
    expect(list).not.toBeNull();
    expect(
      [...list.querySelectorAll("button")].map((b) =>
        b.getAttribute("data-cy"),
      ),
    ).toEqual([
      "story-shop-greeting-buy",
      "story-shop-greeting-sell",
      "story-shop-greeting-leave",
    ]);
    expect(
      container
        .querySelector('[data-cy="story-shop-greeting-leave"]')
        ?.classList.contains("story-danger"),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-cy="story-shop-greeting-buy"]')
        ?.classList.contains("story-danger"),
    ).toBe(false);
  });

  /* The selectors the existing suites walk both flows through: the component
     takes them from the caller, so adopting it renames nothing. */
  it("existing data-cy values still resolve", async () => {
    const narrative = render(NarrativeScreen, {
      beat: PROLOGUE.beats[13]!,
      choices: PROLOGUE.choices,
    });
    for (const value of [
      "story-narrative-choices",
      "story-narrative-choices-heading",
      "story-choice-trust-rin",
      "story-choice-challenge-rin",
      "story-choice-observe-first",
    ])
      expect(
        narrative.container.querySelector(`[data-cy="${value}"]`),
        value,
      ).not.toBeNull();
    cleanup();

    const shop = render(ShopGreetingScreen, {});
    await openShopMenu(shop.container);
    for (const value of [
      "story-shop-greeting-menu",
      "story-shop-greeting-buy",
      "story-shop-greeting-sell",
      "story-shop-greeting-leave",
    ])
      expect(
        shop.container.querySelector(`[data-cy="${value}"]`),
        value,
      ).not.toBeNull();
  });

  /* jsdom loads no stylesheet, so the rule itself is the evidence — the same
     way `StoryCardTile`'s fit is checked. */
  it("the shared list is one centred column of large buttons", () => {
    const css = readFileSync("src/story/styles.css", "utf8");
    const list = ruleBlock(css, ".story-app .story-choice-list {");
    expect(list).toContain("width: min(28rem, 100%)");
    expect(list).toContain("margin-inline: auto");
    expect(ruleBlock(css, ".story-app .story-choice-list button {")).toContain(
      "min-height: 3.25rem",
    );
  });

  it("the danger style uses the token, not a raw colour", () => {
    const css = readFileSync("src/story/styles.css", "utf8");
    const danger = ruleBlock(css, ".story-app .story-danger {");
    expect(danger).toContain("var(--danger)");
    expect(danger).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardControl from "../../src/battle/app/components/duel-field/CardControl.svelte";
import {
  cardCode,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  BoardCardView,
  BoardMaterialView,
} from "../../src/battle/field/board-view-model.ts";

afterEach(() => {
  cleanup();
});

function makeCard(overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id: "test-card",
    targetId: "card:test-card",
    instanceId: cardInstanceId("test-card"),
    player: 0,
    owner: 0,
    zoneId: "p0:hand" as const,
    sequence: 0,
    position: "faceUpAttack",
    orientation: "upright",
    facing: "self",
    hidden: false,
    label: "Blue-Eyes White Dragon in Your Hand",
    x: 0,
    y: 0,
    width: 72 / 1280,
    height: 104 / 720,
    counters: [],
    materials: [],
    chainLinks: [],
    image: { kind: "back" },
    ...overrides,
  };
}

function makeMaterial(
  overrides: Partial<BoardMaterialView> & { id: string; sequence: number },
): BoardMaterialView {
  return {
    identityVisible: false,
    label: "Hidden material",
    ...overrides,
  };
}

function renderCard(
  card: BoardCardView,
  onzoomenter: (element: HTMLElement) => void = () => undefined,
) {
  return render(CardControl, {
    card,
    layout: "hand",
    placement: null,
    imageUrl: "/back.webp",
    imageLibrary: null,
    onzoomenter,
  });
}

/* Materials must render independently of layout, so this mirrors renderCard
   and only adds the two art urls the material faces resolve against. */
function renderFieldCard(card: BoardCardView) {
  return render(CardControl, {
    card,
    layout: "hand",
    placement: null,
    imageUrl: "/back.webp",
    imageLibrary: null,
    cardBackUrl: "/back.webp",
    placeholderUrl: "/placeholder.webp",
  });
}

function materialElements(): readonly HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(".duel-field-card__material"),
  ];
}

async function hoverCard(): Promise<HTMLElement> {
  const article = document.querySelector<HTMLElement>(".duel-field-card")!;
  await fireEvent.pointerEnter(article);
  return article;
}

describe("CardControl zoom gating", () => {
  it("an unknown face-down card is not zoomable and shows no label", async () => {
    const onzoomenter = vi.fn();
    renderCard(makeCard({ hidden: true }), onzoomenter);
    const article = await hoverCard();
    expect(onzoomenter).not.toHaveBeenCalled();
    expect(article.classList.contains("is-identity-known")).toBe(false);
    expect(document.querySelector(".duel-field-card__label")).toBeNull();
  });

  it("a known face-down card is zoomable and keeps its name label", async () => {
    const onzoomenter = vi.fn();
    renderCard(
      makeCard({
        hidden: true,
        code: cardCode(89631139),
        label: "Blue-Eyes White Dragon in Your Hand",
        image: { kind: "face", code: cardCode(89631139) },
      }),
      onzoomenter,
    );
    const article = await hoverCard();
    expect(onzoomenter).toHaveBeenCalledOnce();
    expect(article.classList.contains("is-identity-known")).toBe(true);
    const label = document.querySelector(".duel-field-card__label");
    expect(label).not.toBeNull();
    expect(label?.textContent?.trim()).toContain("Blue-Eyes White Dragon");
  });

  it("a face-up card keeps zoom and label", () => {
    renderCard(
      makeCard({
        hidden: false,
        code: cardCode(89631139),
        label: "Blue-Eyes White Dragon in Your Hand",
        image: { kind: "face", code: cardCode(89631139) },
      }),
    );
    const article = document.querySelector<HTMLElement>(".duel-field-card");
    expect(article?.classList.contains("is-identity-known")).toBe(true);
    const label = document.querySelector(".duel-field-card__label");
    expect(label).not.toBeNull();
    expect(label?.textContent?.trim()).toContain("Blue-Eyes White Dragon");
  });
});

describe("CardControl xyz materials", () => {
  it("renders one material element per entry with unique data-cy", () => {
    renderFieldCard(
      makeCard({
        materials: [
          makeMaterial({ id: "material:a", sequence: 0 }),
          makeMaterial({ id: "material:b", sequence: 1 }),
        ],
      }),
    );
    const materials = materialElements();
    expect(materials).toHaveLength(2);
    expect(materials.map((element) => element.getAttribute("data-cy"))).toEqual(
      ["field-card-material-material:a", "field-card-material-material:b"],
    );
  });

  it("orders materials by sequence and indexes the offset variable", () => {
    renderFieldCard(
      makeCard({
        materials: [
          makeMaterial({ id: "material:b", sequence: 1 }),
          makeMaterial({ id: "material:a", sequence: 0 }),
        ],
      }),
    );
    const materials = materialElements();
    expect(materials.map((element) => element.getAttribute("data-cy"))).toEqual(
      ["field-card-material-material:a", "field-card-material-material:b"],
    );
    expect(materials[0]?.getAttribute("style")).toContain(
      "--material-index: 0",
    );
    expect(materials[1]?.getAttribute("style")).toContain(
      "--material-index: 1",
    );
  });

  it("hidden material shows the card back", () => {
    renderFieldCard(
      makeCard({
        materials: [makeMaterial({ id: "material:a", sequence: 0 })],
      }),
    );
    const image = document.querySelector<HTMLImageElement>(
      '[data-cy="field-card-material-image-material:a"]',
    );
    expect(image?.getAttribute("src")).toBe("/back.webp");
    expect(image?.getAttribute("alt")).toBe("");
    expect(materialElements()[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("visible material shows art with placeholder fallback", () => {
    renderFieldCard(
      makeCard({
        materials: [
          makeMaterial({
            id: "material:a",
            sequence: 0,
            identityVisible: true,
            code: cardCode(5053103),
            label: "Right Leg of the Forbidden One",
          }),
        ],
      }),
    );
    const image = document.querySelector<HTMLImageElement>(
      '[data-cy="field-card-material-image-material:a"]',
    );
    expect(image?.getAttribute("src")).toBe("/placeholder.webp");
    expect(image?.getAttribute("alt")).toBe("Right Leg of the Forbidden One");

    cleanup();
    renderFieldCard(makeCard({ materials: [] }));
    expect(materialElements()).toHaveLength(0);
  });
});

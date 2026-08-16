// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardControl from "../../src/battle/app/components/duel-field/CardControl.svelte";
import {
  cardCode,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { BoardCardView } from "../../src/battle/field/board-view-model.ts";

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

function renderCard(card: BoardCardView) {
  return render(CardControl, {
    card,
    layout: "hand",
    placement: null,
    imageUrl: "/back.webp",
    imageLibrary: null,
  });
}

describe("CardControl zoom gating", () => {
  it("an unknown face-down card is not zoomable and shows no label", () => {
    renderCard(makeCard({ hidden: true }));
    const article = document.querySelector<HTMLElement>(".duel-field-card");
    expect(article?.classList.contains("is-identity-known")).toBe(false);
    expect(document.querySelector(".duel-field-card__label")).toBeNull();
  });

  it("a known face-down card is zoomable and keeps its name label", () => {
    renderCard(
      makeCard({
        hidden: true,
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

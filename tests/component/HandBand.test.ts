// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import HandBand from "../../src/app/components/duel-field/HandBand.svelte";
import { cardInstanceId } from "../../src/duel/contracts/ids.ts";
import type { ActiveInteractionSpec } from "../../src/app/prompts/interaction-spec.ts";
import type {
  BoardCardView,
  BoardTargetId,
  BoardZoneView,
} from "../../src/field/board-view-model.ts";
import {
  fieldZoneAccessibleName,
  STANDARD_DUEL_FIELD_LAYOUT,
} from "../../src/field/duel-field-layout.ts";

afterEach(() => {
  cleanup();
});

function zoneFor(player: 0 | 1): BoardZoneView {
  const layout = STANDARD_DUEL_FIELD_LAYOUT.find(
    (value) => value.id === `p${player}:hand`,
  );
  if (layout === undefined) throw new Error("Missing hand zone layout");
  return {
    ...layout,
    targetId: `zone:${layout.id}` as const,
    accessibleLabel: fieldZoneAccessibleName(layout),
  };
}

function handCard(
  player: 0 | 1,
  sequence: number,
  overrides: Partial<BoardCardView> = {},
): BoardCardView {
  const id = `p${player}-hand-${sequence}`;
  return Object.freeze({
    id,
    targetId: `card:${id}` as const,
    instanceId: cardInstanceId(id),
    player,
    owner: player,
    zoneId: `p${player}:hand` as const,
    sequence,
    position: "faceUpAttack" as const,
    orientation: "upright" as const,
    facing: player === 0 ? ("self" as const) : ("opponent" as const),
    hidden: false,
    label: `Card ${sequence} in Your Hand`,
    x: 0,
    y: 0,
    width: 72 / 1280,
    height: 104 / 720,
    counters: [],
    materials: [],
    chainLinks: [],
    image: Object.freeze({ kind: "back" as const }),
    ...overrides,
  });
}

function handCards(
  player: 0 | 1,
  count: number,
  overrides: Partial<BoardCardView> = {},
): readonly BoardCardView[] {
  return Array.from({ length: count }, (_, index) =>
    handCard(player, index, overrides),
  );
}

function renderBand(
  props: Partial<Parameters<typeof HandBand>[1]> & {
    readonly player?: 0 | 1;
    readonly cards: readonly BoardCardView[];
  },
) {
  const player = props.player ?? 0;
  return render(HandBand, {
    zone: zoneFor(player),
    imageUrls: new Map(),
    imageLibrary: null,
    cardBackUrl: "/back.webp",
    placeholderUrl: "/placeholder.webp",
    spec: null,
    selectedTargets: new Set<BoardTargetId>(),
    activeTarget: null,
    disabled: false,
    pinnedTarget: null,
    ...props,
    player,
  });
}

function cardArticles(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".duel-field-card")];
}

describe("HandBand", () => {
  it("mounts at most ten cards", () => {
    renderBand({ cards: handCards(0, 12) });

    expect(cardArticles()).toHaveLength(10);
    expect(
      document.querySelector('[data-cy="field-hand-p0-page-status"]')
        ?.textContent,
    ).toBe("Page 1 of 2");
  });

  it("next and previous page preserve card ids", async () => {
    renderBand({ cards: handCards(0, 12) });

    await fireEvent.click(
      document.querySelector('[data-cy="field-hand-p0-next"]')!,
    );
    let ids = cardArticles().map((article) =>
      article.getAttribute("data-card-id"),
    );
    expect(ids).toEqual(["p0-hand-10", "p0-hand-11"]);

    await fireEvent.click(
      document.querySelector('[data-cy="field-hand-p0-previous"]')!,
    );
    ids = cardArticles().map((article) => article.getAttribute("data-card-id"));
    expect(ids).toEqual(
      Array.from({ length: 10 }, (_, index) => `p0-hand-${index}`),
    );
  });

  it("disables arrows at boundaries", () => {
    renderBand({ cards: handCards(0, 12) });

    const previous = document.querySelector<HTMLButtonElement>(
      '[data-cy="field-hand-p0-previous"]',
    );
    const next = document.querySelector<HTMLButtonElement>(
      '[data-cy="field-hand-p0-next"]',
    );
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);
  });

  it("clamps when cards shrink", async () => {
    const rendered = renderBand({ cards: handCards(0, 12) });
    await fireEvent.click(
      document.querySelector('[data-cy="field-hand-p0-next"]')!,
    );
    expect(cardArticles()).toHaveLength(2);

    await rendered.rerender({ cards: handCards(0, 2) });

    expect(
      document.querySelector('[data-cy="field-hand-p0-page-status"]')
        ?.textContent,
    ).toBe("Page 1 of 1");
    expect(cardArticles()).toHaveLength(2);
  });

  it("follows active target across a page boundary", async () => {
    const rendered = renderBand({ cards: handCards(0, 11) });
    expect(cardArticles()).toHaveLength(10);

    await rendered.rerender({ activeTarget: "card:p0-hand-10" });

    expect(
      cardArticles().map((article) => article.getAttribute("data-card-id")),
    ).toEqual(["p0-hand-10"]);
  });

  it("mirrors opponent visual flow without changing DOM sequence", () => {
    renderBand({ player: 1, cards: handCards(1, 3) });

    const root = document.querySelector('[data-cy="field-hand-band-p1"]');
    expect(root?.classList.contains("is-opponent")).toBe(true);
    const ids = cardArticles().map((article) =>
      article.getAttribute("data-card-id"),
    );
    expect(ids).toEqual(["p1-hand-0", "p1-hand-1", "p1-hand-2"]);
  });

  it("forwards preview, activation and drag callbacks", async () => {
    const onpreview = vi.fn();
    const onactivate = vi.fn();
    const card = handCard(0, 0);
    renderBand({
      cards: [card],
      spec: {
        kind: "cardAction",
        cardChoices: new Map([[card.targetId, []]]),
        zoneChoices: new Map(),
        stackChoices: new Map(),
        key: { workerGeneration: 0, sessionGeneration: 0, promptId: "p" },
      } as unknown as ActiveInteractionSpec,
      oncardpreview: onpreview,
      oncardactivate: onactivate,
    });

    const target = document.querySelector<HTMLElement>(
      `[data-cy="field-card-target-${card.id}"]`,
    );
    if (target === null) throw new Error("Missing hand card target");
    await fireEvent.pointerDown(target, { clientX: 1, clientY: 1 });
    expect(onpreview).toHaveBeenCalledWith(card);
    await fireEvent.click(target);
    expect(onactivate).toHaveBeenCalled();
  });

  it("keeps both arrow targets at least 44px by contract", () => {
    renderBand({ cards: handCards(0, 12) });

    const previous = document.querySelector(
      '[data-cy="field-hand-p0-previous"]',
    );
    const next = document.querySelector('[data-cy="field-hand-p0-next"]');
    expect(previous?.classList.contains("duel-field-hand-band__arrow")).toBe(
      true,
    );
    expect(next?.classList.contains("duel-field-hand-band__arrow")).toBe(true);
  });
});

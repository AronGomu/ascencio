// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import DuelField from "../../src/app/components/DuelField.svelte";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";

afterEach(() => cleanup());

function board(state: keyof typeof BOARD_VIEW_MODEL_FIXTURES) {
  const result = mapSnapshotToBoard(
    BOARD_VIEW_MODEL_FIXTURES[state],
    BOARD_CARD_TEXTS,
  );
  if (!result.ok)
    throw new Error(`Fixture mapping failed: ${result.error.type}`);
  return result.value;
}

describe("DuelField", () => {
  it("renders one named semantic board with 34 stable physical zones and two shared EMZs", () => {
    const value = board("ST-01");
    render(DuelField, { board: value });

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelector("canvas")).toBeNull();
    expect(field.querySelectorAll("[data-zone-id]")).toHaveLength(34);

    for (const zone of value.zones) {
      const node = within(field).getByRole("group", { name: zone.label });
      expect(node.getAttribute("data-zone-id")).toBe(zone.id);
    }

    const sharedZones = within(field).getAllByRole("group", {
      name: /^Shared Extra Monster Zone/,
    });
    expect(sharedZones).toHaveLength(2);
    expect(
      new Set(sharedZones.map((zone) => zone.getAttribute("data-zone-id"))),
    ).toEqual(
      new Set(["shared:extraMonster:left", "shared:extraMonster:right"]),
    );
    expect(within(field).queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps visible and hidden card nodes keyed without exposing opponent identity", async () => {
    const value = board("ST-01");
    const rendered = render(DuelField, {
      board: value,
      imageUrls: new Map([[97590747, "/cards/97590747.jpg"]]),
      cardBackUrl: "/cards/back.webp",
      placeholderUrl: "/cards/placeholder.webp",
    });

    const visible = screen.getByRole("article", {
      name: /The Legendary Fisherman in Your Hand/,
    });
    const hidden = screen.getAllByRole("article", {
      name: "Hidden opponent hand card",
    })[0];
    if (hidden === undefined) throw new Error("Missing hidden opponent card");
    expect(visible.getAttribute("data-card-id")).toBe("st01-own-hand");
    expect(hidden.getAttribute("data-hidden")).toBe("true");
    expect(document.body.textContent).not.toContain("Dark Magician");
    expect(document.body.innerHTML).not.toContain("46986414");
    expect(hidden.querySelector("img")?.getAttribute("alt")).toBe("");

    await rendered.rerender({ board: value });
    expect(
      screen.getByRole("article", {
        name: /The Legendary Fisherman in Your Hand/,
      }),
    ).toBe(visible);
    expect(
      screen.getAllByRole("article", {
        name: "Hidden opponent hand card",
      })[0],
    ).toBe(hidden);
  });

  it("renders stack counts through named passive controls", () => {
    render(DuelField, { board: board("ST-08") });

    expect(
      screen.getByRole("group", { name: "Your Deck, 35 cards" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: "Your GY, 1 card, top card Blue-Eyes White Dragon",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Opponent Deck, 31 cards" }),
    ).toBeTruthy();
  });

  it("exposes defense and opponent orientation as readable state and DOM data", () => {
    render(DuelField, { board: board("ST-04") });

    const defense = screen.getByRole("article", {
      name: /Axe Raider in Your Main Monster 2, face-up defense/,
    });
    expect(defense.getAttribute("data-orientation")).toBe("sideways");
    expect(defense.classList.contains("is-sideways")).toBe(true);

    const opponent = board("ST-03").cards.find(
      (card) => card.facing === "opponent",
    );
    if (opponent === undefined)
      throw new Error("Missing opponent fixture card");
    cleanup();
    render(DuelField, { board: board("ST-03") });
    const opponentCard = screen.getByRole("article", {
      name: `Opponent controlled, ${opponent.label}`,
    });
    expect(opponentCard.getAttribute("data-facing")).toBe("opponent");
    expect(opponentCard.classList.contains("is-opponent")).toBe(true);
    expect(opponentCard.getAttribute("aria-label")).toContain("Opponent");
  });

  it("renders placeholder and back art immediately without image readiness state", () => {
    render(DuelField, {
      board: board("ST-04"),
      cardBackUrl: "/cards/back.webp",
      placeholderUrl: "/cards/placeholder.webp",
    });

    const visible = screen.getByRole("article", {
      name: /The Legendary Fisherman in Your Main Monster 1/,
    });
    const hidden = screen.getByRole("article", {
      name: /Hidden card in Your Main Monster 3/,
    });
    expect(within(visible).getByRole("img").getAttribute("src")).toBe(
      "/cards/placeholder.webp",
    );
    expect(hidden.querySelector("img")?.getAttribute("src")).toBe(
      "/cards/back.webp",
    );
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });
});

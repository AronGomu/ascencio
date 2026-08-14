import { describe, expect, it } from "vitest";
import {
  catalogTapZone,
  deckTapTargets,
  ZONE_CAPACITY,
  type DeckCounts,
} from "../../../src/deck-editor/layout/tap-targets.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const blueEyes = catalog.get(89631139)!;
const fusion = catalog.get(8505920)!;
const forbidden = catalog.get(10000000)!;
const EMPTY: DeckCounts = { main: 0, extra: 0, side: 0 };

function target(
  card: typeof blueEyes,
  from: "main" | "extra" | "side",
  zone: string,
  counts: DeckCounts = EMPTY,
) {
  return deckTapTargets(card, from, counts, PROTOTYPE_RULESET).find(
    (entry) => entry.zone === zone,
  );
}

describe("catalogTapZone", () => {
  it("sends an Extra Deck card to the Extra Deck", () => {
    expect(catalogTapZone(fusion)).toBe("extra");
  });

  it("sends everything else to the Main Deck", () => {
    expect(catalogTapZone(blueEyes)).toBe("main");
  });
});

describe("deckTapTargets", () => {
  it("never offers the zone the card is already in, and always offers remove", () => {
    const zones = deckTapTargets(
      blueEyes,
      "main",
      EMPTY,
      PROTOTYPE_RULESET,
    ).map(({ zone }) => zone);
    expect(zones).not.toContain("main");
    expect(zones).toEqual(["extra", "side", "remove"]);
    expect(target(blueEyes, "main", "remove")?.enabled).toBe(true);
  });

  it("disables a zone the ruleset cannot move the card to", () => {
    const extra = target(blueEyes, "main", "extra");
    expect(extra?.enabled).toBe(false);
    expect(extra?.reason).not.toBeNull();
    expect(target(blueEyes, "main", "side")?.enabled).toBe(true);
  });

  it("lets a side-decked card go home to its canonical zone only", () => {
    expect(target(blueEyes, "side", "main")?.enabled).toBe(true);
    expect(target(blueEyes, "side", "extra")?.enabled).toBe(false);
    expect(target(fusion, "side", "extra")?.enabled).toBe(true);
    expect(target(fusion, "side", "main")?.enabled).toBe(false);
  });

  it("disables a full zone with a capacity reason", () => {
    const full: DeckCounts = { ...EMPTY, side: ZONE_CAPACITY.side };
    const side = target(blueEyes, "main", "side", full);
    expect(side?.enabled).toBe(false);
    expect(side?.reason).toContain("full");
  });

  it("leaves a forbidden card only the remove target", () => {
    const targets = deckTapTargets(forbidden, "main", EMPTY, PROTOTYPE_RULESET);
    expect(
      targets.filter(({ enabled }) => enabled).map(({ zone }) => zone),
    ).toEqual(["remove"]);
    expect(target(forbidden, "main", "side")?.reason).toContain("forbidden");
  });

  it("labels every target for a menu item", () => {
    for (const entry of deckTapTargets(
      blueEyes,
      "main",
      EMPTY,
      PROTOTYPE_RULESET,
    ))
      expect(entry.label.length).toBeGreaterThan(0);
  });
});

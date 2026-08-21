import { describe, expect, it } from "vitest";
import {
  byName,
  groupByRarity,
  RARITY_ORDER,
} from "../../../src/story/collection/group-by-rarity.ts";
import type { ShopRarity } from "../../../src/story/model/story-state.ts";

/* The grouping the collection reads in and the set list will read in after it
   (T34), so the order lives in one place rather than being guessed twice. */

function entry(name: string, rarity: ShopRarity) {
  return { name, rarity };
}

const MIXED = [
  entry("Zombie Master", "ghost-rare"),
  entry("Dark Magician", "ultra-rare"),
  entry("Blue-Eyes White Dragon", "common"),
  entry("Celtic Guardian", "rare"),
  entry("Alpha the Magnet Warrior", "common"),
];

describe("RARITY_ORDER", () => {
  it("runs from the most common tier to the rarest", () => {
    expect([...RARITY_ORDER]).toEqual([
      "common",
      "rare",
      "super-rare",
      "ultra-rare",
      "secret-rare",
      "ultimate-rare",
      "ghost-rare",
    ]);
  });
});

describe("groupByRarity", () => {
  it("orders groups from common and sorts names inside each", () => {
    const groups = groupByRarity(MIXED, "common-first");
    expect(groups.map(({ rarity }) => rarity)).toEqual([
      "common",
      "rare",
      "ultra-rare",
      "ghost-rare",
    ]);
    expect(groups[0]!.cards.map(({ name }) => name)).toEqual([
      "Alpha the Magnet Warrior",
      "Blue-Eyes White Dragon",
    ]);
  });

  it("reverses the tiers for rarest-first", () => {
    expect(
      groupByRarity(MIXED, "rarest-first").map(({ rarity }) => rarity),
    ).toEqual(["ghost-rare", "ultra-rare", "rare", "common"]);
  });

  /* An empty heading over nothing is a promise the list has not kept. */
  it("emits no group for a rarity nothing carries", () => {
    expect(
      groupByRarity([entry("Raigeki", "super-rare")], "common-first").map(
        ({ rarity }) => rarity,
      ),
    ).toEqual(["super-rare"]);
  });

  it("groups nothing into nothing", () => {
    expect(groupByRarity([], "common-first")).toEqual([]);
  });

  /* The screen sorts the same input a second way for its ungrouped view, so a
     grouping pass that reordered the source list would corrupt it. */
  it("leaves the array it was handed untouched", () => {
    const source = [...MIXED];
    groupByRarity(source, "common-first");
    expect(source).toEqual(MIXED);
  });
});

describe("byName", () => {
  it("is the alphabetical order both views read in", () => {
    expect([...MIXED].sort(byName).map(({ name }) => name)).toEqual([
      "Alpha the Magnet Warrior",
      "Blue-Eyes White Dragon",
      "Celtic Guardian",
      "Dark Magician",
      "Zombie Master",
    ]);
  });
});

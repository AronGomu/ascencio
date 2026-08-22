import { describe, expect, it } from "vitest";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import { PACK_SIZE } from "../../../src/story/shop/data/shop-pricing.ts";
import {
  parseStorySaveEnvelope,
  STORY_SAVE_SCHEMA_VERSION,
  STORY_SLOT_KEYS,
} from "../../../src/story/saves/story-save-contracts.ts";
import type { StoryState } from "../../../src/story/model/story-state.ts";

/* When the cards become the player's. `feedback-vn.md`, Card Reveal item 5:
   spending on a pack is what hands the cards over, and the reveal that follows
   is a ceremony the player is free to walk out of.

   `open-boosters` already credits at open time rather than at reveal end, and
   nothing in the reveal enforces that — a later step that added the cards to
   the collection on the way to the results list would look perfectly
   reasonable and would pass every other suite in this repo. It would also
   double every pull. So the timing is written down here as a contract rather
   than left as an accident of where the loop happens to sit.

   The two claims that matter, and they pull in opposite directions:
     - never short — a crash between the spend and the last flip must leave the
       cards already banked;
     - never twice — a reveal re-entered, resumed from a save or replayed must
       add nothing. */

const SET = "a";

function shopBrowse(boosters: Record<string, number>): StoryState {
  return { ...createInitialStoryState(), screen: "shop-browse", boosters };
}

/** One pack's worth of distinct pulls, so a miscounted credit shows up as a
    wrong quantity on a named card rather than as a total that still adds up. */
function pull(): { code: number; rarity: "common" }[] {
  return Array.from({ length: PACK_SIZE }, (_, index) => ({
    code: 100 + index,
    rarity: "common" as const,
  }));
}

function openOnePack(state: StoryState, cards = pull()) {
  return reduceStory(state, {
    type: "open-boosters",
    picks: [{ setId: SET, count: 1 }],
    cards,
    mode: "sequential",
  });
}

/** The whole pack, once each. */
function creditedOnce(): Record<number, number> {
  return Object.fromEntries(pull().map(({ code }) => [code, 1]));
}

describe("the collection is credited when the pack is opened", () => {
  it("holds every card of the pack before one is turned over", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));

    /* The reveal has not started — this is the state the screen mounts on. */
    expect(opened.screen).toBe("shop-opening");
    expect(opened.collection).toEqual(creditedOnce());
    expect(opened.openedCards).toHaveLength(PACK_SIZE);
  });

  /* The credit and the pack it came off the shelf are one reduction, so there
     is no window in which the shelf is spent and the collection has not caught
     up — nor the reverse. */
  it("spends the pack and credits the cards in the same reduction", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));

    expect(opened.boosters).toEqual({});
    expect(opened.collection).toEqual(creditedOnce());
  });

  it("finishing the reveal adds nothing", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));
    const finished = reduceStory(opened, { type: "finish-opening" });

    expect(finished.screen).toBe("shop-results");
    expect(finished.collection).toEqual(creditedOnce());
  });

  it("acknowledging the results list adds nothing", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));
    const finished = reduceStory(opened, { type: "finish-opening" });
    const acknowledged = reduceStory(finished, { type: "acknowledge-opened" });

    expect(acknowledged.screen).toBe("shop-browse");
    expect(acknowledged.collection).toEqual(creditedOnce());
    expect(acknowledged.openedCards).toBeNull();
  });

  /* Item 4's Back button, at the model layer: one pack has no results list to
     see, so leaving the reveal is leaving the whole opening. */
  it("leaving the reveal early keeps every card", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));
    const left = reduceStory(opened, { type: "acknowledge-opened" });

    expect(left.screen).toBe("shop-browse");
    expect(left.collection).toEqual(creditedOnce());
    expect(left.openedCards).toBeNull();
    expect(left.openingMode).toBeNull();
  });
});

describe("the same pull is never credited twice", () => {
  /* The exploit direction. The shelf is what the credit is drawn against, so
     replaying the command that opened the pack finds nothing left to spend. */
  it("replaying the open credits nothing a second time", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));
    const replayed = openOnePack(opened);

    expect(replayed).toBe(opened);
    expect(replayed.collection).toEqual(creditedOnce());
  });

  /* Two packs bought, one opened: the second open is legal and credits its own
     pull, which is the case the guard above must not swallow. */
  it("a second pack off the shelf is still credited", () => {
    const first = openOnePack(shopBrowse({ [SET]: 2 }));
    const second = openOnePack(first);

    expect(second.boosters).toEqual({});
    for (const { code } of pull()) expect(second.collection[code]).toBe(2);
  });

  /* A reload mid-reveal: the save carries the credited collection and the
     screen the player was on, and walking the rest of the reveal from there
     adds nothing. This is the save an interrupted opening actually leaves — it
     goes through the real envelope parser rather than a hand-built clone, so
     a state this build cannot read would fail here rather than pass. */
  it("a reveal resumed from a save credits nothing further", () => {
    const opened = openOnePack(shopBrowse({ [SET]: 1 }));
    const slot = STORY_SLOT_KEYS[0]!;
    const read = parseStorySaveEnvelope(slot, {
      schemaVersion: STORY_SAVE_SCHEMA_VERSION,
      slot,
      revision: 1,
      savedAt: 1_700_000_000_000,
      state: opened,
    });

    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    const resumed = read.envelope.state;
    expect(resumed.screen).toBe("shop-opening");
    expect(resumed.collection).toEqual(creditedOnce());

    const finished = reduceStory(resumed, { type: "finish-opening" });
    const acknowledged = reduceStory(finished, { type: "acknowledge-opened" });
    expect(acknowledged.collection).toEqual(creditedOnce());
  });
});

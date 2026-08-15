import { afterEach, describe, expect, it, vi } from "vitest";
import { buildActiveImageManifest } from "../../../scripts/lib/active-image-manifest.ts";
import {
  findSelectableDeck,
  listSelectableDecks,
  supportedDuelCardCodes,
} from "../../../src/battle/decks/selectable-decks.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/decks/catalog/prototype-catalog.ts";
import type { DeckRecord, DeckRepository } from "../../../src/decks/index.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { validateDeckDraft } from "../../../src/decks/deck-validation.ts";
import { DECK_CATALOG } from "../../../src/battle/duel/presets/deck-catalog.ts";

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const mainCodes = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
).map(({ code }) => code);
const validMain = Array.from(
  { length: 40 },
  (_, index) => mainCodes[index % mainCodes.length]!,
);
const supported = new Set(PROTOTYPE_CATALOG.map(({ code }) => code));

function deckRecord(
  id: string,
  main: readonly number[],
  revision = 1,
): DeckRecord {
  const base = createBlankDeck(id, catalog, PROTOTYPE_RULESET, { id });
  return Object.freeze({
    ...base,
    revision,
    main: Object.freeze([...main]),
    validation: validateDeckDraft(
      { main: [...main], extra: [], side: [] },
      catalog,
      PROTOTYPE_RULESET,
    ),
  });
}

/** Only the two methods the lister is allowed to reach for. A repository that
    could save is deliberately out of reach: listing never rewrites a deck. */
function repositoryOf(
  ...decks: readonly DeckRecord[]
): Pick<DeckRepository, "list" | "load"> {
  return {
    list: async () => decks,
    load: async (id) => {
      const deck = decks.find((candidate) => candidate.id === id);
      return deck === undefined ? null : { deck, history: emptyDeckHistory() };
    },
  };
}

async function list(repository: Pick<DeckRepository, "list" | "load">) {
  return await listSelectableDecks(
    DECK_CATALOG,
    repository,
    catalog,
    PROTOTYPE_RULESET,
    supported,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("listSelectableDecks", () => {
  it("lists every bundled preset even with an empty repository", async () => {
    const decks = await list(repositoryOf());

    expect(decks).toHaveLength(DECK_CATALOG.length);
    expect(decks.every((deck) => deck.source === "preset")).toBe(true);
    expect(decks.map((deck) => deck.key)).toEqual(
      DECK_CATALOG.map((preset) => `preset:${preset.id}`),
    );
    expect(decks[0]?.selection).toEqual({
      kind: "preset",
      deckId: DECK_CATALOG[0]?.id,
    });
  });

  it("lists a ready local deck whose codes are all supported", async () => {
    const decks = await list(repositoryOf(deckRecord("ready-deck", validMain)));
    const local = decks.filter((deck) => deck.source === "local");

    expect(local).toHaveLength(1);
    expect(local[0]?.key).toBe("local:ready-deck:1");
    expect(local[0]?.label).toBe("ready-deck");
    expect(local[0]?.selection).toEqual({
      kind: "local",
      deck: expect.objectContaining({
        ref: { type: "local", deckId: "ready-deck", revision: 1 },
        main: validMain,
      }),
    });
  });

  it("hides a deck that resolves invalid", async () => {
    const decks = await list(
      repositoryOf(deckRecord("short-deck", validMain.slice(0, 39))),
    );

    expect(decks.filter((deck) => deck.source === "local")).toEqual([]);
  });

  it("hides a deck the repository cannot load", async () => {
    const listed = deckRecord("ghost-deck", validMain);
    const decks = await list({
      list: async () => [listed],
      load: async () => null,
    });

    expect(decks.filter((deck) => deck.source === "local")).toEqual([]);
  });

  it("hides a ready deck holding a code outside the active snapshot", async () => {
    const decks = await listSelectableDecks(
      DECK_CATALOG,
      repositoryOf(deckRecord("ready-deck", validMain)),
      catalog,
      PROTOTYPE_RULESET,
      new Set([...supported].filter((code) => code !== validMain[0])),
    );

    expect(decks.filter((deck) => deck.source === "local")).toEqual([]);
  });

  it("changes the key when the deck is saved again", async () => {
    const first = await list(
      repositoryOf(deckRecord("rev-deck", validMain, 1)),
    );
    const second = await list(
      repositoryOf(deckRecord("rev-deck", validMain, 2)),
    );

    expect(first.at(-1)?.key).toBe("local:rev-deck:1");
    expect(second.at(-1)?.key).toBe("local:rev-deck:2");
  });

  it("keeps presets ahead of local decks", async () => {
    const decks = await list(repositoryOf(deckRecord("ready-deck", validMain)));

    expect(decks.map((deck) => deck.source)).toEqual([
      ...DECK_CATALOG.map(() => "preset"),
      "local",
    ]);
  });
});

describe("findSelectableDeck", () => {
  it("returns the entry for a known key and null otherwise", async () => {
    const decks = await list(repositoryOf(deckRecord("ready-deck", validMain)));

    expect(findSelectableDeck(decks, "local:ready-deck:1")?.source).toBe(
      "local",
    );
    expect(findSelectableDeck(decks, "preset:mvp-player")?.source).toBe(
      "preset",
    );
    expect(findSelectableDeck(decks, "local:ready-deck:2")).toBeNull();
    expect(findSelectableDeck([], "preset:mvp-player")).toBeNull();
  });
});

/* The filter above is right, and on this build it always says no.

   `__ACTIVE_IMAGE_MANIFEST__` is built from the six bundled `.ydk` decks alone
   (`scripts/lib/active-image-manifest.ts`), while the deck editor builds from
   `PROTOTYPE_CATALOG`. Only eight cards are in both, and the pinned ruleset
   caps those eight below the 40-card Main minimum — so no deck a player can
   assemble is one this build can draw, and the local group is empty in
   production no matter what the picker does.

   Widening art coverage is out of scope for T18, so this is a tripwire rather
   than a fix: when the packaged set grows, this test fails, and the thing to
   do is turn `a ruleset-valid local deck stays hidden while its art is
   unpackaged` in `e2e/duel-smoke.spec.ts` into the local duel it was always
   meant to be. */
describe("local deck coverage tripwire", () => {
  it("no assemblable deck is playable, because art covers only bundled decks", () => {
    const packaged = new Set(
      buildActiveImageManifest(process.cwd(), "tripwire").files.map(
        ({ code }) => code,
      ),
    );
    const assemblable = PROTOTYPE_CATALOG.filter((card) =>
      packaged.has(card.code),
    );
    const largestPlayableDeck = assemblable.reduce(
      (total, card) => total + quantityLimit(PROTOTYPE_RULESET, card.code),
      0,
    );

    expect(assemblable).toHaveLength(8);
    expect(largestPlayableDeck).toBeLessThan(40);
  });
});

describe("supportedDuelCardCodes", () => {
  it("keeps only codes the packaged snapshot can both play and draw", () => {
    vi.stubGlobal("__ACTIVE_CARD_TEXTS__", [
      { code: 1, name: "one", description: "" },
      { code: 2, name: "two", description: "" },
    ]);
    vi.stubGlobal("__ACTIVE_IMAGE_MANIFEST__", {
      files: [{ code: 2 }, { code: 3 }],
      missing: [1],
    });

    expect([...supportedDuelCardCodes()]).toEqual([2]);
  });
});

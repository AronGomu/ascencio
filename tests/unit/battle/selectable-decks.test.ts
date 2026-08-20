import { afterEach, describe, expect, it, vi } from "vitest";
import { buildActiveCardDataManifest } from "../../../scripts/lib/active-card-data-manifest.ts";
import { buildActiveCardTextManifest } from "../../../scripts/lib/active-card-text-manifest.ts";
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
import { packagedCatalog } from "../../../src/decks/catalog/packaged-catalog.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";
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

afterEach(() => {
  vi.unstubAllGlobals();
  setRuntimeCatalogForTests(null);
});

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

/* The filter above is right, and it used to always say no: the editor built
   from a hand-written fixture while `__ACTIVE_IMAGE_MANIFEST__` was cut from
   the six bundled `.ydk` decks, so only eight cards were in both and the
   pinned ruleset capped those eight below the 40-card Main minimum. No deck a
   player could assemble was one this build could draw.

   The editor and the duel now await one runtime catalog read
   (`src/decks/catalog/runtime-catalog.ts`, ADR-043), so the editor's offer is
   the duel's card set less its Tokens, never a different set. This asserts that from the build's own manifests rather than
   from the browser globals, which is the earliest place the claim can be
   checked — and it goes red the day packaging shrinks back below a legal deck.
   `a local deck built from the packaged catalog duels` in
   `e2e/duel-smoke.spec.ts` walks the same claim end to end. */
describe("packaged local deck coverage", () => {
  it("packages enough legal cards to assemble a deck the duel can draw", () => {
    const packagedCodes = buildActiveImageManifest(
      process.cwd(),
      "coverage",
    ).files.map(({ code }) => code);
    const packaged = packagedCatalog(
      buildActiveCardDataManifest(process.cwd(), new Set(packagedCodes)),
      buildActiveCardTextManifest(process.cwd(), new Set(packagedCodes)),
    );
    const assemblableMain = packaged.filter(
      (card) => card.canonicalZone === "main",
    );
    const largestPlayableDeck = assemblableMain.reduce(
      (total, card) => total + quantityLimit(PROTOTYPE_RULESET, card.code),
      0,
    );

    expect(packaged).toHaveLength(packagedCodes.length);
    expect(largestPlayableDeck).toBeGreaterThanOrEqual(40);

    /* Assembled the way the editor would, then run through the validator the
       picker consults: legal to build is only worth asserting if it is also
       legal to duel. */
    const codes = assemblableMain
      .filter((card) => quantityLimit(PROTOTYPE_RULESET, card.code) === 3)
      .map(({ code }) => code);
    const main = Array.from(
      { length: 40 },
      (_, index) => codes[index % codes.length]!,
    );
    const validation = validateDeckDraft(
      { main, extra: [], side: [] },
      catalogByCode(packaged),
      PROTOTYPE_RULESET,
    );

    expect(
      validation.issues.filter((issue) => issue.severity === "error"),
    ).toEqual([]);
  });
});

describe("supportedDuelCardCodes", () => {
  it("names exactly the cards the runtime catalog offers", async () => {
    const offered = PROTOTYPE_CATALOG.slice(0, 2);
    setRuntimeCatalogForTests(offered);

    expect([...(await supportedDuelCardCodes())]).toEqual(
      offered.map(({ code }) => code),
    );
  });

  /* The claim this ticket exists for. The supported set used to be cut from
     the art-backed packaged manifest, so a deck holding anything the six
     bundled `.ydk` decks did not already name was withheld without a word.
     Reading the runtime catalog means every card the editor could offer is a
     card the picker will list. */
  it("offers a local deck built from cards no bundled deck names", async () => {
    setRuntimeCatalogForTests(PROTOTYPE_CATALOG);

    const decks = await listSelectableDecks(
      DECK_CATALOG,
      repositoryOf(deckRecord("own-deck", validMain)),
      catalog,
      PROTOTYPE_RULESET,
      await supportedDuelCardCodes(),
    );

    expect(decks.filter((deck) => deck.source === "local")).toHaveLength(1);
    expect(decks.at(-1)?.key).toBe("local:own-deck:1");
  });

  /* Widening what is supported must not widen it past the catalog: a deck the
     Worker would refuse still has to be absent, because a refusal that arrives
     after the player chose the deck is the worse failure. */
  it("withholds a local deck holding a code the catalog does not carry", async () => {
    setRuntimeCatalogForTests(
      PROTOTYPE_CATALOG.filter(({ code }) => code !== validMain[0]),
    );

    const decks = await listSelectableDecks(
      DECK_CATALOG,
      repositoryOf(deckRecord("own-deck", validMain)),
      catalog,
      PROTOTYPE_RULESET,
      await supportedDuelCardCodes(),
    );

    expect(decks.filter((deck) => deck.source === "local")).toEqual([]);
  });
});

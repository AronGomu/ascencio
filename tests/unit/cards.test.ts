import { describe, expect, it } from "vitest";
import {
  cardCode,
  createCards,
  parseCardDefinitions,
  validateCardConsistency,
} from "../../src/cards/index.ts";
import { cardCode as battleCardCode } from "../../src/battle/duel/contracts/ids.ts";
import { cardsDeckCatalog } from "../../src/decks/catalog/index.ts";
import {
  validatePublishedDecks,
  PROTOTYPE_RULESET,
  validateDeckDraft,
  catalogByCode,
} from "../../src/decks/validation/index.ts";
import { mapDeckBuilderCard } from "../../src/decks/catalog/ocg-card-mapper.ts";
import { PROTOTYPE_CATALOG_RECORDS } from "../fixtures/catalog.ts";
import { installedEditorCatalog } from "../../src/shell/adapters/installed-editor-catalog.ts";
import { installedDuelGameplayFixture } from "../fixtures/installed-duel-gameplay.ts";
import { storyCardOwnership } from "../../src/story/decks/card-ownership.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";

function definitions() {
  return PROTOTYPE_CATALOG_RECORDS.map(({ card, text, scope }) => ({
    code: cardCode(card.code),
    alias: card.alias,
    setcodes: [...card.setcodes],
    type: card.type,
    level: card.level,
    attribute: card.attribute,
    race: String(card.race),
    attack: card.attack,
    defense: card.defense,
    lscale: card.lscale,
    rscale: card.rscale,
    linkMarker: card.link_marker,
    scope: Number(scope),
    name: text.name,
    description: text.description,
    strings: [...text.strings],
    images: {
      full: { code: cardCode(card.code), variant: "full" as const },
      cropped: { code: cardCode(card.code), variant: "cropped" as const },
    },
  }));
}

describe("Canonical card definition", () => {
  it("rejects two conflicting same-code records", () => {
    const first = definitions()[0]!;
    expect(() => createCards([first, { ...first, name: "conflict" }])).toThrow(
      "CARDS_INVALID_DEFINITION",
    );
  });
  it("deduplicates identical definitions, sorts codes, freezes nested copies", () => {
    const source = definitions();
    const cards = createCards([...source].reverse().concat(source[0]!));
    expect(cards.all().map((c) => c.code)).toEqual(
      source.map((c) => c.code).sort((a, b) => a - b),
    );
    const card = cards.get(source[0]!.code)!;
    source[0]!.strings.push("changed");
    expect(card.strings).not.toContain("changed");
    for (const value of [
      cards,
      cards.all(),
      card,
      card.strings,
      card.setcodes,
      card.images,
      card.images.full,
      card.images.cropped,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(cards.get(cardCode(999999999))).toBeUndefined();
  });
  it("uses one Battle brand and preserves invalid-code errors", () => {
    expect(battleCardCode).toBe(cardCode);
    for (const code of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => cardCode(code)).toThrow(`Invalid card code: ${code}`);
  });
  it("parses canonical decimal races and semantic image refs only", () => {
    const first = definitions()[0]!;
    expect(parseCardDefinitions([first])[0]).toEqual(first);
    for (const change of [
      { race: "01" },
      { race: "-1" },
      { race: 1n },
      { attack: Infinity },
      { strings: [1] },
      {
        images: {
          full: { code: first.code, variant: "cropped" },
          cropped: first.images.cropped,
        },
      },
    ])
      expect(() => parseCardDefinitions([{ ...first, ...change }])).toThrow(
        "CARDS_INVALID_DEFINITION",
      );
    expect(() => parseCardDefinitions(null)).toThrow(
      "CARDS_INVALID_DEFINITION",
    );
    for (const value of [
      new Array(1),
      [{ ...first, setcodes: new Array(1) }],
      [{ ...first, strings: new Array(1) }],
    ])
      expect(() => parseCardDefinitions(value)).toThrow(
        "CARDS_INVALID_DEFINITION",
      );
  });
  it("checks chapter definitions against runtime including text", () => {
    const first = definitions()[0]!;
    expect(() => validateCardConsistency([first], definitions())).not.toThrow();
    expect(() => validateCardConsistency([first], [])).toThrow(
      "CARDS_INVALID_DEFINITION",
    );
    expect(() =>
      validateCardConsistency(
        [{ ...first, description: "changed" }],
        definitions(),
      ),
    ).toThrow("CARDS_INVALID_DEFINITION");
  });
});

it("Mapping parity: normal/XYZ/link/spell/trap labels, stats and race conversion", () => {
  const expected = PROTOTYPE_CATALOG_RECORDS.map((record) => ({
    ...mapDeckBuilderCard(record),
    imageUrl: null,
  })).sort((a, b) => a.code - b.code);
  expect(
    [...cardsDeckCatalog(createCards(definitions()))].sort(
      (a, b) => a.code - b.code,
    ),
  ).toEqual(expected);
});

it("Ownership preserved: Story collection has 1 copy; deck asks 2", () => {
  const cards = createCards(definitions());
  const normal = cards.all().find((c) => c.type === 17)!;
  const ownership = storyCardOwnership({
    ...createInitialStoryState(),
    collection: { [normal.code]: 1 },
  });
  const summary = validateDeckDraft(
    { main: [normal.code, normal.code], extra: [], side: [] },
    catalogByCode(cardsDeckCatalog(cards)),
    PROTOTYPE_RULESET,
    ownership,
  );
  expect(summary.issues).toContainEqual(
    expect.objectContaining({
      code: "not-owned",
      cardCode: normal.code,
      message: `This deck uses 2 copy/copies of ${normal.name}; you own 1.`,
    }),
  );
});

it("Shell adapter preserves wire scope/text and offers abortable null optional media", async () => {
  const gameplay = installedDuelGameplayFixture();
  const input = installedEditorCatalog(gameplay);
  for (const { record, text } of gameplay.cards) {
    expect(input.cards.get(cardCode(record.code))).toMatchObject({
      scope: record.ot,
      name: text.name,
      description: text.description,
      strings: text.strings,
      race: record.race,
    });
  }
  const code = input.cards.all()[0]!.code;
  await expect(
    input.images.acquire(code, "full", new AbortController().signal),
  ).resolves.toBeNull();
  const abort = new AbortController();
  abort.abort();
  await expect(
    input.images.acquire(code, "cropped", abort.signal),
  ).rejects.toMatchObject({
    name: "AbortError",
    message: "The operation was aborted.",
  });
  expect(Object.isFrozen(input.starter.cards.main)).toBe(true);
});

it("published decks preserve missing/token/zone/quantity rules without minimum size", () => {
  const cards = createCards(definitions());
  const normal = cards.all().find((c) => c.type === 17)!;
  const extra = cardsDeckCatalog(cards).find(
    (c) => c.canonicalZone === "extra",
  )!;
  expect(() =>
    validatePublishedDecks(
      [{ main: [normal.code], extra: [], side: [] }],
      cards,
      PROTOTYPE_RULESET,
    ),
  ).not.toThrow();
  for (const deck of [
    { main: [999999999], extra: [], side: [] },
    { main: [extra.code], extra: [], side: [] },
    { main: [], extra: [normal.code], side: [] },
    {
      main: [normal.code, normal.code],
      extra: [],
      side: [normal.code, normal.code],
    },
  ])
    expect(() =>
      validatePublishedDecks([deck], cards, PROTOTYPE_RULESET),
    ).toThrow("DECK_RELEASE_INVALID");
  const token = { ...normal, type: 16385 };
  expect(() =>
    validatePublishedDecks(
      [{ main: [token.code], extra: [], side: [] }],
      createCards([token]),
      PROTOTYPE_RULESET,
    ),
  ).toThrow("DECK_RELEASE_INVALID");
});

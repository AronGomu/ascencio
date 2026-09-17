import { describe, expect, it, vi } from "vitest";
import type { DeckRepository } from "../../src/decks/index.ts";
import { deckId } from "../../src/decks/index.ts";
import { installedDeckCatalog } from "../../src/decks/catalog/installed-gameplay-cards.ts";
import { installedSelectableDecks } from "../../src/battle/decks/installed-selectable-decks.ts";
import { installedFreePlayOpponents } from "../../src/shell/screens/free-play-opponents.ts";
import { PROTOTYPE_RULESET } from "../../src/decks/validation/index.ts";
import {
  battlePresentationFixture,
  installedGameplayFixture,
  TEST_CONTENT_SET_REF,
} from "../fixtures/installed-gameplay.ts";

function repositoryWithMissingCard(): Pick<DeckRepository, "list" | "load"> {
  const id = deckId("saved-invalid");
  const deck = Object.freeze({
    schemaVersion: 1 as const,
    id,
    revision: 3,
    name: "Saved Invalid",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    validation: Object.freeze({
      status: "valid" as const,
      issues: Object.freeze([]),
      rulesetRevision: PROTOTYPE_RULESET.revision,
    }),
    importedNeedsReview: false,
    illustrationCardCode: null,
    main: Object.freeze([
      999,
      ...Array.from({ length: 39 }, (_, i) => (i % 13) + 1),
    ]),
    extra: Object.freeze([]),
    side: Object.freeze([]),
  });
  return {
    list: vi.fn(async () => [deck]),
    load: vi.fn(async (requested) =>
      requested === id
        ? {
            deck,
            history: Object.freeze({
              undo: Object.freeze([]),
              redo: Object.freeze([]),
              nextSequence: 1,
            }),
          }
        : null,
    ),
  };
}

describe("installed Free Play projection", () => {
  it("derives chapter deck and AI roster without compiled presets", async () => {
    const gameplay = installedGameplayFixture();
    const catalog = installedDeckCatalog(gameplay).cards;
    const decks = await installedSelectableDecks(
      battlePresentationFixture(gameplay),
      repositoryWithMissingCard(),
      new Map(catalog.map((card) => [card.code, card])),
      PROTOTYPE_RULESET,
    );

    expect(decks[0]).toMatchObject({
      key: "chapter:installed-starter",
      label: "Installed Starter",
      source: "chapter",
      blockReason: null,
    });
    expect(decks.some(({ key }) => key.startsWith("preset:"))).toBe(false);
    expect(installedFreePlayOpponents(gameplay)).toEqual([
      {
        id: "installed-rival",
        name: "Installed Rival",
        line: "Installed only",
        deckKey: "chapter:installed-starter",
        policyId: "basic",
      },
    ]);
    expect(gameplay.content).toBe(TEST_CONTENT_SET_REF);
  });

  it("keeps invalid stored deck visible and explains missing installed card", async () => {
    const gameplay = installedGameplayFixture();
    const cards = installedDeckCatalog(gameplay).cards;
    const decks = await installedSelectableDecks(
      battlePresentationFixture(gameplay),
      repositoryWithMissingCard(),
      new Map(cards.map((card) => [card.code, card])),
      PROTOTYPE_RULESET,
    );
    const invalid = decks.find(({ key }) =>
      key.startsWith("local:saved-invalid:"),
    );

    expect(invalid).toMatchObject({
      label: "Saved Invalid",
      source: "local",
      selection: null,
    });
    expect(invalid?.blockReason).toContain("999");
  });

  it("renders the same saved revision that a local seat will start", async () => {
    const gameplay = installedGameplayFixture();
    const cards = installedDeckCatalog(gameplay).cards;
    const staleRepository = repositoryWithMissingCard();
    const listed = (await staleRepository.list())[0]!;
    const stored = (await staleRepository.load(listed.id))!;
    const currentMain = Object.freeze(
      Array.from({ length: 40 }, (_, index) => (index % 14) + 1),
    );
    const current = Object.freeze({
      ...stored.deck,
      revision: 4,
      name: "Saved Current",
      updatedAt: "2026-09-13T00:00:00.000Z",
      main: currentMain,
    });
    const decks = await installedSelectableDecks(
      battlePresentationFixture(gameplay),
      {
        list: async () => [listed],
        load: async () => ({ ...stored, deck: current }),
      },
      new Map(cards.map((card) => [card.code, card])),
      PROTOTYPE_RULESET,
    );
    const local = decks.find(({ source }) => source === "local");

    expect(local).toMatchObject({
      key: "local:saved-invalid:4",
      label: "Saved Current",
      lists: { main: currentMain },
      selection: {
        kind: "local",
        deck: {
          ref: { type: "local", deckId: "saved-invalid", revision: 4 },
          name: "Saved Current",
          main: currentMain,
        },
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import type { InstalledGameplay } from "../../../src/content/index.ts";
import { installedDeckCatalog } from "../../../src/decks/index.ts";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";

const hash = (character: string) => character.repeat(64);

function gameplay(): InstalledGameplay {
  const image = {
    packId: "chapter-01" as const,
    path: "chapters/chapter-01/card.png",
  };
  return {
    content: {
      catalogSha256: hash("a"),
      snapshot: {
        activationId: hash("b"),
        runtimeSnapshotId: hash("c"),
        runtimeManifestSha256: hash("d"),
        releaseCatalogSha256: hash("a"),
      },
      runtime: { packId: "runtime", sha256: hash("e"), bytes: 1 },
      chapters: [{ packId: "chapter-01", sha256: hash("f"), bytes: 1 }],
    },
    chapterIds: ["chapter-01"],
    cards: [
      {
        code: 7,
        record: {
          code: 7,
          alias: 0,
          setcodes: [1],
          type: 17,
          level: 4,
          attribute: 1,
          race: "1",
          attack: 1200,
          defense: 800,
          lscale: 0,
          rscale: 0,
          linkMarker: 0,
          ot: 3,
        },
        text: {
          code: 7,
          name: "Installed Card",
          description: "Chapter-owned text",
          strings: [],
        },
        fullImage: image,
        croppedImage: image,
      },
    ],
    sets: [
      {
        id: "set-text-only",
        name: "Text-only Set",
        releaseYear: 2001,
        image: null,
        cards: [
          {
            code: 7,
            name: "Installed Card",
            rarity: "secret-rare",
            printingCode: "TEST-007",
            sourceRarity: "Secret Rare",
            sourceRarityCode: "ScR",
          },
        ],
      },
    ],
    decks: [],
    opponents: [],
    defaults: { starterDeckId: "starter", opponentId: "rival" },
  };
}

describe("installedDeckCatalog", () => {
  it("maps chapter cards only and preserves printing provenance", () => {
    setRuntimeCatalogForTests([
      {
        code: 999,
        name: "Runtime-only Card",
        description: "Not installed by chapter",
        family: "monster",
        subtypes: [],
        attribute: null,
        race: null,
        levelRankLink: 1,
        ratingLabel: "Level",
        attack: 0,
        defense: 0,
        pendulumScales: null,
        linkMarkers: [],
        canonicalZone: "main",
        imageUrl: null,
        scope: 3,
        rawType: 17,
      },
    ]);
    const installed = gameplay();
    const projected = installedDeckCatalog(installed);
    expect(projected.cards.map(({ code }) => code)).toEqual([7]);
    expect(projected.cards[0]).toMatchObject({
      name: "Installed Card",
      description: "Chapter-owned text",
      imageUrl: null,
      rawType: 17,
    });
    expect(projected.sets).toEqual(installed.sets);
    expect(projected.sets[0]).toMatchObject({
      image: null,
      cards: [
        {
          printingCode: "TEST-007",
          sourceRarity: "Secret Rare",
          sourceRarityCode: "ScR",
        },
      ],
    });
    expect(projected.cards.some(({ code }) => code === 999)).toBe(false);
    setRuntimeCatalogForTests(null);
  });
});

import type {
  OwnedContentReader,
  ContentSetRef,
  InstalledGameplay,
} from "../../src/content/index.ts";
import type { DeckBuilderCardView } from "../../src/decks/catalog/index.ts";

const hash = (character: string) => character.repeat(64);

export const TEST_CONTENT_SET_REF: ContentSetRef = Object.freeze({
  catalogSha256: hash("a"),
  snapshot: Object.freeze({
    activationId: hash("b"),
    runtimeSnapshotId: hash("c"),
    runtimeManifestSha256: hash("d"),
    releaseCatalogSha256: hash("a"),
  }),
  runtime: Object.freeze({
    packId: "runtime",
    sha256: hash("e"),
    bytes: 1_024,
  }),
  chapters: Object.freeze([
    Object.freeze({
      packId: "chapter-01",
      sha256: hash("f"),
      bytes: 2_048,
    }),
  ]),
});

export const TEST_CONTENT_REF = TEST_CONTENT_SET_REF;

export function contentReaderFixture(): OwnedContentReader {
  return {
    close: () => undefined,
    acquireSession: async () => ({
      kind: "ok" as const,
      value: { content: TEST_CONTENT_SET_REF, release: () => undefined },
    }),
    readFile: async () => ({
      kind: "failed" as const,
      code: "CONTENT_MISSING" as const,
      packId: null,
      path: null,
    }),
  } as unknown as OwnedContentReader;
}

export async function openContentReaderFixture() {
  return { kind: "ok" as const, value: contentReaderFixture() };
}

export function installedGameplayFromCatalog(
  catalog: readonly DeckBuilderCardView[],
  overrides: Partial<InstalledGameplay> = {},
): InstalledGameplay {
  const cards = catalog.map((card) =>
    Object.freeze({
      code: card.code,
      record: Object.freeze({
        code: card.code,
        alias: 0,
        setcodes: Object.freeze([]),
        type: card.rawType,
        level: card.levelRankLink ?? 0,
        attribute: 0,
        race: "1",
        attack: card.attack ?? 0,
        defense: card.defense ?? 0,
        lscale: card.pendulumScales?.[0] ?? 0,
        rscale: card.pendulumScales?.[1] ?? 0,
        linkMarker: 0,
        ot: card.scope,
      }),
      text: Object.freeze({
        code: card.code,
        name: card.name,
        description: card.description,
        strings: Object.freeze([]),
      }),
      fullImage: Object.freeze({
        packId: "chapter-01",
        path: `chapters/chapter-01/cards/${card.code}.jpg`,
      }),
      croppedImage: Object.freeze({
        packId: "chapter-01",
        path: `chapters/chapter-01/cards/${card.code}-cropped.jpg`,
      }),
    }),
  );
  return installedGameplayFixture({
    cards: Object.freeze(cards),
    ...overrides,
  });
}

export function installedGameplayFixture(
  overrides: Partial<InstalledGameplay> = {},
): InstalledGameplay {
  const cards = Array.from({ length: 14 }, (_, index) => {
    const code = index + 1;
    return Object.freeze({
      code,
      record: Object.freeze({
        code,
        alias: 0,
        setcodes: Object.freeze([]),
        type: 0x11,
        level: 4,
        attribute: 0x01,
        race: "1",
        attack: 1_000,
        defense: 1_000,
        lscale: 0,
        rscale: 0,
        linkMarker: 0,
        ot: 3,
      }),
      text: Object.freeze({
        code,
        name: `Installed ${code}`,
        description: `Installed card ${code}`,
        strings: Object.freeze([]),
      }),
      fullImage: Object.freeze({
        packId: "chapter-01",
        path: `chapters/chapter-01/cards/${code}.jpg`,
      }),
      croppedImage: Object.freeze({
        packId: "chapter-01",
        path: `chapters/chapter-01/cards/${code}-cropped.jpg`,
      }),
    });
  });
  const main = Object.freeze(
    Array.from({ length: 40 }, (_, index) => (index % 14) + 1),
  );
  return Object.freeze({
    content: TEST_CONTENT_SET_REF,
    chapterIds: Object.freeze(["chapter-01" as const]),
    cards: Object.freeze(cards),
    sets: Object.freeze([
      Object.freeze({
        id: "installed-set",
        name: "Installed Set",
        releaseYear: 2002,
        image: null,
        cards: Object.freeze(
          cards.map(({ code, text }) =>
            Object.freeze({
              code,
              name: text.name,
              rarity: "common" as const,
              printingCode: `SET-${code}`,
              sourceRarity: "Common",
              sourceRarityCode: "C",
            }),
          ),
        ),
      }),
    ]),
    decks: Object.freeze([
      Object.freeze({
        id: "installed-starter",
        name: "Installed Starter",
        main,
        extra: Object.freeze([]),
        side: Object.freeze([]),
      }),
    ]),
    opponents: Object.freeze([
      Object.freeze({
        id: "installed-rival",
        name: "Installed Rival",
        line: "Installed only",
        deckId: "installed-starter",
        policyId: "basic" as const,
      }),
    ]),
    defaults: Object.freeze({
      starterDeckId: "installed-starter",
      opponentId: "installed-rival",
    }),
    ...overrides,
  });
}

import type {
  OwnedContentReader,
  ContentSetRef,
  InstalledGameplay,
} from "../../src/content/index.ts";
import { cardCode } from "../../src/cards/index.ts";
import type { DeckBuilderCardView } from "../../src/decks/catalog/index.ts";
import { installedDeckCatalog } from "../../src/decks/index.ts";
import type { BattlePresentationInput } from "../../src/battle/ports/index.ts";
import type {
  BattleRuntimeInput,
  BattleRuntimeSource,
} from "../../src/battle/ports/index.ts";

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

export const TEST_RUNTIME_INPUT: BattleRuntimeInput = Object.freeze({
  schemaVersion: 1,
  snapshotId: hash("c"),
  coreVersion: Object.freeze([11, 0]) as readonly [number, number],
  wasmBinary: new ArrayBuffer(8),
  cards: Object.freeze([
    Object.freeze({
      code: cardCode(1),
      alias: 0,
      setcodes: Object.freeze([]),
      type: 0x11,
      level: 4,
      attribute: 1,
      race: "1",
      attack: 1_000,
      defense: 1_000,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
    }),
  ]),
  texts: Object.freeze([
    Object.freeze({
      code: cardCode(1),
      name: "Test card",
      description: "Test card",
      strings: Object.freeze([]),
    }),
  ]),
  scripts: Object.freeze([
    Object.freeze({ name: "utility.lua", source: "return {}" }),
  ]),
  requiredScripts: Object.freeze({
    cards: Object.freeze([]),
    globals: Object.freeze(["utility.lua"]),
  }),
  strings: Object.freeze({
    system: Object.freeze({ "1": "Normal Summon" }),
    victory: Object.freeze({ "0x0": "Surrendered" }),
    counter: Object.freeze({}),
    setname: Object.freeze({}),
  }),
  allowedCardCodes: Object.freeze([cardCode(1)]),
  ruleset: Object.freeze({
    id: "prototype-single-ruleset",
    revision: "prototype-2026-01",
    quantityByCode: Object.freeze([]),
  }),
  revisions: Object.freeze({ babelCdb: "babel", cardScripts: "scripts" }),
});

/** Legacy name retained across runtime-focused historical fixtures. */
export const TEST_CONTENT_REF = TEST_RUNTIME_INPUT;

export const TEST_RUNTIME_SOURCE: BattleRuntimeSource = Object.freeze({
  async load(signal: AbortSignal): Promise<BattleRuntimeInput> {
    signal.throwIfAborted();
    return {
      ...TEST_RUNTIME_INPUT,
      wasmBinary: TEST_RUNTIME_INPUT.wasmBinary.slice(0),
    };
  },
});

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

export function battlePresentationFixture(
  gameplay: InstalledGameplay = installedGameplayFixture(),
): BattlePresentationInput {
  return Object.freeze({
    snapshotId: gameplay.content.snapshot.runtimeSnapshotId,
    catalogRevision: gameplay.content.catalogSha256,
    cards: installedDeckCatalog(gameplay).cards,
    decks: gameplay.decks,
    opponents: gameplay.opponents,
    defaults: gameplay.defaults,
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

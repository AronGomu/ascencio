// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { createSqliteDeckRepository } from "../../../src/decks/sqlite-deck-repository.ts";
import { importYdk } from "../../../src/decks/ydk-adapter.ts";
import { JsonUserDataStore } from "../../../src/storage/json/user-data-store.ts";
import { parseUserDocument } from "../../../src/storage/json/user-document.ts";

const root = new URL(
  "../../../test/fixtures/decks/pre-gx-2005/",
  import.meta.url,
);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", root), "utf8"),
) as {
  decks: {
    id: string;
    archetype: string;
    name: string;
    file: string;
    sha256: string;
    counts: Record<"main" | "extra" | "side", number>;
    main: { code: number; count: number }[];
    extra: { code: number; count: number; catalogName: string }[];
    side: { code: number; count: number }[];
  }[];
};

function cardsFromFile(file: string) {
  const result = importYdk(readFileSync(new URL(file, root), "utf8"));
  if (result.type !== "ready") throw new Error(result.message);
  return result.cards;
}

describe("strict pre-GX 2005 archetype dataset", () => {
  it("preserves eight distinct archetypes and their deck contents", () => {
    expect(manifest.decks).toHaveLength(8);
    expect(new Set(manifest.decks.map(({ id }) => id)).size).toBe(8);
    expect(new Set(manifest.decks.map(({ archetype }) => archetype)).size).toBe(
      8,
    );
    const codes = new Set<number>();
    for (const deck of manifest.decks) {
      expect(deck.name).toBe(`Pre-GX 2005 - ${deck.archetype}`);
      const bytes = readFileSync(new URL(deck.file, root));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        deck.sha256,
      );
      const cards = cardsFromFile(deck.file);
      const copies = new Map<number, number>();
      for (const zone of ["main", "extra", "side"] as const) {
        expect(cards[zone]).toEqual(
          deck[zone].flatMap(({ code, count }) =>
            Array<number>(count).fill(code),
          ),
        );
        expect(cards[zone]).toHaveLength(deck.counts[zone]);
        for (const code of cards[zone]) {
          codes.add(code);
          copies.set(code, (copies.get(code) ?? 0) + 1);
        }
      }
      expect(cards.main.length).toBeGreaterThanOrEqual(40);
      expect(cards.side.length).toBeLessThanOrEqual(15);
      expect(Math.max(...copies.values())).toBeLessThanOrEqual(3);
    }
    expect(codes.size).toBe(138);
    expect(Math.max(...manifest.decks.map(({ counts }) => counts.extra))).toBe(
      15,
    );
  });

  it("keeps three Thousand-Eyes Restrict and removes lowest-ATK other Fusions to reach fifteen", () => {
    const removed: Record<string, string[]> = {
      "Goat Control": [
        "Ojama King",
        "Reaper on the Nightmare",
        "Flame Ghost",
        "Darkfire Dragon",
        "Musician King",
      ],
      "Tribute Control": [
        "Flame Ghost",
        "Charubin the Fire Knight",
        "Flame Swordsman",
      ],
    };
    for (const [archetype, names] of Object.entries(removed)) {
      const deck = manifest.decks.find((d) => d.archetype === archetype)!;
      expect(cardsFromFile(deck.file).extra).toHaveLength(15);
      expect(
        deck.extra.find((c) => c.catalogName === "Thousand-Eyes Restrict")
          ?.count,
      ).toBe(3);
      expect(
        deck.extra
          .filter((c) => c.catalogName !== "Thousand-Eyes Restrict")
          .every((c) => c.count === 1),
      ).toBe(true);
      for (const name of names)
        expect(deck.extra.some((c) => c.catalogName === name)).toBe(false);
    }
    expect(
      manifest.decks
        .find((d) => d.archetype === "Tribute Control")!
        .extra.some((c) => c.catalogName === "Cyber Saurus"),
    ).toBe(true);
  });

  it("saves and reloads every zone through the application JSON deck repository without changing card counts", async () => {
    let persisted: string | null = null;
    const backend = {
      async read() {
        return persisted;
      },
      async write(source: string, expected: string | null) {
        expect(persisted).toBe(expected);
        persisted = source;
        return { kind: "ok" as const, value: undefined };
      },
    };
    const store = new JsonUserDataStore(backend);
    expect((await store.initialize()).kind).toBe("ok");
    const repository = createSqliteDeckRepository(store);
    for (const deck of manifest.decks) {
      await repository.create(
        {
          schemaVersion: 1,
          id: deckId(deck.id),
          revision: 0,
          name: deck.name,
          ...cardsFromFile(deck.file),
          createdAt: "2026-11-02T00:00:00.000Z",
          updatedAt: "2026-11-02T00:00:00.000Z",
          importedNeedsReview: true,
          illustrationCardCode: null,
          validation: {
            status: "warnings",
            issues: [
              {
                id: "import-review:deck-all",
                code: "import-review",
                severity: "warning",
                message: "Imported deck has not been reviewed.",
              },
            ],
            rulesetRevision: "pre-gx-dataset-storage-test",
          },
        },
        emptyDeckHistory(),
      );
    }
    expect((await store.flush()).kind).toBe("ok");
    expect(parseUserDocument(persisted!).kind).toBe("ok");
    const reopened = new JsonUserDataStore(backend);
    expect((await reopened.initialize()).kind).toBe("ok");
    const reloaded = createSqliteDeckRepository(reopened);
    expect(await reloaded.list()).toHaveLength(8);
    for (const deck of manifest.decks) {
      const saved = await reloaded.load(deckId(deck.id));
      expect(saved?.deck.main).toEqual(cardsFromFile(deck.file).main);
      expect(saved?.deck.extra).toEqual(cardsFromFile(deck.file).extra);
      expect(saved?.deck.side).toEqual(cardsFromFile(deck.file).side);
    }
  });
});

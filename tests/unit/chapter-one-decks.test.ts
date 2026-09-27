import { buildStarterGrant } from "../../src/story/decks/starter-grant.ts";
import { ASSET_SOURCES } from "../../scripts/lib/asset-roots.ts";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import { parseBattleRequest } from "../../src/battle/battle-contracts.ts";
import { parseDuelDeckSelection } from "../../src/battle/duel/contracts/duel-deck-selection.ts";
import {
  parseYdk,
  uniqueDeckCodes,
} from "../../src/battle/duel/presets/deck-parser.ts";
import { DECK_SOURCES } from "../../src/battle/duel/presets/deck-sources-browser.ts";
import { loadDeckSources } from "../../src/battle/duel/presets/deck-sources-node.ts";
import { reviewedCardPool } from "../../src/battle/duel/presets/reviewed-card-pool.ts";
import { loadActiveDuelDependenciesNode } from "../../src/battle/worker/assets/active-duel-dependencies-node.ts";
import { packagedCatalog } from "../../src/decks/catalog/packaged-catalog.ts";
import type { AssetDeckCardRecord } from "../../src/decks/catalog/ocg-card-mapper.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
  validateDeckDraft,
} from "../../src/decks/validation/index.ts";
import { STARTER_DECK_LIST } from "../../src/decks/editing/index.ts";
import { reduceStory } from "../../src/story/model/story-reducer.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import { createSqliteStoryRepository } from "../../src/story/saves/index.ts";
import {
  storyUserRuntime,
  resetStorySessionFixture,
} from "../fixtures/story-session.ts";
import { storyBindingFixture } from "../fixtures/story-release.ts";

afterEach(resetStorySessionFixture);
import {
  normalizeChapterSource,
  type ChapterSourceCorrections,
  type ChapterSourceSet,
} from "../../scripts/lib/chapter-source-policy.ts";

const base = [
  97590747, 5053103, 15025844, 50930991, 13039848, 23771716, 66788016, 5318639,
  4206964, 17814387, 12607053,
].flatMap((code) => [code, code, code]);
const main = (ace: number) =>
  [...base, 70781052, 70781052, ace, ace, 51482758, 51482758, 12580477].sort(
    (a, b) => a - b,
  );
const legacyIds = [
  "mvp-player",
  "mvp-opponent",
  "burning-abyss",
  "nekroz",
  "shaddoll",
  "spellbook",
];

describe("Chapter 1 bundled prerequisites", () => {
  it("browser and Node adapters expose only two new decks, never legacy IDs or their exclusive reviewed codes", async () => {
    const sources = await loadDeckSources();
    expect([...sources.keys()]).toEqual([
      "chapter-one-starter",
      "chapter-one-practice",
    ]);
    expect(DECK_SOURCES).toEqual(sources);
    for (const id of legacyIds)
      expect((sources as ReadonlyMap<string, string>).has(id)).toBe(false);
    expect(reviewedCardPool(sources)).toEqual(
      new Set([...main(46986414), ...main(89631139)]),
    );
  });

  it.each(legacyIds)(
    "production request adapters reject legacy preset %s",
    (deckId) => {
      expect(() =>
        parseDuelDeckSelection({ kind: "preset", deckId }),
      ).toThrow();
      expect(() =>
        parseBattleRequest({
          player: { kind: "preset", deckId },
          opponent: { kind: "preset", deckId: "chapter-one-practice" },
        }),
      ).toThrow("player.deckId is not a bundled deck");
    },
  );

  it("each active deck is exact 40/0/0, source-selected, buildable and runtime-supported under current quantities", async () => {
    const bytes = await readFile("content/authoring/card-set-source.json");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "b3ac778e5f1b9927554ef8e66185a596c0c35d71ab642b448c952c6c9050496d",
    );
    const source = JSON.parse(bytes.toString("utf8")) as {
      sets: ChapterSourceSet[];
    };
    const selections = JSON.parse(
      await readFile("content/chapter-selections.json", "utf8"),
    ) as { chapters: { setNames: string[] }[] };
    const corrections = JSON.parse(
      await readFile("content/authoring/chapter-one-corrections.json", "utf8"),
    ) as ChapterSourceCorrections;
    const names = new Set(selections.chapters[0]!.setNames);
    const selected = new Set(
      normalizeChapterSource(
        source.sets.filter(({ name }) => names.has(name)),
        corrections,
      ).cardCodes,
    );
    const sources = await loadDeckSources();
    for (const { id } of DECK_CATALOG) {
      const deck = parseYdk(sources.get(id)!);
      expect([...deck.main].sort((a, b) => a - b)).toEqual(
        main(id === "chapter-one-starter" ? 46986414 : 89631139),
      );
      expect(deck.extra).toEqual([]);
      expect(deck.side).toEqual([]);
      const codes = uniqueDeckCodes(deck);
      expect([...codes].filter((code) => !selected.has(code))).toEqual([]);
      const dependencies = await loadActiveDuelDependenciesNode(
        ASSET_SOURCES.data.source,
        codes,
      );
      const shards = [
        ...new Set(
          [...codes].map((code) => (code % 64).toString(16).padStart(2, "0")),
        ),
      ];
      const records = (
        await Promise.all(
          shards.map(
            async (shard) =>
              JSON.parse(
                await readFile(
                  `${ASSET_SOURCES.data.source}/catalog/cards/${shard}.json`,
                  "utf8",
                ),
              ) as AssetDeckCardRecord[],
          ),
        )
      ).flat();
      const requested: ReadonlySet<number> = codes;
      const catalog = catalogByCode(
        packagedCatalog(
          records.filter(({ code }) => requested.has(code)),
          [...dependencies.texts.values()],
        ),
      );
      expect(
        validateDeckDraft(deck, catalog, PROTOTYPE_RULESET).issues.filter(
          ({ severity }) => severity === "error",
        ),
      ).toEqual([]);
      for (const code of codes) {
        const card = dependencies.cards.get(code)!;
        expect(card, String(code)).toBeDefined();
        // Normal monsters are implemented by the core, without per-card Lua.
        if (card.type !== 17)
          expect(
            dependencies.scripts.get(`c${code}.lua`),
            String(code),
          ).toBeTruthy();
      }
    }
  });

  it("legacy new-game and new-library starter agree; all three personas explicitly use DM practice", () => {
    expect(STARTER_DECK_LIST).toBe(DECK_SOURCES.get("chapter-one-starter"));
    const starter = parseYdk(STARTER_DECK_LIST);
    expect([...starter.main].sort((a, b) => a - b)).toEqual(main(46986414));
    const state = reduceStory(createInitialStoryState(), {
      type: "new-game",
      starterGrant: buildStarterGrant(),
    });
    expect(state.decks).toHaveLength(1);
    expect(state.decks[0]).toMatchObject({
      name: "Chapter 1 Starter",
      ...starter,
    });
    expect(state.collection).toEqual(
      Object.fromEntries(
        [...new Set(starter.main)].map((code) => [
          code,
          starter.main.filter((value) => value === code).length,
        ]),
      ),
    );
    expect(state.dp).toBe(1000);
  });

  it("current starter library, inventory and checkpoint round-trip without a grant on read", async () => {
    const initial = reduceStory(createInitialStoryState(), {
      type: "new-game",
      starterGrant: buildStarterGrant(),
    });
    const state = {
      ...initial,
      dp: 150,
      collection: { ...initial.collection, 89631139: 9 },
      pendingHandoffId: "saved-checkpoint",
    };
    const runtime = storyUserRuntime({});
    const saves = createSqliteStoryRepository(runtime);
    expect(
      await saves.write("checkpoint:pre-duel", state, 0, storyBindingFixture()),
    ).toEqual({ kind: "written", revision: 1 });
    const before = await runtime.readUser("story", "checkpoint:pre-duel");
    for (let index = 0; index < 2; index += 1)
      expect(await saves.read("checkpoint:pre-duel")).toMatchObject({
        kind: "ready",
        envelope: { schemaVersion: 6, state },
      });
    expect(await runtime.readUser("story", "checkpoint:pre-duel")).toEqual(
      before,
    );
  });
});

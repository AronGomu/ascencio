import { readFileSync } from "node:fs";
import { createCards } from "../../src/cards/index.ts";
import { PROTOTYPE_RULESET } from "../../src/decks/validation/index.ts";
import { createSqliteBattleRuntimeSource } from "../../src/shell/adapters/sqlite-battle-runtime.ts";
import { readAllCards } from "../../src/shell/adapters/sqlite-content-inputs.ts";
import { packageQueryFixture } from "./package-query.ts";

/** Real frozen engine over shared read-only normalized package queries. */
export async function packageRuntimeFixture() {
  const { content, packages, core, library, chapter, codes, close } =
    await packageQueryFixture();
  try {
    const cards = createCards(
      await readAllCards(content, new AbortController().signal),
    );
    const allowedCardCodes = new Set(chapter.normalized.cardCodes);
    const source = createSqliteBattleRuntimeSource({
      content,
      packages,
      cards,
      core,
      library,
      ruleset: {
        id: PROTOTYPE_RULESET.id,
        revisionPackageId: "chapter-01",
        limits: [...PROTOTYPE_RULESET.quantityByCode].filter(
          ([code, limit]) => codes.has(code) && limit < 3,
        ) as readonly (readonly [number, 0 | 1 | 2])[],
        allowedCardCodes,
      },
    });
    const decks = JSON.parse(
      readFileSync("assets/content/chapter-01/decks.json", "utf8"),
    ) as readonly {
      readonly id: string;
      readonly name: string;
      readonly cards: {
        readonly main: readonly number[];
        readonly extra: readonly number[];
        readonly side: readonly number[];
      };
    }[];
    const config = JSON.parse(
      readFileSync("assets/content/chapter-01/config.json", "utf8"),
    ) as {
      readonly defaults: {
        readonly starterDeckId: string;
        readonly opponentId: string;
      };
    };
    return {
      source,
      gameplay: {
        cards: cards.all().filter(({ code }) => allowedCardCodes.has(code)),
        decks: decks.map(({ id, name, cards }) => ({ id, name, ...cards })),
        defaults: config.defaults,
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

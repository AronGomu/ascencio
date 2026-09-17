import { describe, expect, it } from "vitest";
import { buildActiveCardDataManifest } from "../../../scripts/lib/active-card-data-manifest.ts";
import { buildActiveCardTextManifest } from "../../../scripts/lib/active-card-text-manifest.ts";
import { packagedCatalog } from "../../../src/decks/catalog/packaged-catalog.ts";
import { catalogByCode } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { sortDeckCards } from "../../../src/decks/deck-model.ts";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import {
  emptyDeckHistory,
  pushDeckUpdate,
  undoDeckUpdate,
  redoDeckUpdate,
} from "../../../src/decks/deck-history.ts";

// Preserve the pre-Content browser matrix, including all four Extra subtypes.
// Chapter 01's browser catalog is chapter-scoped; its cards are Fusion-only.
const input = {
  main: [12580477, 74677422, 46986414, 91152256, 53129443],
  extra: [1322368, 8505920, 8809344, 6766208],
  side: [8505920, 44095762, 89631139, 12580477],
};
const codes = new Set(Object.values(input).flat());
const catalog = catalogByCode(
  packagedCatalog(
    buildActiveCardDataManifest(process.cwd(), codes),
    buildActiveCardTextManifest(process.cwd(), codes),
  ),
);
const matrix = [
  {
    mode: "alpha",
    asc: {
      main: [91152256, 53129443, 46986414, 12580477, 74677422],
      extra: [6766208, 8505920, 8809344, 1322368],
      side: [89631139, 8505920, 44095762, 12580477],
    },
    desc: {
      main: [74677422, 12580477, 46986414, 53129443, 91152256],
      extra: [1322368, 8809344, 8505920, 6766208],
      side: [12580477, 44095762, 8505920, 89631139],
    },
  },
  {
    mode: "type",
    asc: {
      main: [91152256, 46986414, 74677422, 53129443, 12580477],
      extra: [8505920, 6766208, 8809344, 1322368],
      side: [89631139, 12580477, 44095762, 8505920],
    },
    desc: {
      main: [53129443, 12580477, 91152256, 46986414, 74677422],
      extra: [1322368, 8809344, 6766208, 8505920],
      side: [8505920, 44095762, 12580477, 89631139],
    },
  },
  {
    mode: "level",
    asc: {
      main: [91152256, 46986414, 74677422, 53129443, 12580477],
      extra: [1322368, 8809344, 6766208, 8505920],
      side: [89631139, 8505920, 12580477, 44095762],
    },
    desc: {
      main: [46986414, 74677422, 91152256, 53129443, 12580477],
      extra: [8505920, 6766208, 8809344, 1322368],
      side: [8505920, 89631139, 12580477, 44095762],
    },
  },
  {
    mode: "attribute",
    asc: {
      main: [46986414, 74677422, 91152256, 53129443, 12580477],
      extra: [8505920, 8809344, 1322368, 6766208],
      side: [8505920, 89631139, 12580477, 44095762],
    },
    desc: {
      main: [91152256, 46986414, 74677422, 53129443, 12580477],
      extra: [6766208, 8809344, 1322368, 8505920],
      side: [89631139, 8505920, 12580477, 44095762],
    },
  },
  {
    mode: "race",
    asc: {
      main: [74677422, 46986414, 91152256, 53129443, 12580477],
      extra: [6766208, 8809344, 8505920, 1322368],
      side: [89631139, 8505920, 12580477, 44095762],
    },
    desc: {
      main: [91152256, 46986414, 74677422, 53129443, 12580477],
      extra: [8505920, 1322368, 6766208, 8809344],
      side: [8505920, 89631139, 12580477, 44095762],
    },
  },
  {
    mode: "atk",
    asc: {
      main: [91152256, 74677422, 46986414, 53129443, 12580477],
      extra: [8809344, 1322368, 6766208, 8505920],
      side: [89631139, 8505920, 12580477, 44095762],
    },
    desc: {
      main: [46986414, 74677422, 91152256, 53129443, 12580477],
      extra: [8505920, 6766208, 1322368, 8809344],
      side: [8505920, 89631139, 12580477, 44095762],
    },
  },
  {
    mode: "def",
    asc: {
      main: [91152256, 74677422, 46986414, 53129443, 12580477],
      extra: [6766208, 8809344, 8505920, 1322368],
      side: [89631139, 8505920, 12580477, 44095762],
    },
    desc: {
      main: [46986414, 74677422, 91152256, 53129443, 12580477],
      extra: [8505920, 8809344, 6766208, 1322368],
      side: [8505920, 89631139, 12580477, 44095762],
    },
  },
] as const;

describe("canonical cross-era sort matrix retained from browser acceptance", () => {
  for (const entry of matrix) {
    for (const direction of ["asc", "desc"] as const) {
      it(`${entry.mode} ${direction} preserves exact three-zone order and undo/redo`, () => {
        const sorted = sortDeckCards(input, catalog, entry.mode, direction);
        expect(sorted).toEqual(entry[direction]);
        const history = pushDeckUpdate(emptyDeckHistory(), {
          deckId: deckId("canonical-sort-matrix"),
          before: input,
          after: sorted,
          reason: "sort",
        });
        const undone = undoDeckUpdate(history)!;
        expect(undone.cards).toEqual(input);
        expect(redoDeckUpdate(undone.history)!.cards).toEqual(entry[direction]);
      });
    }
  }
});

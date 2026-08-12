import { readFile } from "node:fs/promises";
import path from "node:path";
import { DECK_CATALOG } from "../../src/duel/presets/deck-catalog.ts";
import {
  parseYdk,
  uniqueDeckCodes,
} from "../../src/duel/presets/deck-parser.ts";
import {
  loadActiveDuelDependencies,
  type ActiveDuelAssetReader,
} from "../../src/worker/assets/active-duel-dependencies.ts";

export async function resolveActiveRuntimeFiles(
  projectRoot: string,
): Promise<readonly string[]> {
  const assetRoot = path.join(projectRoot, "generated/assets/current");
  const requested = new Set<string>();
  const reader: ActiveDuelAssetReader = {
    async readJson<T>(relativePath: string): Promise<T> {
      requested.add(relativePath);
      return JSON.parse(
        await readFile(
          path.join(assetRoot, ...relativePath.split("/")),
          "utf8",
        ),
      ) as T;
    },
  };
  const deckSources = await Promise.all(
    DECK_CATALOG.map(({ fileName }) =>
      readFile(
        path.join(projectRoot, "src/duel/presets/decks", fileName),
        "utf8",
      ),
    ),
  );
  const parsedDecks = deckSources.map(parseYdk);
  await loadActiveDuelDependencies(reader, uniqueDeckCodes(...parsedDecks));
  return Object.freeze([...requested].sort());
}

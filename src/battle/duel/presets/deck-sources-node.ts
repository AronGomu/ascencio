import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DECK_CATALOG, type DeckId } from "./deck-catalog.ts";

export async function loadDeckSources(): Promise<ReadonlyMap<DeckId, string>> {
  const entries = await Promise.all(
    DECK_CATALOG.map(async ({ id, fileName }) => {
      const source = await readFile(
        fileURLToPath(
          new URL(
            `../../../../assets/content/chapter-01/decks/${fileName}`,
            import.meta.url,
          ),
        ),
        "utf8",
      );
      return [id, source] as const;
    }),
  );
  return Object.freeze(new Map(entries));
}

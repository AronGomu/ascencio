/** English labels and engine type flags from the session's frozen content. */
import path from "node:path";
import { readFile } from "node:fs/promises";

export async function reviewCardMetadata(fixture: string): Promise<{
  names: Record<string, string>;
  typesByName: Record<string, number>;
}> {
  const file = path.join(fixture, "content", "card-library", "critical.json");
  try {
    const snapshot = JSON.parse(await readFile(file, "utf8"));
    const names: Record<string, string> = {},
      typesByName: Record<string, number> = {};
    for (const card of snapshot.cards as {
      definition: { code: number; type: number };
      texts: { locale: string; name: string }[];
    }[]) {
      const english = card.texts.find((text) => text.locale === "en");
      if (english) {
        names[String(card.definition.code)] = english.name;
        typesByName[english.name] = card.definition.type;
      }
    }
    return { names, typesByName };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { names: {}, typesByName: {} };
    throw error;
  }
}
export async function reviewCardNames(
  fixture: string,
): Promise<Record<string, string>> {
  return (await reviewCardMetadata(fixture)).names;
}

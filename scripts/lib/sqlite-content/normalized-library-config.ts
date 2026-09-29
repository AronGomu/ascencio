import type { ExportReceipt } from "../../../src/storage/contracts/package-build.ts";
import type { CardLibraryConfig } from "../../../src/storage/contracts/package-payloads.ts";
import { NormalizedSourceFailure } from "./normalized-package-source.ts";

/** Generated normalized config lists inventory, including scripts without catalog rows. */
export function projectNormalizedLibraryConfig(
  value: unknown,
  catalog: {
    readonly cards: readonly { readonly code: number }[];
    readonly scripts: readonly { readonly name: string }[];
  },
): {
  readonly config: CardLibraryConfig;
  readonly inventoryOnlyScripts: ExportReceipt["inventoryOnlyScripts"];
} {
  const config = value as CardLibraryConfig | null;
  const required = config?.requiredScripts;
  if (
    !required ||
    !Array.isArray(required.cards) ||
    !Array.isArray(required.globals)
  )
    throw new NormalizedSourceFailure("card-library", "config.json");
  const scripts = new Set(catalog.scripts.map(({ name }) => name));
  for (const names of [required.cards, required.globals]) {
    if (new Set(names).size !== names.length)
      throw new NormalizedSourceFailure("card-library", "config.json");
    for (const name of names)
      if (typeof name !== "string" || !scripts.has(name))
        throw new NormalizedSourceFailure(
          "card-library",
          `scripts/${String(name)}`,
        );
  }
  const codes = new Set(catalog.cards.map(({ code }) => code));
  const cards: string[] = [];
  const inventoryOnlyScripts: {
    name: string;
    reason: "missing-catalog-definition";
  }[] = [];
  for (const name of [...required.cards].sort()) {
    const match = /^c([1-9]\d*)\.lua$/.exec(name);
    if (!match)
      throw new NormalizedSourceFailure("card-library", `scripts/${name}`);
    if (codes.has(Number(match[1]))) cards.push(name);
    else
      inventoryOnlyScripts.push({ name, reason: "missing-catalog-definition" });
  }
  return {
    config: { ...config!, requiredScripts: { ...required, cards } },
    inventoryOnlyScripts,
  };
}

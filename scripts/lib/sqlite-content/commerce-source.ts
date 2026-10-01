import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  composeContent,
  ContentDiagnostic,
  type CommerceReferences,
} from "../../../src/modules/commerce/composition.ts";
import type {
  CommerceContent,
  CanonicalSet,
} from "../../../src/modules/commerce/content.ts";
import {
  exact,
  reference,
  validCanonicalSet,
  validateCommerce,
} from "../../../src/modules/commerce/validation.ts";
import { assertNoSymlinkParents } from "./asset-restructure.ts";
export interface CompiledShopSource extends CommerceContent {
  readonly sets: readonly CanonicalSet[];
}
interface ReadBudget {
  bytes: number;
}
async function read(
  root: string,
  relative: string,
  budget: ReadBudget = { bytes: 0 },
): Promise<unknown> {
  if (
    path.isAbsolute(relative) ||
    relative.includes("\\") ||
    relative.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new ContentDiagnostic("SOURCE_PATH_INVALID", relative, "");
  await assertNoSymlinkParents(root, relative);
  const file = path.join(root, relative);
  const info = await stat(file);
  budget.bytes += info.size;
  if (
    !info.isFile() ||
    info.size > 16 * 1024 * 1024 ||
    budget.bytes > 64 * 1024 * 1024
  )
    throw new ContentDiagnostic("SOURCE_SIZE_INVALID", relative, "");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new ContentDiagnostic("SOURCE_JSON_INVALID", relative, "");
  }
}
export async function readEntities(
  root: string,
  directory: string,
  budget: ReadBudget = { bytes: 0 },
): Promise<unknown[]> {
  if (
    path.isAbsolute(directory) ||
    directory.includes("\\") ||
    directory.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new ContentDiagnostic("SOURCE_PATH_INVALID", directory, "");
  await assertNoSymlinkParents(root, directory);
  const files = (await readdir(path.join(root, directory))).sort();
  if (
    files.length > 10000 ||
    files.some((f) => !f.endsWith(".json") || !reference(f.slice(0, -5)))
  )
    throw new ContentDiagnostic("SOURCE_ENTITIES_INVALID", directory, "");
  const entities = [];
  for (const file of files) {
    const entity = await read(root, `${directory}/${file}`, budget);
    if (
      typeof entity !== "object" ||
      entity === null ||
      !("id" in entity) ||
      entity.id !== file.slice(0, -5)
    )
      throw new ContentDiagnostic(
        "SOURCE_ID_INVALID",
        `${directory}/${file}`,
        "/id",
      );
    entities.push(entity);
  }
  return entities;
}
export async function loadCommerceSource(
  root: string,
  manifestPath = "content/commerce/sources.json",
  expectedVersion?: string,
  references?: CommerceReferences,
): Promise<CompiledShopSource> {
  const budget = { bytes: 0 };
  const manifest = await read(root, manifestPath, budget);
  const kinds = ["sets", "economies", "boosters", "shops"] as const;
  if (
    !exact(manifest, ["schemaVersion", "baseVersion", ...kinds, "mods"]) ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.baseVersion !== "string" ||
    !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(
      manifest.baseVersion,
    ) ||
    !manifest.baseVersion
      .split(".")
      .every((p) => Number.isSafeInteger(Number(p))) ||
    (expectedVersion !== undefined &&
      manifest.baseVersion !== expectedVersion) ||
    !Array.isArray(manifest.mods) ||
    manifest.mods.length > 256
  )
    throw new ContentDiagnostic("SOURCE_MANIFEST_INVALID", manifestPath, "");
  const base: Record<string, unknown> = { schemaVersion: 1 };
  const locations = new Map<string, string>();
  const fields = {
    sets: ["id", "name", "releaseYear", "imageAssetPath", "cards"],
    economies: ["id", "sellPrices", "singlesMultiplier", "maxPackResale"],
    boosters: ["id", "name", "setId", "replacement", "slots"],
    shops: ["id", "economyId", "offers", "singles"],
  };
  for (const kind of kinds) {
    const roots = manifest[kind];
    if (
      !Array.isArray(roots) ||
      roots.length > 256 ||
      !roots.every((v) => typeof v === "string")
    )
      throw new ContentDiagnostic(
        "SOURCE_MANIFEST_INVALID",
        manifestPath,
        `/${kind}`,
      );
    const entities = [];
    for (const directory of roots)
      for (const entity of await readEntities(root, directory, budget)) {
        const entry = entity as Record<string, unknown>;
        const file = `${directory}/${entry.id}.json`;
        const valid =
          kind === "sets"
            ? validCanonicalSet(entity)
            : validateCommerce(
                {
                  schemaVersion: 1,
                  economies: [],
                  boosters: [],
                  shops: [],
                  [kind]: [entity],
                },
                undefined,
                false,
              );
        if (!valid)
          throw new ContentDiagnostic(
            "SOURCE_ENTITY_INVALID",
            file,
            "/" +
              (Object.keys(entry).find((key) => !fields[kind].includes(key)) ??
                ""),
          );
        if (locations.has(`${kind}:${entry.id}`))
          throw new ContentDiagnostic("SOURCE_DUPLICATE_ID", file, "/id", [
            locations.get(`${kind}:${entry.id}`)!,
          ]);
        locations.set(`${kind}:${entry.id}`, file);
        entities.push(entity);
      }
    if (
      new Set(entities.map((v) => (v as { id: string }).id)).size !==
      entities.length
    )
      throw new ContentDiagnostic(
        "SOURCE_DUPLICATE_ID",
        manifestPath,
        `/${kind}`,
      );
    base[kind] = entities;
  }
  const typed = base as unknown as CompiledShopSource;
  for (const product of typed.boosters)
    if (
      !typed.sets.some((set) => set.id === product.setId) &&
      !references?.setIds.includes(product.setId)
    )
      throw new ContentDiagnostic(
        "SOURCE_REFERENCE_MISSING",
        locations.get(`boosters:${product.id}`)!,
        "/setId",
      );
  for (const shop of typed.shops) {
    if (
      ![...typed.economies, ...(references?.commerce.economies ?? [])].some(
        (e) => e.id === shop.economyId,
      )
    )
      throw new ContentDiagnostic(
        "SOURCE_REFERENCE_MISSING",
        locations.get(`shops:${shop.id}`)!,
        "/economyId",
      );
    for (const [index, offer] of shop.offers.entries())
      if (
        ![...typed.boosters, ...(references?.commerce.boosters ?? [])].some(
          (p) => p.id === offer.boosterId,
        )
      )
        throw new ContentDiagnostic(
          "SOURCE_REFERENCE_MISSING",
          locations.get(`shops:${shop.id}`)!,
          `/offers/${index}/boosterId`,
        );
  }
  const { sets, ...commerce } = base;
  if (
    !(sets as unknown[]).every(validCanonicalSet) ||
    !validateCommerce(commerce, undefined, false)
  )
    throw new ContentDiagnostic("SOURCE_CONTENT_INVALID", manifestPath, "");
  const mods = [];
  for (const mod of manifest.mods) {
    if (typeof mod !== "string")
      throw new ContentDiagnostic(
        "SOURCE_MANIFEST_INVALID",
        manifestPath,
        "/mods",
      );
    mods.push(await read(root, mod, budget));
  }
  try {
    return composeContent(
      base as unknown as CompiledShopSource,
      mods,
      manifest.baseVersion,
      references,
    );
  } catch (error) {
    if (error instanceof ContentDiagnostic) {
      const index = mods.findIndex(
        (mod) =>
          typeof mod === "object" &&
          mod !== null &&
          "id" in mod &&
          mod.id === error.source,
      );
      if (index >= 0)
        throw new ContentDiagnostic(
          error.code,
          String(manifest.mods[index]),
          error.pointer,
          error.related,
        );
    }
    throw error;
  }
}

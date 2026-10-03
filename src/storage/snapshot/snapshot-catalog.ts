import { parseCardDefinitions } from "../../cards/index.ts";
import { mergeCommerce } from "../../modules/index.ts";
import type { CardLibraryConfig } from "../contracts/package-payloads.ts";
import type {
  CriticalSnapshot,
  MediaMapping,
} from "../contracts/critical-snapshot.ts";
import type { PackageId, StorageResult } from "../contracts/package.ts";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
} from "../contracts/storage-client.ts";
import { validQuery } from "../contracts/validate-content-query.ts";

export type ResidentAssetReader = (
  packageId: PackageId,
  mapping: MediaMapping,
  signal: AbortSignal,
) => Promise<QueryMap["asset"]>;
interface Catalog {
  readonly cards: ReadonlyMap<string, QueryMap["cards"]>;
  readonly search: ReadonlyMap<
    string,
    readonly { readonly name: string; readonly code: number }[]
  >;
  readonly scripts: QueryMap["scripts"];
  readonly sets: QueryMap["sets"];
}
function buildCatalog(packs: readonly CriticalSnapshot[]): Catalog {
  const localeRows = new Map<string, Map<number, QueryMap["cards"][number]>>();
  const scripts = new Map<string, QueryMap["scripts"][number]>();
  const sets = new Map<string, QueryMap["sets"][number]>();
  for (const pack of packs) {
    for (const card of pack.cards)
      for (const text of card.texts) {
        let locale = localeRows.get(text.locale);
        if (!locale) {
          locale = new Map();
          localeRows.set(text.locale, locale);
        }
        const definition = parseCardDefinitions([
          {
            ...card.definition,
            name: text.name,
            description: text.description,
            strings: text.strings,
            images: {
              full: { code: card.definition.code, variant: "full" },
              cropped: { code: card.definition.code, variant: "cropped" },
            },
          },
        ])[0]!;
        const previous = locale.get(definition.code);
        if (previous && JSON.stringify(previous) !== JSON.stringify(definition))
          throw new Error("PACKAGE_IDENTITY_CONFLICT");
        if (!previous) locale.set(definition.code, definition);
      }
    for (const script of pack.scripts) {
      const previous = scripts.get(script.name);
      if (previous && previous.source !== script.source)
        throw new Error("PACKAGE_IDENTITY_CONFLICT");
      scripts.set(script.name, previous ?? script);
    }
    for (const set of pack.sets) {
      const semantic = Object.freeze({
        id: set.id,
        name: set.name,
        releaseYear: set.releaseYear,
        cards: set.cards,
      });
      const previous = sets.get(set.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(semantic))
        throw new Error("PACKAGE_IDENTITY_CONFLICT");
      sets.set(set.id, previous ?? semantic);
    }
  }
  const cards = new Map<string, QueryMap["cards"]>(),
    search = new Map<string, readonly { name: string; code: number }[]>();
  for (const [locale, rows] of localeRows) {
    const ordered = Object.freeze(
      [...rows.values()].sort((a, b) => a.code - b.code),
    );
    cards.set(locale, ordered);
    search.set(
      locale,
      Object.freeze(
        ordered
          .map((c) => ({ name: normalize(c.name), code: c.code }))
          .sort((a, b) => compare(a.name, b.name) || a.code - b.code),
      ),
    );
  }
  return {
    cards,
    search,
    scripts: Object.freeze(
      [...scripts.values()].sort((a, b) => compare(a.name, b.name)),
    ),
    sets: Object.freeze([...sets.values()].sort((a, b) => compare(a.id, b.id))),
  };
}
/** Built during startup; all gameplay queries reuse resident objects and indexes. */
export function createSnapshotCatalog(
  packs: readonly CriticalSnapshot[],
  assets: ResidentAssetReader,
  executable: ReadonlyMap<string, NonNullable<QueryMap["asset"]>>,
  revision?: (
    packageId: PackageId,
    mapping: MediaMapping,
    signal: AbortSignal,
  ) => Promise<string | null>,
): ContentQueries {
  const byId = new Map(
    packs.map((p) => [p.manifest.packageId, { ...p, cards: [], scripts: [] }]),
  );
  const libraries = packs
    .filter((p) => p.manifest.packageType === "card-library")
    .sort((a, b) => compare(a.manifest.packageId, b.manifest.packageId));
  const merged = buildCatalog(libraries);
  const perPack = new Map(
    libraries.map((p) => [
      p.manifest.packageId,
      libraries.length === 1 ? merged : buildCatalog([p]),
    ]),
  );
  const media = new Map(
    packs.map((p) => [
      p.manifest.packageId,
      new Map(p.media.map((m) => [m.id, m])),
    ]),
  );
  const cardOwners = new Map<number, PackageId>(),
    setOwners = new Map<string, PackageId>();
  for (const p of libraries) {
    for (const c of p.cards)
      if (!cardOwners.has(c.definition.code))
        cardOwners.set(c.definition.code, p.manifest.packageId);
    for (const s of p.sets)
      if (!setOwners.has(s.id)) setOwners.set(s.id, p.manifest.packageId);
  }
  const configs = libraries.map((p) => p.config as CardLibraryConfig);
  const libraryConfig = configs.length
    ? Object.freeze({
        ...configs[0]!,
        ...(configs.some((c) => c.commerce)
          ? {
              commerce: mergeCommerce(
                configs.flatMap((c) => (c.commerce ? [c.commerce] : [])),
              ),
            }
          : {}),
        locales: [...new Set(configs.flatMap((c) => c.locales))],
        requiredScripts: {
          cards: [
            ...new Set(configs.flatMap((c) => c.requiredScripts.cards)),
          ].sort(),
          globals: [
            ...new Set(configs.flatMap((c) => c.requiredScripts.globals)),
          ].sort(),
        },
      })
    : null;
  async function asset(
    packageId: PackageId,
    logical: string,
    signal: AbortSignal,
  ): Promise<QueryMap["asset"]> {
    const retained = executable.get(`${packageId}:${logical}`);
    if (retained) return retained;
    const mapping = media.get(packageId)?.get(logical);
    return mapping ? assets(packageId, mapping, signal) : null;
  }
  return {
    ...(revision
      ? ({
          async mediaRevision(request, signal) {
            signal.throwIfAborted();
            let owner: PackageId | undefined;
            let logical: string | undefined;
            if (request.kind === "asset") {
              const match = /^cards\/(?:full|cropped)\/([0-9]+)\.jpg$/.exec(
                request.path,
              );
              owner =
                request.packageId === "card-library" && match
                  ? (cardOwners.get(Number(match[1])) ?? request.packageId)
                  : request.packageId;
              logical = request.path;
            } else {
              owner = setOwners.get(request.setId);
              logical = owner
                ? (byId.get(owner)?.sets.find((s) => s.id === request.setId)
                    ?.imageAssetPath ?? undefined)
                : undefined;
            }
            const mapping =
              owner && logical ? media.get(owner)?.get(logical) : undefined;
            return owner && mapping ? revision(owner, mapping, signal) : null;
          },
        } satisfies Pick<ContentQueries, "mediaRevision">)
      : {}),
    async query<Q extends ContentQuery>(
      request: Q,
      signal: AbortSignal,
    ): Promise<StorageResult<QueryMap[Q["kind"]]>> {
      if (signal.aborted) return failure("OPERATION_CANCELLED");
      if (!validQuery(request)) return failure("RPC_INVALID");
      const module = request.kind === "module-query" ? request.packageId : null;
      const q = request.kind === "module-query" ? request.query : request;
      const catalog = module ? perPack.get(module) : merged;
      const packageId =
        module ?? ("packageId" in q ? q.packageId : "card-library");
      const pack = byId.get(packageId);
      if (!pack || !catalog) return failure("PACKAGE_NOT_FOUND");
      let value: unknown;
      switch (q.kind) {
        case "cards": {
          const cards = catalog.cards.get(q.locale) ?? [];
          const start = lowerBound(cards, (c) => c.code <= q.afterCode);
          value = cards.slice(start, start + q.limit);
          break;
        }
        case "card-search": {
          const index = catalog.search.get(q.locale) ?? [],
            prefix = normalize(q.prefix);
          const start = lowerBound(index, (entry) => entry.name < prefix);
          const result = [];
          for (
            let i = start;
            i < index.length && result.length < q.limit;
            i++
          ) {
            const entry = index[i]!;
            if (!entry.name.startsWith(prefix)) break;
            result.push(entry.code);
          }
          value = result;
          break;
        }
        case "scripts": {
          const start = lowerBound(
            catalog.scripts,
            (s) => s.name <= q.afterName,
          );
          value = catalog.scripts.slice(start, start + q.limit);
          break;
        }
        case "sets":
          value = catalog.sets;
          break;
        case "config":
          value =
            q.packageId === "card-library" && !module
              ? libraryConfig
              : pack.config;
          break;
        case "decks":
          value = pack.decks;
          break;
        case "opponents":
          value = pack.opponents;
          break;
        case "limits":
          value = pack.limits;
          break;
        case "story":
          value = pack.stories.find((s) => s.contentId === q.contentId) ?? null;
          break;
        case "asset": {
          const match = /^cards\/(?:full|cropped)\/([1-9][0-9]*)\.jpg$/.exec(
            q.path,
          );
          const owner =
            q.packageId === "card-library" && match
              ? (cardOwners.get(Number(match[1])) ?? q.packageId)
              : q.packageId;
          value = await asset(owner, q.path, signal);
          break;
        }
        case "set-image": {
          const owner = module ?? setOwners.get(q.setId);
          const set = owner
            ? byId.get(owner)?.sets.find((s) => s.id === q.setId)
            : undefined;
          value =
            owner && set?.imageAssetPath
              ? await asset(owner, set.imageAssetPath, signal)
              : null;
          break;
        }
      }
      return signal.aborted
        ? failure("OPERATION_CANCELLED")
        : { kind: "ok", value: value as QueryMap[Q["kind"]] };
    },
  };
}
function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function lowerBound<T>(
  rows: readonly T[],
  before: (row: T) => boolean,
): number {
  let low = 0,
    high = rows.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (before(rows[mid]!)) low = mid + 1;
    else high = mid;
  }
  return low;
}
function failure<T>(
  code: "OPERATION_CANCELLED" | "RPC_INVALID" | "PACKAGE_NOT_FOUND",
): StorageResult<T> {
  return { kind: "failed", error: { code } };
}

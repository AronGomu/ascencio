import { validQuery } from "../runtime/content-query-runtime.ts";
import type { CardDefinition } from "../../cards/index.ts";
import type {
  ContentQueries,
  ContentQuery,
  PackageStack,
  QueryMap,
} from "../contracts/storage-client.ts";
import type { StorageResult } from "../contracts/package.ts";
import type { CardLibraryConfig } from "../contracts/package-payloads.ts";

type CatalogQuery = Extract<
  ContentQuery,
  { kind: "cards" | "scripts" | "sets" | "set-image" }
>;

/** One validated catalog snapshot in memory; metadata queries never materialize image bytes. */
export function createModuleCatalogQueries(
  raw: ContentQueries,
  current: () => Promise<StorageResult<PackageStack>>,
): ContentQueries {
  let generation = -1;
  const snapshots = new Map<string, Promise<unknown>>();
  const cardOwners = new Map<number, string>();
  const setOwners = new Map<string, string>();
  async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!snapshots.has(key)) snapshots.set(key, load());
    const pending = snapshots.get(key);
    try {
      return (await pending) as T;
    } catch (error) {
      if (snapshots.get(key) === pending) snapshots.delete(key);
      throw error;
    }
  }
  return {
    async query<Q extends ContentQuery>(
      request: Q,
      signal: AbortSignal,
    ): Promise<StorageResult<QueryMap[Q["kind"]]>> {
      if (!validQuery(request))
        return { kind: "failed", error: { code: "RPC_INVALID" } };
      if (signal.aborted)
        return { kind: "failed", error: { code: "OPERATION_CANCELLED" } };
      if (
        ![
          "cards",
          "card-search",
          "scripts",
          "sets",
          "set-image",
          "asset",
          "config",
        ].includes(request.kind)
      )
        return raw.query(request, signal);
      const state = await current();
      if (state.kind === "failed") return state;
      const expectedGeneration = state.value.generation;
      const libraries = state.value.packages
        .filter((item) => item.packageType === "card-library")
        .sort((a, b) => a.packageId.localeCompare(b.packageId));
      if (libraries.length <= 1) return raw.query(request, signal);
      if (generation !== state.value.generation) {
        generation = state.value.generation;
        snapshots.clear();
        cardOwners.clear();
        setOwners.clear();
      }
      const read = async <K extends CatalogQuery["kind"]>(
        packageId: string,
        query: Extract<CatalogQuery, { kind: K }>,
      ): Promise<QueryMap[K]> => {
        const result = await raw.query(
          {
            kind: "module-query",
            packageId: packageId as `card-pack-${string}`,
            query,
          },
          signal,
        );
        if (result.kind === "failed") throw new Error(result.error.code);
        return result.value as QueryMap[K];
      };
      const cards = () =>
        cached<readonly CardDefinition[]>(
          `cards:${"locale" in request ? request.locale : "en"}`,
          async () => {
            const merged = new Map<number, CardDefinition>();
            for (const library of libraries) {
              let afterCode = 0;
              while (true) {
                const page = await read(library.packageId, {
                  kind: "cards",
                  locale: "locale" in request ? request.locale : "en",
                  afterCode,
                  limit: 500,
                });
                for (const card of page) {
                  const previous = merged.get(card.code);
                  if (
                    previous &&
                    JSON.stringify(previous) !== JSON.stringify(card)
                  )
                    throw new Error("PACKAGE_IDENTITY_CONFLICT");
                  if (!previous) {
                    merged.set(card.code, card);
                    if (generation === expectedGeneration)
                      cardOwners.set(card.code, library.packageId);
                  }
                }
                if (page.length < 500) break;
                const last = page.at(-1)!.code;
                if (last <= afterCode) throw new Error("PACKAGE_INVALID");
                afterCode = last;
              }
            }
            return [...merged.values()].sort((a, b) => a.code - b.code);
          },
        );
      try {
        let value: unknown;
        switch (request.kind) {
          case "cards":
            value = (await cards())
              .filter((card) => card.code > request.afterCode)
              .slice(0, request.limit);
            break;
          case "card-search": {
            const normalize = (text: string) =>
              text.normalize("NFKC").toLocaleLowerCase("en-US");
            const prefix = normalize(request.prefix);
            const index = await cached(`search:${request.locale}`, async () =>
              (await cards())
                .map((card) => ({
                  code: card.code,
                  name: normalize(card.name),
                }))
                .sort((a, b) =>
                  a.name < b.name ? -1 : a.name > b.name ? 1 : a.code - b.code,
                ),
            );
            let low = 0;
            let high = index.length;
            while (low < high) {
              const middle = Math.floor((low + high) / 2);
              if (index[middle]!.name < prefix) low = middle + 1;
              else high = middle;
            }
            const matches: number[] = [];
            for (
              let i = low;
              i < index.length && matches.length < request.limit;
              i++
            ) {
              if (!index[i]!.name.startsWith(prefix)) break;
              matches.push(index[i]!.code);
            }
            value = matches;
            break;
          }
          case "scripts": {
            const scripts = await cached<QueryMap["scripts"]>(
              "scripts",
              async () => {
                const merged = new Map<string, string>();
                for (const library of libraries) {
                  let afterName = "";
                  while (true) {
                    const page = await read(library.packageId, {
                      kind: "scripts",
                      afterName,
                      limit: 500,
                    });
                    for (const script of page) {
                      if (
                        merged.has(script.name) &&
                        merged.get(script.name) !== script.source
                      )
                        throw new Error("PACKAGE_IDENTITY_CONFLICT");
                      merged.set(script.name, script.source);
                    }
                    if (page.length < 500) break;
                    const last = page.at(-1)!.name;
                    if (last <= afterName) throw new Error("PACKAGE_INVALID");
                    afterName = last;
                  }
                }
                return [...merged]
                  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                  .map(([name, source]) => ({ name, source }));
              },
            );
            value = scripts
              .filter((script) => script.name > request.afterName)
              .slice(0, request.limit);
            break;
          }
          case "sets": {
            value = await cached<QueryMap["sets"]>("sets", async () => {
              const merged = new Map<string, QueryMap["sets"][number]>();
              for (const library of libraries)
                for (const set of await read(library.packageId, {
                  kind: "sets",
                  packageId: "card-library",
                })) {
                  if (
                    merged.has(set.id) &&
                    JSON.stringify(merged.get(set.id)) !== JSON.stringify(set)
                  )
                    throw new Error("PACKAGE_IDENTITY_CONFLICT");
                  if (!merged.has(set.id)) {
                    merged.set(set.id, set);
                    if (generation === expectedGeneration)
                      setOwners.set(set.id, library.packageId);
                  }
                }
              return [...merged.values()].sort((a, b) =>
                a.id.localeCompare(b.id),
              );
            });
            break;
          }
          case "set-image": {
            if (!setOwners.has(request.setId)) {
              const loaded = await this.query(
                { kind: "sets", packageId: "card-library" },
                signal,
              );
              if (loaded.kind === "failed") return loaded;
            }
            const owner = setOwners.get(request.setId);
            if (!owner) return raw.query(request, signal);
            value = await read(owner, request);
            break;
          }
          case "asset": {
            if (
              request.packageId === "card-library" &&
              request.path.startsWith("cards/")
            )
              await cards();
            const match = /^cards\/(?:full|cropped)\/(\d+)\.jpg$/.exec(
              request.path,
            );
            const owner =
              request.packageId === "card-library" && match
                ? cardOwners.get(Number(match[1]))
                : undefined;
            return raw.query(
              owner
                ? { ...request, packageId: owner as `card-pack-${string}` }
                : request,
              signal,
            ) as Promise<StorageResult<QueryMap[Q["kind"]]>>;
          }
          case "config": {
            if (request.packageId !== "card-library")
              return raw.query(request, signal);
            value = await cached<CardLibraryConfig>(
              "library-config",
              async () => {
                const configs: CardLibraryConfig[] = [];
                for (const library of libraries) {
                  const config = await raw.query(
                    { kind: "config", packageId: library.packageId },
                    signal,
                  );
                  if (config.kind === "failed")
                    throw new Error(config.error.code);
                  configs.push(config.value as CardLibraryConfig);
                }
                const base = configs[0]!;
                return {
                  ...base,
                  locales: [
                    ...new Set(configs.flatMap((config) => config.locales)),
                  ],
                  requiredScripts: {
                    cards: [
                      ...new Set(
                        configs.flatMap(
                          (config) => config.requiredScripts.cards,
                        ),
                      ),
                    ].sort(),
                    globals: [
                      ...new Set(
                        configs.flatMap(
                          (config) => config.requiredScripts.globals,
                        ),
                      ),
                    ].sort(),
                  },
                };
              },
            );
            break;
          }
          default:
            return raw.query(request, signal);
        }
        if (generation !== expectedGeneration)
          return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
        if (signal.aborted)
          return { kind: "failed", error: { code: "OPERATION_CANCELLED" } };
        return { kind: "ok", value: value as QueryMap[Q["kind"]] };
      } catch (error) {
        return {
          kind: "failed",
          error: {
            code: signal.aborted
              ? "OPERATION_CANCELLED"
              : error instanceof Error &&
                  error.message === "PACKAGE_IDENTITY_CONFLICT"
                ? "PACKAGE_IDENTITY_CONFLICT"
                : "PACKAGE_INVALID",
          },
        };
      }
    },
  };
}

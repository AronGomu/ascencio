import { SqliteImageLeasePool } from "../adapters/sqlite-image-source.ts";
import { createCards } from "../../cards/index.ts";
import {
  prepareBattleRuntime,
  type BattleRuntimeSource,
} from "../../battle/ports/index.ts";
import {
  buildDeckCatalogIndex,
  filterDeckCatalogIndex,
  EMPTY_DECK_CATALOG_QUERY,
} from "../../decks/catalog/index.ts";
import { nativeIoTrace } from "../../storage/index.ts";
import type { LocalStorageClient } from "../../storage/index.ts";
import type { ShellUserServices } from "../core/user-services.ts";
import { loadFreeplayInputs } from "../adapters/sqlite-freeplay-inputs.ts";
import {
  loadStoryInputs,
  type LoadedStoryInputs,
} from "../adapters/sqlite-story-inputs.ts";
import { readAllCards } from "../adapters/sqlite-content-inputs.ts";

async function retainedRuntime(
  source: BattleRuntimeSource,
  signal: AbortSignal,
): Promise<BattleRuntimeSource> {
  const input = await source.load(signal);
  return Object.freeze({
    async load(loadSignal: AbortSignal) {
      loadSignal.throwIfAborted();
      return Object.freeze({ ...input, wasmBinary: input.wasmBinary.slice(0) });
    },
  });
}
/** Root ownership, including every installed chapter. Domain sessions borrow these references. */
export async function prepareApplicationInputs(
  storage: LocalStorageClient,
  users: ShellUserServices,
  signal: AbortSignal,
  progress: (completed: number, total: number) => void = () => {},
) {
  const current = await storage.packages.current();
  if (current.kind === "failed") throw new Error(current.error.code);
  const chapters = current.value.packages.filter(
    (pack) => pack.packageType === "chapter",
  );
  const total = chapters.length + 6;
  let completed = 0;
  progress(completed, total);
  const advance = () => progress(++completed, total);
  const cards = createCards(await readAllCards(storage.content, signal));
  advance();
  const images = new SqliteImageLeasePool(storage.content);
  let freeplay: Awaited<ReturnType<typeof loadFreeplayInputs>> | undefined;
  const stories = new Map<`chapter-${string}`, LoadedStoryInputs>();
  try {
    freeplay = await loadFreeplayInputs(storage, users, signal, cards, images);
    advance();
    for (const pack of chapters) {
      signal.throwIfAborted();
      const chapter = pack.packageId as `chapter-${string}`;
      const inputs = await loadStoryInputs(
        storage,
        users,
        chapter,
        signal,
        cards,
        images,
      );
      stories.set(chapter, inputs);
      const battle = await retainedRuntime(inputs.gameplay.battle, signal);
      stories.set(
        chapter,
        Object.freeze({
          ...inputs,
          gameplay: Object.freeze({ ...inputs.gameplay, battle }),
        }),
      );
      advance();
    }
    const searchIndex = buildDeckCatalogIndex(freeplay.presentation.cards);
    filterDeckCatalogIndex(searchIndex, EMPTY_DECK_CATALOG_QUERY, () => true);
    for (const input of stories.values())
      filterDeckCatalogIndex(
        buildDeckCatalogIndex(input.gameplay.presentation.cards),
        EMPTY_DECK_CATALOG_QUERY,
        () => true,
      );
    advance();
    const searchBenchmark = () => {
      const samples: number[] = [];
      for (let i = 0; i < 30; i++) {
        const started = performance.now();
        filterDeckCatalogIndex(
          searchIndex,
          {
            ...EMPTY_DECK_CATALOG_QUERY,
            name: ["dragon", "the", "elemental", "zz-missing", ""][i % 5]!,
          },
          () => true,
        );
        samples.push(performance.now() - started);
      }
      return samples;
    };
    const battle = await retainedRuntime(freeplay.battle, signal);
    advance();
    const preparedFreeplay = Object.freeze({ ...freeplay, battle });
    await Promise.all([
      import("../../battle/index.ts"),
      import("../../deck-editor/index.ts"),
      import("../../story/index.ts"),
    ]);
    advance();
    await prepareBattleRuntime(battle, signal);
    advance();
    if (nativeIoTrace.enabled)
      Object.defineProperty(globalThis, "__ASCENCIO_SEARCH_BENCHMARK__", {
        value: searchBenchmark,
        configurable: true,
      });
    return Object.freeze({
      requirements: [
        "domain-projections",
        "engine-preparation",
        "screen-modules",
      ] as const,
      freeplay: preparedFreeplay,
      stories,
      close() {
        if (
          Reflect.get(globalThis, "__ASCENCIO_SEARCH_BENCHMARK__") ===
          searchBenchmark
        )
          Reflect.deleteProperty(globalThis, "__ASCENCIO_SEARCH_BENCHMARK__");
        images.close();
        preparedFreeplay.close();
        for (const input of stories.values()) input.close();
        stories.clear();
      },
    });
  } catch (error) {
    images.close();
    freeplay?.close();
    for (const input of stories.values()) input.close();
    throw error;
  }
}

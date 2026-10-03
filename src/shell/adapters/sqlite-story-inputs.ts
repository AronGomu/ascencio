import { isChapterModule, type CommerceContent } from "../../modules/index.ts";
import {
  createCards,
  type CardDefinition,
  type Cards,
} from "../../cards/index.ts";
import { OCG_TYPE, hasOcgType } from "../../cards/classification/index.ts";
import { cardsDeckCatalog } from "../../decks/catalog/index.ts";
import { cloneCardLists } from "../../decks/contracts/index.ts";
import {
  validatePublishedDecks,
  type PinnedDeckRuleset,
} from "../../decks/validation/index.ts";
import type {
  ActivePackage,
  ChapterConfig,
  LocalStorageClient,
  QueryMap,
  StorageFailure,
} from "../../storage/index.ts";
import {
  parseStoryRelease,
  type StoryRelease,
  type StorySet,
} from "../../story/ports/index.ts";
import { createSqliteStoryRepository } from "../../story/saves/index.ts";
import type { StoryInputs } from "../core/shell-application.ts";
import type { ShellGameplay } from "../core/installed-inputs.ts";
import type { ShellUserServices } from "../core/user-services.ts";
import { packageReadiness } from "./package-readiness.ts";
import {
  createSqliteBattleRuntimeSource,
  runtimeSnapshotId,
} from "./sqlite-battle-runtime.ts";
import {
  isCardLibraryConfig,
  isDuelCoreConfig,
  query,
  readAllCards,
  readConfig,
} from "./sqlite-content-inputs.ts";
import {
  createSqliteCardImageSource,
  SqliteImageLeasePool,
} from "./sqlite-image-source.ts";
import {
  createSqliteStoryMedia,
  loadSqliteStoryImageLibrary,
} from "./sqlite-story-media.ts";

export interface LoadedStoryInputs extends StoryInputs {
  close(): void;
}

export function chapterDeckLimit(
  rows: ReadonlyMap<number, 0 | 1 | 2>,
  code: number,
): 0 | 1 | 2 | 3 {
  return rows.get(code) ?? 3;
}

export function closeStoryInputs(inputs: StoryInputs): void {
  const close = (inputs as Partial<LoadedStoryInputs>).close;
  if (typeof close === "function") close();
}

export async function loadStoryInputs(
  storage: LocalStorageClient,
  users: ShellUserServices,
  chapterId: `chapter-${string}`,
  signal: AbortSignal,
  residentCards?: Cards,
  sharedImages?: SqliteImageLeasePool,
): Promise<LoadedStoryInputs> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const current = await storage.packages.current();
    if (current.kind === "failed") throw storageError(current.error);
    if (chapterId === "chapter-01" && !packageReadiness(current.value).newGame)
      throw new Error("APP_REQUIRED_INPUT_FAILED");
    const chapterIdentity = packageById(current.value.packages, chapterId);
    if (chapterIdentity.packageType !== "chapter")
      throw new Error("APP_REQUIRED_INPUT_FAILED");

    const [
      core,
      library,
      chapter,
      definitions,
      decks,
      opponents,
      limits,
      sets,
    ] = await Promise.all([
      readConfig(
        storage.content,
        "duel-core",
        isDuelCoreConfig,
        controller.signal,
      ),
      readConfig(
        storage.content,
        "card-library",
        isCardLibraryConfig,
        controller.signal,
      ),
      readConfig(
        storage.content,
        chapterId,
        isChapterConfig,
        controller.signal,
      ),
      residentCards
        ? Promise.resolve(residentCards.all())
        : readAllCards(storage.content, controller.signal),
      query(
        storage.content,
        { kind: "decks", packageId: chapterId },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "opponents", packageId: chapterId },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "limits", packageId: chapterId },
        controller.signal,
      ),
      query(
        storage.content,
        { kind: "sets", packageId: "card-library" },
        controller.signal,
      ),
    ]);
    const document =
      chapter.storyContentId === null
        ? null
        : await query(
            storage.content,
            {
              kind: "story",
              packageId: chapterId,
              contentId: chapter.storyContentId,
            },
            controller.signal,
          );
    throwIfAborted(controller.signal);

    const cards = residentCards ?? createCards(definitions);
    const limitMap = new Map(limits);
    const allowedCardCodes = new Set(
      definitions
        .filter(
          (card) =>
            chapterDeckLimit(limitMap, card.code) !== 0 && supportedCard(card),
        )
        .map(({ code }) => code),
    );
    const ruleset: PinnedDeckRuleset = Object.freeze({
      id: chapterId,
      revision: `${chapterIdentity.version}:${chapterIdentity.sha256}`,
      quantityByCode: limitMap,
    });
    validatePublishedDecks(decks, cards, ruleset);
    validateChapterReferences(chapter, decks, opponents, document);
    const selectedSets = selectDatedSets(chapter, sets);
    const release = buildRelease(
      current.value.generation,
      chapterId,
      chapter,
      document,
      allowedCardCodes,
      selectedSets,
      decks,
      opponents,
      library.commerce,
    );

    const pool = sharedImages ?? new SqliteImageLeasePool(storage.content);
    const images = createSqliteCardImageSource(
      storage.content,
      pool,
      sharedImages === undefined,
    );
    const media = createSqliteStoryMedia(
      pool,
      chapterId,
      chapter.mapAssetPath,
      new Set(selectedSets.map(({ id }) => id)),
    );
    try {
      const snapshotId = runtimeSnapshotId(current.value.packages, chapterId);
      const libraryIdentity = packageById(
        current.value.packages,
        "card-library",
      );
      const presentationDecks = Object.freeze(
        decks.map(({ id, name, main, extra, side }) =>
          Object.freeze({
            id,
            name,
            ...cloneCardLists({ main, extra, side }),
          }),
        ),
      );
      const presentationOpponents = Object.freeze(
        opponents.map(({ id, name, line, deckId }) =>
          Object.freeze({ id, name, line, deckId }),
        ),
      );
      const defaults = Object.freeze({ ...chapter.defaults });
      const presentation = Object.freeze({
        snapshotId,
        catalogRevision: `${libraryIdentity.version}:${libraryIdentity.sha256}`,
        cards: cardsDeckCatalog(cards),
        decks: presentationDecks,
        opponents: presentationOpponents,
        defaults,
      });
      const starter = decks.find(
        ({ id }) => id === chapter.defaults.starterDeckId,
      )!;
      const editor = Object.freeze({
        ruleset,
        cards,
        images,
        starter: Object.freeze({
          name: starter.name,
          cards: cloneCardLists(starter),
        }),
      });
      const battle = createSqliteBattleRuntimeSource({
        content: storage.content,
        packages: current.value.packages,
        cards,
        core,
        library,
        ruleset: {
          id: chapterId,
          revisionPackageId: chapterId,
          limits,
          allowedCardCodes,
        },
      });
      const gameplay: ShellGameplay = Object.freeze({
        identity: `${snapshotId}:${current.value.generation}`,
        chapterIds: Object.freeze([chapterId]),
        presentation,
        cards,
        sets: selectedSets,
        decks: presentationDecks,
        opponents: Object.freeze(
          opponents.map(({ id, name, line, deckId, policyId }) =>
            Object.freeze({ id, name, line, deckId, policyId }),
          ),
        ),
        defaults,
        battle,
        editor: (source = images) =>
          source === images
            ? editor
            : Object.freeze({ ...editor, images: source }),
        images: (imageSignal = new AbortController().signal) =>
          loadSqliteStoryImageLibrary(selectedSets, media, imageSignal),
        cardImages: async () => images,
      });
      let closed = false;
      const loaded: LoadedStoryInputs = Object.freeze({
        users,
        gameplay,
        cards,
        release,
        media,
        saves: createSqliteStoryRepository(
          storage.userData,
          storage.composition,
        ),
        close() {
          if (closed) return;
          closed = true;
          if (sharedImages === undefined) pool.close();
        },
      });
      throwIfAborted(controller.signal);
      return loaded;
    } catch (error) {
      if (sharedImages === undefined) pool.close();
      throw error;
    }
  } catch (error) {
    controller.abort();
    throwIfAborted(signal);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function buildRelease(
  generation: number,
  chapterId: `chapter-${string}`,
  config: ChapterConfig,
  document: QueryMap["story"],
  allowedCardCodes: ReadonlySet<number>,
  sets: readonly StorySet[],
  decks: QueryMap["decks"],
  opponents: QueryMap["opponents"],
  commerce?: CommerceContent,
): StoryRelease {
  return parseStoryRelease({
    revision: generation,
    chapters: [
      {
        id: chapterId,
        ...(config.module === undefined ? {} : { module: config.module }),
        document,
        ...(config.shopId === undefined
          ? {}
          : { shopId: config.shopId, commerce }),
        cardCodes: [...allowedCardCodes].sort((left, right) => left - right),
        sets,
        decks,
        opponents,
        defaults: config.defaults,
      },
    ],
  });
}

function selectDatedSets(
  config: ChapterConfig,
  sets: QueryMap["sets"],
): readonly StorySet[] {
  const byId = new Map(sets.map((set) => [set.id, set]));
  return Object.freeze(
    config.setIds.map((setId) => {
      const set = byId.get(setId);
      if (
        set === undefined ||
        !Number.isSafeInteger(set.releaseYear) ||
        Number(set.releaseYear) < 1 ||
        Number(set.releaseYear) > 9999
      )
        throw new Error("STORY_RELEASE_INVALID");
      return Object.freeze({
        ...set,
        releaseYear: set.releaseYear,
      }) as StorySet;
    }),
  );
}

function validateChapterReferences(
  config: ChapterConfig,
  decks: QueryMap["decks"],
  opponents: QueryMap["opponents"],
  document: QueryMap["story"],
): void {
  const deckIds = new Set(decks.map(({ id }) => id));
  const opponentIds = new Set(opponents.map(({ id }) => id));
  if (
    !deckIds.has(config.defaults.starterDeckId) ||
    !opponentIds.has(config.defaults.opponentId) ||
    opponents.some(({ deckId }) => !deckIds.has(deckId)) ||
    (config.storyContentId === null) !== (document === null) ||
    (document !== null && document.contentId !== config.storyContentId)
  )
    throw new Error("STORY_RELEASE_INVALID");
}

function supportedCard(card: CardDefinition): boolean {
  return !hasOcgType(card.type, OCG_TYPE.TOKEN) && (card.scope & 8) === 0;
}

function isChapterConfig(value: QueryMap["config"]): value is ChapterConfig {
  const record = object(value);
  const defaults = object(record.defaults);
  return (
    typeof record.title === "string" &&
    record.title.length > 0 &&
    Number.isSafeInteger(record.chapterNumber) &&
    Number(record.chapterNumber) > 0 &&
    (record.storyContentId === null ||
      (typeof record.storyContentId === "string" &&
        record.storyContentId.length > 0 &&
        record.storyContentId.length <= 256)) &&
    (record.module === undefined || isChapterModule(record.module)) &&
    typeof defaults.starterDeckId === "string" &&
    defaults.starterDeckId.length > 0 &&
    typeof defaults.opponentId === "string" &&
    defaults.opponentId.length > 0 &&
    Array.isArray(record.setIds) &&
    record.setIds.every(
      (setId) => typeof setId === "string" && setId.length > 0,
    ) &&
    new Set(record.setIds).size === record.setIds.length &&
    (record.mapAssetPath === null ||
      (typeof record.mapAssetPath === "string" &&
        record.mapAssetPath.length > 0))
  );
}

function packageById(
  packages: readonly ActivePackage[],
  packageId: ActivePackage["packageId"],
): ActivePackage {
  const matches = packages.filter((active) => active.packageId === packageId);
  if (matches.length !== 1) throw new Error("APP_REQUIRED_INPUT_FAILED");
  return matches[0]!;
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storageError(error: StorageFailure): Error {
  if (error.code === "OPERATION_CANCELLED") return abortError();
  return new Error(error.code, { cause: error });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

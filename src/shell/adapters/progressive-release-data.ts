import {
  parseChapterGameplay,
  parseChapterStoryDocument,
  type ChapterCard,
  type ChapterFileRef,
  type ChapterGameplay,
  type ContentReader,
  type ProgressiveManifest,
  type ReleaseFile,
  type StagedContent,
} from "../../content/index.ts";
import {
  cardCode,
  createCards,
  type CardDefinition,
  type Cards,
} from "../../cards/index.ts";
import { PROTOTYPE_RULESET } from "../../decks/validation/index.ts";
import {
  parseStoryRelease,
  type StoryRelease,
} from "../../story/ports/index.ts";
import {
  parseBattleRuntimeInput,
  validateFrozenBattleExecutable,
  type BattleRuntimeCard,
  type BattleRuntimeInput,
  type BattleRuntimeSource,
} from "../../battle/ports/index.ts";

interface RuntimeManifest {
  readonly snapshotId: string;
  readonly engine: { readonly coreVersion: readonly [number, number] };
  readonly assets: {
    readonly babelCdbRevision: string;
    readonly cardScriptsRevision: string;
    readonly files: readonly { readonly path: string }[];
  };
}

interface RuntimeScriptIndex {
  readonly official: readonly string[];
  readonly preRelease: readonly string[];
  readonly globals: readonly string[];
  readonly shardCount: number;
}

export interface ProgressiveReleaseData {
  readonly manifest: ProgressiveManifest;
  readonly required: ReadonlyMap<string, Uint8Array>;
  readonly chapterCards: readonly CardDefinition[];
  readonly runtimeCards: readonly CardDefinition[];
  readonly cards: Cards;
  readonly story: StoryRelease;
  readonly battle: BattleRuntimeSource;
  readonly imageRefs: ReadonlyMap<string, ChapterFileRef>;
  readonly mapRefs: ReadonlyMap<string, ChapterFileRef>;
  readonly setImageRefs: ReadonlyMap<string, ChapterFileRef>;
}

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export async function readProgressiveReleaseData(
  reader: ContentReader,
  staged: StagedContent,
  signal: AbortSignal,
): Promise<ProgressiveReleaseData> {
  signal.throwIfAborted();
  await reader.verifyRequired(staged, signal);
  const manifest = await reader.readManifest(staged.manifestVersion);
  if (
    manifest.releaseSequence !== staged.releaseSequence ||
    JSON.stringify(staged.chapterIds) !==
      JSON.stringify(
        [...staged.chapterIds].sort((left, right) => compare(left, right)),
      ) ||
    staged.chapterIds.some(
      (id) => !manifest.chapters.some((chapter) => chapter.id === id),
    )
  )
    invalid();
  const selected = new Set<string>(["runtime", ...staged.chapterIds]);
  const requiredFiles = manifest.files.filter(
    (file) =>
      file.required && file.packIds.some((packId) => selected.has(packId)),
  );
  if (
    requiredFiles.some(
      (file) =>
        (file.role === "gameplay" || file.role === "story") &&
        (file.mediaType !== "application/json" || file.bytes > 4194304),
    )
  )
    invalid();
  const required = new Map<string, Uint8Array>();
  await Promise.all(
    requiredFiles.map(async (file) => {
      const bytes = await reader.readFile(
        staged.manifestVersion,
        file.path,
        signal,
      );
      if (bytes === null || bytes.byteLength !== file.bytes) invalid();
      required.set(file.path, bytes.slice());
    }),
  );
  signal.throwIfAborted();

  const games: ChapterGameplay[] = [];
  const documents = new Map<
    string,
    StoryRelease["chapters"][number]["document"]
  >();
  const imageRefs = new Map<string, ChapterFileRef>();
  const mapRefs = new Map<string, ChapterFileRef>();
  const setImageRefs = new Map<string, ChapterFileRef>();
  const originalCards = new Map<number, ChapterCard>();

  for (const id of staged.chapterIds) {
    const chapter =
      manifest.chapters.find((value) => value.id === id) ?? invalid();
    const parsed = parseChapterGameplay(json(required, chapter.gameplayPath));
    if (parsed.kind !== "ok" || parsed.value.chapterId !== id) invalid();
    const game = parsed.value;
    games.push(game);
    for (const card of game.cards) {
      const previous = originalCards.get(card.code);
      if (previous !== undefined && !same(previous, card)) invalid();
      originalCards.set(card.code, card);
      validateMediaRef(manifest, selected, card.fullImage, "image/");
      validateMediaRef(manifest, selected, card.croppedImage, "image/");
      imageRefs.set(`${card.code}:full`, card.fullImage);
      imageRefs.set(`${card.code}:cropped`, card.croppedImage);
    }
    for (const set of game.sets) {
      if (set.image !== null) {
        validateMediaRef(manifest, selected, set.image, "image/");
        setImageRefs.set(set.id, set.image);
      }
    }
    if (chapter.storyPath === null) {
      if (game.story !== null) invalid();
      documents.set(id, null);
    } else {
      if (
        game.story === null ||
        game.story.document.path !== chapter.storyPath ||
        game.story.document.packId !== id
      )
        invalid();
      const parsedStory = parseChapterStoryDocument(
        json(required, chapter.storyPath),
      );
      if (
        parsedStory.kind !== "ok" ||
        parsedStory.value.contentId !== game.story.contentId
      )
        invalid();
      const { mapImage, ...document } = parsedStory.value;
      validateMediaRef(manifest, selected, mapImage, "image/");
      mapRefs.set(id, mapImage);
      documents.set(id, document);
    }
  }

  const chapterCards = [...originalCards.values()].map(chapterCardDefinition);
  const cards = createCards(chapterCards);
  const story = parseStoryRelease({
    revision: staged.releaseSequence,
    chapters: games.map((game) => ({
      id: game.chapterId,
      document: documents.get(game.chapterId) ?? null,
      cardCodes: game.cards.map(({ code }) => cardCode(code)),
      sets: game.sets.map((set) => ({
        id: set.id,
        name: set.name,
        releaseYear: set.releaseYear,
        cards: set.cards.map((card) => ({
          ...card,
          code: cardCode(card.code),
        })),
      })),
      decks: game.decks,
      opponents: game.opponents,
      defaults: game.defaults,
    })),
  });

  await validateFrozenBattleExecutable(
    bytes(required, "runtime/engine/vendor-manifest.json"),
    bytes(required, "runtime/engine/ocgcore.sync.wasm"),
  );
  const runtime = runtimeData(
    manifest,
    required,
    cards.all().map(({ code }) => code),
  );
  const runtimeCards = runtimeDefinitions(runtime.records, runtime.texts);
  const battle = battleSource(runtime.input, runtime.wasm);

  return {
    manifest,
    required,
    chapterCards,
    runtimeCards,
    cards,
    story,
    battle,
    imageRefs,
    mapRefs,
    setImageRefs,
  };
}

function runtimeData(
  manifest: ProgressiveManifest,
  required: ReadonlyMap<string, Uint8Array>,
  allowedCardCodes: readonly ReturnType<typeof cardCode>[],
): {
  readonly input: Omit<BattleRuntimeInput, "wasmBinary">;
  readonly wasm: Uint8Array;
  readonly records: readonly (BattleRuntimeCard & { readonly ot: number })[];
  readonly texts: BattleRuntimeInput["texts"];
} {
  const runtimeManifest = jsonValue<RuntimeManifest>(
    required,
    "runtime/current/manifest.json",
  );
  if (runtimeManifest.snapshotId !== manifest.runtimeSnapshotId) invalid();
  const assetPaths = runtimeManifest.assets.files.map(({ path }) => path);
  const cardPaths = assetPaths
    .filter((path) => /^catalog\/cards\/[a-f0-9]{2}\.json$/.test(path))
    .sort(compare);
  const textPaths = assetPaths
    .filter((path) => /^catalog\/texts\/en\/[a-f0-9]{2}\.json$/.test(path))
    .sort(compare);
  const scriptPaths = assetPaths
    .filter((path) => /^scripts\/cards\/[a-f0-9]{2}\.json$/.test(path))
    .sort(compare);
  if (cardPaths.length === 0 || textPaths.length === 0) invalid();
  for (const path of assetPaths) {
    const releasePath = `runtime/assets/current/${path}`;
    const descriptor = manifest.files.find((file) => file.path === releasePath);
    if (!descriptor || !descriptor.required || descriptor.role !== "runtime")
      invalid();
  }
  const records = cardPaths
    .flatMap((path) =>
      jsonValue<readonly (BattleRuntimeCard & { readonly ot: number })[]>(
        required,
        `runtime/assets/current/${path}`,
      ),
    )
    .map((record) => ({
      code: cardCode(Number(record.code)),
      alias: record.alias,
      setcodes: record.setcodes,
      type: record.type,
      level: record.level,
      attribute: record.attribute,
      race: record.race,
      attack: record.attack,
      defense: record.defense,
      lscale: record.lscale,
      rscale: record.rscale,
      linkMarker: record.linkMarker,
      ot: record.ot,
    }))
    .sort((left, right) => left.code - right.code);
  const texts = textPaths
    .flatMap((path) =>
      jsonValue<BattleRuntimeInput["texts"]>(
        required,
        `runtime/assets/current/${path}`,
      ),
    )
    .map((text) => ({ ...text, code: cardCode(Number(text.code)) }))
    .sort((left, right) => left.code - right.code);
  if (
    records.length !== texts.length ||
    records.some((record, index) => record.code !== texts[index]?.code)
  )
    invalid();
  const index = jsonValue<RuntimeScriptIndex>(
    required,
    "runtime/assets/current/scripts/index.json",
  );
  if (index.shardCount !== 256) invalid();
  const scripts = new Map<string, string>();
  const addScripts = (value: Readonly<Record<string, string>>): void => {
    for (const [name, source] of Object.entries(value)) {
      const previous = scripts.get(name);
      if (previous !== undefined && previous !== source) invalid();
      scripts.set(name, source);
    }
  };
  for (const path of scriptPaths)
    addScripts(jsonValue(required, `runtime/assets/current/${path}`));
  addScripts(
    jsonValue(required, "runtime/assets/current/scripts/globals.json"),
  );
  const supported = new Set(records.map(({ code }) => Number(code)));
  const requiredCards = [...index.official, ...index.preRelease]
    .filter((name) => {
      const match = /^c([1-9]\d*)\.lua$/.exec(name);
      return match !== null && supported.has(Number(match[1]));
    })
    .filter((name, position, all) => all.indexOf(name) === position)
    .sort(compare);
  const input = {
    schemaVersion: 1 as const,
    snapshotId: runtimeManifest.snapshotId,
    coreVersion: runtimeManifest.engine.coreVersion,
    cards: records.map((record) => ({
      code: record.code,
      alias: record.alias,
      setcodes: record.setcodes,
      type: record.type,
      level: record.level,
      attribute: record.attribute,
      race: record.race,
      attack: record.attack,
      defense: record.defense,
      lscale: record.lscale,
      rscale: record.rscale,
      linkMarker: record.linkMarker,
    })),
    texts,
    scripts: [...scripts]
      .sort(([left], [right]) => compare(left, right))
      .map(([name, source]) => ({ name, source })),
    requiredScripts: {
      cards: requiredCards,
      globals: [...new Set(index.globals)].sort(compare),
    },
    strings: jsonValue<BattleRuntimeInput["strings"]>(
      required,
      "runtime/assets/current/strings/en.json",
    ),
    allowedCardCodes,
    ruleset: {
      id: PROTOTYPE_RULESET.id,
      revision: PROTOTYPE_RULESET.revision,
      quantityByCode: [...PROTOTYPE_RULESET.quantityByCode]
        .filter(([code]) => supported.has(code))
        .map(([code, quantity]) => [cardCode(code), quantity] as const)
        .sort(([left], [right]) => left - right),
    },
    revisions: {
      babelCdb: runtimeManifest.assets.babelCdbRevision,
      cardScripts: runtimeManifest.assets.cardScriptsRevision,
    },
  };
  const wasm = bytes(required, "runtime/engine/ocgcore.sync.wasm").slice();
  parseBattleRuntimeInput({ ...input, wasmBinary: wasm.slice().buffer });
  return { input, wasm, records, texts };
}

function battleSource(
  input: Omit<BattleRuntimeInput, "wasmBinary">,
  wasm: Uint8Array,
): BattleRuntimeSource {
  return Object.freeze({
    load(signal: AbortSignal): Promise<BattleRuntimeInput> {
      signal.throwIfAborted();
      return Promise.resolve(
        parseBattleRuntimeInput({ ...input, wasmBinary: wasm.slice().buffer }),
      );
    },
  });
}

function runtimeDefinitions(
  records: readonly (BattleRuntimeCard & { readonly ot: number })[],
  texts: BattleRuntimeInput["texts"],
): readonly CardDefinition[] {
  return records.map((record, index) => {
    const text = texts[index] ?? invalid();
    return {
      code: record.code,
      alias: record.alias,
      setcodes: record.setcodes,
      type: record.type,
      level: record.level,
      attribute: record.attribute,
      race: record.race,
      attack: record.attack,
      defense: record.defense,
      lscale: record.lscale,
      rscale: record.rscale,
      linkMarker: record.linkMarker,
      scope: record.ot,
      name: text.name,
      description: text.description,
      strings: text.strings,
      images: {
        full: { code: record.code, variant: "full" },
        cropped: { code: record.code, variant: "cropped" },
      },
    };
  });
}

function chapterCardDefinition(card: ChapterCard): CardDefinition {
  const code = cardCode(card.code);
  return {
    code,
    alias: card.record.alias,
    setcodes: card.record.setcodes,
    type: card.record.type,
    level: card.record.level,
    attribute: card.record.attribute,
    race: card.record.race,
    attack: card.record.attack,
    defense: card.record.defense,
    lscale: card.record.lscale,
    rscale: card.record.rscale,
    linkMarker: card.record.linkMarker,
    scope: card.record.ot,
    name: card.text.name,
    description: card.text.description,
    strings: card.text.strings,
    images: {
      full: { code, variant: "full" },
      cropped: { code, variant: "cropped" },
    },
  };
}

function validateMediaRef(
  manifest: ProgressiveManifest,
  selected: ReadonlySet<string>,
  ref: ChapterFileRef,
  mediaType: string,
): ReleaseFile {
  if (!selected.has(ref.packId)) invalid();
  const file = manifest.files.find(({ path }) => path === ref.path);
  if (
    !file ||
    file.required ||
    file.role !== "media" ||
    !file.packIds.includes(ref.packId) ||
    !file.mediaType.startsWith(mediaType)
  )
    invalid();
  return file;
}

function json(
  required: ReadonlyMap<string, Uint8Array>,
  path: string,
): unknown {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes(required, path)),
    );
  } catch {
    return invalid();
  }
}

function jsonValue<T>(
  required: ReadonlyMap<string, Uint8Array>,
  path: string,
): T {
  return json(required, path) as T;
}

function bytes(
  required: ReadonlyMap<string, Uint8Array>,
  path: string,
): Uint8Array {
  return required.get(path) ?? invalid();
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invalid(): never {
  throw new Error("APP_REQUIRED_INPUT_FAILED");
}

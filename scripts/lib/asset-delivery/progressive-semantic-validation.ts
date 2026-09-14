import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cardCode, type CardDefinition } from "../../../src/cards/index.ts";
import type { ChapterCard } from "../../../src/content/index.ts";
import type { BattleRuntimeInput } from "../../../src/battle/ports/index.ts";
import {
  parseBattleRuntimeInput,
  validateFrozenBattleExecutable,
} from "../../../src/battle/ports/index.ts";
import {
  parseStoryRelease,
  type StoryRelease,
} from "../../../src/story/ports/index.ts";
import { validateReleaseData } from "../../../src/shell/release-validation.ts";
import type { ProgressiveManifest } from "../../../src/content/index.ts";
import type { FrozenInventory } from "./frozen-inventory.ts";
import { assertSafeParents } from "./path-guards.ts";
import { progressiveFail } from "./progressive-error.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";

interface RuntimeManifest {
  readonly snapshotId: string;
  readonly engine: { readonly coreVersion: readonly [number, number] };
  readonly assets: {
    readonly babelCdbRevision: string;
    readonly cardScriptsRevision: string;
    readonly files: readonly { readonly path: string }[];
  };
}

interface ScriptIndex {
  readonly official: readonly string[];
  readonly preRelease: readonly string[];
  readonly globals: readonly string[];
  readonly shardCount: number;
}

export async function validateProgressiveSemantics(
  root: string,
  run: string,
  inventory: FrozenInventory,
  manifest: ProgressiveManifest,
  previousStory: StoryRelease | null,
): Promise<StoryRelease> {
  try {
    const metadata = inventory.playerMetadata;
    if (
      metadata === null ||
      metadata.runtimeSnapshotId !== manifest.runtimeSnapshotId ||
      metadata.chapters.length !== manifest.chapters.length
    )
      invalid();
    for (const chapter of metadata.chapters) {
      const descriptor = manifest.chapters.find(({ id }) => id === chapter.id);
      const gameplay = chapter.gameplay;
      if (
        descriptor === undefined ||
        descriptor.title !== chapter.title ||
        descriptor.description !== chapter.description ||
        descriptor.gameplayPath !== `chapters/${chapter.id}/gameplay.json` ||
        descriptor.storyPath !==
          (chapter.storyContentId === null
            ? null
            : `chapters/${chapter.id}/story.json`) ||
        gameplay.chapterId !== chapter.id ||
        !same(
          chapter.cardCodes,
          gameplay.cards.map(({ code }) => code),
        ) ||
        !same(
          chapter.setIds,
          gameplay.sets.map(({ id }) => id),
        ) ||
        !same(
          chapter.opponentIds,
          gameplay.opponents.map(({ id }) => id),
        ) ||
        chapter.storyContentId !== (gameplay.story?.contentId ?? null) ||
        chapter.storyContentId !== chapter.story.contentId
      )
        invalid();
      for (const card of gameplay.cards) {
        media(manifest, card.fullImage.packId, card.fullImage.path, "image/");
        media(
          manifest,
          card.croppedImage.packId,
          card.croppedImage.path,
          "image/",
        );
      }
      for (const set of gameplay.sets)
        if (set.image !== null)
          media(manifest, set.image.packId, set.image.path, "image/");
      media(
        manifest,
        chapter.story.mapImage.packId,
        chapter.story.mapImage.path,
        "image/",
      );
    }
    const chapterCards = metadata.chapters.flatMap(({ gameplay }) =>
      gameplay.cards.map(cardDefinition),
    );
    const story = parseStoryRelease({
      revision: manifest.releaseSequence,
      chapters: metadata.chapters.map(({ gameplay, story }) => ({
        id: gameplay.chapterId,
        document: gameplay.story === null ? null : withoutMap(story),
        cardCodes: gameplay.cards.map(({ code }) => cardCode(code)),
        sets: gameplay.sets.map((set) => ({
          id: set.id,
          name: set.name,
          releaseYear: set.releaseYear,
          cards: set.cards.map((card) => ({
            ...card,
            code: cardCode(card.code),
          })),
        })),
        decks: gameplay.decks,
        opponents: gameplay.opponents,
        defaults: gameplay.defaults,
      })),
    });
    const runtimeData = await runtimeInput(root, run, manifest, chapterCards);
    const runtime = runtimeData.input;
    if (
      !same(
        metadata.runtimeCardCodes,
        runtime.cards.map(({ code }) => Number(code)),
      )
    )
      invalid();
    const runtimeCards = runtimeDefinitions(runtime, runtimeData.scopeByCode);
    validateReleaseData({
      chapterCards,
      runtimeCards,
      story,
      runtime,
      previousStory,
    });
    return story;
  } catch (error) {
    if (error instanceof Error && error.message === "CONTENT_SEMANTIC_INVALID")
      progressiveFail("CONTENT_SEMANTIC_INVALID");
    progressiveFail("CONTENT_SEMANTIC_INVALID");
  }
}

async function runtimeInput(
  root: string,
  run: string,
  manifest: ProgressiveManifest,
  chapterCards: readonly CardDefinition[],
): Promise<{
  readonly input: BattleRuntimeInput;
  readonly scopeByCode: ReadonlyMap<number, number>;
}> {
  const json = async <T>(file: string): Promise<T> => {
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await objectBytes(root, run, manifest, file),
        ),
      ) as T;
    } catch {
      return invalid();
    }
  };
  const runtime = await json<RuntimeManifest>("runtime/current/manifest.json");
  if (runtime.snapshotId !== manifest.runtimeSnapshotId) invalid();
  const paths = runtime.assets.files.map(({ path }) => path);
  const rawCards = (
    await Promise.all(
      paths
        .filter((file) => /^catalog\/cards\/[a-f0-9]{2}\.json$/.test(file))
        .sort()
        .map((file) =>
          json<readonly Record<string, unknown>[]>(
            `runtime/assets/current/${file}`,
          ),
        ),
    )
  ).flat();
  const scopeByCode = new Map(
    rawCards.map((row) => [Number(row.code), Number(row.ot)]),
  );
  const cards = rawCards.map((row) => ({
    code: cardCode(Number(row.code)),
    alias: row.alias,
    setcodes: row.setcodes,
    type: row.type,
    level: row.level,
    attribute: row.attribute,
    race: row.race,
    attack: row.attack,
    defense: row.defense,
    lscale: row.lscale,
    rscale: row.rscale,
    linkMarker: row.linkMarker,
  }));
  const texts = (
    await Promise.all(
      paths
        .filter((file) => /^catalog\/texts\/en\/[a-f0-9]{2}\.json$/.test(file))
        .sort()
        .map((file) =>
          json<BattleRuntimeInput["texts"]>(`runtime/assets/current/${file}`),
        ),
    )
  )
    .flat()
    .map((text) => ({ ...text, code: cardCode(Number(text.code)) }));
  const scriptMaps = await Promise.all(
    paths
      .filter((file) => /^scripts\/cards\/[a-f0-9]{2}\.json$/.test(file))
      .sort()
      .map((file) =>
        json<Readonly<Record<string, string>>>(
          `runtime/assets/current/${file}`,
        ),
      ),
  );
  scriptMaps.push(
    await json<Readonly<Record<string, string>>>(
      "runtime/assets/current/scripts/globals.json",
    ),
  );
  const scripts = new Map<string, string>();
  for (const entries of scriptMaps)
    for (const [name, source] of Object.entries(entries)) {
      const prior = scripts.get(name);
      if (prior !== undefined && prior !== source) invalid();
      scripts.set(name, source);
    }
  const index = await json<ScriptIndex>(
    "runtime/assets/current/scripts/index.json",
  );
  if (index.shardCount !== 256) invalid();
  const wasm = await objectBytes(
    root,
    run,
    manifest,
    "runtime/engine/ocgcore.sync.wasm",
  );
  await validateFrozenBattleExecutable(
    await objectBytes(
      root,
      run,
      manifest,
      "runtime/engine/vendor-manifest.json",
    ),
    wasm,
  );
  const supported = new Set(cards.map(({ code }) => Number(code)));
  const input = parseBattleRuntimeInput({
    schemaVersion: 1,
    snapshotId: runtime.snapshotId,
    coreVersion: runtime.engine.coreVersion,
    wasmBinary: wasm.slice().buffer,
    cards,
    texts,
    scripts: [...scripts]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([name, source]) => ({ name, source })),
    requiredScripts: {
      cards: [...new Set([...index.official, ...index.preRelease])]
        .filter((name) => {
          const match = /^c([1-9]\d*)\.lua$/.exec(name);
          return match !== null && supported.has(Number(match[1]));
        })
        .sort(),
      globals: [...new Set(index.globals)].sort(),
    },
    strings: await json("runtime/assets/current/strings/en.json"),
    allowedCardCodes: [...new Set(chapterCards.map(({ code }) => code))].sort(
      (left, right) => left - right,
    ),
    ruleset: {
      id: PROTOTYPE_RULESET.id,
      revision: PROTOTYPE_RULESET.revision,
      quantityByCode: [...PROTOTYPE_RULESET.quantityByCode]
        .filter(([code]) => supported.has(code))
        .map(([code, quantity]) => [cardCode(code), quantity] as const)
        .sort(([left], [right]) => left - right),
    },
    revisions: {
      babelCdb: runtime.assets.babelCdbRevision,
      cardScripts: runtime.assets.cardScriptsRevision,
    },
  });
  return { input, scopeByCode };
}

async function objectBytes(
  root: string,
  run: string,
  manifest: ProgressiveManifest,
  file: string,
): Promise<Uint8Array> {
  const descriptor = manifest.files.find(({ path }) => path === file);
  if (descriptor === undefined || !descriptor.required) invalid();
  const bytes = new Uint8Array(
    await readFile(
      await assertSafeParents(
        root,
        path.posix.join(
          run,
          "progressive/objects/content/files",
          descriptor.version,
          descriptor.path,
        ),
      ),
    ),
  );
  if (
    bytes.length !== descriptor.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== descriptor.version
  )
    invalid();
  return bytes;
}

function runtimeDefinitions(
  input: BattleRuntimeInput,
  scopeByCode: ReadonlyMap<number, number>,
): readonly CardDefinition[] {
  const text = new Map(input.texts.map((value) => [value.code, value]));
  return input.cards.map((record) => {
    const words = text.get(record.code) ?? invalid();
    const source = scopeByCode.get(record.code) ?? invalid();
    return {
      ...record,
      scope: source,
      name: words.name,
      description: words.description,
      strings: words.strings,
      images: {
        full: { code: record.code, variant: "full" },
        cropped: { code: record.code, variant: "cropped" },
      },
    };
  });
}

function cardDefinition(card: ChapterCard): CardDefinition {
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

function withoutMap(
  story: NonNullable<
    FrozenInventory["playerMetadata"]
  >["chapters"][number]["story"],
): Omit<typeof story, "mapImage"> {
  return {
    schemaVersion: story.schemaVersion,
    contentId: story.contentId,
    title: story.title,
    beats: story.beats,
    choices: story.choices,
    choiceResponses: story.choiceResponses,
    laterAcknowledgments: story.laterAcknowledgments,
  };
}

function media(
  manifest: ProgressiveManifest,
  packId: string,
  filePath: string,
  mediaType: string,
): void {
  const file = manifest.files.find(({ path }) => path === filePath);
  if (
    file === undefined ||
    file.required ||
    file.role !== "media" ||
    !file.packIds.includes(packId as "runtime" | `chapter-${string}`) ||
    !file.mediaType.startsWith(mediaType)
  )
    invalid();
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invalid(): never {
  throw new Error("CONTENT_SEMANTIC_INVALID");
}

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type {
  ChapterCard,
  ChapterGameplay,
  ContentManifest,
  ContentReadPort,
  ContentSetRef,
  ManifestRef,
} from "../../src/content/index.ts";
import { loadInstalledGameplay } from "../../src/content/index.ts";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const runtimeSnapshotId = hash("runtime-snapshot");
const catalogSha256 = hash("catalog");

function card(code: number, name = `Card ${code}`): ChapterCard {
  const image = {
    packId: "chapter-01" as const,
    path: "chapters/chapter-01/card.png",
  };
  return {
    code,
    record: {
      code,
      alias: 0,
      setcodes: [],
      type: 17,
      level: 4,
      attribute: 1,
      race: "1",
      attack: 1000,
      defense: 1000,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
      ot: 3,
    },
    text: { code, name, description: "Fixture", strings: [] },
    fullImage: image,
    croppedImage: image,
  };
}

function gameplay(
  chapterId: "chapter-01" | "chapter-02",
  cards: readonly ChapterCard[],
): ChapterGameplay {
  return {
    schemaVersion: 1,
    chapterId,
    cards,
    sets: [
      {
        id: "set-shared",
        name: "Shared Set",
        releaseYear: 2000,
        image: null,
        cards: [
          {
            code: 1,
            name: "Card 1",
            rarity: "common",
            printingCode: "TEST-001",
            sourceRarity: "Common",
            sourceRarityCode: "C",
          },
        ],
      },
    ],
    decks: [
      {
        id: "starter",
        name: "Starter",
        main: Array.from({ length: 40 }, () => 1),
        extra: [],
        side: [],
      },
    ],
    opponents: [
      {
        id: "rival",
        name: "Rival",
        line: "Duel",
        deckId: "starter",
        policyId: "basic",
      },
    ],
    defaults: { starterDeckId: "starter", opponentId: "rival" },
    story: null,
  };
}

interface TestReader extends ContentReadPort {
  notifyChanged(): void;
}

function fixture(options: {
  readonly chapterTwo?: boolean;
  readonly conflictingCard?: boolean;
  readonly runtimeOnly?: boolean;
}) {
  const runtimeRef: ManifestRef = {
    packId: "runtime",
    sha256: hash("runtime-manifest"),
    bytes: 1,
  };
  const chapterOneRef: ManifestRef = {
    packId: "chapter-01",
    sha256: hash("chapter-one-manifest"),
    bytes: 1,
  };
  const chapterTwoRef: ManifestRef = {
    packId: "chapter-02",
    sha256: hash("chapter-two-manifest"),
    bytes: 1,
  };
  const chapterOne = gameplay("chapter-01", [card(1)]);
  const chapterTwo = gameplay("chapter-02", [
    card(1, options.conflictingCard ? "Conflict" : "Card 1"),
    card(2),
  ]);
  const json = (value: unknown) =>
    new Blob([JSON.stringify(value)], {
      type: "application/json",
    });
  const gameplayFiles = new Map([
    ["chapter-01", json(chapterOne)],
    ["chapter-02", json(chapterTwo)],
  ]);
  const manifest = (
    ref: ManifestRef,
    game: ChapterGameplay | null,
    dependencies: readonly ManifestRef[],
  ): ContentManifest => ({
    schemaVersion: 2,
    packId: ref.packId,
    runtimeSnapshotId,
    storyContentId: null,
    gameplayPath:
      game === null ? null : `chapters/${game.chapterId}/gameplay.json`,
    dependencies,
    cardCodes: game?.cards.map(({ code }) => code) ?? [1, 2, 999],
    opponentIds: game?.opponents.map(({ id }) => id) ?? [],
    parts: [],
    files:
      game === null
        ? []
        : [
            {
              path: `chapters/${game.chapterId}/gameplay.json`,
              bytes: gameplayFiles.get(game.chapterId)!.size,
              sha256: hash(`gameplay-${game.chapterId}`),
              mediaType: "application/json",
              partSha256: hash(`part-${game.chapterId}`),
              entry: `chapters/${game.chapterId}/gameplay.json`,
            },
          ],
  });
  const manifests = new Map<string, ContentManifest>([
    [runtimeRef.sha256, manifest(runtimeRef, null, [])],
    [chapterOneRef.sha256, manifest(chapterOneRef, chapterOne, [runtimeRef])],
    [
      chapterTwoRef.sha256,
      manifest(chapterTwoRef, chapterTwo, [runtimeRef, chapterOneRef]),
    ],
  ]);
  const content: ContentSetRef = {
    catalogSha256,
    snapshot: {
      activationId: hash("activation"),
      runtimeSnapshotId,
      runtimeManifestSha256: hash("runtime-file"),
      releaseCatalogSha256: catalogSha256,
    },
    runtime: runtimeRef,
    chapters: options.runtimeOnly
      ? []
      : options.chapterTwo
        ? [chapterOneRef, chapterTwoRef]
        : [chapterOneRef],
  };
  const listeners = new Set<
    Parameters<ContentReadPort["subscribeCurrent"]>[0]
  >();
  const reader: TestReader = {
    inspectContent: vi.fn(async () => ({
      kind: "ok" as const,
      value: content,
    })),
    readManifest: vi.fn(async (ref) => ({
      kind: "ok" as const,
      value: {
        bytes: new Uint8Array([1]),
        sha256: ref.sha256,
        value: manifests.get(ref.sha256)!,
      },
    })),
    readFile: vi.fn(async (ref) => ({
      kind: "ok" as const,
      value: gameplayFiles.get(ref.packId)!,
    })),
    readCatalog: vi.fn(),
    current: vi.fn(),
    subscribeCurrent: vi.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    acquireSession: vi.fn(),
    notifyChanged() {
      for (const listener of listeners)
        listener({
          kind: "ok",
          value: { generation: 2, current: null, previous: content },
        });
    },
  };
  return { content, reader };
}

describe("loadInstalledGameplay", () => {
  it("X1 — union grants only chapter cards", async () => {
    const { content, reader } = fixture({});
    const result = await loadInstalledGameplay(reader, content);
    expect(result).toMatchObject({
      kind: "ok",
      value: {
        chapterIds: ["chapter-01"],
        defaults: { starterDeckId: "starter" },
      },
    });
    if (result.kind !== "ok") throw result;
    expect(result.value.cards.map(({ code }) => code)).toEqual([1]);
    expect(result.value.sets[0]?.image).toBeNull();
  });

  it("X2 — chapter02 expands deterministic union", async () => {
    const { content, reader } = fixture({ chapterTwo: true });
    const result = await loadInstalledGameplay(reader, content);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw result;
    expect(result.value.chapterIds).toEqual(["chapter-01", "chapter-02"]);
    expect(result.value.cards.map(({ code }) => code)).toEqual([1, 2]);
    expect(result.value.sets).toHaveLength(1);
    expect(result.value.decks).toHaveLength(1);
    expect(result.value.opponents).toHaveLength(1);
  });

  it("X3 — conflicting chapter definitions fail", async () => {
    const { content, reader } = fixture({
      chapterTwo: true,
      conflictingCard: true,
    });
    await expect(loadInstalledGameplay(reader, content)).resolves.toMatchObject(
      {
        kind: "failed",
        code: "CONTENT_INCOMPATIBLE",
      },
    );
  });

  it("rejects a stale union when state changes during gameplay read", async () => {
    const { content, reader } = fixture({});
    let readStarted!: () => void;
    let continueRead!: () => void;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      continueRead = resolve;
    });
    const readFile = vi.mocked(reader.readFile);
    const original = readFile.getMockImplementation()!;
    readFile.mockImplementationOnce(async (...args) => {
      readStarted();
      await gate;
      return original(...args);
    });

    const stale = loadInstalledGameplay(reader, content);
    await started;
    reader.notifyChanged();
    continueRead();
    await expect(stale).resolves.toMatchObject({
      kind: "failed",
      code: "CONTENT_MISSING",
    });
    await expect(loadInstalledGameplay(reader, content)).resolves.toMatchObject(
      {
        kind: "ok",
      },
    );
    expect(reader.inspectContent).toHaveBeenCalledTimes(2);
  });

  it("runtime support alone grants no cards", async () => {
    const { content, reader } = fixture({ runtimeOnly: true });
    await expect(loadInstalledGameplay(reader, content)).resolves.toMatchObject(
      {
        kind: "failed",
        code: "CONTENT_MISSING",
      },
    );
    expect(reader.inspectContent).not.toHaveBeenCalled();
  });
});

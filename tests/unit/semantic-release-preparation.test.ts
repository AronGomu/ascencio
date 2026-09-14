// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ChapterGameplay,
  ChapterStoryDocument,
  ProgressiveContentStore,
  ProgressiveManifest,
  ReleaseFile,
  StagedContent,
} from "../../src/content/index.ts";
import { cardCode } from "../../src/cards/index.ts";
import { OCG_TYPE } from "../../src/cards/classification/index.ts";
import { prepareRelease } from "../../src/shell/application/prepared-release.ts";
import { validateReleaseData } from "../../src/shell/release-validation.ts";
import { contentRuntimeFixture } from "../fixtures/content-runtime-fixture.ts";
import { prepared } from "../fixtures/asset-delivery-bundle.ts";

const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));

let runtimeFiles: Awaited<ReturnType<typeof contentRuntimeFixture>>["files"];
let runtimeSnapshotId: string;

beforeAll(async () => {
  const runtime = await contentRuntimeFixture(
    prepared.chapters[0]!.gameplay.cards,
    {},
  );
  runtimeSnapshotId = runtime.snapshotId;
  runtimeFiles = runtime.files;
});

type Mutable<T> = T extends number | string | boolean | null
  ? T
  : T extends readonly (infer Entry)[]
    ? Mutable<Entry>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;

type FixtureMutation = (input: {
  gameplay: Mutable<ChapterGameplay>;
  story: Mutable<ChapterStoryDocument>;
  files: Map<string, Uint8Array>;
  manifest: Mutable<ProgressiveManifest>;
}) => void;

function releaseFile(
  path: string,
  role: ReleaseFile["role"],
  packIds: ReleaseFile["packIds"],
  bytes: Uint8Array,
  mediaType = "application/json",
): Mutable<ReleaseFile> {
  return {
    path,
    version: "a".repeat(64),
    bytes: bytes.length,
    mediaType,
    role,
    required: role !== "media",
    packIds: [...packIds],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fixture(mutate?: FixtureMutation) {
  const gameplay = clone(
    prepared.chapters[0]!.gameplay,
  ) as Mutable<ChapterGameplay>;
  const story = clone(
    prepared.chapters[0]!.story,
  ) as Mutable<ChapterStoryDocument>;
  const files = new Map<string, Uint8Array>(
    runtimeFiles.map((file) => [file.path, file.bytes.slice()]),
  );
  files.set("chapters/chapter-01/gameplay.json", encode(gameplay));
  files.set("chapters/chapter-01/story.json", encode(story));
  files.set("story/media/map.png", new Uint8Array([1, 2, 3]));
  const descriptors: Mutable<ReleaseFile>[] = [
    ...runtimeFiles.map((file) =>
      releaseFile(
        file.path,
        "runtime",
        ["runtime"],
        file.bytes,
        file.mediaType,
      ),
    ),
    releaseFile(
      "chapters/chapter-01/gameplay.json",
      "gameplay",
      ["chapter-01"],
      files.get("chapters/chapter-01/gameplay.json")!,
    ),
    releaseFile(
      "chapters/chapter-01/story.json",
      "story",
      ["chapter-01"],
      files.get("chapters/chapter-01/story.json")!,
    ),
    releaseFile(
      "story/media/map.png",
      "media",
      ["chapter-01"],
      files.get("story/media/map.png")!,
      "image/png",
    ),
  ];
  const manifest: Mutable<ProgressiveManifest> = {
    schemaVersion: 3,
    releaseSequence: 7,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId,
    chapters: [
      {
        id: "chapter-01",
        title: "DM",
        description: "Fixture chapter.",
        depends: [],
        gameplayPath: "chapters/chapter-01/gameplay.json",
        storyPath: "chapters/chapter-01/story.json",
      },
    ],
    files: descriptors.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  mutate?.({ gameplay, story, files, manifest });
  files.set("chapters/chapter-01/gameplay.json", encode(gameplay));
  files.set("chapters/chapter-01/story.json", encode(story));
  manifest.files = manifest.files.map((file) => ({
    ...file,
    bytes: files.get(file.path)?.byteLength ?? file.bytes,
  }));
  const readFile = vi.fn<ProgressiveContentStore["readFile"]>(
    async (_version, path) => files.get(path)?.slice() ?? null,
  );
  const staged: StagedContent = {
    receiptId: "b".repeat(64),
    manifestVersion: "c".repeat(64),
    releaseSequence: manifest.releaseSequence,
    chapterIds: manifest.chapters.map(({ id }) => id),
  };
  const store = {
    verifyRequired: vi.fn(async () => undefined),
    readManifest: vi.fn(async () => manifest),
    readFile,
  } as unknown as ProgressiveContentStore;
  return { files, gameplay, manifest, readFile, staged, store };
}

async function rejected(mutate: FixtureMutation): Promise<void> {
  const input = fixture(mutate);
  await expect(
    prepareRelease(input.store, input.staged, new AbortController().signal),
  ).rejects.toThrow(new Error("APP_REQUIRED_INPUT_FAILED"));
}

function mutateRuntimeCard(
  files: Map<string, Uint8Array>,
  code: number,
  change: (row: Record<string, unknown>) => void,
): void {
  for (const [path, bytes] of files) {
    if (
      !/^runtime\/assets\/current\/catalog\/cards\/[a-f0-9]{2}\.json$/.test(
        path,
      )
    )
      continue;
    const rows = JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >[];
    const row = rows.find((value) => value.code === code);
    if (row) {
      change(row);
      files.set(path, encode(rows));
      return;
    }
  }
  throw new Error(`Missing runtime card ${code}`);
}

function mutateRuntimeText(
  files: Map<string, Uint8Array>,
  code: number,
  change: (row: Record<string, unknown>) => void,
): void {
  for (const [path, bytes] of files) {
    if (
      !/^runtime\/assets\/current\/catalog\/texts\/en\/[a-f0-9]{2}\.json$/.test(
        path,
      )
    )
      continue;
    const rows = JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >[];
    const row = rows.find((value) => value.code === code);
    if (row) {
      change(row);
      files.set(path, encode(rows));
      return;
    }
  }
  throw new Error(`Missing runtime text ${code}`);
}

function addSecondChapter(
  input: Parameters<FixtureMutation>[0],
  conflicting: boolean,
): void {
  const second = clone(input.gameplay) as unknown as {
    chapterId: "chapter-02";
    decks: { name: string }[];
    story: { document: { packId: string; path: string } };
  };
  second.chapterId = "chapter-02";
  if (conflicting) second.decks[0]!.name = "Conflicting starter";
  second.story.document.packId = "chapter-02";
  second.story.document.path = "chapters/chapter-02/story.json";
  input.files.set("chapters/chapter-02/gameplay.json", encode(second));
  input.files.set("chapters/chapter-02/story.json", encode(input.story));
  input.manifest.chapters = [
    ...input.manifest.chapters,
    {
      id: "chapter-02",
      title: "Second",
      description: "Dedup fixture",
      depends: ["chapter-01"],
      gameplayPath: "chapters/chapter-02/gameplay.json",
      storyPath: "chapters/chapter-02/story.json",
    },
  ];
  input.manifest.files = [
    ...input.manifest.files,
    releaseFile(
      "chapters/chapter-02/gameplay.json",
      "gameplay",
      ["chapter-02"],
      input.files.get("chapters/chapter-02/gameplay.json")!,
    ),
    releaseFile(
      "chapters/chapter-02/story.json",
      "story",
      ["chapter-02"],
      input.files.get("chapters/chapter-02/story.json")!,
    ),
  ].sort((left, right) => (left.path < right.path ? -1 : 1));
}

describe("prepareRelease semantic parity", () => {
  it("pins each required byte once, invokes complete semantics, and keeps allowed pool chapter-scoped", async () => {
    const input = fixture();
    const candidate = await prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    expect(input.store.verifyRequired).toHaveBeenCalledOnce();
    for (const file of input.manifest.files.filter(({ required }) => required))
      expect(
        input.readFile.mock.calls.filter(([, path]) => path === file.path),
      ).toHaveLength(1);
    expect(candidate.cards.all()).toHaveLength(14);
    expect(candidate.editor.starter.name).toBe("Starter");
    const first = await candidate.battle.load(new AbortController().signal);
    const second = await candidate.battle.load(new AbortController().signal);
    expect(first.allowedCardCodes).toEqual(
      Array.from({ length: 14 }, (_, index) => cardCode(index + 1)),
    );
    expect(first.wasmBinary).not.toBe(second.wasmBinary);
    expect(input.readFile).toHaveBeenCalledTimes(
      input.manifest.files.filter(({ required }) => required).length,
    );
    candidate.dispose();
    candidate.dispose();
  });

  it.each([
    [
      "unsupported token",
      ({ gameplay, files }: Parameters<FixtureMutation>[0]) => {
        gameplay.cards[0]!.record.type |= OCG_TYPE.TOKEN;
        mutateRuntimeCard(files, 1, (row) => {
          row.type = gameplay.cards[0]!.record.type;
        });
      },
    ],
    [
      "wrong main/extra zone",
      ({ gameplay, files }: Parameters<FixtureMutation>[0]) => {
        gameplay.cards[0]!.record.type |= OCG_TYPE.FUSION;
        mutateRuntimeCard(files, 1, (row) => {
          row.type = gameplay.cards[0]!.record.type;
        });
      },
    ],
    [
      "copy limit",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.decks[0]!.main.splice(0, 4, 1, 1, 1, 1);
      },
    ],
  ])("preserves Decks-owned rejection: %s", async (_name, mutate) => {
    await rejected(mutate);
  });

  it("rejects chapter/runtime text mismatch through Cards", async () => {
    await rejected(({ files }) =>
      mutateRuntimeText(files, 1, (row) => {
        row.name = "Conflicting runtime text";
      }),
    );
  });

  it("deduplicates identical chapter definitions and keeps lexical-first defaults", async () => {
    const input = fixture((value) => addSecondChapter(value, false));
    const candidate = await prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    expect(candidate.cards.all()).toHaveLength(14);
    expect(candidate.editor.starter.name).toBe("Starter");
    expect(candidate.story.chapters.map(({ id }) => id)).toEqual([
      "chapter-01",
      "chapter-02",
    ]);
  });

  it("rejects conflicting duplicate chapter definitions", async () => {
    await rejected((value) => addSecondChapter(value, true));
  });

  it("rejects missing optional media metadata but permits missing optional bytes", async () => {
    await rejected(({ manifest }) => {
      manifest.files = manifest.files.filter(({ role }) => role !== "media");
    });
    const input = fixture(({ files }) => files.delete("story/media/map.png"));
    const candidate = await prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    expect(
      await candidate.images.acquire(
        cardCode(1),
        "full",
        new AbortController().signal,
      ),
    ).toBeNull();
    expect(
      await candidate.storyMedia.acquireMap(
        "chapter-01",
        new AbortController().signal,
      ),
    ).toBeNull();
  });

  it("rejects invalid default/reference semantics", async () => {
    await rejected(({ gameplay }) => {
      gameplay.opponents[0]!.deckId = "missing-deck";
    });
  });
});

describe("validateReleaseData", () => {
  it("maps any owned validator failure to CONTENT_SEMANTIC_INVALID", () => {
    expect(() =>
      validateReleaseData({
        chapterCards: [],
        runtimeCards: [],
        story: { revision: 1, chapters: [] },
        runtime: {} as never,
        previousStory: null,
      }),
    ).toThrow(new Error("CONTENT_SEMANTIC_INVALID"));
  });
});

describe("T8 repair: pinned preparation and media lifecycle", () => {
  it("snapshots and freezes staged identity before the first awaited read", async () => {
    const input = fixture();
    let resume!: () => void;
    vi.mocked(input.store.verifyRequired).mockImplementationOnce(
      async (staged) => {
        expect(Object.isFrozen(staged)).toBe(true);
        expect(Object.isFrozen(staged.chapterIds)).toBe(true);
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
      },
    );
    const pending = prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    const original = clone(input.staged);
    (input.staged as Mutable<StagedContent>).manifestVersion = "d".repeat(64);
    (input.staged.chapterIds as string[]).push("chapter-02");
    resume();
    const candidate = await pending;
    expect(candidate.content).toEqual(original);
    expect(candidate.content).not.toBe(input.staged);
    await candidate.storyMedia.acquireMap(
      "chapter-01",
      new AbortController().signal,
    );
    expect(
      input.readFile.mock.calls.every(
        ([version]) => version === original.manifestVersion,
      ),
    ).toBe(true);
    candidate.dispose();
  });

  it.each([
    "receiptId",
    "manifestVersion",
    "releaseSequence",
    "chapterIds",
  ] as const)("rejects malformed staged %s before any read", async (key) => {
    const input = fixture();
    const staged = {
      ...input.staged,
      [key]: key === "chapterIds" ? ["chapter-01", "chapter-01"] : "bad",
    };
    await expect(
      prepareRelease(
        input.store,
        staged as never,
        new AbortController().signal,
      ),
    ).rejects.toThrow("APP_REQUIRED_INPUT_FAILED");
    expect(input.store.verifyRequired).not.toHaveBeenCalled();
    expect(input.store.readManifest).not.toHaveBeenCalled();
  });

  it("shares four read/decode slots across card/map/set requests and aborts queued requests exactly", async () => {
    const input = fixture();
    const candidate = await prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    const pendingReads: (() => void)[] = [];
    input.readFile.mockClear();
    input.readFile.mockImplementation(async () => {
      await new Promise<void>((resolve) => pendingReads.push(resolve));
      return new Uint8Array([1]);
    });
    const controller = new AbortController();
    const signal = new AbortController().signal;
    const requests = [
      candidate.images.acquire(cardCode(1), "full", signal),
      candidate.storyMedia.acquireMap("chapter-01", signal),
      candidate.images.acquire(cardCode(1), "cropped", signal),
      candidate.storyMedia.acquireMap("chapter-01", signal),
    ];
    const queued = candidate.images.acquire(
      cardCode(1),
      "full",
      controller.signal,
    );
    const rejected = expect(queued).rejects.toEqual(
      new DOMException("The operation was aborted.", "AbortError"),
    );
    await Promise.resolve();
    const started = input.readFile.mock.calls.length;
    controller.abort("custom reason must not escape");
    for (const finish of pendingReads) finish();
    await rejected;
    const leases = await Promise.all(requests);
    expect(started).toBe(4);
    expect(input.readFile).toHaveBeenCalledTimes(4);
    candidate.dispose();
    for (const lease of leases) lease?.release();
  });

  it("dispose then lease release revokes each URL exactly once", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const input = fixture();
    const candidate = await prepareRelease(
      input.store,
      input.staged,
      new AbortController().signal,
    );
    const lease = await candidate.storyMedia.acquireMap(
      "chapter-01",
      new AbortController().signal,
    );
    expect(lease).not.toBeNull();
    candidate.dispose();
    candidate.dispose();
    lease!.release();
    lease!.release();
    expect(
      revoke.mock.calls.filter(([url]) => url === lease!.url),
    ).toHaveLength(1);
    revoke.mockRestore();
  });

  it.each([
    "runtime/engine/ocgcore.sync.wasm",
    "runtime/engine/vendor-manifest.json",
  ])("rejects wrong frozen executable identity: %s", async (path) => {
    await rejected(({ files }) => files.set(path, new Uint8Array([1])));
  });
});

describe("T8 exhaustive semantic owner parity", () => {
  it.each([
    [
      "unknown deck card",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.decks[0]!.main[0] = 999999;
      },
    ],
    [
      "normal card in Extra",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.decks[0]!.extra = [1];
      },
    ],
    [
      "set references unavailable card",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.sets[0]!.cards[0]!.code = 999999;
      },
    ],
    [
      "chapter/runtime record mismatch",
      ({ files }: Parameters<FixtureMutation>[0]) =>
        mutateRuntimeCard(files, 1, (row) => {
          row.attack = 1234;
        }),
    ],
    [
      "chapter card missing from runtime support",
      ({ files }: Parameters<FixtureMutation>[0]) => {
        for (const [path, bytes] of files)
          if (/catalog\/cards\//.test(path))
            files.set(
              path,
              encode(
                (
                  JSON.parse(new TextDecoder().decode(bytes)) as {
                    code: number;
                  }[]
                ).filter(({ code }) => code !== 1),
              ),
            );
      },
    ],
    [
      "missing starter default",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.defaults.starterDeckId = "missing";
      },
    ],
    [
      "missing opponent default",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.defaults.opponentId = "missing";
      },
    ],
    [
      "full image missing descriptor",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.cards[0]!.fullImage.path = "missing.png";
      },
    ],
    [
      "cropped image missing descriptor",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.cards[0]!.croppedImage.path = "missing.png";
      },
    ],
    [
      "set image missing descriptor",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.sets[0]!.image = { packId: "chapter-01", path: "missing.png" };
      },
    ],
    [
      "map image missing descriptor",
      ({ story }: Parameters<FixtureMutation>[0]) => {
        story.mapImage.path = "missing.png";
      },
    ],
    [
      "image wrong MIME",
      ({ manifest }: Parameters<FixtureMutation>[0]) => {
        manifest.files.find(({ role }) => role === "media")!.mediaType =
          "audio/ogg";
      },
    ],
    [
      "media required role",
      ({ manifest }: Parameters<FixtureMutation>[0]) => {
        manifest.files.find(({ role }) => role === "media")!.required = true;
      },
    ],
    [
      "media pack outside selected closure",
      ({ manifest }: Parameters<FixtureMutation>[0]) => {
        manifest.files.find(({ role }) => role === "media")!.packIds = [
          "chapter-02",
        ];
      },
    ],
    [
      "story descriptor mismatch",
      ({ gameplay }: Parameters<FixtureMutation>[0]) => {
        gameplay.story!.document.path = "missing.json";
      },
    ],
    [
      "story content identity mismatch",
      ({ story }: Parameters<FixtureMutation>[0]) => {
        story.contentId = "different-content" as never;
      },
    ],
    [
      "duplicate opponent across chapters",
      (input: Parameters<FixtureMutation>[0]) => {
        addSecondChapter(input, false);
        const path = "chapters/chapter-02/gameplay.json";
        const game = JSON.parse(
          new TextDecoder().decode(input.files.get(path)),
        ) as Mutable<ChapterGameplay>;
        game.opponents[0]!.name = "Conflicting opponent";
        input.files.set(path, encode(game));
      },
    ],
  ])("owned negative parity: %s", async (_name, mutate) => {
    await rejected(mutate);
  });
});

it("shared media queue drains card/map/set reads without exceeding four slots", async () => {
  const input = fixture(({ gameplay }) => {
    gameplay.sets[0]!.image = {
      packId: "chapter-01",
      path: "story/media/map.png",
    };
  });
  const candidate = await prepareRelease(
    input.store,
    input.staged,
    new AbortController().signal,
  );
  let reads = 0;
  let maximum = 0;
  const finishes: (() => void)[] = [];
  input.readFile.mockImplementation(async () => {
    reads++;
    maximum = Math.max(maximum, reads);
    await new Promise<void>((resolve) => finishes.push(resolve));
    reads--;
    return new Uint8Array([1]);
  });
  const signal = new AbortController().signal;
  const pending = Array.from({ length: 12 }, (_, index) =>
    index % 3 === 0
      ? candidate.images.acquire(cardCode(1), "full", signal)
      : index % 3 === 1
        ? candidate.storyMedia.acquireMap("chapter-01", signal)
        : candidate.storyMedia.acquireSetImage(
            input.gameplay.sets[0]!.id,
            signal,
          ),
  );
  for (let batch = 0; batch < 3; batch++) {
    await vi.waitFor(() => expect(finishes).toHaveLength(4));
    finishes.splice(0).forEach((finish) => finish());
  }
  const leases = await Promise.all(pending);
  expect(maximum).toBe(4);
  expect(leases.every((lease) => lease !== null)).toBe(true);
  candidate.dispose();
  leases.forEach((lease) => lease?.release());
});

it("disposed pending media read cannot create a late URL", async () => {
  const input = fixture();
  const candidate = await prepareRelease(
    input.store,
    input.staged,
    new AbortController().signal,
  );
  const read = Promise.withResolvers<Uint8Array>();
  input.readFile.mockReturnValue(read.promise);
  const create = vi.spyOn(URL, "createObjectURL");
  const pending = candidate.storyMedia.acquireMap(
    "chapter-01",
    new AbortController().signal,
  );
  await Promise.resolve();
  candidate.dispose();
  read.resolve(new Uint8Array([1]));
  await expect(pending).resolves.toBeNull();
  expect(create).not.toHaveBeenCalled();
  create.mockRestore();
});

it("conflicting duplicate chapter card definition rejects before readiness", async () => {
  await rejected((input) => {
    addSecondChapter(input, false);
    const path = "chapters/chapter-02/gameplay.json";
    const game = JSON.parse(
      new TextDecoder().decode(input.files.get(path)),
    ) as Mutable<ChapterGameplay>;
    game.cards[0]!.text.name = "Conflicting duplicate";
    input.files.set(path, encode(game));
  });
});

it.each([
  "starter default",
  "opponent default",
  "opponent deck ref",
  "set card ref",
  "duplicate deck",
  "duplicate opponent",
])("Story owner directly rejects %s without Content parser", async (name) => {
  const { validateStoryRelease } =
    await import("../../src/story/ports/index.ts");
  const input = fixture();
  const candidate = await prepareRelease(
    input.store,
    input.staged,
    new AbortController().signal,
  );
  const story = structuredClone(candidate.story) as Mutable<
    typeof candidate.story
  >;
  const chapter = story.chapters[0]!;
  if (name === "starter default") chapter.defaults.starterDeckId = "missing";
  if (name === "opponent default") chapter.defaults.opponentId = "missing";
  if (name === "opponent deck ref") chapter.opponents[0]!.deckId = "missing";
  if (name === "set card ref")
    chapter.sets[0]!.cards[0]!.code = cardCode(999999);
  if (name === "duplicate deck")
    chapter.decks.push({ ...chapter.decks[0]!, name: "Conflict" });
  if (name === "duplicate opponent")
    chapter.opponents.push({ ...chapter.opponents[0]!, name: "Conflict" });
  expect(() => validateStoryRelease(story)).toThrow("STORY_RELEASE_INVALID");
  candidate.dispose();
});

it.each(["gameplay", "story"] as const)(
  "required JSON descriptor rejects wrong %s MIME before reads",
  async (role) => {
    const input = fixture(({ manifest }) => {
      manifest.files.find((file) => file.role === role)!.mediaType =
        "image/png";
    });
    await expect(
      prepareRelease(input.store, input.staged, new AbortController().signal),
    ).rejects.toThrow("APP_REQUIRED_INPUT_FAILED");
    expect(input.readFile).not.toHaveBeenCalled();
  },
);

it.each(["gameplay", "story"] as const)(
  "required JSON descriptor rejects padded oversized %s bytes before reads",
  async (role) => {
    const input = fixture();
    const descriptor = input.manifest.files.find((file) => file.role === role)!;
    const original = input.files.get(descriptor.path)!;
    const padded = new Uint8Array(4194305).fill(32);
    padded.set(original);
    descriptor.bytes = padded.length;
    input.files.set(descriptor.path, padded);
    await expect(
      prepareRelease(input.store, input.staged, new AbortController().signal),
    ).rejects.toThrow("APP_REQUIRED_INPUT_FAILED");
    expect(input.readFile).not.toHaveBeenCalled();
  },
);

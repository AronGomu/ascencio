// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type {
  ContentManifest,
  ContentReadPort,
  ChapterGameplay,
  ChapterStoryDocument,
} from "../../src/content/index.ts";
import { verifyGameplay } from "../../src/content/install/verify-gameplay.ts";
import type { ManifestEntry } from "../../src/content/install/manifest-closure.ts";
import { contentRuntimeFixture } from "../fixtures/content-runtime-fixture.ts";
import { prepared } from "../fixtures/asset-delivery-bundle.ts";

type Mutable<T> = T extends readonly (infer E)[]
  ? Mutable<E>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
let runtime: Awaited<ReturnType<typeof contentRuntimeFixture>>;
beforeAll(async () => {
  runtime = await contentRuntimeFixture(
    prepared.chapters[0]!.gameplay.cards,
    {},
  );
});
function fixture() {
  const game = structuredClone(
    prepared.chapters[0]!.gameplay,
  ) as Mutable<ChapterGameplay>;
  const story = structuredClone(
    prepared.chapters[0]!.story,
  ) as Mutable<ChapterStoryDocument>;
  const files = new Map(runtime.files.map((file) => [file.path, file.bytes]));
  files.set("chapters/chapter-01/gameplay.json", encode(game));
  files.set("chapters/chapter-01/story.json", encode(story));
  const manifest = (
    packId: "runtime" | "chapter-01",
  ): Mutable<ContentManifest> => ({
    schemaVersion: 2,
    packId,
    runtimeSnapshotId: runtime.snapshotId,
    storyContentId: packId === "runtime" ? null : game.story!.contentId,
    gameplayPath:
      packId === "runtime" ? null : "chapters/chapter-01/gameplay.json",
    dependencies: [],
    cardCodes: game.cards.map(({ code }) => code),
    opponentIds: packId === "runtime" ? [] : game.opponents.map(({ id }) => id),
    parts: [],
    files: [...files]
      .filter(([path]) =>
        path.startsWith(packId === "runtime" ? "runtime/" : "chapters/"),
      )
      .map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: "a".repeat(64),
        mediaType: "application/json",
        partSha256: "b".repeat(64),
        entry: path,
      })),
  });
  const entries: Mutable<ManifestEntry>[] = ["runtime", "chapter-01"].map(
    (id, index) => ({
      ref: {
        packId: id as "runtime" | "chapter-01",
        sha256: String(index).repeat(64),
        bytes: 1,
      },
      manifest: manifest(id as "runtime" | "chapter-01"),
    }),
  );
  entries[1]!.manifest.dependencies = [entries[0]!.ref];
  entries[1]!.manifest.files.push({
    path: "story/media/map.png",
    bytes: 1,
    sha256: "c".repeat(64),
    mediaType: "image/png",
    partSha256: "d".repeat(64),
    entry: "story/media/map.png",
  });
  const reader = {
    readFile: async (_ref, path) => ({
      kind: "ok",
      value: new Blob([files.get(path)!.slice()]),
    }),
  } as ContentReadPort;
  return { entries, files, game, story, reader };
}
type Fixture = ReturnType<typeof fixture>;
const runtimeRows = (input: Fixture, value: unknown) => {
  const path = [...input.files.keys()].find((path) =>
    /catalog\/cards\//.test(path),
  )!;
  input.files.set(path, encode(value));
};

describe("legacy verifyGameplay structural branch parity", () => {
  it("valid structural baseline", async () => {
    const input = fixture();
    await expect(
      verifyGameplay(input.entries, input.reader),
    ).resolves.toBeUndefined();
  });
  const cases: readonly [string, (input: Fixture) => void, string][] = [
    [
      "missing runtime",
      ({ entries }) => {
        entries.shift();
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "missing gameplay descriptor",
      ({ entries }) => {
        entries[1]!.manifest.gameplayPath = "missing.json";
      },
      "CONTENT_INVALID_MANIFEST",
    ],
    [
      "oversized gameplay descriptor",
      ({ entries }) => {
        entries[1]!.manifest.files[0]!.bytes = 4194305;
      },
      "CONTENT_INVALID_MANIFEST",
    ],
    [
      "chapter identity mismatch",
      ({ entries }) => {
        entries[1]!.ref.packId = "chapter-02";
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "manifest card roster mismatch",
      ({ entries }) => {
        entries[1]!.manifest.cardCodes.pop();
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "manifest opponent roster mismatch",
      ({ entries }) => {
        entries[1]!.manifest.opponentIds = [];
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "manifest story identity mismatch",
      ({ entries }) => {
        entries[1]!.manifest.storyContentId = null;
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "runtime rows not array",
      (input) => runtimeRows(input, {}),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "null runtime row",
      (input) => runtimeRows(input, [null]),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "primitive runtime row",
      (input) => runtimeRows(input, [1]),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "runtime row missing code",
      (input) => runtimeRows(input, [{}]),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "runtime code not number",
      (input) => runtimeRows(input, [{ code: "1" }]),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "duplicate runtime code",
      (input) =>
        runtimeRows(input, [
          input.game.cards[0]!.record,
          input.game.cards[0]!.record,
        ]),
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "missing closure dependency",
      ({ entries }) => {
        entries[1]!.manifest.dependencies.push({
          packId: "chapter-02",
          sha256: "f".repeat(64),
          bytes: 1,
        });
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "closure identity mismatch",
      ({ entries }) => {
        entries[1]!.manifest.dependencies = [
          { ...entries[0]!.ref, sha256: "f".repeat(64) },
        ];
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "runtime roster omits chapter card",
      ({ entries }) => {
        entries[0]!.manifest.cardCodes = [];
      },
      "CONTENT_INCOMPATIBLE",
    ],
    [
      "oversized story bytes",
      ({ files }) => {
        files.set("chapters/chapter-01/story.json", new Uint8Array(4194305));
      },
      "CONTENT_INVALID_MANIFEST",
    ],
    [
      "malformed gameplay JSON",
      ({ files }) => {
        files.set("chapters/chapter-01/gameplay.json", new Uint8Array([1]));
      },
      "CONTENT_INVALID_MANIFEST",
    ],
    [
      "malformed story JSON",
      ({ files }) => {
        files.set("chapters/chapter-01/story.json", new Uint8Array([1]));
      },
      "CONTENT_INVALID_MANIFEST",
    ],
  ];
  it.each([
    "not array",
    "null row",
    "primitive row",
    "missing code",
    "nonnumeric code",
    "duplicate code",
  ])("structural negative parity: runtime text %s", async (name) => {
    const input = fixture();
    const path = [...input.files.keys()].find((path) =>
      /catalog\/texts\//.test(path),
    )!;
    const row = input.game.cards[0]!.text;
    const values: Record<string, unknown> = {
      "not array": {},
      "null row": [null],
      "primitive row": [1],
      "missing code": [{}],
      "nonnumeric code": [{ code: "1" }],
      "duplicate code": [row, row],
    };
    input.files.set(path, encode(values[name]));
    await expect(
      verifyGameplay(input.entries, input.reader),
    ).rejects.toMatchObject({ kind: "failed", code: "CONTENT_INCOMPATIBLE" });
  });
  it("structural negative parity: required read failure preserves exact Content category", async () => {
    const input = fixture();
    input.reader.readFile = async () => ({
      kind: "failed",
      code: "CONTENT_INTEGRITY_FAILED",
      packId: null,
      path: null,
    });
    await expect(
      verifyGameplay(input.entries, input.reader),
    ).rejects.toMatchObject({
      kind: "failed",
      code: "CONTENT_INTEGRITY_FAILED",
    });
  });
  it.each(cases)(
    "structural negative parity: %s",
    async (_name, mutate, code) => {
      const input = fixture();
      mutate(input);
      await expect(
        verifyGameplay(input.entries, input.reader),
      ).rejects.toMatchObject({ kind: "failed", code });
    },
  );
});

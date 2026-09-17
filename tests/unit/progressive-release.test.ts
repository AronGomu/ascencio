import { describe, expect, it } from "vitest";
import {
  parseLatestContentPointer,
  parseProgressiveManifest,
  type CoreBootstrap,
  type ProgressiveCoreBootstrap,
} from "../../src/content/index.ts";

const version = "a".repeat(64);
const file = (path: string, role = "media", packIds = ["chapter-01"]) => ({
  path,
  version,
  bytes: 0,
  mediaType: role === "media" ? "image/png" : "application/json",
  role,
  required: role !== "media",
  packIds,
});
const chapter = (id = "chapter-01", depends: string[] = []) => ({
  id,
  title: "Chapter",
  description: "",
  depends,
  gameplayPath: `chapters/${id}/gameplay.json`,
  storyPath: null as string | null,
});
function manifest() {
  return {
    schemaVersion: 3,
    releaseSequence: 1,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId: version,
    chapters: [chapter()],
    files: [
      file("chapters/chapter-01/gameplay.json", "gameplay"),
      file("runtime/manifest.json", "runtime", ["runtime"]),
    ],
  };
}
function withMedia(path = "images/card.png") {
  const value = manifest();
  value.files.splice(1, 0, file(path));
  value.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return value;
}
const pointer = () => ({
  schemaVersion: 1,
  releaseSequence: 1,
  manifest: { version, bytes: 1024 },
});
const invalid = "CONTENT_INVALID_MANIFEST";

describe("progressive wire shape parsers", () => {
  it("accepts valid release and pointer without changing legacy bootstrap type", () => {
    const value = manifest();
    expect(parseProgressiveManifest(value)).toEqual(value);
    expect(parseLatestContentPointer(pointer())).toEqual(pointer());
    const legacy: CoreBootstrap = {
      schemaVersion: 1,
      appSchemaVersion: 1,
      contentSchemaVersion: 2,
      hashAlgorithm: "SHA-256",
      delivery: null,
      chapters: [],
    };
    const progressive: ProgressiveCoreBootstrap = {
      schemaVersion: 2,
      coreContentApiVersion: 1,
      delivery: {
        baseUrl: "http://127.0.0.1/",
        pointerPath: "content/latest.json",
      },
    };
    expect(legacy.schemaVersion).toBe(1);
    expect(progressive.schemaVersion).toBe(2);
  });

  it.each([
    null,
    [],
    "{}",
    1,
    { ...manifest(), schemaVersion: 2 },
    { ...manifest(), extra: true },
  ])("rejects wrong top-level manifest shape %j", (value) =>
    expect(() => parseProgressiveManifest(value)).toThrow(invalid),
  );

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, "1", null])(
    "rejects invalid release sequence %j in either document",
    (releaseSequence) => {
      expect(() =>
        parseProgressiveManifest({ ...manifest(), releaseSequence }),
      ).toThrow(invalid);
      expect(() =>
        parseLatestContentPointer({ ...pointer(), releaseSequence }),
      ).toThrow(invalid);
    },
  );

  it.each(["A".repeat(64), "a".repeat(63), "g".repeat(64), "", 123])(
    "rejects non-full-lowercase hashes %j",
    (bad) => {
      expect(() =>
        parseProgressiveManifest({ ...manifest(), runtimeSnapshotId: bad }),
      ).toThrow(invalid);
      const value = manifest();
      expect(() =>
        parseProgressiveManifest({
          ...value,
          files: [{ ...value.files[0], version: bad }, value.files[1]],
        }),
      ).toThrow(invalid);
      expect(() =>
        parseLatestContentPointer({
          ...pointer(),
          manifest: { ...pointer().manifest, version: bad },
        }),
      ).toThrow(invalid);
    },
  );

  it.each([
    { min: 0, maxExclusive: 2 },
    { min: 1, maxExclusive: 1 },
    { min: 2, maxExclusive: 1 },
    { min: 1.5, maxExclusive: 2 },
    { min: 1, maxExclusive: Number.MAX_SAFE_INTEGER + 1 },
    { min: 1, maxExclusive: 2, extra: 1 },
  ])("rejects invalid CORE range %j", (coreRange) =>
    expect(() =>
      parseProgressiveManifest({ ...manifest(), coreRange }),
    ).toThrow(invalid),
  );

  it.each(["chapter-00", "chapter-1", "chapter-100", "Chapter-01", "runtime"])(
    "rejects noncanonical chapter ids %s",
    (id) => {
      const value = manifest();
      value.chapters[0]!.id = id;
      expect(() => parseProgressiveManifest(value)).toThrow(invalid);
    },
  );

  it("rejects unknown nested fields, missing fields, accessors and cycles", () => {
    const value = manifest();
    expect(() =>
      parseProgressiveManifest({
        ...value,
        chapters: [{ ...value.chapters[0], extra: 1 }],
      }),
    ).toThrow(invalid);
    expect(() =>
      parseProgressiveManifest({
        ...value,
        files: [{ ...value.files[0], extra: 1 }, value.files[1]],
      }),
    ).toThrow(invalid);
    const missingFiles: Record<string, unknown> = { ...value };
    delete missingFiles.files;
    expect(() => parseProgressiveManifest(missingFiles)).toThrow(invalid);
    const accessor = { ...value };
    Object.defineProperty(accessor, "releaseSequence", {
      get: () => {
        throw new Error("accessor executed");
      },
      enumerable: true,
    });
    expect(() => parseProgressiveManifest(accessor)).toThrow(invalid);
    expect(() =>
      parseLatestContentPointer({ ...pointer(), extra: true }),
    ).toThrow(invalid);
    expect(() =>
      parseLatestContentPointer({
        ...pointer(),
        manifest: { ...pointer().manifest, extra: true },
      }),
    ).toThrow(invalid);
    const cyclic: Record<string, unknown> = { ...value };
    cyclic.self = cyclic;
    expect(() => parseProgressiveManifest(cyclic)).toThrow(invalid);
  });

  it.each([
    "/absolute",
    "a//b",
    "a/./b",
    "a/../b",
    "a\\b",
    "a?b",
    "a#b",
    "a%2Fb",
    "a b",
    "café",
    ".",
    "..",
    "",
    "https://example.invalid/a",
  ])("rejects ambiguous/non-ASCII path %s", (path) =>
    expect(() => parseProgressiveManifest(withMedia(path))).toThrow(invalid),
  );

  it("accepts exact ASCII segment grammar, not legacy Windows path policy", () => {
    for (const path of [
      "images/A_z-9.png",
      "images/.hidden",
      "images/con",
      "images/trailing.",
    ])
      expect(
        parseProgressiveManifest(withMedia(path)).files.some(
          (entry) => entry.path === path,
        ),
      ).toBe(true);
  });

  it("rejects duplicate and non-ASCII-order file paths", () => {
    const value = withMedia();
    expect(() =>
      parseProgressiveManifest({ ...value, files: [...value.files].reverse() }),
    ).toThrow(invalid);
    value.files.splice(1, 0, { ...value.files[0]! });
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
  });

  it.each([-1, 0.5, 256 * 1024 * 1024 + 1, Number.MAX_SAFE_INTEGER + 1, "0"])(
    "rejects unsafe or over-cap file length %j",
    (bytes) => {
      const value = manifest();
      expect(() =>
        parseProgressiveManifest({
          ...value,
          files: [{ ...value.files[0], bytes }, value.files[1]],
        }),
      ).toThrow(invalid);
    },
  );

  it("accepts inclusive file cap, zero bytes and maximum safe sequence/range", () => {
    const value = manifest();
    value.files[0]!.bytes = 256 * 1024 * 1024;
    value.releaseSequence = Number.MAX_SAFE_INTEGER;
    value.coreRange.maxExclusive = Number.MAX_SAFE_INTEGER;
    expect(parseProgressiveManifest(value)).toEqual(value);
  });

  it.each([
    { packIds: [] },
    { packIds: ["chapter-01", "chapter-01"] },
    { packIds: ["runtime", "chapter-01"] },
    { packIds: ["chapter-02"] },
    { packIds: ["chapter-00"] },
  ])(
    "rejects empty/duplicate/unsorted/unknown file packIds $packIds",
    ({ packIds }) => {
      const value = manifest();
      value.files[0]!.packIds = packIds;
      expect(() => parseProgressiveManifest(value)).toThrow(invalid);
    },
  );

  it("rejects role/required mismatches, nonboolean required and non-media MIME", () => {
    const value = withMedia();
    for (const required of [true, "false", null])
      expect(() =>
        parseProgressiveManifest({
          ...value,
          files: value.files.map((entry) =>
            entry.role === "media" ? { ...entry, required } : entry,
          ),
        }),
      ).toThrow(invalid);
    for (const role of ["runtime", "gameplay", "story", "unknown"])
      expect(() =>
        parseProgressiveManifest({
          ...value,
          files: value.files.map((entry) =>
            entry.role === "media" ? { ...entry, role } : entry,
          ),
        }),
      ).toThrow(invalid);
    for (const mediaType of [
      "application/json",
      "text/plain",
      "image/",
      "image/png\n",
      "ximage/png",
    ])
      expect(() =>
        parseProgressiveManifest({
          ...value,
          files: value.files.map((entry) =>
            entry.role === "media" ? { ...entry, mediaType } : entry,
          ),
        }),
      ).toThrow(invalid);
    for (const mediaType of ["image/svg+xml", "audio/ogg", "video/mp4"])
      expect(
        parseProgressiveManifest({
          ...value,
          files: value.files.map((entry) =>
            entry.role === "media" ? { ...entry, mediaType } : entry,
          ),
        }).files[1]!.mediaType,
      ).toBe(mediaType);
  });

  it("rejects a header-unsafe MIME type on a required file", () => {
    const value = manifest();
    value.files[1]!.mediaType = "application/json\r\nx-content: injected";
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
  });

  it("rejects a required runtime file without the runtime pack", () => {
    const value = manifest();
    value.files[1]!.packIds = ["chapter-01"];
    expect(value.files[1]!.required).toBe(true);
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
  });

  it("requires chapter gameplay/story references with matching role and owner", () => {
    const value = manifest();
    value.chapters[0]!.storyPath = "chapters/chapter-01/story.json";
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
    value.files.splice(1, 0, file(value.chapters[0]!.storyPath, "story"));
    expect(parseProgressiveManifest(value)).toEqual(value);
    value.chapters[0]!.storyPath = value.chapters[0]!.gameplayPath;
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
    const wrongOwner = manifest();
    wrongOwner.files[0]!.packIds = ["runtime"];
    expect(() => parseProgressiveManifest(wrongOwner)).toThrow(invalid);
    const wrongPath = manifest();
    wrongPath.chapters[0]!.gameplayPath = "absent.json";
    expect(() => parseProgressiveManifest(wrongPath)).toThrow(invalid);
  });

  it("rejects runtime-only releases and chapters without mandatory runtime", () => {
    expect(() =>
      parseProgressiveManifest({ ...manifest(), chapters: [] }),
    ).toThrow(invalid);
    expect(() =>
      parseProgressiveManifest({ ...manifest(), files: [] }),
    ).toThrow(invalid);
    const value = manifest();
    value.files.pop();
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
  });

  it("checks bounded transitive dependency closure, cycles, sorted unique chapters", () => {
    const value = manifest();
    value.chapters.push(
      chapter("chapter-02", ["chapter-01"]),
      chapter("chapter-03", ["chapter-01", "chapter-02"]),
    );
    value.files = [
      ...value.chapters.map((entry) =>
        file(entry.gameplayPath, "gameplay", [entry.id]),
      ),
      value.files[1]!,
    ];
    expect(parseProgressiveManifest(value)).toEqual(value);
    for (const depends of [
      ["chapter-02"],
      ["chapter-02", "chapter-01"],
      ["chapter-01", "chapter-01"],
      ["chapter-04"],
      ["chapter-03"],
    ]) {
      const copy = structuredClone(value);
      copy.chapters[2]!.depends = depends;
      expect(() => parseProgressiveManifest(copy)).toThrow(invalid);
    }
    const cycle = structuredClone(value);
    cycle.chapters[0]!.depends = ["chapter-03"];
    expect(() => parseProgressiveManifest(cycle)).toThrow(invalid);
    expect(() =>
      parseProgressiveManifest({
        ...value,
        chapters: [...value.chapters].reverse(),
      }),
    ).toThrow(invalid);
    expect(() =>
      parseProgressiveManifest({
        ...value,
        chapters: [value.chapters[0], ...value.chapters],
      }),
    ).toThrow(invalid);
  });

  it("accepts 50,000 files / 99 chapters; rejects either count above cap", () => {
    const value = manifest();
    value.chapters = Array.from({ length: 99 }, (_, i) =>
      chapter(`chapter-${String(i + 1).padStart(2, "0")}`),
    );
    value.files = [
      ...value.chapters.map((entry) =>
        file(entry.gameplayPath, "gameplay", [entry.id]),
      ),
      ...Array.from({ length: 49900 }, (_, i) =>
        file(`images/${String(i).padStart(5, "0")}.png`),
      ),
      file("runtime/manifest.json", "runtime", ["runtime"]),
    ];
    expect(parseProgressiveManifest(value).files).toHaveLength(50000);
    expect(() =>
      parseProgressiveManifest({
        ...value,
        files: [...value.files, file("z.png")],
      }),
    ).toThrow(invalid);
    expect(() =>
      parseProgressiveManifest({
        ...manifest(),
        chapters: Array.from({ length: 100 }, () => chapter()),
      }),
    ).toThrow(invalid);
  });

  it("rejects over-32-MiB compact metadata without claiming original-body verification", () => {
    const value = manifest();
    value.chapters[0]!.description = "x".repeat(32 * 1024 * 1024);
    expect(() => parseProgressiveManifest(value)).toThrow(invalid);
  });

  it.each([
    0,
    -1,
    0.5,
    32 * 1024 * 1024 + 1,
    Number.MAX_SAFE_INTEGER + 1,
    "1024",
  ])("rejects impossible pointer manifest length %j", (bytes) =>
    expect(() =>
      parseLatestContentPointer({ ...pointer(), manifest: { version, bytes } }),
    ).toThrow(invalid),
  );
});

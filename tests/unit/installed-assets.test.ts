import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChapterFileRef,
  ContentManifest,
  ContentReadPort,
  ContentResult,
  ContentSetRef,
  ManifestRef,
} from "../../src/content/index.ts";
import { acquireInstalledAsset } from "../../src/content/index.ts";

const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const imageBytes = new Uint8Array([137, 80, 78, 71]);
const svgBytes = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
);
const runtimeSnapshotId = sha("runtime");
const catalogSha256 = sha("catalog");
const runtimeRef: ManifestRef = {
  packId: "runtime",
  sha256: sha("runtime-manifest"),
  bytes: 1,
};
const chapterRef: ManifestRef = {
  packId: "chapter-01",
  sha256: sha("chapter-manifest"),
  bytes: 1,
};
const file: ChapterFileRef = {
  packId: "chapter-01",
  path: "chapters/chapter-01/card.png",
};
const packedFile = {
  path: file.path,
  bytes: imageBytes.length,
  sha256: sha(imageBytes),
  mediaType: "image/png" as const,
  partSha256: sha("part"),
  entry: file.path,
};
const svgFile: ChapterFileRef = {
  packId: "chapter-01",
  path: "chapters/chapter-01/set.svg",
};
const packedSvg = {
  path: svgFile.path,
  bytes: svgBytes.length,
  sha256: sha(svgBytes),
  mediaType: "image/svg+xml" as const,
  partSha256: sha("part"),
  entry: svgFile.path,
};
const runtimeManifest: ContentManifest = {
  schemaVersion: 2,
  packId: "runtime",
  runtimeSnapshotId,
  storyContentId: null,
  gameplayPath: null,
  dependencies: [],
  cardCodes: [1],
  opponentIds: [],
  parts: [],
  files: [],
};
const chapterManifest: ContentManifest = {
  schemaVersion: 2,
  packId: "chapter-01",
  runtimeSnapshotId,
  storyContentId: null,
  gameplayPath: "chapters/chapter-01/gameplay.json",
  dependencies: [runtimeRef],
  cardCodes: [1],
  opponentIds: ["rival"],
  parts: [],
  files: [packedFile, packedSvg],
};
const content: ContentSetRef = {
  catalogSha256,
  snapshot: {
    activationId: sha("activation"),
    runtimeSnapshotId,
    runtimeManifestSha256: sha("runtime-file"),
    releaseCatalogSha256: catalogSha256,
  },
  runtime: runtimeRef,
  chapters: [chapterRef],
};

interface TestReader extends ContentReadPort {
  notifyChanged(): void;
}

function readerWith(
  readFile: () => Promise<ContentResult<Blob>> = async () => ({
    kind: "ok",
    value: new Blob([imageBytes], { type: "image/png" }),
  }),
): TestReader {
  const listeners = new Set<
    Parameters<ContentReadPort["subscribeCurrent"]>[0]
  >();
  const manifests = new Map([
    [runtimeRef.sha256, runtimeManifest],
    [chapterRef.sha256, chapterManifest],
  ]);
  return {
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
    readFile: vi.fn(readFile),
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
          kind: "failed",
          code: "CONTENT_MISSING",
          packId: "chapter-01",
          path: file.path,
        });
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ close: vi.fn() })),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:installed-card"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("acquireInstalledAsset", () => {
  it("X4 — verified media is cache-only", async () => {
    const reader = readerWith();
    const result = await acquireInstalledAsset(reader, content, file);
    expect(result).toMatchObject({
      kind: "ok",
      value: { url: "blob:installed-card" },
    });
    expect(reader.readFile).toHaveBeenCalledWith(chapterRef, file.path);
    expect(fetch).not.toHaveBeenCalled();
    if (result.kind === "ok") result.value.release();
  });

  it.each([
    {
      name: "evicted",
      read: async () => ({
        kind: "failed" as const,
        code: "CONTENT_MISSING" as const,
        packId: null,
        path: null,
      }),
      code: "CONTENT_MISSING",
    },
    {
      name: "bad SHA",
      read: async () => ({
        kind: "ok" as const,
        value: new Blob([new Uint8Array([0, 0, 0, 0])], {
          type: "image/png",
        }),
      }),
      code: "CONTENT_INTEGRITY_FAILED",
    },
  ])("X4 — $name media fails closed", async ({ read, code }) => {
    await expect(
      acquireInstalledAsset(readerWith(read), content, file),
    ).resolves.toMatchObject({
      kind: "failed",
      code,
      packId: "chapter-01",
      path: file.path,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("X4 — decode failure returns scoped integrity failure", async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("bad image"));
    await expect(
      acquireInstalledAsset(readerWith(), content, file),
    ).resolves.toEqual({
      kind: "failed",
      code: "CONTENT_INTEGRITY_FAILED",
      packId: "chapter-01",
      path: file.path,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:installed-card");
  });

  it("X4 — SVG uses safe image load and decode", async () => {
    const decode = vi.fn(async () => undefined);
    class TestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readonly decode = decode;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", TestImage);
    const reader = readerWith(async () => ({
      kind: "ok",
      value: new Blob([svgBytes], { type: "image/svg+xml" }),
    }));
    const result = await acquireInstalledAsset(reader, content, svgFile);
    expect(result).toMatchObject({ kind: "ok" });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(createImageBitmap).not.toHaveBeenCalled();
    if (result.kind === "ok") result.value.release();
  });

  it("state-change hint clears inspection and revokes active lease", async () => {
    const reader = readerWith();
    const first = await acquireInstalledAsset(reader, content, file);
    expect(first.kind).toBe("ok");
    reader.notifyChanged();
    await vi.waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:installed-card"),
    );
    const second = await acquireInstalledAsset(reader, content, file);
    expect(second.kind).toBe("ok");
    expect(reader.inspectContent).toHaveBeenCalledTimes(2);
    expect(reader.readFile).toHaveBeenCalledTimes(2);
    if (first.kind === "ok") first.value.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    if (second.kind === "ok") second.value.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("stops before cache insertion after an earlier state-change hint", async () => {
    const reader = readerWith();
    let readStarted!: () => void;
    let continueRead!: () => void;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      continueRead = resolve;
    });
    const readManifest = vi.mocked(reader.readManifest);
    const original = readManifest.getMockImplementation()!;
    readManifest.mockImplementationOnce(async (...args) => {
      readStarted();
      await gate;
      return original(...args);
    });

    const stale = acquireInstalledAsset(reader, content, file);
    await started;
    reader.notifyChanged();
    continueRead();
    await expect(stale).resolves.toMatchObject({
      kind: "failed",
      code: "CONTENT_MISSING",
      packId: "chapter-01",
      path: file.path,
    });
    expect(reader.readFile).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    const fresh = await acquireInstalledAsset(reader, content, file);
    expect(fresh.kind).toBe("ok");
    expect(reader.readFile).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    if (fresh.kind === "ok") fresh.value.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("stale acquisition cannot revoke a newer generation lease", async () => {
    const reader = readerWith();
    let readStarted!: () => void;
    let continueRead!: () => void;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      continueRead = resolve;
    });
    const readManifest = vi.mocked(reader.readManifest);
    const original = readManifest.getMockImplementation()!;
    readManifest.mockImplementationOnce(async (...args) => {
      readStarted();
      await gate;
      return original(...args);
    });

    const stale = acquireInstalledAsset(reader, content, file);
    await started;
    reader.notifyChanged();
    const fresh = await acquireInstalledAsset(reader, content, file);
    expect(fresh.kind).toBe("ok");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    continueRead();
    await expect(stale).resolves.toMatchObject({
      kind: "failed",
      code: "CONTENT_MISSING",
    });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(reader.readFile).toHaveBeenCalledTimes(1);
    if (fresh.kind === "ok") fresh.value.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("X5 — last media lease revokes URL", async () => {
    const reader = readerWith();
    const [first, second] = await Promise.all([
      acquireInstalledAsset(reader, content, file),
      acquireInstalledAsset(reader, content, file),
    ]);
    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");
    if (first.kind !== "ok" || second.kind !== "ok") throw new Error("lease");
    expect(first.value.url).toBe(second.value.url);
    expect(reader.inspectContent).toHaveBeenCalledTimes(1);
    expect(reader.readFile).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    first.value.release();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    second.value.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

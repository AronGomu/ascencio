// @vitest-environment jsdom
import { createHash } from "node:crypto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ContentManifest,
  ContentReadPort,
  ContentSetRef,
  ManifestRef,
} from "../../src/content/index.ts";
import { acquireInstalledAsset } from "../../src/content/index.ts";
import InstalledCardMediaHarness from "../fixtures/InstalledCardMediaHarness.svelte";

const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const bytes = new Uint8Array([137, 80, 78, 71]);
const runtime: ManifestRef = {
  packId: "runtime",
  sha256: hash("runtime-manifest"),
  bytes: 1,
};
const chapter: ManifestRef = {
  packId: "chapter-01",
  sha256: hash("chapter-manifest"),
  bytes: 1,
};
const chapterTwo: ManifestRef = {
  packId: "chapter-02",
  sha256: hash("chapter-two-manifest"),
  bytes: 1,
};
const runtimeSnapshotId = hash("runtime");
const catalogSha256 = hash("catalog");
const path = "chapters/chapter-01/card.png";
const chapterTwoPath = "chapters/chapter-02/card.png";
const imageFile = (filePath: string) => ({
  path: filePath,
  bytes: bytes.length,
  sha256: hash(bytes),
  mediaType: "image/png" as const,
  partSha256: hash("part"),
  entry: filePath,
});
const manifests = new Map<string, ContentManifest>([
  [
    runtime.sha256,
    {
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
    },
  ],
  [
    chapter.sha256,
    {
      schemaVersion: 2,
      packId: "chapter-01",
      runtimeSnapshotId,
      storyContentId: null,
      gameplayPath: "chapters/chapter-01/gameplay.json",
      dependencies: [runtime],
      cardCodes: [1],
      opponentIds: ["rival"],
      parts: [],
      files: [imageFile(path)],
    },
  ],
  [
    chapterTwo.sha256,
    {
      schemaVersion: 2,
      packId: "chapter-02",
      runtimeSnapshotId,
      storyContentId: null,
      gameplayPath: "chapters/chapter-02/gameplay.json",
      dependencies: [runtime],
      cardCodes: [1],
      opponentIds: ["rival"],
      parts: [],
      files: [imageFile(chapterTwoPath)],
    },
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
  runtime,
  chapters: [chapter, chapterTwo],
};

function readerWith(): ContentReadPort {
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
    readFile: vi.fn(async () => ({
      kind: "ok" as const,
      value: new Blob([bytes], { type: "image/png" }),
    })),
    readCatalog: vi.fn(),
    current: vi.fn(),
    subscribeCurrent: vi.fn(() => () => undefined),
    acquireSession: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ close: vi.fn() })),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:component-card"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("installed card media consumer", () => {
  it("releases the verified media lease on unmount", async () => {
    const reader = readerWith();
    const view = render(InstalledCardMediaHarness, {
      acquire: () =>
        acquireInstalledAsset(reader, content, {
          packId: "chapter-01",
          path,
        }),
      manifest: chapter,
      file: { packId: "chapter-01", path },
      invalidate: async () => ({
        kind: "ok",
        value: { generation: 1, current: content, previous: null },
      }),
    });
    expect((await screen.findByRole("img")).getAttribute("src")).toBe(
      "blob:component-card",
    );
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:component-card");
  });

  it("forwards scoped media failure, reduces union, and releases URL", async () => {
    const reader = readerWith();
    const reduced = { ...content, chapters: [chapter] };
    const invalidate = vi.fn(async () => ({
      kind: "ok" as const,
      value: { generation: 2, current: reduced, previous: content },
    }));
    const onfailure = vi.fn();
    const oninvalidated = vi.fn();
    const oninvalidationfailure = vi.fn();
    render(InstalledCardMediaHarness, {
      acquire: () =>
        acquireInstalledAsset(reader, content, {
          packId: "chapter-02",
          path: chapterTwoPath,
        }),
      manifest: chapterTwo,
      file: { packId: "chapter-02", path: chapterTwoPath },
      invalidate,
      onfailure,
      oninvalidated,
      oninvalidationfailure,
    });
    const image = await screen.findByRole("img");
    await fireEvent.error(image);
    await waitFor(() => expect(oninvalidated).toHaveBeenCalledTimes(1));
    const scoped = {
      kind: "failed" as const,
      code: "CONTENT_INTEGRITY_FAILED" as const,
      packId: "chapter-02" as const,
      path: chapterTwoPath,
    };
    expect(onfailure).toHaveBeenCalledWith(scoped);
    expect(invalidate).toHaveBeenCalledWith(chapterTwo, scoped);
    expect(oninvalidated).toHaveBeenCalledWith({
      generation: 2,
      current: reduced,
      previous: content,
    });
    expect(oninvalidated.mock.calls[0]![0].current.chapters).toEqual([chapter]);
    expect(oninvalidationfailure).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:component-card");
  });

  it("surfaces invalidation failure", async () => {
    const oninvalidationfailure = vi.fn();
    render(InstalledCardMediaHarness, {
      acquire: async () => ({
        kind: "failed",
        code: "CONTENT_MISSING",
        packId: "chapter-01",
        path,
      }),
      manifest: chapter,
      file: { packId: "chapter-01", path },
      invalidate: async () => ({
        kind: "failed",
        code: "CONTENT_BUSY",
        packId: "chapter-01",
        path,
      }),
      oninvalidationfailure,
    });
    await waitFor(() =>
      expect(oninvalidationfailure).toHaveBeenCalledWith({
        kind: "failed",
        code: "CONTENT_BUSY",
        packId: "chapter-01",
        path,
      }),
    );
  });
});

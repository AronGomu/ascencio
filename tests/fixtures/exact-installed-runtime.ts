import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import type {
  ContentIndex,
  ContentManifest,
  ContentSetRef,
  InstalledRuntimeReceipt,
  OwnedContentReader,
} from "../../src/content/index.ts";

export const EXACT_CONTENT_RUN =
  "generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807";
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Exact private producer artifacts; no fallback to synthetic or legacy assets. */
export async function exactInstalledRuntime() {
  const object = async (key: string) =>
    new Uint8Array(await readFile(`${EXACT_CONTENT_RUN}/objects/${key}`));
  const candidate = JSON.parse(
    await readFile(`${EXACT_CONTENT_RUN}/candidate.json`, "utf8"),
  );
  const snapshotBytes = await object(candidate.snapshot.key);
  if (sha(snapshotBytes) !== candidate.snapshot.sha256)
    throw new Error("Exact snapshot digest mismatch");
  const snapshot = JSON.parse(new TextDecoder().decode(snapshotBytes));
  const catalogBytes = await object(snapshot.prod.index.key);
  if (sha(catalogBytes) !== snapshot.prod.index.sha256)
    throw new Error("Exact catalog digest mismatch");
  const catalog = JSON.parse(
    new TextDecoder().decode(catalogBytes),
  ) as ContentIndex;
  const chapter = catalog.chapters.find(
    (chapter) => chapter.status === "published",
  );
  if (chapter?.status !== "published") throw new Error("No published chapter");
  const manifests = new Map<
    string,
    { bytes: Uint8Array; sha256: string; value: ContentManifest }
  >();
  const files = new Map<string, Uint8Array>();
  for (const ref of [catalog.runtime, chapter.manifest]) {
    const bytes = await object(`content/manifests/${ref.sha256}.json`);
    if (sha(bytes) !== ref.sha256 || bytes.length !== ref.bytes)
      throw new Error("Exact manifest mismatch");
    const manifest = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as ContentManifest;
    manifests.set(ref.packId, { bytes, sha256: ref.sha256, value: manifest });
    for (const part of manifest.parts) {
      const bytes = await object(`content/parts/${part.sha256}.zip`);
      if (sha(bytes) !== part.sha256 || bytes.length !== part.bytes)
        throw new Error("Exact part mismatch");
      const zip = new ZipReader(new Uint8ArrayReader(bytes));
      try {
        for (const entry of await zip.getEntries()) {
          if (entry.directory) continue;
          const record = manifest.files.find(
            (file) => file.path === entry.filename,
          );
          const bytes = await entry.getData(new Uint8ArrayWriter());
          if (
            !record ||
            sha(bytes) !== record.sha256 ||
            bytes.length !== record.bytes
          )
            throw new Error("Exact file mismatch");
          files.set(entry.filename, bytes);
        }
      } finally {
        await zip.close();
      }
    }
  }
  const runtime = manifests.get("runtime")!.value;
  const runtimeManifestFile = runtime.files.find(
    (file) => file.path === "runtime/current/manifest.json",
  )!;
  const runtimeSnapshotId = catalog.runtimeSnapshotId;
  const releaseCatalogSha256 = snapshot.prod.index.sha256;
  const content: ContentSetRef = {
    catalogSha256: releaseCatalogSha256,
    runtime: catalog.runtime,
    chapters: [chapter.manifest],
    snapshot: {
      runtimeSnapshotId,
      releaseCatalogSha256,
      runtimeManifestSha256: runtimeManifestFile.sha256,
      activationId: sha(
        new TextEncoder().encode(
          JSON.stringify({ runtimeSnapshotId, releaseCatalogSha256 }),
        ),
      ),
    },
  };
  let closes = 0;
  const reader: OwnedContentReader = {
    close() {
      closes++;
    },
    current: async () => ({
      kind: "ok",
      value: { generation: 1, current: content, previous: null },
    }),
    subscribeCurrent: () => () => undefined,
    readCatalog: async () => ({
      kind: "ok",
      value: {
        bytes: catalogBytes,
        sha256: releaseCatalogSha256,
        value: catalog,
      },
    }),
    readManifest: async (ref) => ({
      kind: "ok",
      value: manifests.get(ref.packId)!,
    }),
    readFile: async (_ref, path) => ({
      kind: "ok",
      value: new Blob([files.get(path)!.slice()]),
    }),
    inspectContent: async () => ({ kind: "ok", value: content }),
    acquireSession: async () => ({
      kind: "ok",
      value: { content, release() {} },
    }),
  };
  const receiptFile = (path: string) => {
    const file = runtime.files.find((file) => file.path === path)!;
    return { path, bytes: file.bytes, sha256: file.sha256 };
  };
  const receipt: InstalledRuntimeReceipt = {
    schemaVersion: 1,
    kind: "installed-runtime-v1",
    snapshot: content.snapshot,
    runtimePack: content.runtime,
    verifiedAt: 1,
    runtimeManifestFile: receiptFile("runtime/current/manifest.json"),
    assetManifestFile: receiptFile("runtime/assets/current/manifest.json"),
    engineManifestFile: receiptFile("runtime/engine/vendor-manifest.json"),
  };
  return { reader, receipt, content, files, closes: () => closes };
}

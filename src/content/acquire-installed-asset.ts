import type { ChapterFileRef } from "./contracts/chapter-file-ref.ts";
import type { ContentFailure } from "./contracts/content-failure.ts";
import type { ContentReadPort } from "./contracts/content-read-port.ts";
import type { ContentResult } from "./contracts/content-result.ts";
import type { ContentSetRef } from "./contracts/content-set-ref.ts";
import type { InstalledAssetLease } from "./contracts/installed-asset-lease.ts";
import type { ManifestRef } from "./contracts/manifest-ref.ts";
import {
  contentError,
  digest,
  failure,
  unwrap,
} from "./content-verification.ts";
import { inspectInstalledContent } from "./installed-content-inspection.ts";
import { installedContentState } from "./installed-content-state.ts";
import { manifestClosure } from "./install/manifest-closure.ts";
import { packId, safePath } from "./parsers/schema.ts";

interface SharedAsset {
  readonly url: string;
  references: number;
  revoked: boolean;
}

interface ReaderAssetCache {
  readonly entries: Map<string, Promise<SharedAsset>>;
}

const assetCaches = new WeakMap<ContentReadPort, ReaderAssetCache>();

function revokeSharedAsset(asset: SharedAsset): void {
  if (asset.revoked) return;
  asset.revoked = true;
  URL.revokeObjectURL(asset.url);
}

function assetCache(reader: ContentReadPort): ReaderAssetCache {
  const existing = assetCaches.get(reader);
  if (existing !== undefined) return existing;
  const cache: ReaderAssetCache = { entries: new Map() };
  assetCaches.set(reader, cache);
  installedContentState(reader).listeners.add(() => {
    for (const pending of cache.entries.values())
      void pending.then(revokeSharedAsset, () => undefined);
    cache.entries.clear();
  });
  return cache;
}

function scopedFailure(
  code: ContentFailure["code"],
  file: ChapterFileRef,
): ContentFailure {
  return {
    kind: "failed",
    code,
    packId: file.packId,
    path: file.path,
  };
}

async function decodeSvg(url: string): Promise<void> {
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("CONTENT_INTEGRITY_FAILED"));
      image.src = url;
    });
    await image.decode();
  } finally {
    image.onload = null;
    image.onerror = null;
  }
}

async function loadAsset(
  reader: ContentReadPort,
  manifest: ManifestRef,
  file: ChapterFileRef,
  expected: {
    readonly bytes: number;
    readonly sha256: string;
    readonly mediaType: string;
  },
): Promise<SharedAsset> {
  const result = await reader.readFile(manifest, file.path);
  if (result.kind === "failed") throw scopedFailure(result.code, file);
  const blob = result.value;
  if (blob.size !== expected.bytes || blob.type !== expected.mediaType)
    throw scopedFailure("CONTENT_INTEGRITY_FAILED", file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if ((await digest(bytes)) !== expected.sha256)
    throw scopedFailure("CONTENT_INTEGRITY_FAILED", file);

  let url: string;
  try {
    url = URL.createObjectURL(blob);
  } catch {
    throw scopedFailure("CONTENT_STORAGE_UNAVAILABLE", file);
  }
  try {
    if (expected.mediaType === "image/svg+xml") await decodeSvg(url);
    else {
      const bitmap = await createImageBitmap(blob);
      bitmap.close();
    }
  } catch {
    URL.revokeObjectURL(url);
    throw scopedFailure("CONTENT_INTEGRITY_FAILED", file);
  }
  return { url, references: 0, revoked: false };
}

export async function acquireInstalledAsset(
  reader: ContentReadPort,
  ref: ContentSetRef,
  input: ChapterFileRef,
): Promise<ContentResult<InstalledAssetLease>> {
  if (!Array.isArray(ref?.chapters) || ref.chapters.length === 0)
    return failure("CONTENT_MISSING");
  let file: ChapterFileRef;
  try {
    file = { packId: packId(input?.packId), path: safePath(input?.path) };
  } catch {
    return failure("CONTENT_INVALID_MANIFEST");
  }
  try {
    unwrap(await inspectInstalledContent(reader, ref));
    const state = installedContentState(reader);
    const revision = state.revision;
    const entries = await manifestClosure(
      [ref.runtime, ...ref.chapters],
      async (manifestRef) =>
        unwrap(await reader.readManifest(manifestRef)).value,
    );
    const owner = entries.find(({ ref }) => ref.packId === file.packId);
    const expected = owner?.manifest.files.find(
      ({ path }) => path === file.path,
    );
    if (!owner || !expected) throw scopedFailure("CONTENT_MISSING", file);
    if (!expected.mediaType.startsWith("image/"))
      throw scopedFailure("CONTENT_INCOMPATIBLE", file);
    if (state.revision !== revision)
      throw scopedFailure("CONTENT_MISSING", file);

    const cache = assetCache(reader);
    const key = `${owner.ref.sha256}:${expected.sha256}:${file.path}`;
    let pending = cache.entries.get(key);
    let ownsPending = false;
    if (pending === undefined) {
      ownsPending = true;
      const loading = loadAsset(reader, owner.ref, file, expected);
      const created = loading.catch((error) => {
        if (cache.entries.get(key) === created) cache.entries.delete(key);
        throw error;
      });
      pending = created;
      cache.entries.set(key, pending);
    }
    const shared = await pending;
    if (state.revision !== revision || shared.revoked) {
      if (ownsPending) {
        if (cache.entries.get(key) === pending) cache.entries.delete(key);
        revokeSharedAsset(shared);
      }
      throw scopedFailure("CONTENT_MISSING", file);
    }
    shared.references += 1;
    let released = false;
    const lease: InstalledAssetLease = Object.freeze({
      url: shared.url,
      release(): void {
        if (released) return;
        released = true;
        shared.references -= 1;
        if (shared.references !== 0 || shared.revoked) return;
        if (cache.entries.get(key) === pending) cache.entries.delete(key);
        revokeSharedAsset(shared);
      },
    });
    return { kind: "ok", value: lease };
  } catch (error) {
    return contentError(error);
  }
}

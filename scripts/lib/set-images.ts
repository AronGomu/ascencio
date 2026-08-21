import { createHash } from "node:crypto";

/* ADR-052. Shop set art is decoration served as a plain static runtime URL,
   but the bytes are still pinned by hash so a build stays reproducible. These
   helpers are the pure half of that: `scripts/download-set-images.ts` performs
   the network and file I/O, `scripts/verify-set-images.ts` re-hashes, and
   `scripts/lib/vite-runtime-assets.ts` publishes the result. */

/** A shop set as `public/story/shop-sets.v1.json` records it. */
export interface ShopSetIdentity {
  readonly id: string;
  readonly name: string;
}

/** One record of the YGOPRODeck `cardsets.php` index. */
export interface UpstreamSetRecord {
  readonly set_name?: unknown;
  readonly set_image?: unknown;
}

/** A shop set paired with its upstream art, or `null` when it has none. */
export interface SetImageSource {
  readonly setId: string;
  readonly sourceUrl: string | null;
}

/** A resolved source plus the bytes fetched for it, if any. */
export interface SetImageDownload extends SetImageSource {
  readonly bytes: Uint8Array | null;
}

export interface SetImageRecord {
  readonly setId: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly sourceUrl: string;
}

export interface SetImageManifest {
  readonly schemaVersion: 1;
  readonly provider: "ygoprodeck";
  readonly files: readonly SetImageRecord[];
  readonly missing: readonly string[];
}

export interface SetImageFile {
  readonly fileName: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface SetImageVerification {
  readonly status: "ok" | "failed";
  readonly failures: readonly string[];
}

/* Set ids become file names and URL segments, so they are confined to
   characters that cannot traverse, escape or encode. Every id in
   `public/story/shop-sets.v1.json` is a lowercase slug; the pattern also
   admits the upstream set codes so a code-keyed caller stays legal. */
const SAFE_SET_ID = /^[A-Za-z0-9_-]+$/;

/* The art host is pinned. `cardsets.php` is fetched over the network, so an
   unexpected `set_image` origin would turn one upstream record into an
   arbitrary outbound request from an acquisition run. A rejected origin is
   recorded as missing art rather than raised, so one odd record cannot stop
   the other 49 sets from being acquired. */
const IMAGE_ORIGIN = "https://images.ygoprodeck.com/";

export function setImageFileName(setId: string): string {
  if (!SAFE_SET_ID.test(setId)) {
    throw new Error(`Set id is not a safe file name: ${setId}`);
  }
  return `${setId}.jpg`;
}

export function setImageRuntimePath(setId: string): string {
  return `runtime/sets/${setImageFileName(setId)}`;
}

/**
 * Pair every shop set with the upstream image URL for its name. A set the
 * upstream index does not carry, or carries without a `set_image`, resolves to
 * `null`: missing art is recorded, never an error.
 */
export function resolveSetImageSources(
  sets: readonly ShopSetIdentity[],
  upstream: readonly UpstreamSetRecord[],
): SetImageSource[] {
  const imageByName = new Map<string, string>();
  for (const record of upstream) {
    if (typeof record.set_name !== "string") continue;
    if (typeof record.set_image !== "string") continue;
    if (!record.set_image.startsWith(IMAGE_ORIGIN)) continue;
    if (!imageByName.has(record.set_name)) {
      imageByName.set(record.set_name, record.set_image);
    }
  }
  return sets.map((set) => {
    // Reject an unusable id while acquiring rather than at write time.
    setImageFileName(set.id);
    return { setId: set.id, sourceUrl: imageByName.get(set.name) ?? null };
  });
}

/** Hash every downloaded set image; record the rest under `missing`. */
export function buildSetImageManifest(
  downloads: readonly SetImageDownload[],
): SetImageManifest {
  const files: SetImageRecord[] = [];
  const missing: string[] = [];
  for (const download of downloads) {
    if (download.bytes === null || download.sourceUrl === null) {
      missing.push(download.setId);
      continue;
    }
    files.push({
      setId: download.setId,
      sha256: createHash("sha256").update(download.bytes).digest("hex"),
      bytes: download.bytes.byteLength,
      sourceUrl: download.sourceUrl,
    });
  }
  return {
    schemaVersion: 1,
    provider: "ygoprodeck",
    files: files.sort((left, right) => left.setId.localeCompare(right.setId)),
    missing: missing.sort((left, right) => left.localeCompare(right)),
  };
}

/** Fail on drifted bytes, a missing file, or a file the manifest never listed. */
export function verifySetImageManifest(
  manifest: SetImageManifest,
  filesOnDisk: readonly SetImageFile[],
): SetImageVerification {
  const failures: string[] = [];
  const onDisk = new Map(filesOnDisk.map((file) => [file.fileName, file]));
  for (const record of manifest.files) {
    const fileName = setImageFileName(record.setId);
    const file = onDisk.get(fileName);
    onDisk.delete(fileName);
    if (file === undefined) {
      failures.push(`Set image is missing: ${record.setId}`);
      continue;
    }
    if (file.bytes !== record.bytes) {
      failures.push(
        `Set image byte length changed: ${record.setId} expected ${record.bytes}, found ${file.bytes}`,
      );
    }
    if (file.sha256 !== record.sha256) {
      failures.push(
        `Set image bytes drifted: ${record.setId} expected ${record.sha256}, found ${file.sha256}`,
      );
    }
  }
  for (const fileName of onDisk.keys()) {
    failures.push(`Set image is not listed in the manifest: ${fileName}`);
  }
  return { status: failures.length ? "failed" : "ok", failures };
}

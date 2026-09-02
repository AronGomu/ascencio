import type { SetImageFile } from "./set-images.ts";
import { setImageFileName } from "./set-images.ts";

/* Audit F16b. Every other image check re-hashes files against a manifest that
   was generated from those same files, so bytes substituted upstream verify
   clean: `scripts/lib/active-image-manifest.ts` hashes the archive after it
   lands, and `scripts/download-set-images.ts` writes the digests it then
   verifies. `generated/` is gitignored, so no reviewer diff ever showed the
   change either.

   This lock is the one image digest under version control, covering the
   shipped surface only: the preset-deck card codes and the shop set art. Both
   verifiers compare against it, so drifted bytes fail the build.

   What it proves is "unchanged since we pinned it", not "genuine". YGOPRODeck
   publishes no digest, so the lock is trust-on-first-use seeded and cannot
   attest provenance. Regenerating it is an explicit act (`npm run assets:lock`)
   and never a side effect of downloading or verifying, or the loop would close
   on itself again. */

/** Tracked, at the repository root beside `assets-source-lock.json`. */
export const IMAGE_CONTENT_LOCK_FILE = "image-content-lock.json";

/** One pinned card image, and the shape observed files are compared in. */
export interface CardImageDigest {
  readonly code: number;
  readonly bytes: number;
  readonly sha256: string;
}

export interface SetImageDigest {
  readonly setId: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ImageContentLock {
  readonly schemaVersion: 2;
  readonly provider: "ygoprodeck";
  readonly cards: readonly CardImageDigest[];
  readonly crops: readonly CardImageDigest[];
  readonly sets: readonly SetImageDigest[];
}

/**
 * Order entries and keys so the serialized lock depends on content alone: a
 * diff then shows art whose bytes moved and nothing else.
 */
export function buildImageContentLock(
  cards: readonly CardImageDigest[],
  crops: readonly CardImageDigest[],
  sets: readonly SetImageDigest[],
): ImageContentLock {
  const orderedCards = (records: readonly CardImageDigest[]) =>
    [...records]
      .sort((left, right) => left.code - right.code)
      .map(({ code, bytes, sha256 }) => ({ code, bytes, sha256 }));
  return {
    schemaVersion: 2,
    provider: "ygoprodeck",
    cards: orderedCards(cards),
    crops: orderedCards(crops),
    sets: [...sets]
      .sort((left, right) => left.setId.localeCompare(right.setId))
      .map(({ setId, bytes, sha256 }) => ({ setId, bytes, sha256 })),
  };
}

/** Fail on drifted bytes, a missing image, or shipped art the lock never pinned. */
export function verifyLockedCardImages(
  lock: Pick<ImageContentLock, "cards">,
  observed: readonly CardImageDigest[],
): string[] {
  const failures: string[] = [];
  const remaining = new Map(observed.map((file) => [file.code, file]));
  for (const record of lock.cards) {
    const file = remaining.get(record.code);
    remaining.delete(record.code);
    if (file === undefined) {
      failures.push(`Locked card image is missing: ${record.code}`);
      continue;
    }
    if (file.bytes !== record.bytes) {
      failures.push(
        `Locked card image byte length changed: ${record.code} expected ${record.bytes}, found ${file.bytes}`,
      );
    }
    if (file.sha256 !== record.sha256) {
      failures.push(
        `Locked card image bytes drifted: ${record.code} expected ${record.sha256}, found ${file.sha256}`,
      );
    }
  }
  for (const code of remaining.keys()) {
    failures.push(`Card image is not pinned by the image lock: ${code}`);
  }
  return failures;
}

/** The set-art half. Takes files as they sit on disk, keyed by file name. */
export function verifyLockedSetImages(
  lock: Pick<ImageContentLock, "sets">,
  filesOnDisk: readonly SetImageFile[],
): string[] {
  const failures: string[] = [];
  const remaining = new Map(filesOnDisk.map((file) => [file.fileName, file]));
  for (const record of lock.sets) {
    const fileName = setImageFileName(record.setId);
    const file = remaining.get(fileName);
    remaining.delete(fileName);
    if (file === undefined) {
      failures.push(`Locked set image is missing: ${record.setId}`);
      continue;
    }
    if (file.bytes !== record.bytes) {
      failures.push(
        `Locked set image byte length changed: ${record.setId} expected ${record.bytes}, found ${file.bytes}`,
      );
    }
    if (file.sha256 !== record.sha256) {
      failures.push(
        `Locked set image bytes drifted: ${record.setId} expected ${record.sha256}, found ${file.sha256}`,
      );
    }
  }
  for (const fileName of remaining.keys()) {
    failures.push(`Set image is not pinned by the image lock: ${fileName}`);
  }
  return failures;
}

/**
 * Read the tracked lock as data rather than as trusted types. An entry that
 * validated loosely would compare `undefined` against a real digest and could
 * report drift for the wrong reason.
 */
export function parseImageContentLock(value: unknown): ImageContentLock {
  const lock = asRecord(value);
  if (
    lock.schemaVersion !== 2 ||
    lock.provider !== "ygoprodeck" ||
    !Array.isArray(lock.cards) ||
    !Array.isArray(lock.crops) ||
    !Array.isArray(lock.sets)
  ) {
    throw new Error(`${IMAGE_CONTENT_LOCK_FILE} is not a valid image lock`);
  }
  const parseCards = (entries: unknown[], kind: "card" | "crop") =>
    entries.map((entry) => {
      const record = asRecord(entry);
      if (!Number.isSafeInteger(record.code) || !hasDigestFields(record)) {
        throw new Error(
          `${IMAGE_CONTENT_LOCK_FILE} has an invalid ${kind} entry: ${JSON.stringify(entry)}`,
        );
      }
      return {
        code: record.code as number,
        bytes: record.bytes as number,
        sha256: record.sha256 as string,
      };
    });
  const cards = parseCards(lock.cards as unknown[], "card");
  const crops = parseCards(lock.crops as unknown[], "crop");
  const sets = (lock.sets as unknown[]).map((entry) => {
    const record = asRecord(entry);
    if (typeof record.setId !== "string" || !hasDigestFields(record)) {
      throw new Error(
        `${IMAGE_CONTENT_LOCK_FILE} has an invalid set entry: ${JSON.stringify(entry)}`,
      );
    }
    // Rejects an id that would resolve to a file outside the archive.
    setImageFileName(record.setId);
    return {
      setId: record.setId,
      bytes: record.bytes as number,
      sha256: record.sha256 as string,
    };
  });
  return { schemaVersion: 2, provider: "ygoprodeck", cards, crops, sets };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${IMAGE_CONTENT_LOCK_FILE} is not a valid image lock`);
  }
  return value as Record<string, unknown>;
}

function hasDigestFields(record: Record<string, unknown>): boolean {
  return (
    Number.isSafeInteger(record.bytes) &&
    typeof record.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(record.sha256)
  );
}

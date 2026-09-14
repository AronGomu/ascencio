import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  LatestContentPointer,
  ProgressiveManifest,
} from "../../../src/content/index.ts";
import {
  parseLatestContentPointer,
  parseProgressiveManifest,
} from "../../../src/content/index.ts";
import {
  canonicalBytes,
  compareCodePoints,
  parseJsonBytes,
} from "./canonical-json.ts";
import {
  parseFrozenInventory,
  type FrozenInventory,
} from "./frozen-inventory.ts";
import type { PayloadFile } from "./player-payload.ts";
import { deriveProgressiveManifest } from "./progressive-manifest.ts";
import { assertSafeParents } from "./path-guards.ts";
import { digestSource, sameDigest, sourceStat } from "./source-files.ts";
import { progressiveFail, ProgressiveError } from "./progressive-error.ts";

export interface ProgressiveCandidateRecord {
  readonly schemaVersion: 1;
  readonly previousManifestVersion: string | null;
  readonly manifest: Readonly<{ version: string; bytes: number }>;
  readonly pointer: Readonly<{ version: string; bytes: number }>;
}

export interface ProgressiveReleaseCandidate {
  readonly run: string;
  readonly manifest: ProgressiveManifest;
  readonly manifestBytes: Uint8Array;
  readonly manifestVersion: string;
  readonly pointer: LatestContentPointer;
  readonly pointerBytes: Uint8Array;
  readonly pointerVersion: string;
  readonly candidate: ProgressiveCandidateRecord;
  readonly objectKeys: readonly string[];
}

export interface ProgressivePackOptions {
  readonly releaseSequence: number;
  readonly coreMin: number;
  readonly coreMaxExclusive: number;
  readonly previousRun?: string;
}

const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

async function writeExclusive(
  root: string,
  relative: string,
  bytes: Uint8Array,
): Promise<void> {
  const target = await assertSafeParents(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const handle = await open(target, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function copyPayload(
  root: string,
  run: string,
  file: PayloadFile,
): Promise<string> {
  const key = `content/files/${file.sha256}/${file.path}`;
  const relative = `${run}/progressive/objects/${key}`;
  if (file.derivedBytes !== null) {
    if (
      !sameDigest(file, {
        bytes: file.derivedBytes.length,
        sha256: digest(file.derivedBytes),
      })
    )
      progressiveFail("CONTENT_SOURCE_STALE");
    await writeExclusive(root, relative, file.derivedBytes);
  } else {
    if (file.sourcePath === null) progressiveFail("CONTENT_SOURCE_STALE");
    try {
      const before = await digestSource(root, file.sourcePath, true);
      if (!sameDigest(file, before)) progressiveFail("CONTENT_SOURCE_STALE");
      const target = await assertSafeParents(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(
        await assertSafeParents(root, file.sourcePath),
        target,
        constants.COPYFILE_EXCL,
      );
      const copied = await digestSource(root, relative, true);
      const after = await digestSource(root, file.sourcePath, true);
      if (!sameDigest(file, copied) || !sameDigest(file, after))
        progressiveFail("CONTENT_SOURCE_STALE");
    } catch (error) {
      if (error instanceof ProgressiveError) throw error;
      progressiveFail("CONTENT_SOURCE_STALE");
    }
  }
  return key;
}

function progressiveDirectory(run: string): string {
  return `${run}/progressive`;
}

async function readCandidateFile(
  root: string,
  run: string,
  name: string,
): Promise<Uint8Array> {
  try {
    const file = await assertSafeParents(
      root,
      `${progressiveDirectory(run)}/${name}`,
    );
    const info = await sourceStat(root, `${progressiveDirectory(run)}/${name}`);
    if (!info?.isFile() || info.size > BigInt(32 * 1024 * 1024))
      progressiveFail("CONTENT_INVALID_MANIFEST");
    return new Uint8Array(await readFile(file));
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("CONTENT_INVALID_MANIFEST");
  }
}

export async function packProgressiveRelease(
  root: string,
  inventory: FrozenInventory,
  options: ProgressivePackOptions,
): Promise<ProgressiveReleaseCandidate> {
  if (
    !Number.isSafeInteger(options.releaseSequence) ||
    options.releaseSequence < 1 ||
    !Number.isSafeInteger(options.coreMin) ||
    options.coreMin < 1 ||
    !Number.isSafeInteger(options.coreMaxExclusive) ||
    options.coreMaxExclusive <= options.coreMin
  )
    progressiveFail("CONTENT_INVALID_MANIFEST");
  let previousManifestVersion: string | null = null;
  if (options.releaseSequence > 1) {
    if (!options.previousRun)
      progressiveFail("CONTENT_PREVIOUS_RELEASE_REQUIRED");
    const previous = await verifyProgressiveRelease(
      root,
      options.previousRun,
      false,
    );
    if (previous.manifest.releaseSequence >= options.releaseSequence)
      progressiveFail("CONTENT_PREVIOUS_RELEASE_REQUIRED");
    previousManifestVersion = previous.manifestVersion;
  } else if (options.previousRun)
    progressiveFail("CONTENT_PREVIOUS_RELEASE_REQUIRED");
  const { manifest, payload } = deriveProgressiveManifest(inventory, {
    releaseSequence: options.releaseSequence,
    coreRange: { min: options.coreMin, maxExclusive: options.coreMaxExclusive },
  });
  const run = `generated/asset-delivery/runs/${randomUUID()}`;
  await mkdir(await assertSafeParents(root, progressiveDirectory(run)), {
    recursive: true,
    mode: 0o700,
  });
  const keys: string[] = [];
  for (const file of payload) keys.push(await copyPayload(root, run, file));
  const manifestBytes = canonicalBytes(manifest);
  const manifestVersion = digest(manifestBytes);
  const manifestKey = `content/manifests/${manifestVersion}.json`;
  await writeExclusive(
    root,
    `${run}/progressive/objects/${manifestKey}`,
    manifestBytes,
  );
  const pointer: LatestContentPointer = {
    schemaVersion: 1,
    releaseSequence: manifest.releaseSequence,
    manifest: { version: manifestVersion, bytes: manifestBytes.length },
  };
  const pointerBytes = canonicalBytes(pointer);
  const pointerVersion = digest(pointerBytes);
  const candidate: ProgressiveCandidateRecord = {
    schemaVersion: 1,
    previousManifestVersion,
    manifest: pointer.manifest,
    pointer: { version: pointerVersion, bytes: pointerBytes.length },
  };
  await writeExclusive(root, `${run}/progressive/manifest.json`, manifestBytes);
  await writeExclusive(root, `${run}/progressive/pointer.json`, pointerBytes);
  await writeExclusive(
    root,
    `${run}/progressive/candidate.json`,
    canonicalBytes(candidate),
  );
  await writeExclusive(
    root,
    `${run}/progressive/inventory.json`,
    canonicalBytes(inventory),
  );
  return {
    run,
    manifest,
    manifestBytes,
    manifestVersion,
    pointer,
    pointerBytes,
    pointerVersion,
    candidate,
    objectKeys: [...keys, manifestKey].sort(compareCodePoints),
  };
}

function parseCandidate(value: unknown): ProgressiveCandidateRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    progressiveFail("CONTENT_INVALID_MANIFEST");
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).sort().join(",") !==
    "manifest,pointer,previousManifestVersion,schemaVersion"
  )
    progressiveFail("CONTENT_INVALID_MANIFEST");
  const ref = (value: unknown): { version: string; bytes: number } => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      progressiveFail("CONTENT_INVALID_MANIFEST");
    const item = value as Record<string, unknown>;
    if (
      Object.keys(item).sort().join(",") !== "bytes,version" ||
      typeof item.version !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.version) ||
      typeof item.bytes !== "number" ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 1
    )
      progressiveFail("CONTENT_INVALID_MANIFEST");
    return { version: item.version, bytes: item.bytes };
  };
  if (
    row.schemaVersion !== 1 ||
    !(
      row.previousManifestVersion === null ||
      (typeof row.previousManifestVersion === "string" &&
        /^[a-f0-9]{64}$/.test(row.previousManifestVersion))
    )
  )
    progressiveFail("CONTENT_INVALID_MANIFEST");
  return {
    schemaVersion: 1,
    previousManifestVersion: row.previousManifestVersion,
    manifest: ref(row.manifest),
    pointer: ref(row.pointer),
  } as ProgressiveCandidateRecord;
}

export async function verifyProgressiveRelease(
  root: string,
  run: string,
  checkSources: boolean,
): Promise<ProgressiveReleaseCandidate> {
  try {
    const [manifestBytes, pointerBytes, candidateBytes, inventoryBytes] =
      await Promise.all([
        readCandidateFile(root, run, "manifest.json"),
        readCandidateFile(root, run, "pointer.json"),
        readCandidateFile(root, run, "candidate.json"),
        readCandidateFile(root, run, "inventory.json"),
      ]);
    const manifest = parseProgressiveManifest(parseJsonBytes(manifestBytes));
    const pointer = parseLatestContentPointer(parseJsonBytes(pointerBytes));
    const candidate = parseCandidate(parseJsonBytes(candidateBytes));
    const manifestVersion = digest(manifestBytes);
    const pointerVersion = digest(pointerBytes);
    if (
      !Buffer.from(canonicalBytes(manifest)).equals(
        Buffer.from(manifestBytes),
      ) ||
      !Buffer.from(canonicalBytes(pointer)).equals(Buffer.from(pointerBytes)) ||
      pointer.releaseSequence !== manifest.releaseSequence ||
      pointer.manifest.version !== manifestVersion ||
      pointer.manifest.bytes !== manifestBytes.length ||
      candidate.manifest.version !== manifestVersion ||
      candidate.manifest.bytes !== manifestBytes.length ||
      candidate.pointer.version !== pointerVersion ||
      candidate.pointer.bytes !== pointerBytes.length
    )
      progressiveFail("CONTENT_INVALID_MANIFEST");
    const inventory = parseFrozenInventory(parseJsonBytes(inventoryBytes));
    const { manifest: expectedManifest, payload } = deriveProgressiveManifest(
      inventory,
      {
        releaseSequence: manifest.releaseSequence,
        coreRange: manifest.coreRange,
      },
    );
    if (
      !Buffer.from(canonicalBytes(expectedManifest)).equals(
        Buffer.from(manifestBytes),
      )
    )
      progressiveFail("CONTENT_INVALID_MANIFEST");
    for (const file of manifest.files) {
      const object = await readFile(
        await assertSafeParents(
          root,
          `${run}/progressive/objects/content/files/${file.version}/${file.path}`,
        ),
      );
      if (object.length !== file.bytes || digest(object) !== file.version)
        progressiveFail("CONTENT_INVALID_MANIFEST");
    }
    const storedManifest = await readFile(
      await assertSafeParents(
        root,
        `${run}/progressive/objects/content/manifests/${manifestVersion}.json`,
      ),
    );
    if (!Buffer.from(storedManifest).equals(Buffer.from(manifestBytes)))
      progressiveFail("CONTENT_INVALID_MANIFEST");
    if (checkSources) {
      const inputs = new Map<string, { bytes: number; sha256: string }>();
      for (const source of [
        ...inventory.files,
        ...inventory.vendorFiles,
        ...(inventory.playerMetadata?.sourceInputs ?? []),
      ]) {
        const old = inputs.get(source.path);
        if (old && !sameDigest(old, source))
          progressiveFail("CONTENT_SOURCE_STALE");
        inputs.set(source.path, source);
      }
      for (const [sourcePath, expected] of inputs) {
        let actual;
        try {
          actual = await digestSource(root, sourcePath, true);
        } catch {
          progressiveFail("CONTENT_SOURCE_STALE");
        }
        if (!sameDigest(expected, actual))
          progressiveFail("CONTENT_SOURCE_STALE");
      }
      for (const file of payload) {
        if (
          file.derivedBytes !== null &&
          !sameDigest(file, {
            bytes: file.derivedBytes.length,
            sha256: digest(file.derivedBytes),
          })
        )
          progressiveFail("CONTENT_SOURCE_STALE");
      }
    }
    return {
      run,
      manifest,
      manifestBytes,
      manifestVersion,
      pointer,
      pointerBytes,
      pointerVersion,
      candidate,
      objectKeys: [
        ...manifest.files.map(
          (file) => `content/files/${file.version}/${file.path}`,
        ),
        `content/manifests/${manifestVersion}.json`,
      ].sort(compareCodePoints),
    };
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("CONTENT_INVALID_MANIFEST");
  }
}

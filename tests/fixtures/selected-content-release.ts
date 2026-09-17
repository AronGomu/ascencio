import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  scanAssetProfiles,
  EMPTY_RETAINED_METADATA,
} from "../../scripts/lib/asset-delivery/scan-assets.ts";
import { loadSelection } from "../../scripts/lib/asset-delivery/profile-set.ts";
import { parsePreparedPlayerMetadata } from "../../scripts/lib/asset-delivery/prepared-player-metadata.ts";
import { deriveProgressiveManifest } from "../../scripts/lib/asset-delivery/progressive-manifest.ts";
import { consolidateRuntime } from "./consolidated-runtime.ts";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function selectedContentRelease() {
  const metadata = parsePreparedPlayerMetadata(
    JSON.parse(
      await readFile("generated/asset-delivery/prepared-player.json", "utf8"),
    ),
  );
  const { inventory } = await scanAssetProfiles(
    process.cwd(),
    await loadSelection(process.cwd()),
    EMPTY_RETAINED_METADATA,
    metadata,
  );
  const { manifest, payload } = deriveProgressiveManifest(inventory, {
    releaseSequence: 1,
    coreRange: { min: 1, maxExclusive: 2 },
  });
  const bytes = new Map<string, Uint8Array>();
  for (const file of manifest.files.filter(({ required }) => required)) {
    const source = payload.find(({ path }) => path === file.path)!;
    const value = source.derivedBytes ?? (await readFile(source.sourcePath!));
    assert.equal(sha(value), file.version, file.path);
    assert.equal(value.byteLength, file.bytes, file.path);
    bytes.set(file.path, value);
  }
  return {
    canonical: { manifest, bytes },
    consolidated: consolidateRuntime(manifest, bytes),
    payload,
  };
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { EMPTY_RETAINED_METADATA } from "../../scripts/lib/asset-delivery/scan-assets.ts";
import {
  loadProfiles,
  loadSelection,
  selectProfiles,
} from "../../scripts/lib/asset-delivery/profile-set.ts";
import { parseFrozenInventory } from "../../scripts/lib/asset-delivery/frozen-inventory.ts";
import { assertMigrationReady } from "../../scripts/lib/asset-delivery/migration-state.ts";
import { readSourceJson } from "../../scripts/lib/asset-delivery/source-files.ts";
import { scanVendorFiles } from "../../scripts/lib/asset-delivery/vendor-files.ts";
import { parsePreparedPlayerMetadata } from "../../scripts/lib/asset-delivery/prepared-player-metadata.ts";
import { deriveProgressiveManifest } from "../../scripts/lib/asset-delivery/progressive-manifest.ts";
import { consolidateRuntime } from "./consolidated-runtime.ts";
import { selectedAssetFiles } from "./selected-asset-files.ts";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function selectedContentRelease() {
  const metadata = parsePreparedPlayerMetadata(
    JSON.parse(
      await readFile("generated/asset-delivery/prepared-player.json", "utf8"),
    ),
  );
  const root = process.cwd();
  await assertMigrationReady(root);
  const selected = selectProfiles(
    await loadProfiles(root),
    await loadSelection(root),
  );
  const pkg = (await readSourceJson(root, "package.json")) as {
    version: string;
  };
  const inventory = parseFrozenInventory({
    schemaVersion: 1,
    appVersion: pkg.version,
    runtimeSnapshotId: metadata.runtimeSnapshotId,
    ...selected,
    files: await selectedAssetFiles(root, selected.profiles),
    vendorFiles: await scanVendorFiles(root),
    retainedMetadata: EMPTY_RETAINED_METADATA,
    playerMetadata: metadata,
  });
  await assertMigrationReady(root);
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

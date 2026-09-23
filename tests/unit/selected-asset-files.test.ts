import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetProfile } from "../../scripts/lib/asset-delivery/asset-profile.ts";
import {
  scanAssetProfiles,
  EMPTY_RETAINED_METADATA,
} from "../../scripts/lib/asset-delivery/scan-assets.ts";
import { selectedAssetFiles } from "../fixtures/selected-asset-files.ts";

const profiles: readonly AssetProfile[] = [
  {
    schemaVersion: 1,
    id: "runtime",
    dependsOn: [],
    rules: [
      {
        kind: "file",
        root: "shared",
        path: "card-back.jpg",
        logicalPath: "runtime/images/card-back.jpg",
      },
      {
        kind: "tree",
        root: "shared",
        path: "data",
        logicalPath: "runtime/assets/current",
      },
    ],
  },
];
const owned: string[] = [];
afterEach(async () => {
  for (const root of owned.splice(0)) await rm(root, { recursive: true });
});
async function fixture() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/selected-asset-files-"));
  owned.push(root);
  await mkdir(path.join(root, "assets/shared/data/nested"), {
    recursive: true,
  });
  await writeFile(path.join(root, "package.json"), '{"version":"0.1.0"}');
  await writeFile(path.join(root, "assets/shared/card-back.jpg"), "back");
  await writeFile(
    path.join(root, "assets/shared/data/nested/cards.json"),
    "[]",
  );
  await writeFile(
    path.join(root, "assets/shared/unselected.jpg"),
    "unselected",
  );
  return root;
}

describe("selected Content fixture asset inventory", () => {
  it("matches production selected digests without traversing unselected assets", async () => {
    const root = await fixture();
    const { inventory } = await scanAssetProfiles(
      root,
      { schemaVersion: 1, profiles: ["runtime"] },
      EMPTY_RETAINED_METADATA,
      null,
      profiles,
    );
    const selected = inventory.files.filter(
      ({ profile }) => profile !== "dev-only",
    );
    // Full inventory traversal rejects this sentinel; selected fixture must not visit it.
    await symlink("absent", path.join(root, "assets/shared/unselected-link"));
    const files = await selectedAssetFiles(root, profiles);
    expect(files).toEqual(selected);
    expect(files.map(({ logicalPath }) => logicalPath)).toEqual([
      "runtime/images/card-back.jpg",
      "runtime/assets/current/nested/cards.json",
    ]);
    expect(files[0]).toMatchObject({
      bytes: 4,
      sha256: createHash("sha256").update("back").digest("hex"),
    });
  });

  it("rejects symlinks inside selected trees", async () => {
    const root = await fixture();
    await symlink("absent", path.join(root, "assets/shared/data/link"));
    await expect(selectedAssetFiles(root, profiles)).rejects.toThrow(
      "ASSET_PATH_UNSAFE",
    );
  });

  it("rejects selected files with the wrong filesystem kind", async () => {
    const root = await fixture();
    await rm(path.join(root, "assets/shared/card-back.jpg"));
    await mkdir(path.join(root, "assets/shared/card-back.jpg"));
    await expect(selectedAssetFiles(root, profiles)).rejects.toThrow(
      "ASSET_PROFILE_CONFLICT",
    );
  });
});

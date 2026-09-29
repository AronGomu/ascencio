import type { AssetProfile, PlayerSelection } from "./asset-profile.ts";
import type { SelectedAsset } from "./selected-asset.ts";

export interface FrozenInventory {
  readonly schemaVersion: 1;
  readonly appVersion: string;
  readonly profiles: readonly AssetProfile[];
  readonly selection: PlayerSelection;
  readonly files: readonly SelectedAsset[];
}

import {
  array,
  assertSorted,
  object,
  releaseVersion,
  version,
} from "./schema.ts";
import { parseAssetProfile, parsePlayerSelection } from "./asset-profile.ts";
import { parseSelectedAsset } from "./selected-asset.ts";
import { assertNoPathCollisions } from "./path-guards.ts";
import { fail } from "./failure.ts";
import { compareCodePoints } from "./canonical-json.ts";
export function parseFrozenInventory(value: unknown): FrozenInventory {
  const inventory = object(value, {
    schemaVersion: version,
    appVersion: releaseVersion,
    profiles: array(parseAssetProfile, (profile) => profile.id),
    selection: parsePlayerSelection,
    files: array(parseSelectedAsset),
  });
  assertSorted(inventory.files, (a, b) => compareCodePoints(a.path, b.path));
  assertNoPathCollisions(inventory.files.map((file) => file.path));
  assertNoPathCollisions(
    inventory.files.flatMap((file) =>
      file.logicalPath === null ? [] : [file.logicalPath],
    ),
  );
  const ids = new Set(inventory.profiles.map((profile) => profile.id));
  if (
    ids.size !== inventory.selection.profiles.length ||
    inventory.selection.profiles.some((id) => !ids.has(id)) ||
    inventory.files.some(
      (file) => file.profile !== "dev-only" && !ids.has(file.profile),
    ) ||
    inventory.profiles.some((p) => p.dependsOn.some((id) => !ids.has(id)))
  )
    fail("ASSET_REFERENCE_MISSING");
  return inventory;
}

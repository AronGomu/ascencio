import type { AssetProfile } from "../../scripts/lib/asset-delivery/asset-profile.ts";
import { compareCodePoints } from "../../scripts/lib/asset-delivery/canonical-json.ts";
import { fail } from "../../scripts/lib/asset-delivery/failure.ts";
import { ruleSource } from "../../scripts/lib/asset-delivery/profile-set.ts";
import type { SelectedAsset } from "../../scripts/lib/asset-delivery/selected-asset.ts";
import {
  digestSource,
  sourceFiles,
  sourceStat,
} from "../../scripts/lib/asset-delivery/source-files.ts";

/** Real selected payload only; unrelated local media must not scale fixture setup. */
export async function selectedAssetFiles(
  root: string,
  profiles: readonly AssetProfile[],
): Promise<SelectedAsset[]> {
  const files: SelectedAsset[] = [];
  for (const profile of profiles)
    for (const rule of profile.rules) {
      const relative = ruleSource(rule);
      const info = await sourceStat(root, relative);
      if (!info) continue;
      if (rule.kind === "file" ? !info.isFile() : !info.isDirectory())
        fail("ASSET_PROFILE_CONFLICT", relative);
      const paths =
        rule.kind === "file"
          ? [relative]
          : await sourceFiles(root, relative, true);
      for (const file of paths)
        files.push({
          ...(await digestSource(root, file, true)),
          root: rule.root,
          sourcePath: file.slice(`assets/${rule.root}/`.length),
          profile: profile.id,
          logicalPath: rule.logicalPath + file.slice(relative.length),
        });
    }
  return files.sort((left, right) => compareCodePoints(left.path, right.path));
}

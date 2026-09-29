import { PACKAGE_ASSET_SOURCES as ASSET_SOURCES } from "./lib/asset-roots.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { parseRuntimeSnapshotManifest } from "../src/battle/worker/assets/runtime-manifest.ts";
import {
  buildRuntimeSnapshotManifest,
  verifyRuntimeSnapshotFiles,
} from "../src/battle/worker/assets/runtime-snapshot-node.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const assetRoot = path.join(projectRoot, ASSET_SOURCES.data.source);
const vendorRoot = path.join(projectRoot, "vendor", "ocgcore-wasm", "0.1.2");
const manifest = await buildRuntimeSnapshotManifest(
  assetRoot,
  vendorRoot,
  path.join(projectRoot, ASSET_SOURCES.dataManifest.source),
);
const publishedManifest = parseRuntimeSnapshotManifest(
  JSON.parse(
    await readFile(
      path.join(projectRoot, ASSET_SOURCES.runtime.source, "manifest.json"),
      "utf8",
    ),
  ) as unknown,
);
if (!isDeepStrictEqual(publishedManifest, manifest)) {
  throw new Error(
    "Published runtime manifest does not match the independently derived snapshot",
  );
}
await verifyRuntimeSnapshotFiles(
  manifest,
  assetRoot,
  path.join(projectRoot, ASSET_SOURCES.strings.source),
);
console.log(
  JSON.stringify({ status: "ok", snapshotId: manifest.snapshotId }, null, 2),
);

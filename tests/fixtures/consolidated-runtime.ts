import { createHash } from "node:crypto";
import { canonicalBytes } from "../../scripts/lib/asset-delivery/canonical-json.ts";
import {
  parseProgressiveManifest,
  type ProgressiveManifest,
  type ReleaseFile,
} from "../../src/content/index.ts";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Test delivery representation only: same records/scripts, fewer verified files. */
export function consolidateRuntime(
  manifest: ProgressiveManifest,
  canonical: ReadonlyMap<string, Uint8Array>,
) {
  const bytes = new Map(canonical);
  const prefix = "runtime/assets/current/";
  const groups = [
    "catalog/cards/",
    "catalog/texts/en/",
    "images/",
    "scripts/cards/",
  ];
  const removed = new Set<string>();
  const added = new Map<string, Uint8Array>();
  for (const group of groups) {
    const paths = [...bytes.keys()]
      .filter(
        (path) =>
          path.startsWith(prefix + group) && /\/[a-f0-9]{2}\.json$/.test(path),
      )
      .sort();
    if (paths.length === 0) continue;
    const values = paths.map((path) =>
      JSON.parse(new TextDecoder().decode(bytes.get(path)!)),
    );
    const combined = Array.isArray(values[0])
      ? values.flat()
      : Object.assign({}, ...values);
    const target = prefix + group + "00.json";
    for (const path of paths) {
      removed.add(path);
      bytes.delete(path);
    }
    added.set(target, canonicalBytes(combined));
  }
  for (const [path, value] of added) bytes.set(path, value);
  const assetManifestPath = prefix + "manifest.json";
  const assetManifest = JSON.parse(
    new TextDecoder().decode(bytes.get(assetManifestPath)!),
  );
  const files = [...bytes]
    .filter(([path]) => path.startsWith(prefix) && path !== assetManifestPath)
    .map(([path, value]) => ({
      path: path.slice(prefix.length),
      bytes: value.byteLength,
      sha256: sha(value),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const assetBytes = canonicalBytes({ ...assetManifest, files });
  bytes.set(assetManifestPath, assetBytes);
  const runtimePath = "runtime/current/manifest.json";
  const runtime = JSON.parse(new TextDecoder().decode(bytes.get(runtimePath)!));
  bytes.set(
    runtimePath,
    canonicalBytes({
      ...runtime,
      assets: { ...runtime.assets, manifestSha256: sha(assetBytes), files },
    }),
  );
  const descriptors: ReleaseFile[] = manifest.files
    .filter((file) => !removed.has(file.path))
    .map((file) => {
      const value = bytes.get(file.path);
      return value
        ? { ...file, bytes: value.byteLength, version: sha(value) }
        : file;
    });
  for (const [path, value] of added)
    descriptors.push({
      path,
      version: sha(value),
      bytes: value.byteLength,
      mediaType: "application/json",
      role: "runtime",
      required: true,
      packIds: ["runtime"],
    });
  return {
    manifest: parseProgressiveManifest({
      ...manifest,
      files: descriptors.sort((a, b) => (a.path < b.path ? -1 : 1)),
    }),
    bytes,
  };
}

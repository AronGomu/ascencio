import type { LatestContentPointer } from "../contracts/progressive-release.ts";
import { budget, hash, integer, literal, record } from "./schema.ts";

export function parseLatestContentPointer(
  value: unknown,
): LatestContentPointer {
  budget(value, 32 * 1024 * 1024);
  const v = record(value, ["schemaVersion", "releaseSequence", "manifest"]);
  const manifest = record(v.manifest, ["version", "bytes"]);
  return {
    schemaVersion: literal(v.schemaVersion, 1),
    releaseSequence: integer(v.releaseSequence, Number.MAX_SAFE_INTEGER, 1),
    manifest: {
      version: hash(manifest.version),
      bytes: integer(manifest.bytes, 32 * 1024 * 1024, 1),
    },
  };
}

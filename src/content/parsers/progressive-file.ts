import type { ReleaseFile } from "../contracts/progressive-release.ts";
import {
  array,
  compare,
  hash,
  integer,
  invalid,
  literal,
  packId,
  record,
  sorted,
} from "./schema.ts";

/** Object-key grammar, deliberately independent of legacy ZIP extraction paths. */
export function progressivePath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9._/-]+$/.test(value) ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("//") ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)
  )
    invalid();
  return value;
}

export function parseProgressiveFile(value: unknown): ReleaseFile {
  const v = record(value, [
    "path",
    "version",
    "bytes",
    "mediaType",
    "role",
    "required",
    "packIds",
  ]);
  const role = literal(v.role, "runtime", "gameplay", "story", "media");
  const packs = array(v.packIds, packId, 100);
  sorted(packs, compare);
  if (
    packs.length === 0 ||
    v.required !== (role !== "media") ||
    typeof v.mediaType !== "string" ||
    !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(
      v.mediaType,
    ) ||
    (role === "media" && !/^(?:image|audio|video)\//.test(v.mediaType)) ||
    (role === "runtime" && !packs.includes("runtime"))
  )
    invalid();
  return {
    path: progressivePath(v.path),
    version: hash(v.version),
    bytes: integer(v.bytes, 256 * 1024 * 1024),
    mediaType: v.mediaType,
    role,
    required: role !== "media",
    packIds: packs,
  };
}

import path from "node:path";
import type { CriticalSnapshot } from "../../../src/storage/contracts/critical-snapshot.ts";

type MediaMapping = CriticalSnapshot["media"][number];

export function readableMediaMapping(id: string, mime: string): MediaMapping {
  const match = /^cards\/(full|cropped)\/([1-9][0-9]*)\.jpg$/.exec(id);
  return {
    id,
    path: match
      ? `cards/${match[2]}/${match[1] === "full" ? "artwork" : "cropped"}.jpg`
      : `media/${id}`,
    mime,
  };
}

/** Optional files never decide which paths belong to the immutable catalog. */
export function declaredLibraryMedia(
  codes: readonly number[],
  setImagePaths: readonly (string | null)[],
): MediaMapping[] {
  const declarations = new Map<string, MediaMapping>();
  const add = (id: string, mime = "image/jpeg") =>
    declarations.set(id, readableMediaMapping(id, mime));
  add("card-back.jpg");
  for (const code of codes)
    for (const variant of ["full", "cropped"])
      add(`cards/${variant}/${code}.jpg`);
  for (const image of setImagePaths) {
    if (image === null) continue;
    const mime =
      (
        {
          ".png": "image/png",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
        } as Record<string, string>
      )[path.extname(image)] ?? "image/jpeg";
    add(image, mime);
  }
  return [...declarations.values()];
}

import { parseChapterStoryDocument } from "../chapter-authoring/chapter-story-document.ts";
import { parseStoryDocument } from "../../../src/story/ports/index.ts";
import type { PackageId } from "../../../src/storage/contracts/package.ts";
import {
  NormalizedSourceFailure,
  type NormalizedMediaSource,
} from "./normalized-package-source.ts";

/** Project only the known authoring map reference; both document parsers stay strict. */
export function projectChapterStories(
  values: readonly unknown[],
  packageId: PackageId,
  config: unknown,
  media: readonly NormalizedMediaSource[],
) {
  const missingOptionalMedia = new Set<string>();
  const stories = values.map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      invalid(packageId);
    let document = value;
    if (Object.hasOwn(value, "mapImage")) {
      const parsed = parseChapterStoryDocument(value);
      if (parsed.kind !== "ok") invalid(packageId);
      const { mapImage, ...runtime } = parsed.value;
      const mapPath = (config as { mapAssetPath?: unknown })?.mapAssetPath;
      if (
        typeof mapPath !== "string" ||
        !mapPath.startsWith("media/") ||
        mapImage.packId !== packageId ||
        mapImage.path !==
          `story/media/${packageId}/${mapPath.slice("media/".length)}`
      )
        invalid(packageId);
      const asset = media.find((asset) => asset.path === mapPath);
      if (asset && !asset.mime.startsWith("image/")) invalid(packageId);
      if (!asset) missingOptionalMedia.add(mapPath);
      // parseChapterStoryDocument rejected unknown fields before this projection.
      document = runtime;
    }
    try {
      return parseStoryDocument(document);
    } catch {
      invalid(packageId);
    }
  });
  return { stories, missingOptionalMedia: [...missingOptionalMedia] };
}
function invalid(packageId: PackageId): never {
  throw new NormalizedSourceFailure(packageId, "story-documents.json");
}

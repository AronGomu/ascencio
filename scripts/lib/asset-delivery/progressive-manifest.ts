import {
  parseProgressiveManifest,
  type ChapterId,
  type ProgressiveManifest,
  type ReleaseFile,
} from "../../../src/content/index.ts";
import { compareCodePoints } from "./canonical-json.ts";
import type { FrozenInventory } from "./frozen-inventory.ts";
import { playerPayload, type PayloadFile } from "./player-payload.ts";
import { progressiveFail } from "./progressive-error.ts";

function mediaType(file: string): string {
  const types: Readonly<Record<string, string>> = {
    json: "application/json",
    wasm: "application/wasm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    svg: "image/svg+xml",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    lua: "text/plain",
  };
  return (
    types[file.split(".").at(-1)!.toLowerCase()] ?? "application/octet-stream"
  );
}

function role(
  packId: "runtime" | ChapterId,
  file: PayloadFile,
): ReleaseFile["role"] {
  if (packId === "runtime") return "runtime";
  if (file.path === `chapters/${packId}/gameplay.json`) return "gameplay";
  if (file.path === `chapters/${packId}/story.json`) return "story";
  if (/^(?:image|audio|video)\//.test(mediaType(file.path))) return "media";
  progressiveFail("CONTENT_INVALID_MANIFEST");
}

function chapterDependencies(
  inventory: FrozenInventory,
  id: ChapterId,
): ChapterId[] {
  const profiles = new Map(
    inventory.profiles.map((profile) => [profile.id, profile]),
  );
  const result = new Set<ChapterId>();
  const visit = (current: string): void => {
    const profile = profiles.get(
      current as (typeof inventory.profiles)[number]["id"],
    );
    if (!profile) progressiveFail("CONTENT_INVALID_MANIFEST");
    for (const dependency of profile.dependsOn) {
      if (dependency === "runtime") continue;
      if (!result.has(dependency as ChapterId)) {
        result.add(dependency as ChapterId);
        visit(dependency);
      }
    }
  };
  visit(id);
  return [...result].sort(compareCodePoints);
}

/** Producer and verifier derive the complete roster and descriptors from inventory. */
export function deriveProgressiveManifest(
  inventory: FrozenInventory,
  identity: Pick<ProgressiveManifest, "releaseSequence" | "coreRange">,
): { manifest: ProgressiveManifest; payload: readonly PayloadFile[] } {
  try {
    if (!inventory.playerMetadata || !inventory.runtimeSnapshotId)
      progressiveFail("CONTENT_INVALID_MANIFEST");
    const selected: { release: ReleaseFile; payload: PayloadFile }[] = [];
    const packIds: ("runtime" | ChapterId)[] = [
      "runtime",
      ...inventory.playerMetadata.chapters.map((chapter) => chapter.id),
    ];
    for (const packId of packIds)
      for (const file of playerPayload(inventory, packId)) {
        const fileRole = role(packId, file);
        selected.push({
          payload: file,
          release: {
            path: file.path,
            version: file.sha256,
            bytes: file.bytes,
            mediaType: mediaType(file.path),
            role: fileRole,
            required: fileRole !== "media",
            packIds: [packId],
          },
        });
      }
    selected.sort((left, right) =>
      compareCodePoints(left.release.path, right.release.path),
    );
    const manifest = parseProgressiveManifest({
      schemaVersion: 3,
      ...identity,
      runtimeSnapshotId: inventory.runtimeSnapshotId,
      chapters: inventory.playerMetadata.chapters
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          depends: chapterDependencies(inventory, chapter.id),
          gameplayPath: `chapters/${chapter.id}/gameplay.json`,
          storyPath:
            chapter.storyContentId === null
              ? null
              : `chapters/${chapter.id}/story.json`,
        }))
        .sort((left, right) => compareCodePoints(left.id, right.id)),
      files: selected.map(({ release }) => release),
    });
    return { manifest, payload: selected.map(({ payload }) => payload) };
  } catch {
    progressiveFail("CONTENT_INVALID_MANIFEST");
  }
}

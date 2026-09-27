import { readFile } from "node:fs/promises";
import { packageQueryFixture } from "./package-query.ts";
import { normalizedMedia } from "../../scripts/lib/sqlite-content/normalized-package-source.ts";
import type { ContentQuery } from "../../src/storage/index.ts";

/** Node-only fixture bytes/config. No browser package transport or importer. */
export async function domainContentFixture() {
  const fixture = await packageQueryFixture();
  const chapterMedia = await normalizedMedia(
    "assets/content/chapter-01",
    "chapter-01",
  );
  const assets = new Map<
    string,
    { root: string; source: string; mime: string }
  >([
    ...fixture.domain.media.map(
      (entry) =>
        [
          `card-library:${entry.path}`,
          { ...entry, root: "assets/content/card-library" },
        ] as const,
    ),
    ...chapterMedia.map(
      (entry) =>
        [
          `chapter-01:${entry.path}`,
          { ...entry, root: "assets/content/chapter-01" },
        ] as const,
    ),
  ]);
  return {
    stack: { generation: 1, packages: fixture.packages },
    close: fixture.close,
    async query(request: ContentQuery, installedMedia: boolean) {
      if (
        request.kind === "set-image" ||
        (request.kind === "asset" && request.packageId !== "duel-core")
      ) {
        if (!installedMedia) return { kind: "ok", value: null };
        const key =
          request.kind === "set-image"
            ? `card-library:${fixture.domain.sets.find(({ id }) => id === request.setId)?.imageAssetPath}`
            : `${request.packageId}:${request.path}`;
        const asset = assets.get(key);
        if (!asset) return { kind: "ok", value: null };
        try {
          const bytes = await readFile(`${asset.root}/${asset.source}`);
          return {
            kind: "ok",
            value: { mime: asset.mime, bytes: bytes.toString("base64") },
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT")
            return { kind: "ok", value: null };
          throw error;
        }
      }
      const result = await fixture.content.query(
        request,
        new AbortController().signal,
      );
      if (result.kind === "ok" && result.value && "bytes" in result.value)
        return {
          ...result,
          value: {
            ...result.value,
            bytes: Buffer.from(result.value.bytes).toString("base64"),
          },
        };
      return result;
    },
  };
}

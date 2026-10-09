import { loadChapterOneContentSource } from "../../scripts/lib/chapter-content-source.ts";
import { loadNormalizedCatalog } from "../../scripts/lib/sqlite-content/normalized-package-source.ts";

const catalogRoot = "assets/content/card-library";
let catalogSource: ReturnType<typeof loadNormalizedCatalog> | undefined;
let chapterSource: ReturnType<typeof loadChapterOneContentSource> | undefined;

export async function normalizedCatalogSource() {
  return structuredClone(
    await (catalogSource ??= loadNormalizedCatalog(catalogRoot, ["en"])),
  );
}

export async function chapterOneSource() {
  return structuredClone(
    await (chapterSource ??= loadChapterOneContentSource(process.cwd())),
  );
}

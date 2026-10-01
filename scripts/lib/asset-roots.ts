/** Legacy source relocation map: local copy/promotion only, never build or serving. */
export const ASSET_SOURCES = {
  data: {
    legacy: "generated/assets/current",
    source: "assets/shared/data/current",
    logical: "runtime/assets/current",
    kind: "tree",
  },
  runtime: {
    legacy: "generated/runtime/current",
    source: "assets/shared/runtime/current",
    logical: "runtime/current",
    kind: "tree",
  },
  fullImages: {
    legacy: "generated/card-images/archive/full",
    source: "assets/shared/card-images/full",
    logical: "runtime/images",
    kind: "tree",
  },
  croppedImages: {
    legacy: "generated/card-images/archive/cropped",
    source: "assets/shared/card-images/cropped",
    logical: "runtime/images-cropped",
    kind: "tree",
  },
  cardBack: {
    legacy: "generated/card-images/card-back.jpg",
    source: "assets/shared/card-back.jpg",
    logical: "runtime/images/card-back.jpg",
    kind: "file",
  },
  setImages: {
    legacy: "generated/set-images",
    source: "assets/shared/set-images",
    logical: "runtime/sets",
    kind: "tree",
  },
  acquiredEngine: {
    legacy: "generated/engine/current",
    source: "assets/battle/engine/current",
    logical: null,
    kind: "tree",
  },
  story: {
    legacy: "src/story/assets",
    source: "assets/story",
    logical: "story/media",
    kind: "tree",
  },
} as const;

/** Package-owned acquisition/snapshot roots. Frozen vendor stays separate. */
export const PACKAGE_ASSET_SOURCES = {
  data: { source: "assets/content/card-library/data" },
  dataManifest: { source: "generated/content-inputs/data/manifest.json" },
  dataManifestSha256: {
    source: "generated/content-inputs/data/manifest.sha256",
  },
  strings: { source: "content/duel-core/strings" },
  runtime: { source: "generated/content-inputs/runtime" },
  fullImages: { source: "assets/content/card-library/images/full" },
  croppedImages: { source: "assets/content/card-library/images/cropped" },
  cardBack: { source: "assets/content/card-library/images/card-back.jpg" },
  setImages: { source: "assets/content/card-library/images/sets" },
  acquiredEngine: { source: "generated/acquisition/engine/current" },
  story: { source: "assets/content/chapter-01/media" },
} as const;

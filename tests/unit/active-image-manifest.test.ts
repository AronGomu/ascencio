import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertNoMissingActiveImages,
  buildActiveImageManifest,
} from "../../scripts/lib/active-image-manifest.ts";
import { loadDeckSources } from "../../src/duel/presets/deck-sources-node.ts";
import { reviewedCardPool } from "../../src/duel/presets/reviewed-card-pool.ts";

const projectRoot = path.resolve(".");

describe("active image manifest", () => {
  it("manifest covers every code of every bundled deck", async () => {
    const manifest = buildActiveImageManifest(projectRoot, "test-snapshot");
    const represented = new Set([
      ...manifest.files.map(({ code }) => code),
      ...manifest.missing,
    ]);

    for (const code of reviewedCardPool(await loadDeckSources())) {
      expect(represented.has(code)).toBe(true);
    }
  });

  it("manifest has no missing images for the bundled decks", () => {
    const manifest = buildActiveImageManifest(projectRoot, "test-snapshot");

    expect(manifest.missing).toHaveLength(0);
  });

  it("pure image completeness guard rejects missing images", () => {
    expect(() => assertNoMissingActiveImages({ missing: [1] })).toThrowError(
      "Missing active card images for browser build: 1",
    );
  });
});

import { describe, expect, it } from "vitest";
import { snapshotCopyPaths } from "../../scripts/lib/vite-runtime-assets.ts";

describe("snapshotCopyPaths", () => {
  it("the snapshot copy plan is the declared manifest", () => {
    const manifest = {
      assets: {
        files: [
          { path: "catalog/cards/02.json" },
          { path: "catalog/cards/01.json" },
          { path: "scripts/index.json" },
        ],
      },
    };
    expect(snapshotCopyPaths(manifest)).toEqual([
      "catalog/cards/01.json",
      "catalog/cards/02.json",
      "manifest.json",
      "scripts/index.json",
    ]);
  });

  it("deduplicates paths", () => {
    const manifest = {
      assets: {
        files: [
          { path: "catalog/cards/00.json" },
          { path: "catalog/cards/00.json" },
        ],
      },
    };
    const result = snapshotCopyPaths(manifest);
    expect(result).toEqual(["catalog/cards/00.json", "manifest.json"]);
  });
});

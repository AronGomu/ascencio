import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PACKAGE_ASSET_SOURCES } from "../../scripts/lib/asset-roots.ts";
import { createNodeDuelWorkerRuntime } from "../../src/battle/worker/create-node-runtime.ts";
import { TEST_CONTENT_REF } from "../fixtures/installed-gameplay.ts";

const mocks = vi.hoisted(() => ({
  manifest: vi.fn(),
  verify: vi.fn(),
  dependencies: vi.fn(),
}));
vi.mock("../../src/battle/worker/assets/runtime-snapshot-node.ts", () => ({
  buildRuntimeSnapshotManifest: mocks.manifest,
  verifyRuntimeSnapshotFiles: mocks.verify,
}));
vi.mock(
  "../../src/battle/worker/assets/active-duel-dependencies-node.ts",
  () => ({
    loadActiveDuelDependenciesNode: mocks.dependencies,
  }),
);
vi.mock("../../src/battle/worker/engine/load-vendored-core-node.ts", () => ({
  loadVendoredCoreNode: async () => ({ getVersion: () => [11, 0] }),
}));
vi.mock("../../scripts/lib/active-image-manifest.ts", () => ({
  buildActiveImageManifest: () => ({}),
  activeImageManifestSha256: () => "a".repeat(64),
}));

describe("Node runtime package-owned sources", () => {
  it("loads normalized catalog/scripts, derived manifest and duel-core strings without hosted originals", async () => {
    mocks.manifest.mockResolvedValue({
      snapshotId: "a".repeat(64),
      engine: { coreVersion: [11, 0] },
      assets: {
        babelCdbRevision: "babel",
        cardScriptsRevision: "scripts",
        distributionRevision: "strings",
      },
    });
    mocks.verify.mockResolvedValue(undefined);
    mocks.dependencies.mockResolvedValue({ cards: new Map() });
    const projectRoot = path.resolve(".tmp/package-only-node-runtime");
    const runtime = createNodeDuelWorkerRuntime(projectRoot);
    try {
      const events = await runtime.handle({
        type: "initialize",
        runtime: TEST_CONTENT_REF,
      });
      expect(events.at(-1)).toMatchObject({ type: "ready" });
      const data = path.join(projectRoot, PACKAGE_ASSET_SOURCES.data.source);
      const strings = path.join(
        projectRoot,
        PACKAGE_ASSET_SOURCES.strings.source,
      );
      expect(mocks.manifest).toHaveBeenCalledWith(
        data,
        path.join(projectRoot, "vendor/ocgcore-wasm/0.1.2"),
        path.join(projectRoot, PACKAGE_ASSET_SOURCES.dataManifest.source),
      );
      expect(mocks.verify).toHaveBeenCalledWith(
        await mocks.manifest.mock.results[0]!.value,
        data,
        strings,
      );
      expect(mocks.dependencies).toHaveBeenCalledWith(
        data,
        expect.any(Set),
        expect.any(Function),
        strings,
      );
    } finally {
      runtime.dispose();
    }
  });
});

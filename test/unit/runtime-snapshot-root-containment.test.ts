import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RuntimeSnapshotManifest } from "../../src/battle/worker/assets/runtime-manifest.ts";
import { verifyRuntimeSnapshotFiles } from "../../src/battle/worker/assets/runtime-snapshot-node.ts";

describe("runtime snapshot root containment", () => {
  it("rejects a manifest file reached through a directory symlink outside the snapshot root", async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), "ygo-runtime-containment-"),
    );
    const assetRoot = path.join(fixtureRoot, "snapshot");
    const externalRoot = path.join(fixtureRoot, "external");
    const bytes = new TextEncoder().encode("outside snapshot");
    try {
      await mkdir(assetRoot);
      await mkdir(externalRoot);
      await writeFile(path.join(externalRoot, "artifact.json"), bytes);
      await symlink(externalRoot, path.join(assetRoot, "support"), "dir");

      await expect(
        verifyRuntimeSnapshotFiles(
          manifestFor("support/artifact.json", bytes),
          assetRoot,
        ),
      ).rejects.toThrow(/escapes snapshot root/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

function manifestFor(
  artifactPath: string,
  bytes: Uint8Array,
): RuntimeSnapshotManifest {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-13T00:00:00.000Z",
    snapshotId: digest as RuntimeSnapshotManifest["snapshotId"],
    engine: {
      package: "ocgcore-wasm",
      version: "0.1.2",
      integrity: "fixture-integrity",
      coreVersion: [11, 0],
      embeddedCoreRevision: "fixture-revision",
      manifestSha256: digest,
    },
    assets: {
      manifestSha256: digest,
      babelCdbRevision: "fixture-babel",
      cardScriptsRevision: "fixture-scripts",
      distributionRevision: "fixture-distribution",
      files: [{ path: artifactPath, bytes: bytes.byteLength, sha256: digest }],
    },
  };
}

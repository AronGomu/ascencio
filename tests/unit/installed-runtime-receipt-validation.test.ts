import { describe, expect, it } from "vitest";
import type {
  ContentReadPort,
  InstalledRuntimeReceipt,
} from "../../src/content/index.ts";
import { assertInstalledRuntimeReceipt } from "../../src/battle/worker/create-browser-runtime.ts";
import { TEST_CONTENT_REF } from "../fixtures/installed-gameplay.ts";

const file = (sha256: string, path = "runtime/current/manifest.json") => ({
  path,
  bytes: 1,
  sha256,
});

function receipt(): InstalledRuntimeReceipt {
  return {
    schemaVersion: 1,
    kind: "installed-runtime-v1",
    snapshot: TEST_CONTENT_REF.snapshot,
    runtimePack: TEST_CONTENT_REF.runtime,
    runtimeManifestFile: file(TEST_CONTENT_REF.snapshot.runtimeManifestSha256),
    assetManifestFile: file(
      "1".repeat(64),
      "runtime/assets/current/manifest.json",
    ),
    engineManifestFile: file(
      "2".repeat(64),
      "runtime/engine/vendor-manifest.json",
    ),
    verifiedAt: 1,
  };
}

describe("Worker installed runtime receipt validation", () => {
  it("rejects different activation, snapshot, catalog, pack, or manifest", async () => {
    const valid = receipt();
    const mismatches: InstalledRuntimeReceipt[] = [
      {
        ...valid,
        snapshot: { ...valid.snapshot, activationId: "3".repeat(64) },
      },
      {
        ...valid,
        snapshot: { ...valid.snapshot, runtimeSnapshotId: "4".repeat(64) },
      },
      {
        ...valid,
        snapshot: { ...valid.snapshot, releaseCatalogSha256: "5".repeat(64) },
      },
      { ...valid, runtimePack: { ...valid.runtimePack, bytes: 2 } },
      {
        ...valid,
        runtimeManifestFile: {
          ...valid.runtimeManifestFile,
          sha256: "6".repeat(64),
        },
      },
    ];
    for (const mismatch of mismatches)
      await expect(
        assertInstalledRuntimeReceipt(
          mismatch,
          TEST_CONTENT_REF,
          {} as ContentReadPort,
        ),
      ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
  });
  it.each([
    "assetManifestFile",
    "engineManifestFile",
    "runtimeManifestFile",
  ] as const)(
    "rejects forged %s digest or length against installed file records",
    async (key) => {
      for (const field of ["sha256", "bytes"] as const) {
        const valid = receipt();
        const reader = {
          readManifest: async () => ({
            kind: "ok",
            value: {
              value: {
                files: [
                  valid.runtimeManifestFile,
                  valid.assetManifestFile,
                  valid.engineManifestFile,
                ],
              },
            },
          }),
        } as unknown as ContentReadPort;
        const forged = {
          ...valid,
          [key]: {
            ...valid[key],
            [field]: field === "bytes" ? 9 : "9".repeat(64),
          },
        };
        await expect(
          assertInstalledRuntimeReceipt(forged, TEST_CONTENT_REF, reader),
        ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
      }
    },
  );
});

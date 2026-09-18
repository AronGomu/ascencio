import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import { verifyArchive } from "../scripts/lib/asset-delivery/verify-archive.ts";

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

test("archive verification rejects bytes that do not match the object ref digest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "archive-identity-"));
  try {
    const content = Buffer.from("data");
    const writer = new ZipWriter(new Uint8ArrayWriter(), {
      level: 0,
      useWebWorkers: false,
      rawLastModDate: 0x00210000,
      extendedTimestamp: false,
      msDosCompatible: true,
      externalFileAttributes: 0,
      useUnicodeFileNames: true,
    });
    await writer.add("safe.png", new Uint8ArrayReader(content));
    const archive = Buffer.from(await writer.close());
    await writeFile(path.join(root, "archive.zip"), archive);

    await assert.rejects(
      verifyArchive(
        root,
        "archive.zip",
        {
          key: `content/parts/${"0".repeat(64)}.zip`,
          bytes: archive.length,
          sha256: "0".repeat(64),
        },
        [{ path: "safe.png", bytes: content.length, sha256: sha256(content) }],
        true,
      ),
      { message: "ASSET_INTEGRITY_FAILED" },
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

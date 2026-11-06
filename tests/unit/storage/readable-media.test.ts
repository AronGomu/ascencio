import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { exportPackages } from "../../../scripts/lib/sqlite-content/index.ts";
import { exportSqliteSource } from "../../../scripts/lib/json-content/export-sqlite-source.ts";
import { compileSource } from "../../../scripts/lib/json-content/compile-source.ts";
import { readableOutputCurrent } from "../../../scripts/lib/json-content/readable-output-current.ts";
import { declaredLibraryMedia } from "../../../scripts/lib/json-content/declared-library-media.ts";
import type { PackageManifest } from "../../../src/storage/contracts/package.ts";

it("conversion hashes do not depend on whether declared optional artwork is downloaded", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ascencio-readable-media-"));
  try {
    await cp(
      "tests/fixtures/sqlite",
      path.join(root, "tests/fixtures/sqlite"),
      { recursive: true },
    );
    const library = path.join(
      root,
      "tests/fixtures/sqlite/sources/card-library",
    );
    const sets = JSON.parse(
      await readFile(path.join(library, "sets.json"), "utf8"),
    );
    sets[0].imageAssetPath = "sets/fixture.jpg";
    await writeFile(path.join(library, "sets.json"), JSON.stringify(sets));
    const assets = JSON.parse(
      await readFile(path.join(library, "assets.json"), "utf8"),
    );
    assets.push({
      path: "sets/fixture.jpg",
      source: "media/sets/fixture.jpg",
      mime: "image/jpeg",
      optional: true,
    });
    await writeFile(path.join(library, "assets.json"), JSON.stringify(assets));
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    expect((await exportPackages(root, spec, { archive: false })).kind).toBe(
      "ok",
    );
    const first = path.join(root, "absent");
    await exportSqliteSource(
      root,
      "generated/content-packages/card-library-1.0.0.sqlite",
      first,
    );
    const before = await compileSource(first, first);
    expect(
      before.snapshot.media.some((entry) => entry.id === "cards/full/2.jpg"),
    ).toBe(true);
    await writeFile(
      path.join(
        root,
        "tests/fixtures/sqlite/sources/card-library/media/cards/full/2.jpg",
      ),
      new Uint8Array([255, 216, 255, 217]),
    );
    await mkdir(path.join(library, "media/sets"), { recursive: true });
    await writeFile(
      path.join(library, "media/sets/fixture.jpg"),
      new Uint8Array([255, 216, 255, 217]),
    );
    await rm(path.join(root, "generated/content-packages"), {
      recursive: true,
    });
    expect((await exportPackages(root, spec, { archive: false })).kind).toBe(
      "ok",
    );
    const second = path.join(root, "present");
    await exportSqliteSource(
      root,
      "generated/content-packages/card-library-1.0.0.sqlite",
      second,
    );
    const after = await compileSource(second, second);
    expect(after.sha256).toBe(before.sha256);
    expect(after.snapshot.sets[0]!.imageAssetPath).toBe("sets/fixture.jpg");
    expect(after.snapshot.media).toContainEqual({
      id: "sets/fixture.jpg",
      path: "media/sets/fixture.jpg",
      mime: "image/jpeg",
    });
    expect(await readFile(path.join(second, "cards/2/artwork.jpg"))).toEqual(
      Buffer.from([255, 216, 255, 217]),
    );
    // The producer rejects conflicts before malformed media reaches conversion.
    assets[0].mime = "image/png";
    await writeFile(path.join(library, "assets.json"), JSON.stringify(assets));
    await rm(path.join(root, "generated/content-packages"), {
      recursive: true,
    });
    expect((await exportPackages(root, spec, { archive: false })).kind).toBe(
      "failed",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("declares all card variants and set references independently of optional bytes", () => {
  const media = declaredLibraryMedia(
    [1, 2],
    ["sets/pack.webp", "sets/pack.webp", null],
  );
  expect(media).toHaveLength(6);
  expect(media).toContainEqual({
    id: "cards/cropped/2.jpg",
    path: "cards/2/cropped.jpg",
    mime: "image/jpeg",
  });
  expect(media).toContainEqual({
    id: "sets/pack.webp",
    path: "media/sets/pack.webp",
    mime: "image/webp",
  });
});

it("setup preserves stale conversion output and rebuilds changed release manifests", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ascencio-readable-current-"));
  const output = path.join(root, "freeplay");
  const manifest: PackageManifest = {
    packageId: "freeplay",
    packageType: "freeplay",
    version: "1.1.2",
    schemaVersion: 1,
    dependencies: [],
    createdAt: "2026-10-01T00:00:00.000Z",
  };
  try {
    expect(await readableOutputCurrent(output, manifest)).toBe(false);
    await mkdir(output);
    await writeFile(
      path.join(output, "pack.json"),
      JSON.stringify({ format: "ascencio-readable-pack", manifest }),
    );
    expect(await readableOutputCurrent(output, manifest)).toBe(true);
    expect(
      await readableOutputCurrent(output, { ...manifest, version: "1.1.3" }),
    ).toBe(false);
    const [saved] = await readdir(root);
    expect(saved).toMatch(/^freeplay-.*\.previous$/);
    expect(
      JSON.parse(await readFile(path.join(root, saved!, "pack.json"), "utf8"))
        .manifest.version,
    ).toBe("1.1.2");
    await mkdir(output);
    await expect(readableOutputCurrent(output, manifest)).rejects.toThrow(
      "Incomplete conversion",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("setup refuses readable output symlinks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ascencio-readable-link-"));
  const target = path.join(root, "target"),
    output = path.join(root, "output");
  try {
    await mkdir(target);
    await symlink(target, output, "junction");
    await expect(
      readableOutputCurrent(output, {
        packageId: "freeplay",
      } as PackageManifest),
    ).rejects.toThrow("Invalid readable output");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

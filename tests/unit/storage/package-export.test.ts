import { createHash } from "node:crypto";
import * as fsSync from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exportPackages,
  verifyPackageFile,
} from "../../../scripts/lib/sqlite-content/index.ts";
import { resolvePackageImportSources } from "../../../src/storage/runtime/package-import-selection.ts";

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof fsSync>()),
}));

const roots: string[] = [];
async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "ascencio-package-export-"));
  roots.push(root);
  await copyTree(
    path.resolve("tests/fixtures/sqlite"),
    path.join(root, "tests/fixtures/sqlite"),
  );
  return root;
}
async function copyTree(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("immutable SQLite package export", () => {
  it("writes exact-schema packages with global cards independent of chapter limits", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    const result = await exportPackages(root, spec);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.value.map(({ packageId }) => packageId)).toEqual([
      "duel-core",
      "card-library",
      "freeplay",
      "chapter-01",
    ]);
    expect(
      (await readdir(path.join(root, "generated/content-packages"))).sort(),
    ).toEqual([
      "card-library-1.0.0.sqlite",
      "chapter-01-1.0.0.sqlite",
      "content-packages.zip",
      "duel-core-1.0.0.sqlite",
      "freeplay-1.0.0.sqlite",
    ]);
    const archive = await resolvePackageImportSources([
      new File(
        [
          await readFile(
            path.join(root, "generated/content-packages/content-packages.zip"),
          ),
        ],
        "content-packages.zip",
        { type: "application/zip" },
      ),
    ]);
    expect(archive.kind).toBe("ok");
    if (archive.kind === "ok") {
      expect(archive.value.map(({ name }) => name)).toEqual(
        result.value.map(({ path: packagePath }) => path.basename(packagePath)),
      );
      for (const [index, source] of archive.value.entries()) {
        const bytes = new Uint8Array(
          await new Response(await source.open()).arrayBuffer(),
        );
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          result.value[index]!.sha256,
        );
      }
    }
    const library = new DatabaseSync(
      path.join(root, "generated/content-packages/card-library-1.0.0.sqlite"),
      { readOnly: true },
    );
    expect(
      library.prepare("SELECT code FROM cards ORDER BY code").all(),
    ).toEqual([{ code: 1 }, { code: 2 }]);
    library.close();
    const chapter = new DatabaseSync(
      path.join(root, "generated/content-packages/chapter-01-1.0.0.sqlite"),
      { readOnly: true },
    );
    expect(
      chapter
        .prepare("SELECT name FROM sqlite_schema WHERE name='cards'")
        .all(),
    ).toEqual([]);
    expect(
      chapter
        .prepare(
          "SELECT card_code, deck_limit FROM chapter_card_limits ORDER BY card_code",
        )
        .all(),
    ).toEqual([{ card_code: 2, deck_limit: 0 }]);
    chapter.close();
    for (const receipt of result.value) {
      const verified = await verifyPackageFile(root, receipt.path);
      expect(verified.kind).toBe("ok");
      if (verified.kind === "ok")
        expect(verified.value.sha256).toBe(receipt.sha256);
    }
  });

  it("reports absent optional media but rejects missing required scripts", async () => {
    const root = await workspace();
    const specPath = path.join(root, "tests/fixtures/sqlite/packages.json");
    const spec = JSON.parse(await readFile(specPath, "utf8"));
    const first = await exportPackages(root, spec);
    expect(first.kind).toBe("ok");
    if (first.kind === "ok") {
      const library = first.value.find(
        ({ packageId }) => packageId === "card-library",
      )!;
      expect(library.missingOptionalMedia).toEqual(["cards/full/2.jpg"]);
    }
    await rm(
      path.join(
        root,
        "tests/fixtures/sqlite/sources/card-library/scripts/utility.lua",
      ),
    );
    await rm(path.join(root, "generated/content-packages"), {
      recursive: true,
      force: true,
    });
    const missing = await exportPackages(root, spec);
    expect(missing).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId: "card-library",
        path: "scripts/utility.lua",
      },
    });
  });

  it("is byte-deterministic, no-ops identical output, rejects immutable conflicts", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    const first = await exportPackages(root, spec);
    const firstArchive = createHash("sha256")
      .update(
        await readFile(
          path.join(root, "generated/content-packages/content-packages.zip"),
        ),
      )
      .digest("hex");
    const second = await exportPackages(root, spec);
    expect(second).toEqual(first);
    expect(
      createHash("sha256")
        .update(
          await readFile(
            path.join(root, "generated/content-packages/content-packages.zip"),
          ),
        )
        .digest("hex"),
    ).toBe(firstArchive);
    expect(first.kind).toBe("ok");
    if (first.kind !== "ok") return;
    const duel = first.value[0]!;
    await writeFile(
      path.join(root, "tests/fixtures/sqlite/sources/duel-core/config.json"),
      JSON.stringify({
        coreVersion: [11, 0],
        wasmPath: "engine/ocgcore.sync.wasm",
        vendorManifestPath: "engine/vendor-manifest.json",
        strings: {
          system: { "1": "changed" },
          victory: { "1": "win" },
          counter: {},
          setname: {},
        },
      }),
    );
    const conflict = await exportPackages(root, spec);
    expect(conflict).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_IDENTITY_CONFLICT",
        packageId: "duel-core",
        path: "generated/content-packages/duel-core-1.0.0.sqlite",
      },
    });
    expect(await verifyPackageFile(root, duel.path)).toMatchObject({
      kind: "ok",
      value: { sha256: duel.sha256 },
    });
  });

  it("rejects a changed BLOB even when its byte length stays valid", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    const exported = await exportPackages(root, spec);
    expect(exported.kind).toBe("ok");
    if (exported.kind !== "ok") return;
    const receipt = exported.value[0]!;
    const file = path.join(root, receipt.path);
    const bytes = await readFile(file);
    expect(receipt.sha256).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    const database = new DatabaseSync(file);
    try {
      const row = database
        .prepare("SELECT data FROM assets WHERE path=?")
        .get("engine/ocgcore.sync.wasm") as { data: Uint8Array };
      const changed = Uint8Array.from(row.data);
      changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
      database
        .prepare("UPDATE assets SET data=? WHERE path=?")
        .run(changed, "engine/ocgcore.sync.wasm");
    } finally {
      database.close();
    }
    expect(await verifyPackageFile(root, receipt.path)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_INTEGRITY_FAILED",
        packageId: "duel-core",
        path: "engine/ocgcore.sync.wasm",
      },
    });
  });

  it("checks references across every selected package", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    const opponentPath = path.join(
      root,
      "tests/fixtures/sqlite/sources/freeplay/opponents.json",
    );
    await writeFile(
      opponentPath,
      JSON.stringify([
        {
          id: "opponent",
          name: "Opponent",
          line: "Ready",
          deckId: "missing",
          policyId: "basic",
        },
      ]),
    );
    expect(await exportPackages(root, spec)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId: "freeplay",
        path: "opponents.json",
      },
    });
  });
  it("rejects changed script source with unchanged stored SHA", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    expect((await exportPackages(root, spec)).kind).toBe("ok");
    const relative = "generated/content-packages/card-library-1.0.0.sqlite";
    const database = new DatabaseSync(path.join(root, relative));
    database
      .prepare("UPDATE scripts SET source=? WHERE name=?")
      .run("return 'tampered'", "utility.lua");
    database.close();
    expect(await verifyPackageFile(root, relative)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_INTEGRITY_FAILED",
        packageId: "card-library",
        path: "scripts/utility.lua",
      },
    });
  });

  it.each(["EACCES", "EIO"])(
    "does not swallow optional asset stat failure %s",
    async (code) => {
      const root = await workspace();
      const spec = JSON.parse(
        await readFile(
          path.join(root, "tests/fixtures/sqlite/packages.json"),
          "utf8",
        ),
      );
      const actual = fsSync.statSync;
      vi.spyOn(fsSync, "statSync").mockImplementation(
        (...args: Parameters<typeof actual>) => {
          if (String(args[0]).endsWith("cards/full/1.jpg"))
            throw Object.assign(new Error("fixture stat failure"), { code });
          return actual(...args);
        },
      );
      await expect(exportPackages(root, spec)).rejects.toMatchObject({ code });
    },
  );

  it.each(["EACCES", "EIO"])(
    "does not misreport asset read failure %s as missing input",
    async (code) => {
      const root = await workspace();
      const spec = JSON.parse(
        await readFile(
          path.join(root, "tests/fixtures/sqlite/packages.json"),
          "utf8",
        ),
      );
      const actual = fsSync.readFileSync;
      vi.spyOn(fsSync, "readFileSync").mockImplementation(
        (...args: Parameters<typeof actual>) => {
          if (String(args[0]).endsWith("cards/full/1.jpg"))
            throw Object.assign(new Error("fixture read failure"), { code });
          return actual(...args);
        },
      );
      await expect(exportPackages(root, spec)).rejects.toMatchObject({ code });
    },
  );

  it.each([
    ["freeplay", "decks.json"],
    ["freeplay", "opponents.json"],
    ["freeplay", "limits.json"],
    ["chapter-01", "story-documents.json"],
    ["card-library", "cards.json"],
    ["card-library", "card-texts.json"],
    ["card-library", "sets.json"],
    ["card-library", "set-cards.json"],
    ["card-library", "assets.json"],
  ])(
    "rejects duplicate input IDs before output: %s/%s",
    async (packageId, sourcePath) => {
      const root = await workspace();
      const spec = JSON.parse(
        await readFile(
          path.join(root, "tests/fixtures/sqlite/packages.json"),
          "utf8",
        ),
      );
      const file = path.join(
        root,
        "tests/fixtures/sqlite/sources",
        packageId!,
        sourcePath!,
      );
      const rows = JSON.parse(await readFile(file, "utf8"));
      await writeFile(file, JSON.stringify([...rows, rows[0]]));
      expect(await exportPackages(root, spec)).toEqual({
        kind: "failed",
        error: {
          code: "PACKAGE_SOURCE_INCOMPLETE",
          packageId,
          path: sourcePath,
        },
      });
      await expect(
        readFile(
          path.join(root, "generated/content-packages/duel-core-1.0.0.sqlite"),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it.each(["missing", "incompatible", "duplicate"])(
    "checks full recipe dependency closure: %s",
    async (kind) => {
      const root = await workspace();
      const spec = JSON.parse(
        await readFile(
          path.join(root, "tests/fixtures/sqlite/packages.json"),
          "utf8",
        ),
      );
      if (kind === "missing") spec.packages.shift();
      if (kind === "incompatible") spec.packages[0].manifest.version = "2.0.0";
      if (kind === "duplicate") spec.packages.push(spec.packages[0]);
      expect(await exportPackages(root, spec)).toMatchObject({
        kind: "failed",
        error: {
          code:
            kind === "missing"
              ? "PACKAGE_DEPENDENCY_MISSING"
              : kind === "duplicate"
                ? "PACKAGE_DUPLICATE"
                : "PACKAGE_DEPENDENCY_INCOMPATIBLE",
        },
      });
      await expect(
        readFile(
          path.join(root, "generated/content-packages/duel-core-1.0.0.sqlite"),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it.each([
    ["card-library", "cards.json", "alias"],
    ["card-library", "card-texts.json", "cardCode"],
    ["card-library", "set-cards.json", "cardCode"],
    ["card-library", "set-cards.json", "setId"],
    ["freeplay", "decks.json", "cards"],
    ["freeplay", "limits.json", "cardCode"],
    ["chapter-01", "config.json", "setIds"],
    ["chapter-01", "config.json", "storyContentId"],
    ["freeplay", "config.json", "defaults"],
  ])(
    "rejects missing recipe ref: %s/%s/%s",
    async (packageId, sourcePath, field) => {
      const root = await workspace();
      const spec = JSON.parse(
        await readFile(
          path.join(root, "tests/fixtures/sqlite/packages.json"),
          "utf8",
        ),
      );
      const file = path.join(
        root,
        "tests/fixtures/sqlite/sources",
        packageId!,
        sourcePath!,
      );
      const value = JSON.parse(await readFile(file, "utf8"));
      const target = Array.isArray(value) ? value[0] : value;
      target[field!] =
        field === "cards"
          ? { main: [999], extra: [], side: [] }
          : field === "setIds"
            ? ["missing"]
            : field === "defaults"
              ? { starterDeckId: "missing", opponentId: "missing" }
              : ["setId", "storyContentId"].includes(field!)
                ? "missing"
                : 999;
      await writeFile(file, JSON.stringify(value));
      expect(await exportPackages(root, spec)).toEqual({
        kind: "failed",
        error: {
          code: "PACKAGE_SOURCE_INCOMPLETE",
          packageId,
          path:
            field === "storyContentId" ? "story-documents.json" : sourcePath,
        },
      });
      await expect(
        readFile(
          path.join(root, "generated/content-packages/duel-core-1.0.0.sqlite"),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
  it("rejects required card script whose code is absent from recipe library", async () => {
    const root = await workspace();
    const spec = JSON.parse(
      await readFile(
        path.join(root, "tests/fixtures/sqlite/packages.json"),
        "utf8",
      ),
    );
    const file = path.join(
      root,
      "tests/fixtures/sqlite/sources/card-library/config.json",
    );
    const config = JSON.parse(await readFile(file, "utf8"));
    config.requiredScripts.cards.push("c999.lua");
    await writeFile(file, JSON.stringify(config));
    await writeFile(
      path.join(
        root,
        "tests/fixtures/sqlite/sources/card-library/scripts/c999.lua",
      ),
      "return true",
    );
    expect(await exportPackages(root, spec)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId: "card-library",
        path: "scripts/c999.lua",
      },
    });
    await expect(
      readFile(
        path.join(root, "generated/content-packages/duel-core-1.0.0.sqlite"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

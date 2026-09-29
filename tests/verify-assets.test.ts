import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  describeGeneratedFiles,
  sha256File,
  writeJson,
} from "../scripts/lib/files.ts";
import type { AssetManifest } from "../scripts/lib/model.ts";

const CARD_SHARDS = 64;
const SCRIPT_SHARDS = 256;

test("verify-assets rejects catalog records stored in wrong shards", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ygo-verify-assets-test-"));

  try {
    for (let shard = 0; shard < CARD_SHARDS; shard += 1) {
      const name = shard.toString(16).padStart(2, "0");
      await writeJson(
        path.join(root, "catalog/cards", `${name}.json`),
        shard === 2 ? [{ code: 65 }] : [],
      );
      await writeJson(
        path.join(root, "catalog/texts/en", `${name}.json`),
        shard === 1 ? [{ code: 65 }] : [],
      );
      await writeJson(
        path.join(root, "images", `${name}.json`),
        shard === 1
          ? [
              {
                code: 65,
                full: "https://example.test/65.jpg",
                cropped: "https://example.test/65.jpg",
              },
            ]
          : [],
      );
    }
    for (let shard = 0; shard < SCRIPT_SHARDS; shard += 1) {
      const name = shard.toString(16).padStart(2, "0");
      await writeJson(path.join(root, "scripts/cards", `${name}.json`), {});
    }
    await writeJson(path.join(root, "strings/en.json"), {
      system: {},
      victory: {},
      counter: {},
      setname: {},
    });
    await writeJson(path.join(root, "scripts/index.json"), {
      official: [],
      preRelease: [],
      globals: ["constant.lua", "utility.lua"],
      shardCount: SCRIPT_SHARDS,
    });
    await writeJson(path.join(root, "scripts/globals.json"), {
      "constant.lua": "",
      "utility.lua": "",
    });

    const revision = {
      repository: "https://example.test/repository.git",
      requestedRef: "0".repeat(40),
      commit: "0".repeat(40),
    };
    const manifest: AssetManifest = {
      schemaVersion: 1,
      generatedAt: "2026-09-21T00:00:00.000Z",
      sources: {
        babelCdb: revision,
        cardScripts: revision,
        distribution: revision,
        imageProvider: {
          name: "YGOPRODeck",
          apiGuide: "https://ygoprodeck.com/api-guide/",
          fullTemplate: "https://example.test/{id}.jpg",
          croppedTemplate: "https://example.test/{id}.jpg",
          redistributionApproved: false,
        },
      },
      inputs: {
        catalogDatabases: ["cards.cdb"],
        scriptDirectories: ["official", "pre-release"],
      },
      counts: {
        cards: 1,
        texts: 1,
        officialScripts: 0,
        preReleaseScripts: 0,
        globalScripts: 2,
        systemStrings: 0,
        victoryStrings: 0,
        counterStrings: 0,
        setNameStrings: 0,
        imageRecords: 1,
      },
      sharding: {
        catalog: CARD_SHARDS,
        scripts: SCRIPT_SHARDS,
        algorithm: "numeric-id-modulo",
      },
      files: await describeGeneratedFiles(root),
    };
    const manifestPath = path.join(root, "manifest.json");
    await writeJson(manifestPath, manifest);
    await writeFile(
      path.join(root, "manifest.sha256"),
      `${await sha256File(manifestPath)}  manifest.json\n`,
    );

    const result = spawnSync(
      process.execPath,
      ["scripts/verify-assets.ts", "--output", root],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.match(result.stderr, /Card 65 is in shard 02; expected shard 01/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

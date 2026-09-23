import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSET_SOURCES } from "../scripts/lib/asset-roots.ts";
import test from "node:test";
import {
  buildAssetStages,
  parseMvpAssetOptions,
} from "../scripts/lib/mvp-assets.ts";

test("MVP asset command runs every online acquisition and verification stage in order", () => {
  const stages = buildAssetStages(parseMvpAssetOptions([]));
  assert.deepEqual(
    stages.map((stage) => stage.name),
    [
      "syncDuelEngine",
      "verifyDuelEngine",
      "syncDataScriptsAndStrings",
      "verifyDataScriptsAndStrings",
      "downloadCardImages",
      "downloadCroppedCardImages",
      "verifyCardImages",
      "generateRuntimeSnapshot",
      "verifyRuntimeSnapshot",
    ],
  );
});

test("offline MVP asset command performs no network image stage", () => {
  const stages = buildAssetStages(parseMvpAssetOptions(["--offline"]));
  assert.equal(stages[0]?.name, "syncDuelEngine");
  assert.deepEqual(stages[0]?.args, ["--offline"]);
  assert.deepEqual(stages[2]?.args, ["--offline"]);
  assert.equal(
    stages.some(
      (stage) =>
        stage.name === "downloadCardImages" ||
        stage.name === "downloadCroppedCardImages",
    ),
    false,
  );
  assert.equal(stages.at(-1)?.name, "verifyRuntimeSnapshot");
});

test("CI produces mandatory set images before isolated verification and caches current asset roots", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const producer = workflow.indexOf("run: npm run assets:sets");
  const isolated = workflow.indexOf(
    "name: Verify an isolated offline headless checkout",
  );
  assert.ok(
    producer >= 0 && producer < isolated,
    "set-image producer must precede isolated headless gate",
  );
  assert.match(
    workflow,
    /run: npm run assets:sets && npm run assets:sets:verify/,
  );
  const cache = workflow.slice(
    workflow.indexOf("uses: actions/cache@v4"),
    workflow.indexOf("- run: npm ci"),
  );
  for (const source of Object.values(ASSET_SOURCES).filter(
    (entry) => entry !== ASSET_SOURCES.story,
  )) {
    assert.ok(
      cache.includes(source.source),
      `missing asset cache: ${source.source}`,
    );
  }
  assert.ok(cache.includes("scripts/download-set-images.ts"));
  for (const input of [
    "content/**/*.json",
    "public/story/shop-sets.v1.json",
    "image-content-lock.json",
    "assets-source-lock.json",
  ])
    assert.ok(cache.includes(input), `missing cache identity input: ${input}`);
  assert.equal(
    workflow.includes("generated/runtime/current/manifest.json"),
    false,
  );
  assert.equal(
    workflow.split(`${ASSET_SOURCES.runtime.source}/manifest.json`).length - 1,
    2,
  );
});

test("MVP asset options enforce the provider request ceiling", () => {
  assert.throws(
    () => parseMvpAssetOptions(["--requests-per-second", "21"]),
    /cannot exceed 20/,
  );
  assert.throws(
    () => parseMvpAssetOptions(["--offline", "--force-images"]),
    /cannot be used together/,
  );
});

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import type {
  LatestContentPointer,
  ProgressiveManifest,
  ReleaseFile,
} from "../src/content/index.ts";
import { prepared } from "../tests/fixtures/asset-delivery-bundle.ts";
import type { atomic } from "../tests/fixtures/atomic-application-browser.ts";
import { contentRuntimeFixture } from "../tests/fixtures/content-runtime-fixture.ts";

declare global {
  interface Window {
    atomic: typeof atomic;
  }
}

const evidence = process.env.T10_REPAIR_EVIDENCE ?? "artifacts/T10-EVIDENCE";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
let bundle: string;
let pointer: LatestContentPointer;
const objects = new Map<string, { body: Buffer; contentType: string }>();

test.beforeAll(async () => {
  const output = await build({
    configFile: false,
    logLevel: "error",
    build: {
      write: false,
      target: "esnext",
      minify: false,
      lib: {
        entry: "tests/fixtures/atomic-application-browser.ts",
        formats: ["es"],
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const result = Array.isArray(output) ? output[0]! : output;
  if (!("output" in result)) throw new Error("Expected fixture bundle");
  const chunk = result.output.find((entry) => entry.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("Fixture bundle missing");
  bundle = chunk.code;

  const chapter = prepared.chapters[0]!;
  const globals = JSON.parse(
    await readFile("assets/shared/data/current/scripts/globals.json", "utf8"),
  );
  const scriptIndex = JSON.parse(
    await readFile("assets/shared/data/current/scripts/index.json", "utf8"),
  );
  const runtime = await contentRuntimeFixture(chapter.gameplay.cards, {
    globals,
    globalIndex: scriptIndex.globals,
  });
  const payload = [
    ...runtime.files.map((file) => ({
      ...file,
      role: "runtime" as const,
      packIds: ["runtime"] as const,
    })),
    {
      path: "chapters/chapter-01/gameplay.json",
      bytes: encode(chapter.gameplay),
      mediaType: "application/json",
      role: "gameplay" as const,
      packIds: ["chapter-01"] as const,
    },
    {
      path: "chapters/chapter-01/story.json",
      bytes: encode(chapter.story),
      mediaType: "application/json",
      role: "story" as const,
      packIds: ["chapter-01"] as const,
    },
    {
      path: "story/media/map.png",
      bytes: Buffer.from([1, 2, 3]),
      mediaType: "image/png",
      role: "media" as const,
      packIds: ["chapter-01"] as const,
    },
  ];
  const files: ReleaseFile[] = payload
    .map((file) => {
      const version = sha(file.bytes);
      objects.set(`/atomic-fixture/content/files/${version}/${file.path}`, {
        body: Buffer.from(file.bytes),
        contentType: file.mediaType,
      });
      return {
        path: file.path,
        version,
        bytes: file.bytes.byteLength,
        mediaType: file.mediaType,
        role: file.role,
        required: file.role !== "media",
        packIds: file.packIds,
      };
    })
    .sort((left, right) => (left.path < right.path ? -1 : 1));
  const manifest: ProgressiveManifest = {
    schemaVersion: 3,
    releaseSequence: 1,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId: runtime.snapshotId,
    chapters: [
      {
        id: "chapter-01",
        title: "Fixture",
        description: "Local acceptance fixture",
        depends: [],
        gameplayPath: "chapters/chapter-01/gameplay.json",
        storyPath: "chapters/chapter-01/story.json",
      },
    ],
    files,
  };
  const bytes = encode(manifest);
  pointer = {
    schemaVersion: 1,
    releaseSequence: 1,
    manifest: { version: sha(bytes), bytes: bytes.byteLength },
  };
  objects.set(
    `/atomic-fixture/content/manifests/${pointer.manifest.version}.json`,
    { body: bytes, contentType: "application/json" },
  );
});

async function harness(page: Page): Promise<void> {
  await page.addScriptTag({ type: "module", content: bundle });
  await page.waitForFunction(() => !!window.atomic);
}

async function deckSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ygo-story-decks", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const names = [...db.objectStoreNames].sort();
      const tx = db.transaction(names);
      return JSON.stringify(
        await Promise.all(
          names.map(async (name) => [
            name,
            await new Promise<unknown[]>((resolve, reject) => {
              const request = tx.objectStore(name).getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            }),
          ]),
        ),
      );
    } finally {
      db.close();
    }
  });
}

test("required-only domains use placeholders/cache-only media; cleanup preserves saves/settings/CORE", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const requests: string[] = [];
  const mediaRequests: string[] = [];
  context.on("request", (request) => {
    if (/\/story\/media\/|fixture\.invalid\/.*\.(jpg|png)/.test(request.url()))
      mediaRequests.push(request.url());
  });
  await context.route("**/atomic-fixture/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const object = objects.get(path);
    if (!object) throw new Error(`Unexpected fixture request: ${path}`);
    await route.fulfill({ body: object.body, contentType: object.contentType });
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4400/#/");
  await harness(page);
  await page.evaluate((value) => window.atomic.stage(value), pointer);
  await page.evaluate(() => window.atomic.activate(0));
  await page.evaluate(() => window.atomic.save(777));
  expect(
    requests.filter((path) => path.endsWith("/story/media/map.png")),
  ).toEqual([]);

  await page.reload();
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect(
    page.locator('[data-cy="optional-media-global-warning"]'),
  ).toContainText("Optional media is missing. You can keep playing.");
  await page.locator('[data-cy="main-menu-new-game"]').click();
  await expect(page.locator('[data-cy="story-app"]')).toBeVisible();
  await expect(
    page.locator('[data-cy="optional-media-global-warning"]'),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/media-placeholder.png`,
  });
  expect(
    requests.filter((path) => path.endsWith("/story/media/map.png")),
  ).toEqual([]);

  for (const [route, cy] of [
    ["free-play", "deck-select-start"],
    ["free-play/decks", "deck-select-screen"],
    ["free-play/collection", "collection-screen"],
  ] as const) {
    await page.evaluate((route) => {
      location.hash = "#/" + route;
    }, route);
    await expect(page.locator(`[data-cy="${cy}"]`)).toBeVisible();
    if (route === "free-play/decks") {
      await page.locator('[data-cy^="deck-tile-press-"]').first().dblclick();
      await expect(page.locator('[data-cy="deck-editor-root"]')).toBeVisible();
      await expect(page.locator('[data-cy="deck-name-input"]')).not.toHaveValue(
        "",
      );
    }
    await expect(
      page.locator('[data-cy="optional-media-global-warning"]'),
    ).toBeVisible();
    await page.screenshot({
      path: `${evidence}/media-${route.replaceAll("/", "-")}.png`,
    });
    expect(mediaRequests).toEqual([]);
  }
  await page.evaluate(() => {
    location.hash = "#/free-play";
  });
  await expect(page.locator('[data-cy="deck-select-start"]')).toBeEnabled();
  await page.locator('[data-cy="deck-select-start"]').click();
  await expect(page.locator('[data-cy="battle-root"]')).toBeVisible();
  await expect(page.locator('[data-cy="duel-shell"]')).toBeVisible();
  await expect(page.locator('[data-cy="app-error-panel"]')).toHaveCount(0);
  await expect(
    page.locator('[data-cy="optional-media-global-warning"]'),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/media-duel.png` });
  expect(mediaRequests).toEqual([]);

  await page.goto("http://127.0.0.1:4400/#/");
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  const observer = await context.newPage();
  await observer.goto("http://127.0.0.1:4400/#/");
  await expect(
    observer.locator('[data-cy="optional-media-global-warning"]'),
  ).toBeVisible();
  await observer.locator('[data-cy="main-menu-install-content"]').click();
  await expect(
    observer.locator('[data-cy="optional-media-placeholder-count"]'),
  ).toContainText("1 placeholder");
  await expect(
    observer.locator('[data-cy="content-download-media"]'),
  ).toBeEnabled();
  const decksBefore = await deckSnapshot(page);
  expect(
    JSON.parse(decksBefore).find(([name]: [string]) => name === "decks")[1]
      .length,
  ).toBeGreaterThan(0);
  const before = await page.evaluate(async () => {
    const core = await caches.open("ygo-core-shell-fixture-retained");
    await core.put(
      new URL("core-fixture-marker", location.origin),
      new Response("retained-core-bytes"),
    );
    localStorage.setItem("fixture-setting", "retained");
    const story = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ygo-story-saves", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const saves = await new Promise<unknown[]>((resolve, reject) => {
      const request = story
        .transaction("generationSaves")
        .objectStore("generationSaves")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    story.close();
    const content = await caches.open("ygo-content-files-v1");
    await content.put(
      "https://fixture.invalid/legacy/keep",
      new Response("keep"),
    );
    return {
      saves: JSON.stringify(saves),
      setting: localStorage.getItem("fixture-setting"),
      shellCaches: (await caches.keys())
        .filter((name) => name.startsWith("ygo-core-shell-"))
        .sort(),
    };
  });

  await page.locator('[data-cy="main-menu-install-content"]').click();
  await page.locator('[data-cy="content-delete-all"]').click();
  await expect(
    page.locator('[data-cy="delete-assets-confirmation-copy"]'),
  ).toContainText("Saves and settings will be retained.");
  await page.locator('[data-cy="delete-assets-confirm"]').click();
  await expect(
    page.locator('[data-cy="content-actions-status"]'),
  ).toContainText("Downloaded assets deleted");

  await expect(
    observer.locator('[data-cy="content-download-media"]'),
  ).toBeDisabled();
  await expect(
    observer.locator('[data-cy="optional-media-placeholder-count"]'),
  ).toHaveCount(0);
  await expect(observer.locator('[data-cy="content-activate"]')).toBeDisabled();
  expect(mediaRequests).toEqual([]);
  await observer.screenshot({ path: `${evidence}/cross-tab-cleanup.png` });

  const after = await page.evaluate(async () => {
    const story = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ygo-story-saves", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const saves = await new Promise<unknown[]>((resolve, reject) => {
      const request = story
        .transaction("generationSaves")
        .objectStore("generationSaves")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    story.close();
    const selection = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open("ygo-application-state", 1);
      request.onsuccess = () => {
        const db = request.result;
        const read = db
          .transaction("selection")
          .objectStore("selection")
          .get("active");
        read.onsuccess = () => {
          resolve(read.result);
          db.close();
        };
        read.onerror = () => reject(read.error);
      };
      request.onerror = () => reject(request.error);
    });
    const content = await caches.open("ygo-content-files-v1");
    return {
      saves: JSON.stringify(saves),
      setting: localStorage.getItem("fixture-setting"),
      shellCaches: (await caches.keys())
        .filter((name) => name.startsWith("ygo-core-shell-"))
        .sort(),
      selection,
      contentUrls: (await content.keys()).map((request) => request.url),
    };
  });
  const decksAfter = await deckSnapshot(page);
  expect(decksAfter).toBe(decksBefore);
  expect(
    await page.evaluate(async () => {
      const cache = await caches.open("ygo-core-shell-fixture-retained");
      return (
        await cache.match(new URL("core-fixture-marker", location.origin))
      )?.text();
    }),
  ).toBe("retained-core-bytes");
  expect(after.saves).toBe(before.saves);
  expect(after.setting).toBe(before.setting);
  expect(after.shellCaches).toEqual(before.shellCaches);
  expect(after.selection).toMatchObject({
    generation: 2,
    content: null,
    storyGenerationId: expect.any(String),
  });
  expect(after.contentUrls).toEqual(["https://fixture.invalid/legacy/keep"]);
  await writeFile(
    `${evidence}/media-native-observations.json`,
    JSON.stringify(
      {
        requiredOnlyDomains: [
          "Story",
          "Free Play",
          "Deck Editor",
          "collection",
          "duel",
        ],
        mediaRequests,
        requiredFileRequests: requests.length,
        savesBeforeSha256: sha(encode(before.saves)),
        savesAfterSha256: sha(encode(after.saves)),
        decksBeforeSha256: sha(encode(decksBefore)),
        decksAfterSha256: sha(encode(decksAfter)),
        settingRetained: before.setting === after.setting,
        coreMarkerRetained: true,
        unknownContentKeysRetained: after.contentUrls,
        selectionAfterCleanup: after.selection,
        observerAfterCleanup: {
          canDownloadMedia: false,
          canActivate: false,
          missingMedia: 0,
        },
      },
      null,
      2,
    ) + "\n",
  );
  await context.close();
});

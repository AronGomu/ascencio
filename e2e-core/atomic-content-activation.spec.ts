import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import { createHash } from "node:crypto";
import { contentRuntimeFixture } from "../tests/fixtures/content-runtime-fixture.ts";
import { prepared } from "../tests/fixtures/asset-delivery-bundle.ts";
import type {
  LatestContentPointer,
  ProgressiveManifest,
  ReleaseFile,
} from "../src/content/index.ts";
import type { atomic } from "../tests/fixtures/atomic-application-browser.ts";

declare global {
  interface Window {
    atomic: typeof atomic;
  }
}
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
  if (!("output" in result)) throw new Error("Expected one fixture bundle");
  const chunk = result.output.find((entry) => entry.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("Fixture bundle missing");
  bundle = chunk.code;
  const chapter = prepared.chapters[0]!;
  const runtime = await contentRuntimeFixture(chapter.gameplay.cards, {});
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
    .sort((a, b) => (a.path < b.path ? -1 : 1));
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
async function harness(page: Page) {
  await page.addScriptTag({ type: "module", content: bundle });
  await page.waitForFunction(() => !!window.atomic);
}

test("native two-tab locks, atomic pair, offline normal saves, post-gate recovery", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const log: string[] = [];
  await context.route("**/atomic-fixture/**", async (route) => {
    const object = objects.get(new URL(route.request().url()).pathname);
    if (!object) throw new Error("Unexpected fixture request");
    await route.fulfill(object);
  });
  const a = await context.newPage();
  const b = await context.newPage();
  for (const page of [a, b]) {
    page.on("console", (msg) => log.push(msg.text()));
    await page.goto("http://127.0.0.1:4400/#/");
  }
  await harness(b);
  await b.evaluate((pointer) => window.atomic.stage(pointer), pointer);
  expect(await b.evaluate(() => window.atomic.activate(0))).toMatchObject({
    kind: "activated",
    selection: { generation: 1 },
  });
  log.push("initial activation -> generation 1");
  await a.reload();
  await expect(a.locator('[data-cy="main-menu-new-game"]')).toBeEnabled();
  await a.locator('[data-cy="main-menu-new-game"]').click();
  await expect(a.locator('[data-cy="shell-region-story"]')).toBeVisible();
  await expect(a.locator('[data-cy="shell-domain-error-story"]')).toHaveCount(
    0,
  );
  expect(await b.evaluate(() => window.atomic.activate(1))).toEqual({
    kind: "blocked",
    code: "APP_SESSION_ACTIVE",
  });
  log.push("native Story route shared lock -> APP_SESSION_ACTIVE immediately");
  await a.evaluate(() => {
    location.hash = "#/";
  });
  await expect(a.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect
    .poll(() => b.evaluate(async () => (await window.atomic.read()).generation))
    .toBe(1);
  await b.evaluate(() => window.atomic.save(123));
  // Check domain-owned routes, including Story deck-edit.
  for (const route of [
    "free-play",
    "free-play/decks",
    "free-play/collection",
    "story/decks",
    "story/collection",
    "admin",
  ]) {
    await a.evaluate((route) => {
      location.hash = "#/" + route;
    }, route);
    await expect
      .poll(() =>
        a.evaluate(async () =>
          (await navigator.locks.query()).held?.some(
            (lock) =>
              lock.name === "ygo-application-lifecycle-v1" &&
              lock.mode === "shared",
          ),
        ),
      )
      .toBe(true);
    expect(await b.evaluate(() => window.atomic.activate(1))).toEqual({
      kind: "blocked",
      code: "APP_SESSION_ACTIVE",
    });
    log.push(`route ${route} -> APP_SESSION_ACTIVE`);
    await a.evaluate(() => {
      location.hash = "#/";
    });
    await expect(a.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  }
  expect(await b.evaluate(() => window.atomic.checkpoint())).toMatchObject({
    kind: "written",
  });
  await a.evaluate(() => {
    location.hash = "#/duel/session/native-handoff";
  });
  await expect(a.locator('[data-cy="shell-region-duel"]')).toBeVisible();
  await expect(a.locator('[data-cy="battle-root"]')).toBeVisible();
  expect(await b.evaluate(() => window.atomic.activate(1))).toEqual({
    kind: "blocked",
    code: "APP_SESSION_ACTIVE",
  });
  await a.evaluate(() => {
    location.hash = "#/story";
  });
  await expect(a.locator('[data-cy="shell-region-story"]')).toBeVisible();
  expect(await b.evaluate(() => window.atomic.activate(1))).toEqual({
    kind: "blocked",
    code: "APP_SESSION_ACTIVE",
  });
  await a.evaluate(() => {
    location.hash = "#/";
  });
  await expect(a.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  log.push(
    "checkpoint reload -> Battle -> Story handback retains shared lifecycle lease",
  );
  // A real download holds Shell's exclusive download lock across the network wait.
  let releaseMedia!: () => void;
  const mediaWait = new Promise<void>((resolve) => {
    releaseMedia = resolve;
  });
  let enteredMedia!: () => void;
  const mediaEntered = new Promise<void>((resolve) => {
    enteredMedia = resolve;
  });
  await b.route("**/story/media/map.png", async (route) => {
    enteredMedia();
    await mediaWait;
    const object = objects.get(new URL(route.request().url()).pathname)!;
    await route.fulfill(object);
  });
  const download = b.evaluate(
    (version) => window.atomic.download(version),
    pointer.manifest.version,
  );
  await mediaEntered;
  expect(await b.evaluate(() => window.atomic.activate(1))).toEqual({
    kind: "blocked",
    code: "APP_DOWNLOAD_ACTIVE",
  });
  releaseMedia();
  await download;
  log.push(
    "real blocked media network -> APP_DOWNLOAD_ACTIVE; no queued activation",
  );
  expect((await b.evaluate(() => window.atomic.read())).generation).toBe(1);
  expect(await b.evaluate(() => window.atomic.notifyThrow(1))).toMatchObject({
    kind: "activated",
    selection: { generation: 2 },
  });
  log.push("notification throws -> committed generation 2 remains success");
  expect(await b.evaluate(() => window.atomic.save(9876))).toMatchObject({
    kind: "written",
  });
  await b.reload();
  await harness(b);
  expect(await b.evaluate(() => window.atomic.saved())).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 9876 } },
  });
  await context.route("**/content/latest.json", (route) => route.abort());
  await b.reload();
  await harness(b);
  await expect(b.locator('[data-cy="main-menu-new-game"]')).toBeEnabled();
  expect(await b.evaluate(() => window.atomic.saved())).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 9876 } },
  });
  log.push("selected save dp=9876 survives reload; offline local pair ready");
  await b.locator('[data-cy="main-menu-continue"]').click();
  await expect(b.locator('[data-cy="shell-region-story"]')).toBeVisible();
  await b.locator('[data-cy="story-narrative-menu"]').click();
  await b.locator('[data-cy="story-pause-save"]').click();
  await b.locator('[data-cy="story-save-load-overwrite-confirm"]').click();
  await expect(b.getByText("Game saved.", { exact: true })).toBeVisible();
  const uiSaved = await b.evaluate(() => window.atomic.saved());
  expect(uiSaved).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 9876 } },
  });
  await b.reload();
  await harness(b);
  expect(await b.evaluate(() => window.atomic.saved())).toEqual(uiSaved);
  log.push(
    "production Story Save UI writes selected repository; exact envelope survives reload",
  );
  await expect(b.locator('[data-cy="shell-region-story"]')).toBeVisible();
  await b.evaluate(() =>
    dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("APP_REQUIRED_INPUT_FAILED"),
        message: "fixture post-gate eviction",
      }),
    ),
  );
  await expect(b.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect(
    b.locator('[data-cy="application-recovery-message"]'),
  ).toBeVisible();
  await expect
    .poll(() =>
      b.evaluate(
        async () =>
          (await navigator.locks.query()).held?.filter(
            (lock) => lock.name === "ygo-application-lifecycle-v1",
          ).length ?? 0,
      ),
    )
    .toBe(0);
  expect(await b.evaluate(() => window.atomic.saved())).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 9876 } },
  });
  log.push(
    "post-gate explicit error -> Main Menu + lease released + save unchanged",
  );
  await b.addInitScript(() => {
    const NativeWorker = window.Worker;
    let started = 0;
    let stopped = 0;
    Object.defineProperty(window, "atomicWorkerCounts", {
      get: () => ({ started, stopped }),
    });
    window.Worker = class extends NativeWorker {
      constructor(_url: string | URL, options?: WorkerOptions) {
        const url = URL.createObjectURL(
          new Blob(
            [
              'self.onmessage = () => { throw new Error("fixture required runtime lost"); };',
            ],
            { type: "text/javascript" },
          ),
        );
        super(url, options);
        URL.revokeObjectURL(url);
        started++;
      }
      override terminate() {
        stopped++;
        super.terminate();
      }
    };
  });
  await b.reload();
  await harness(b);
  await b.locator('[data-cy="main-menu-free-play"]').click();
  await expect(b.locator('[data-cy="deck-select-start"]')).toBeEnabled();
  await b.locator('[data-cy="deck-select-start"]').click();
  await expect(
    b.locator('[data-cy="application-recovery-message"]'),
  ).toBeVisible();
  await expect(b.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect
    .poll(() =>
      b.evaluate(
        async () =>
          (await navigator.locks.query()).held?.filter(
            (lock) => lock.name === "ygo-application-lifecycle-v1",
          ).length ?? 0,
      ),
    )
    .toBe(0);
  const counts = await b.evaluate(
    () =>
      (
        window as unknown as {
          atomicWorkerCounts: { started: number; stopped: number };
        }
      ).atomicWorkerCounts,
  );
  expect(counts.started).toBeGreaterThan(0);
  expect(counts.stopped).toBe(counts.started);
  expect(await b.evaluate(() => window.atomic.saved())).toMatchObject({
    kind: "ready",
    envelope: { state: { dp: 9876 } },
  });
  log.push(
    `native Worker failure -> Main Menu; constructed=${counts.started}; terminated=${counts.stopped}; lease released; saved dp unchanged`,
  );
  await testInfo.attach("recovery", {
    body: await b.screenshot(),
    contentType: "image/png",
  });
  const selectionBeforeLoss = await b.evaluate(() => window.atomic.read());
  const rawSaves = async () => {
    const request = indexedDB.open("ygo-story-saves");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction("generationSaves", "readonly");
        const rows = tx.objectStore("generationSaves").getAll();
        tx.oncomplete = () => resolve(rows.result);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  };
  const savesBeforeLoss = await b.evaluate(rawSaves);
  expect(
    await b.evaluate(async () => {
      const cache = await caches.open("ygo-content-files-v1");
      const key = (await cache.keys()).find((key) =>
        key.url.endsWith("/runtime/current/manifest.json"),
      );
      if (!key) throw new Error("fixture required cache key missing");
      return cache.delete(key);
    }),
  ).toBe(true);
  await b.reload();
  await harness(b);
  await expect(b.locator('[data-cy="main-menu-new-game"]')).toBeDisabled();
  await expect(b.locator('[data-cy="core-gate-status"]')).toContainText(
    "Content configuration is invalid",
  );
  expect(await b.evaluate(() => window.atomic.read())).toEqual(
    selectionBeforeLoss,
  );
  expect(await b.evaluate(rawSaves)).toEqual(savesBeforeLoss);
  log.push(
    "actual required Cache eviction + reload -> locked; selector + every save row unchanged; no fallback",
  );
  await testInfo.attach("native-log", {
    body: log.join("\n"),
    contentType: "text/plain",
  });
  await testInfo.attach("storage-loss", {
    body: await b.screenshot(),
    contentType: "image/png",
  });
  await context.close();
});

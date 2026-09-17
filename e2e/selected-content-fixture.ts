import {
  captureSelectedMedia,
  restoreSelectedMedia,
  type SelectedMediaRow,
} from "../tests/fixtures/selected-media-profile.ts";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "vite";
import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { selectedContentRelease } from "../tests/fixtures/selected-content-release.ts";
import { canonicalBytes } from "../scripts/lib/asset-delivery/canonical-json.ts";
import type { LatestContentPointer } from "../src/content/index.ts";
import type { StorySlotKey } from "../src/story/saves/index.ts";
import type { StoryState } from "../src/story/model/story-state.ts";
import type { selectedContent } from "../tests/fixtures/selected-content-browser.ts";

declare global {
  interface Window {
    selectedContent: typeof selectedContent;
  }
}
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function releaseFixture() {
  const {
    consolidated: { manifest, bytes },
    payload,
  } = await selectedContentRelease();
  const manifestBytes = canonicalBytes(manifest);
  const pointer: LatestContentPointer = {
    schemaVersion: 1,
    releaseSequence: 1,
    manifest: { version: sha(manifestBytes), bytes: manifestBytes.byteLength },
  };
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  objects.set(
    `/domain-fixture/content/manifests/${pointer.manifest.version}.json`,
    { body: Buffer.from(manifestBytes), contentType: "application/json" },
  );
  for (const file of manifest.files.filter(({ required }) => required)) {
    objects.set(`/domain-fixture/content/files/${file.version}/${file.path}`, {
      body: Buffer.from(bytes.get(file.path)!),
      contentType: file.mediaType,
    });
  }
  return { pointer, objects, manifest, payload };
}
async function browserBundle() {
  const output = await build({
    configFile: false,
    base: "/ygo-story-duel/",
    logLevel: "error",
    build: {
      write: false,
      target: "esnext",
      minify: false,
      lib: {
        entry: "tests/fixtures/selected-content-browser.ts",
        formats: ["es"],
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const result = Array.isArray(output) ? output[0]! : output;
  if (!("output" in result)) throw new Error("Expected fixture output");
  const chunk = result.output.find((entry) => entry.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("Fixture bundle missing");
  return chunk.code;
}
let bundle: Promise<string> | undefined;
async function harness(page: Page) {
  if (await page.evaluate(() => !!window.selectedContent)) return;
  bundle ??= browserBundle();
  await page.addScriptTag({ type: "module", content: await bundle });
  await page.waitForFunction(() => !!window.selectedContent);
}
async function serveRelease(
  context: BrowserContext,
  release: Awaited<ReturnType<typeof releaseFixture>>,
  transfers: string[],
) {
  await context.route("**/domain-fixture/**", async (route) => {
    transfers.push(route.request().url());
    const object = release.objects.get(new URL(route.request().url()).pathname);
    if (object) return route.fulfill(object);
    const path = new URL(route.request().url()).pathname;
    const file = release.manifest.files.find(
      (file) =>
        path === `/domain-fixture/content/files/${file.version}/${file.path}`,
    );
    const source = release.payload.find((entry) => entry.path === file?.path);
    if (!file || !source?.sourcePath)
      throw new Error(`Unexpected Content request: ${path}`);
    const body = await readFile(source.sourcePath);
    expect(sha(body), file.path).toBe(file.version);
    await route.fulfill({ body, contentType: file.mediaType });
  });
}
export const test = base.extend<
  { contentTransfers: string[]; installedMedia: boolean },
  {
    selectedRelease: Awaited<ReturnType<typeof releaseFixture>>;
    mediaProfile: () => Promise<SelectedMediaRow[]>;
  }
>({
  installedMedia: [false, { option: true }],
  mediaProfile: [
    async ({ browser, selectedRelease }, use) => {
      let snapshot: Promise<SelectedMediaRow[]> | undefined;
      await use(
        () =>
          (snapshot ??= (async () => {
            const started = Date.now();
            const context = await browser.newContext({
              baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "4300"}/ygo-story-duel/`,
            });
            try {
              await serveRelease(context, selectedRelease, []);
              const page = await context.newPage();
              await page.goto("./#/");
              await harness(page);
              expect(
                await page.evaluate(
                  (pointer) => window.selectedContent.install(pointer),
                  selectedRelease.pointer,
                ),
              ).toMatchObject({ kind: "activated" });
              await page.evaluate(() => window.selectedContent.media());
              const rows = await captureSelectedMedia(
                page,
                selectedRelease.manifest,
              );
              console.log(
                `Verified media profile: ${rows.length} files, ${Date.now() - started}ms`,
              );
              return rows;
            } finally {
              await context.close();
            }
          })()),
      );
    },
    { scope: "worker", timeout: 900_000 },
  ],
  selectedRelease: [
    // Playwright requires destructuring even when this fixture has no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(await releaseFixture());
    },
    { scope: "worker", timeout: 180_000 },
  ],
  // Playwright requires destructuring even when this fixture has no dependencies.
  // eslint-disable-next-line no-empty-pattern
  contentTransfers: async ({}, use) => {
    await use([]);
  },
  page: [
    async (
      {
        page,
        context,
        selectedRelease,
        contentTransfers,
        installedMedia,
        mediaProfile,
      },
      use,
      testInfo,
    ) => {
      await page.addInitScript(() => {
        const errors: string[] = [];
        Object.assign(window, { domainErrors: errors });
        addEventListener("error", (event) =>
          errors.push(String(event.error?.stack ?? event.message)),
        );
        addEventListener("unhandledrejection", (event) =>
          errors.push(String(event.reason?.stack ?? event.reason)),
        );
      });
      await serveRelease(context, selectedRelease, contentTransfers);
      await page.goto("./#/");
      await harness(page);
      expect(
        await page.evaluate(
          (pointer) => window.selectedContent.install(pointer),
          selectedRelease.pointer,
        ),
      ).toMatchObject({ kind: "activated", selection: { generation: 1 } });
      if (installedMedia)
        await restoreSelectedMedia(page, await mediaProfile());
      await page.reload();
      await expect(page.locator('[data-cy="main-menu-new-game"]')).toBeEnabled({
        timeout: 120_000,
      });
      await use(page);
      if (!page.isClosed() && new URL(page.url()).protocol.startsWith("http")) {
        const errors = await page.evaluate(
          () => (window as unknown as { domainErrors: string[] }).domainErrors,
        );
        await testInfo.attach("domain-errors", {
          body: JSON.stringify(errors),
          contentType: "application/json",
        });
      }
    },
    { scope: "test", timeout: 1_200_000 },
  ],
});
export async function putSelectedStorySave(
  page: Page,
  record: { readonly slot: StorySlotKey; readonly state: StoryState },
) {
  await harness(page);
  await page.evaluate(
    ({ slot, state }) => window.selectedContent.save(slot, state),
    record,
  );
}
export async function selectedStorySlots(page: Page) {
  await harness(page);
  return page.evaluate(() => window.selectedContent.slots());
}
export async function corruptSelectedStorySave(
  page: Page,
  slot: StorySlotKey,
  value: unknown,
) {
  await harness(page);
  await page.evaluate(
    ({ slot, value }) => window.selectedContent.corrupt(slot, value),
    { slot, value },
  );
}

export async function selectedSaveSnapshot(page: Page) {
  await harness(page);
  return page.evaluate(() => window.selectedContent.snapshot());
}

export async function repairSelectedStorySlot(page: Page, slot: StorySlotKey) {
  await harness(page);
  await page.evaluate((slot) => window.selectedContent.clear(slot), slot);
}

/** Layout setup re-enters the domain; persistence tests still use real reloads. */
export async function openSelectedStoryState(page: Page, state: StoryState) {
  await page.evaluate(() => {
    location.hash = "#/";
  });
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await putSelectedStorySave(page, { slot: "autosave", state });
  await page.evaluate(() => {
    location.hash = "#/install-content";
  });
  await expect(
    page.locator('[data-cy="install-content-screen"]'),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#/";
  });
  await page.locator('[data-cy="main-menu-continue"]').click();
}

import { build } from "vite";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { domainFixtureConfig } from "../tests/fixtures/domain-vite.ts";
import { domainContentFixture } from "../tests/fixtures/domain-content-server.ts";
import type { StorySlotKey } from "../src/story/saves/index.ts";
import type { StoryState } from "../src/story/model/story-state.ts";
import type { selectedContent } from "../tests/fixtures/selected-content-browser.ts";

declare global {
  interface Window {
    selectedContent: typeof selectedContent;
  }
}
async function browserBundle() {
  const output = await build(domainFixtureConfig());
  const result = Array.isArray(output) ? output[0]! : output;
  if (!("output" in result)) throw new Error("Expected fixture output");
  const files = new Map(
    result.output.map((entry) => [
      entry.fileName,
      Buffer.from(entry.type === "chunk" ? entry.code : entry.source),
    ]),
  );
  const styles = [...files.keys()].filter((name) => name.endsWith(".css"));
  files.set(
    "index.html",
    Buffer.from(
      `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${styles.map((name) => `<link rel="stylesheet" href="/ygo-story-duel/domain-fixture/app/${name}">`).join("")}</head><body><div id="app"></div><script type="module" src="/ygo-story-duel/domain-fixture/app/main.js"></script></body></html>`,
    ),
  );
  return files;
}
export const test = base.extend<
  { contentTransfers: string[]; installedMedia: boolean },
  {
    selectedRelease: Awaited<ReturnType<typeof domainContentFixture>>;
    fixtureBundle: Awaited<ReturnType<typeof browserBundle>>;
  }
>({
  installedMedia: [false, { option: true }],
  selectedRelease: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const fixture = await domainContentFixture();
      try {
        await use(fixture);
      } finally {
        fixture.close();
      }
    },
    { scope: "worker", timeout: 180_000 },
  ],
  fixtureBundle: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(await browserBundle());
    },
    { scope: "worker", timeout: 180_000 },
  ],
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
        fixtureBundle,
        installedMedia,
        contentTransfers,
      },
      use,
      testInfo,
    ) => {
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/domain-fixture/stack")
          return route.fulfill({ json: selectedRelease.stack });
        if (url.pathname === "/domain-fixture/query") {
          contentTransfers.push(url.href);
          return route.fulfill({
            json: await selectedRelease.query(
              JSON.parse(url.searchParams.get("request")!),
              installedMedia,
            ),
          });
        }
        const asset = url.pathname.startsWith(
          "/ygo-story-duel/domain-fixture/app/",
        )
          ? url.pathname.slice("/ygo-story-duel/domain-fixture/app/".length)
          : ["/ygo-story-duel/", "/ygo-story-duel/index.html"].includes(
                url.pathname,
              )
            ? "index.html"
            : null;
        if (asset === null) return route.continue();
        const body = fixtureBundle.get(asset);
        if (!body) throw new Error(`Unknown domain fixture asset: ${asset}`);
        const contentType = asset.endsWith(".js")
          ? "application/javascript"
          : asset.endsWith(".css")
            ? "text/css"
            : asset.endsWith(".html")
              ? "text/html"
              : asset.endsWith(".wasm")
                ? "application/wasm"
                : "application/octet-stream";
        return route.fulfill({ body, contentType });
      });
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
      await page.goto("./#/");
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
        await page.evaluate(() => window.selectedContent.shutdown());
        await expect
          .poll(() =>
            page.evaluate(
              async () =>
                (await navigator.locks.query()).held?.filter(
                  ({ name }) => name === "ascencio-sqlite-owner-v1",
                ).length ?? 0,
            ),
          )
          .toBe(0);
      }
    },
    { scope: "test", timeout: 300_000 },
  ],
});
export async function putSelectedStorySave(
  page: Page,
  record: { readonly slot: StorySlotKey; readonly state: StoryState },
) {
  await page.waitForFunction(() => !!window.selectedContent);
  await page.evaluate(
    ({ slot, state }) => window.selectedContent.save(slot, state),
    record,
  );
}
export async function selectedStorySlots(page: Page) {
  await page.waitForFunction(() => !!window.selectedContent);
  return page.evaluate(() => window.selectedContent.slots());
}
export async function corruptSelectedStorySave(
  page: Page,
  slot: StorySlotKey,
  value: unknown,
) {
  await page.waitForFunction(() => !!window.selectedContent);
  await page.evaluate(
    ({ slot, value }) => window.selectedContent.corrupt(slot, value),
    { slot, value },
  );
}

export async function selectedSaveSnapshot(page: Page) {
  await page.waitForFunction(() => !!window.selectedContent);
  return page.evaluate(() => window.selectedContent.snapshot());
}

export async function repairSelectedStorySlot(page: Page, slot: StorySlotKey) {
  await page.waitForFunction(() => !!window.selectedContent);
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

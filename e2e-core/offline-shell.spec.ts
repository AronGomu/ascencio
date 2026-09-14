import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const apps = [
  { name: "root", url: "http://127.0.0.1:4400/" },
  {
    name: "subpath",
    url: "http://127.0.0.1:4401/ygo-story-duel/",
  },
] as const;

interface CacheInventory {
  readonly names: readonly string[];
  readonly urls: readonly string[];
}

async function selectShell(
  page: Page,
  appUrl: string,
  version: "a" | "b" | "broken",
) {
  const response = await page.request.post(
    `${appUrl}__test/shell-version/${version}`,
  );
  expect(response.ok()).toBe(true);
}

async function openControlled(page: Page, appUrl: string): Promise<void> {
  await page.goto(appUrl);
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await page.evaluate(async () => await navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null)))
    await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
}

async function cacheInventory(page: Page): Promise<CacheInventory> {
  return await page.evaluate(async () => {
    const names = (await caches.keys())
      .filter((name) => name.startsWith("ygo-core-shell-"))
      .sort();
    const urls = (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (request) => request.url,
          ),
        ),
      )
    )
      .flat()
      .sort();
    return { names, urls };
  });
}

async function expectOfflineCore(
  context: BrowserContext,
  appUrl: string,
): Promise<void> {
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(
    offlinePage.locator('[data-cy="main-menu-screen"]'),
  ).toBeVisible();
  await offlinePage.locator('[data-cy="main-menu-settings"]').click();
  await expect(
    offlinePage.locator('[data-cy="shell-settings-offline-status"]'),
  ).toContainText("Offline reopening is ready");
  await offlinePage.locator('[data-cy="shell-settings-close"]').click();
  await offlinePage.locator('[data-cy="main-menu-install-content"]').click();
  await expect(offlinePage).toHaveURL(`${appUrl}#/install-content`);
  await expect(
    offlinePage.locator('[data-cy="install-content-screen"]'),
  ).toBeVisible();

  const contentMiss = await offlinePage.evaluate(async () => {
    try {
      const response = await fetch("content/missing-part.zip");
      return {
        kind: "response" as const,
        status: response.status,
        contentType: response.headers.get("content-type"),
      };
    } catch {
      return { kind: "network-error" as const };
    }
  });
  expect(contentMiss).toEqual({ kind: "network-error" });
}

for (const app of apps) {
  test(`${app.name} service worker caches executable shell without payload`, async ({
    context,
    page,
  }) => {
    await selectShell(page, app.url, "a");
    await openControlled(page, app.url);

    const inventory = await cacheInventory(page);
    const buildFilesResponse = await page.request.get(
      `${app.url}__test/app-javascript/a`,
    );
    expect(buildFilesResponse.ok()).toBe(true);
    const expectedJavaScript = (await buildFilesResponse.json()) as string[];
    const basePath = new URL(app.url).pathname;
    const cachedJavaScript = inventory.urls
      .map((url) => new URL(url).pathname)
      .filter((pathname) => pathname.endsWith(".js"))
      .map((pathname) => pathname.slice(basePath.length))
      .sort();
    expect(cachedJavaScript).toEqual(expectedJavaScript);
    expect(inventory.names).toHaveLength(1);
    expect(
      inventory.urls.some((url) => /\/index\.html(?:\?|$)/.test(url)),
    ).toBe(true);
    expect(
      inventory.urls.some((url) => /\/app-icon\.svg(?:\?|$)/.test(url)),
    ).toBe(true);
    expect(
      inventory.urls.some((url) => /\/manifest\.webmanifest(?:\?|$)/.test(url)),
    ).toBe(true);
    for (const domain of ["battle", "deck-editor", "story"])
      expect(
        inventory.urls.some((url) =>
          new RegExp(`/assets/${domain}-[^/]+\\.js`).test(url),
        ),
      ).toBe(true);
    expect(inventory.urls.some((url) => /\.woff2(?:\?|$)/.test(url))).toBe(
      true,
    );
    expect(
      inventory.urls.filter((url) =>
        /(?:\/content\/|\/runtime\/|\/__content\/|\/assets\/story\/|\.wasm(?:\?|$)|\.zip(?:\?|$))/.test(
          url,
        ),
      ),
    ).toEqual([]);

    await page.close();
    await expectOfflineCore(context, app.url);
  });
}

test("failed precache reports visible service worker failure", async ({
  page,
}) => {
  const appUrl = apps[0].url;
  await selectShell(page, appUrl, "broken");
  await page.goto(appUrl);
  await page.locator('[data-cy="main-menu-settings"]').click();
  await expect(
    page.locator('[data-cy="shell-settings-offline-status"]'),
  ).toContainText("Offline setup failed");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          active: registration?.active?.state ?? null,
          controlled: navigator.serviceWorker.controller !== null,
        };
      }),
    )
    .toEqual({ active: null, controlled: false });
});

test("cold service worker update waits for every old controlled tab", async ({
  context,
  page,
}) => {
  const appUrl = apps[0].url;
  await selectShell(page, appUrl, "a");
  await openControlled(page, appUrl);
  const secondPage = await context.newPage();
  await secondPage.goto(appUrl);
  await expect(
    secondPage.locator('[data-cy="main-menu-screen"]'),
  ).toBeVisible();

  const [activeCache] = (await cacheInventory(page)).names;
  expect(activeCache).toMatch(/^ygo-core-shell-/);
  await page.evaluate(async () => {
    const contentCache = await caches.open("ygo-content-files-v1");
    const key = new URL("/__content/files/receipt/test.txt", location.origin);
    await contentCache.put(new Request(key), new Response("installed-content"));
  });
  await selectShell(page, appUrl, "b");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined)
      throw new Error("Service worker is missing");
    await registration.update();
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting?.state ?? null;
      }),
    )
    .toBe("installed");

  await page.locator('[data-cy="main-menu-settings"]').click();
  await expect(
    page.locator('[data-cy="shell-settings-offline-status"]'),
  ).toContainText("Close all app tabs");
  await page.close();
  await expect
    .poll(() =>
      secondPage.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting?.state ?? null;
      }),
    )
    .toBe("installed");
  await expect(
    secondPage.locator('[data-cy="main-menu-screen"]'),
  ).toBeVisible();

  await secondPage.close();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await context.setOffline(true);
  const updatedPage = await context.newPage();
  await updatedPage.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(
    updatedPage.locator('[data-cy="main-menu-screen"]'),
  ).toBeVisible();
  const inventory = await cacheInventory(updatedPage);
  expect(inventory.names).toHaveLength(1);
  expect(inventory.names[0]).not.toBe(activeCache);
  await expect(
    updatedPage.evaluate(async () => {
      const contentCache = await caches.open("ygo-content-files-v1");
      const key = new URL("/__content/files/receipt/test.txt", location.origin);
      return await (await contentCache.match(key))?.text();
    }),
  ).resolves.toBe("installed-content");
});

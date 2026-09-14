import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

for (const target of [
  { id: "root", base: "http://127.0.0.1:4403/", dist: "dist" },
  {
    id: "subpath",
    base: "http://127.0.0.1:4404/ygo-story-duel/",
    dist: ".tmp/t6-installed-built-subpath",
  },
]) {
  test(`private built Chapter 1 install → Free Play → emitted Worker → surrender (${target.id})`, async ({
    page,
  }, testInfo) => {
    const run = process.env.CONTENT_RUN;
    expect(run, "CONTENT_RUN must name a verified T3 run").toMatch(
      /^generated\/asset-delivery\/runs\/[a-f0-9-]{36}$/,
    );
    const candidate = JSON.parse(
      await readFile(path.join(run!, "candidate.json"), "utf8"),
    ) as {
      snapshot: { key: string; sha256: string };
    };
    const snapshot = JSON.parse(
      await readFile(
        path.join(run!, "objects", candidate.snapshot.key),
        "utf8",
      ),
    ) as {
      prod: {
        index: { sha256: string; bytes: number };
        runtimeSnapshotId: string;
      };
    };
    const requests: { url: string; type: string }[] = [];
    const workers: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) =>
      requests.push({ url: request.url(), type: request.resourceType() }),
    );
    page.on("worker", (worker) => workers.push(worker.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${target.base}#/install-content`);
    const bootstrap = await (
      await page.request.get(`${target.base}core-bootstrap.json`)
    ).json();
    expect(bootstrap.delivery.index).toEqual({
      sha256: snapshot.prod.index.sha256,
      bytes: snapshot.prod.index.bytes,
    });
    expect(
      await (
        await page.request.get(`${target.base}PRIVATE_DEPLOYMENT_ONLY.txt`)
      ).text(),
    ).toContain("Keep it private.");
    await expect(
      page.locator('[data-cy="install-content-install-chapter-01"]'),
    ).toBeEnabled();
    await page
      .locator('[data-cy="install-content-install-chapter-01"]')
      .click();
    await expect(
      page.locator('[data-cy="install-content-ready-chapter-01"]'),
    ).toContainText("Verified installed", { timeout: 240_000 });
    await expect(page.locator('[data-cy="install-content-status"]')).toHaveText(
      "Installed content is ready.",
    );
    expect(workers).toEqual([]);
    await page.locator('[data-cy="install-content-back"]').click();
    await page.locator('[data-cy="main-menu-free-play"]').click();
    await expect(page.locator('[data-cy="deck-select-screen"]')).toBeVisible({
      timeout: 120_000,
    });
    const chapterDecks = page.locator('[data-cy^="deck-tile-chapter:"]');
    await expect(chapterDecks).toHaveCount(2);
    const chapterDeckText = await chapterDecks.allTextContents();
    for (const text of chapterDeckText) {
      expect(text).toContain("Installed chapter");
      expect(text).not.toMatch(/bundled|preset/i);
    }
    await expect(page.locator('[data-cy^="deck-tile-preset:"]')).toHaveCount(0);
    await expect(page.locator('[data-cy="deck-select-start"]')).toBeEnabled();
    await page.locator('[data-cy="deck-select-start"]').click();
    await expect(page.locator('[data-cy="duel-field-board"]')).toBeVisible({
      timeout: 120_000,
    });
    expect(workers).toHaveLength(1);
    await page.locator('[data-cy="duel-right-rail-options"]').click();
    await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
    await page
      .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
      .click();
    await expect(
      page.getByRole("heading", { name: "Duel surrendered" }),
    ).toBeVisible();

    // Black-box built acceptance: no source imports, engine patches, or mocks.
    const base = new URL(target.base);
    const workerPath = new URL(workers[0]!).pathname;
    expect(workerPath).toMatch(
      new RegExp(`^${base.pathname}assets/duel\\.worker-browser-[\\w-]+\\.js$`),
    );
    const workerResources = await page
      .workers()[0]!
      .evaluate(() =>
        performance.getEntriesByType("resource").map(({ name }) => name),
      );
    const builtUrls = [
      ...new Set([
        ...requests
          .filter(({ type }) => type === "script")
          .map(({ url }) => url),
        ...workers,
        ...workerResources.filter((url) =>
          new URL(url).pathname.endsWith(".js"),
        ),
      ]),
    ];
    expect(builtUrls.length).toBeGreaterThan(2);
    const emitted = [];
    for (const url of builtUrls) {
      const pathname = new URL(url).pathname;
      expect(pathname.startsWith(`${base.pathname}assets/`)).toBe(true);
      expect(pathname).toMatch(/\.js$/);
      const relative = pathname.slice(base.pathname.length);
      const bytes = await readFile(path.join(target.dist, relative));
      const response = await page.request.get(url);
      expect(response.ok()).toBe(true);
      expect(await response.body()).toEqual(bytes);
      emitted.push({
        url,
        file: path.join(target.dist, relative),
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    expect(
      [...requests.map(({ url }) => url), ...workerResources].filter((url) =>
        /\/(?:src|@vite|@fs)\//.test(new URL(url).pathname),
      ),
    ).toEqual([]);
    expect(
      requests.filter(
        ({ url }) =>
          new URL(url).origin === base.origin &&
          !new URL(url).pathname.startsWith(base.pathname),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
    await testInfo.attach(`built-installed-terminal-${target.id}`, {
      body: JSON.stringify(
        {
          run,
          candidate,
          bootstrap,
          runtimeSnapshotId: snapshot.prod.runtimeSnapshotId,
          chapterDeckText,
          workers,
          workerResources,
          emitted,
          requests,
          errors,
          result: "Duel surrendered",
          sourceModuleInstrumentation: false,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await page.screenshot({
      path: `artifacts/CORE_ACCEPTANCE/T6/built-installed-${target.id}.png`,
    });
  });
}

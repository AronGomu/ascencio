/* global URL, console, document, process */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { chromium } from "@playwright/test";

const server = await createServer({
  configFile: false,
  plugins: [svelte()],
  cacheDir: `.tmp/settings-focus-vite-cache-${process.pid}`,
  resolve: { preserveSymlinks: true },
  server: {
    host: "127.0.0.1",
    port: 4529,
    strictPort: true,
    fs: { allow: [resolve("."), resolve("../..")] },
  },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const cy = (page, name) => page.locator(`[data-cy="${name}"]`);
let failures = 0;
try {
  for (const portaled of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (error) => console.error(error.stack));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    try {
      await page.goto(
        `http://127.0.0.1:4529/tests/fixtures/ui-hardening.html?mode=settings&diagnostics&dynamic${portaled ? "&portal" : ""}`,
      );
      await cy(page, "open-settings").click();
      const download = cy(page, "settings-download-diagnostics-button");
      await download.focus();
      assert.equal(
        await download.evaluate((node) => document.activeElement === node),
        true,
      );
      await page.keyboard.press("Enter");
      assert.equal(await download.isDisabled(), true);
      const active = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        cy: document.activeElement?.getAttribute("data-cy"),
      }));
      console.log(
        `After diagnostics portal=${portaled}: ${JSON.stringify(active)}`,
      );
      assert.equal(active.cy, "settings-show-duel-hud-checkbox");
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await cy(page, "settings-dialog-close-button").evaluate(
          (node) => node === document.activeElement,
        ),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await cy(page, "settings-show-duel-hud-checkbox").evaluate(
          (node) => node === document.activeElement,
        ),
        true,
      );
      const toggle = cy(page, "settings-show-workspace-checkbox");
      await toggle.check();
      assert.equal(
        await cy(page, "workspace-action").evaluate(
          (node) => node.closest("[inert]") !== null,
        ),
        true,
      );
      await toggle.uncheck();
      assert.equal(
        await cy(page, "prompt-dialog").evaluate(
          (node) => node.closest("[inert]") !== null,
        ),
        true,
      );
      assert.equal(
        await toggle.evaluate((node) => node === document.activeElement),
        true,
      );
      await cy(page, "settings-dialog-close-button").click();
      assert.equal(
        await cy(page, "open-settings").evaluate(
          (node) => node === document.activeElement,
        ),
        true,
      );
      await cy(page, "prompt-controls-choice-dynamic-yes").click();
      assert.equal(
        await cy(page, "underlying-action").textContent(),
        "Underlying action 1",
      );
      console.log(`PASS diagnostics focus recovery portal=${portaled}`);
    } catch (error) {
      failures++;
      console.error(
        `FAIL diagnostics focus recovery portal=${portaled}: ${error.stack}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures > 0) process.exitCode = 1;

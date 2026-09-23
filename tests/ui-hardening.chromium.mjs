/* global URL, console, document, getComputedStyle, process */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { chromium } from "@playwright/test";

const server = await createServer({
  configFile: false,
  plugins: [svelte()],
  cacheDir: `.tmp/ui-hardening-vite-cache-${process.pid}`,
  resolve: { preserveSymlinks: true },
  server: {
    host: "127.0.0.1",
    port: 4517,
    strictPort: true,
    fs: { allow: [resolve("."), resolve("../..")] },
  },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
let failures = 0;
const url = "http://127.0.0.1:4517/tests/fixtures/ui-hardening.html";
const cy = (page, name) => page.locator(`[data-cy="${name}"]`);
async function check(name, run) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (error) =>
    console.error(`PAGE ${name}: ${error.stack}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      console.error(`HTTP ${response.status()} ${response.url()}`);
  });
  // Fixture has no network dependency; block accidental external requests.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  try {
    await run(page);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally {
    await page.close();
  }
}
try {
  await check("E1 unaffordable keyboard preview", async (page) => {
    await page.goto(`${url}?mode=shop`);
    await cy(page, "story-shop-card-first").waitFor();
    await cy(page, "story-shop-cards-rarity-sort").focus();
    for (
      let step = 0;
      step < 12 &&
      !(await cy(page, "story-shop-card-first").evaluate(
        (node) => node === document.activeElement,
      ));
      step++
    ) {
      await page.keyboard.press("Tab");
    }
    assert.equal(
      await cy(page, "story-shop-card-first").evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await cy(page, "story-shop-card-second").evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );
    assert.equal(
      await cy(page, "story-shop-card-preview-text").textContent(),
      "Second effect",
    );
    assert.equal(
      await cy(page, "story-shop-card-buy-second").isDisabled(),
      true,
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    assert.equal(await cy(page, "purchases").textContent(), "0");
  });
  for (const portaled of [false, true]) {
    await check(
      `F2 modal keyboard isolation portal=${portaled}`,
      async (page) => {
        await page.goto(`${url}?mode=settings${portaled ? "&portal" : ""}`);
        await cy(page, "open-settings").click();
        const first = cy(page, "settings-show-duel-hud-checkbox");
        const last = cy(page, "settings-dialog-close-button");
        await first.focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await last.evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await first.evaluate((node) => node === document.activeElement),
          true,
        );
        await cy(page, "underlying-action").evaluate((node) => node.focus());
        assert.equal(
          await first.evaluate((node) => node === document.activeElement),
          true,
        );
        for (let index = 0; index < 24; index++) {
          await page.keyboard.press("Tab");
          assert.equal(
            await cy(page, "settings-dialog").evaluate((node) =>
              node.contains(document.activeElement),
            ),
            true,
          );
        }
        await first.focus();
        await cy(page, "field-card-target-rich-host").evaluate((node) =>
          node.focus(),
        );
        assert.equal(
          await first.evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        assert.equal(
          await cy(page, "underlying-action").textContent(),
          "Underlying action 0",
        );
        await page.keyboard.press("Escape");
        await cy(page, "settings-dialog").waitFor({ state: "detached" });
        assert.equal(
          await cy(page, "open-settings").evaluate(
            (node) => node === document.activeElement,
          ),
          true,
        );
        await cy(page, "underlying-action").click();
        assert.equal(
          await cy(page, "underlying-action").textContent(),
          "Underlying action 1",
        );
      },
    );
  }
  for (const portaled of [false, true]) {
    await check(
      `F2 dynamic prompt isolation portal=${portaled}`,
      async (page) => {
        await page.goto(
          `${url}?mode=settings&dynamic${portaled ? "&portal" : ""}`,
        );
        await cy(page, "open-settings").click();
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
        await cy(page, "prompt-controls-choice-dynamic-yes").evaluate((node) =>
          node.focus(),
        );
        assert.equal(
          await toggle.evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Enter");
        assert.equal(
          await cy(page, "underlying-action").textContent(),
          "Underlying action 0",
        );
        // Pointer hit-testing also proves a later portal cannot cover Settings.
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
      },
    );
  }
  await check(
    "F1 field retry stays reachable beside fallback controls",
    async (page) => {
      await page.goto(`${url}?mode=field-failure`);
      await cy(page, "prompt-controls-choice-host-action").waitFor();
      await cy(page, "prompt-dialog-retry-field").click({ timeout: 3000 });
      await cy(page, "duel-field").waitFor();
      assert.equal(
        await cy(page, "prompt-controls-choice-host-action").count(),
        0,
      );
      assert.equal(
        await cy(page, "underlying-action").textContent(),
        "Underlying action 0",
      );
    },
  );
  await check(
    "F3 decorative shadows off, semantic halos preserved",
    async (page) => {
      await page.goto(`${url}?mode=shadows`);
      const card = cy(page, "field-card-rich-host");
      await card.waitFor();
      const art = card.locator(".duel-field-card__art");
      const material = card.locator(".duel-field-card__material").first();
      const shadow = (locator) =>
        locator.evaluate((node) => getComputedStyle(node).boxShadow);
      const decoration = await Promise.all([
        shadow(card),
        shadow(art),
        shadow(material),
      ]);
      assert.ok(decoration.every((value) => value !== "none"));
      const halos = {};
      for (const state of ["legal", "selected"]) {
        await cy(page, state).click();
        assert.equal(
          await card.evaluate(
            (node, expected) => node.classList.contains(expected),
            state === "legal" ? "is-actionable" : "is-selected",
          ),
          true,
        );
        halos[state] = await shadow(art);
        assert.notEqual(halos[state], "none");
        assert.notEqual(halos[state], decoration[1]);
      }
      await cy(page, "ordinary").click();
      await cy(page, "open-settings").click();
      await cy(page, "settings-show-card-shadows-checkbox").uncheck();
      await page.keyboard.press("Escape");
      assert.deepEqual(
        await Promise.all([shadow(card), shadow(art), shadow(material)]),
        ["none", "none", "none"],
      );
      for (const state of ["legal", "selected"]) {
        await cy(page, state).click();
        assert.equal(await shadow(art), halos[state]);
      }
      await page.keyboard.press("Tab");
      await card.focus();
      assert.equal(
        await card.evaluate((node) => node.matches(":focus-visible")),
        true,
      );
      assert.notEqual(
        await card.evaluate((node) => getComputedStyle(node).outlineStyle),
        "none",
      );
      await cy(page, "ordinary").click();
      await cy(page, "open-settings").click();
      await cy(page, "settings-show-card-shadows-checkbox").check();
      await page.keyboard.press("Escape");
      assert.deepEqual(
        await Promise.all([shadow(card), shadow(art), shadow(material)]),
        decoration,
      );
    },
  );
} finally {
  await browser.close();
  await server.close();
}
if (failures > 0) process.exitCode = 1;

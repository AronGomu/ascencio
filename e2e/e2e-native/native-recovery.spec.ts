import { expect, test, type Locator, type Page } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";
import { installNativeWorkerCapture } from "./native-worker-capture.ts";

async function activateByKeyboard(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (
      await target
        .evaluate((node) => document.activeElement === node)
        .catch(() => false)
    ) {
      await page.keyboard.press("Enter");
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(
    `Could not reach keyboard target: ${await target.textContent()}`,
  );
}

async function reachStoryMap(page: Page) {
  await page.goto("/");
  const newGame = page.locator('[data-cy="main-menu-new-game"]');
  await expect(newGame).toBeVisible({ timeout: 120_000 });
  await newGame.click();
  const dialogue = page.locator('[data-cy="story-narrative-dialogue"]');
  await expect(dialogue).toBeVisible();
  for (let index = 0; index < 13; index += 1)
    await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Choose your response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /I trust you/ }).click();
  for (let index = 0; index < 17; index += 1)
    await page.keyboard.press("Enter");
  await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();
}

function responseCommandCount(commands: readonly unknown[]): number {
  return commands.filter((command) => {
    if (typeof command !== "object" || command === null) return false;
    return "type" in command && command.type === "respond";
  }).length;
}

test("native story map, header, and shop fit the viewport", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await reachStoryMap(page);
  await expect(page.locator('[data-cy="story-top-bar"]')).toBeVisible();
  await expect(page.locator('[data-cy="story-map-hotspots"]')).toBeVisible();
  const mapBounds = await page
    .locator('[data-cy="story-map-screen"]')
    .boundingBox();
  expect(mapBounds).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(mapBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mapBounds!.y).toBeGreaterThanOrEqual(0);
  expect(mapBounds!.x + mapBounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(mapBounds!.y + mapBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );
  await page.locator('[data-cy="story-top-bar-shop"]').click();
  await expect(page.locator('[data-cy="story-shop-greeting"]')).toBeVisible();
  const shopBounds = await page
    .locator('[data-cy="story-shop-greeting"]')
    .boundingBox();
  expect(shopBounds).not.toBeNull();
  expect(shopBounds!.x).toBeGreaterThanOrEqual(0);
  expect(shopBounds!.y).toBeGreaterThanOrEqual(0);
  expect(shopBounds!.x + shopBounds!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  expect(shopBounds!.y + shopBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );
});

test("failed native story checkpoint prevents duel startup and returns to map", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await reachStoryMap(page);
  await page.locator('[data-cy="story-map-hotspot-old-arena"]').click();
  const start = page.locator('[data-cy="deck-select-start"]');
  await expect(start).toBeEnabled({ timeout: 120_000 });
  await page.evaluate(() =>
    window.nativeTestControl.failNextUserCommitContaining(
      "checkpoint:pre-duel",
    ),
  );
  await start.click();
  await expect(
    page.locator('[data-cy="story-handoff-error-message"]'),
  ).toHaveText(
    "Your progress could not be saved, so the duel was not started. Free some storage and try again.",
  );
  await expect(page.locator('[data-cy="duel-shell"]')).toHaveCount(0);
  await page.locator('[data-cy="story-handoff-return"]').click();
  await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();
  await expect(
    page.locator('[data-cy="story-map-hotspot-old-arena"]'),
  ).toBeVisible();
});

test("native field fallback retries, then keyboard surrender completes the duel", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await installNativeWorkerCapture(page);
  await page.goto("/?duelFieldFailure=once#/free-play");
  await activateByKeyboard(page, page.locator('[data-cy="deck-select-start"]'));

  const retry = page.locator('[data-cy="prompt-dialog-retry-field"]');
  await expect(retry).toBeVisible({ timeout: 120_000 });
  const responsesBefore = responseCommandCount(
    await page.evaluate(() => window.__nativeWorkerCapture.commands),
  );
  await activateByKeyboard(page, retry);
  await expect(page.locator('[data-cy="prompt-dialog"]')).toHaveCount(0);
  await expect(page.locator('[data-cy="duel-field"]')).toBeVisible();
  expect(
    responseCommandCount(
      await page.evaluate(() => window.__nativeWorkerCapture.commands),
    ),
  ).toBe(responsesBefore);

  const options = page.locator('[data-cy="duel-right-rail-options"]');
  await activateByKeyboard(page, options);
  const surrender = page.locator('[data-cy="menu-dialog-surrender-button"]');
  await expect(surrender).toBeVisible();
  await activateByKeyboard(page, surrender);
  const confirm = page.locator(
    '[data-cy="menu-dialog-surrender-confirm-button"]',
  );
  await expect(confirm).toBeVisible();
  await activateByKeyboard(page, confirm);
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible({ timeout: 120_000 });
});

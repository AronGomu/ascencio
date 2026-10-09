import { expect, test } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";

test("deck editor preview keeps card width and contains its artwork", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installNativeContentBridge(page);
  await page.goto("/#/decks");
  await page.locator('[data-cy="deck-select-create"]').click();
  await page.getByLabel("Deck name").fill("Native preview geometry");
  await page.locator('[data-cy="deck-library-create-submit"]').click();
  await expect(page.locator('[data-cy="deck-editor-layout"]')).toBeVisible();

  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  const blueEyes = page.locator(
    '[data-cy="deck-catalog-results"] [data-cy="catalog-tile-89631139"]',
  );
  await expect(blueEyes).toBeVisible();
  await blueEyes.click();

  const preview = page.locator('[data-cy="card-preview-panel"]');
  const art = page.locator('[data-cy="card-preview-art"]');
  await expect(preview).toBeVisible();
  await expect(art).toBeVisible();
  const [previewBox, artBox] = await Promise.all([
    preview.boundingBox(),
    art.boundingBox(),
  ]);
  expect(previewBox).not.toBeNull();
  expect(artBox).not.toBeNull();

  const expectedWidth = 15.5 * 16;
  expect(
    Math.abs(previewBox!.width - expectedWidth),
    `preview width ${previewBox!.width}px should be within 10px of ${expectedWidth}px`,
  ).toBeLessThanOrEqual(10);
  expect(artBox!.x).toBeGreaterThanOrEqual(previewBox!.x);
  expect(artBox!.x + artBox!.width).toBeLessThanOrEqual(
    previewBox!.x + previewBox!.width,
  );
});

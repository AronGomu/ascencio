import { expect, test } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";

test("installed Chapter 1, Freeplay images, previews and duel field", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installNativeContentBridge(page);
  await page.goto("/");
  await page.locator('[data-cy="main-menu-new-game"]').click();
  await expect(
    page.locator('[data-cy="story-narrative-dialogue"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-cy="application-recovery-message"]'),
  ).toHaveCount(0);
  await page.goto("/#/free-play");
  const covers = page.locator('img[data-cy^="deck-tile-art-"]');
  await expect(covers).toHaveCount(2);
  for (const cover of await covers.all()) {
    await cover.scrollIntoViewIfNeeded();
    const bounds = await cover.boundingBox();
    expect(bounds?.height).toBeGreaterThan(100);
    await expect
      .poll(() =>
        cover.evaluate(
          (node) =>
            node instanceof HTMLImageElement &&
            node.complete &&
            node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  if (!isMobile) {
    await page
      .locator('[data-cy^="deck-select-seat-list-player-main-row-"]')
      .first()
      .hover({ timeout: 15000 });
    const preview = page.locator('[data-cy="deck-select-card-art-float"]');
    await expect(preview).toBeVisible();
    await expect
      .poll(() =>
        preview.evaluate(
          (node) => node instanceof HTMLImageElement && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("freeplay-preview.png"),
    });
    await page.mouse.move(0, 0);
    await expect(preview).toHaveCount(0);
  }
  await page.locator('[data-cy="deck-select-start"]').click();
  await expect(page.locator('[data-cy="duel-field"]')).toBeVisible();
  await expect(page.locator('[data-cy="field-hand-band-p0"]')).toBeVisible();
  await expect(page.locator('[data-cy="field-hand-band-p1"]')).toBeVisible();
  await expect(
    page.locator('[data-cy="field-zone-p0:mainMonster:0"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-cy="field-zone-p1:mainMonster:0"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-cy="field-hand-p0-viewport"] article'),
  ).toHaveCount(5);
  const opponent = page.locator('[data-cy="field-hand-p1-viewport"]');
  await expect(opponent).not.toContainText("La Jinn");
  await expect(page.locator('[data-cy="duel-field-board-plane"]')).toHaveCSS(
    "transform",
    "none",
  );
  await page.screenshot({ path: testInfo.outputPath("duel-field.png") });
  expect(errors).toEqual([]);
});

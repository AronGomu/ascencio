import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, id: string) {
  await page.goto(`?scenario=${id}`);
  return page.locator('[data-cy="floating-field-window-zoneList"]');
}

test("browse shell caps, centers short row, and keeps approved chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = await open(page, "card-list-browse-six");
  const box = await dialog.boundingBox();
  expect(box?.width).toBeCloseTo(1320, 0);
  expect(box?.height).toBeCloseTo(600, 0);
  await expect(page.locator('[data-cy="zone-list-dialog-title"]')).toHaveText("Graveyard");
  await expect(page.locator('.zone-list-entry')).toHaveCount(6);
  await expect(page.locator('[data-cy="zone-list-dialog-cancel-button"]')).toBeVisible();
  const scroller = page.locator('[data-cy="zone-list-dialog-entries"]');
  expect(await scroller.evaluate((element) => element.scrollWidth === element.clientWidth)).toBe(true);
});

test("browse overflow preserves eight pixel edges and wheel scroll", async ({ page }) => {
  await page.setViewportSize({ width: 780, height: 700 });
  await open(page, "card-list-browse-overflow");
  const scroller = page.locator('[data-cy="zone-list-dialog-entries"]');
  expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const first = page.locator('.zone-list-entry').first();
  const scrollerBox = await scroller.boundingBox();
  const firstBox = await first.boundingBox();
  expect(firstBox!.x - scrollerBox!.x).toBeCloseTo(8, 0);
  await scroller.hover();
  await page.mouse.wheel(0, 120);
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await scroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const lastBox = await page.locator('.zone-list-entry').last().boundingBox();
  expect(scrollerBox!.x + scrollerBox!.width - (lastBox!.x + lastBox!.width)).toBeCloseTo(8, 0);
});

test("empty browse and responsive shell stay inside field", async ({ page }) => {
  for (const width of [780, 320]) {
    await page.setViewportSize({ width, height: 700 });
    const dialog = await open(page, "card-list-empty");
    await expect(page.locator('[data-cy="zone-list-dialog-empty"]')).toHaveText("No cards available");
    await expect(page.locator('[data-cy="zone-list-dialog-alphabetical-checkbox"]')).toBeDisabled();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test("tile geometry, zoom and projected action seam stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-browse-six");
  const tile = page.locator(".zone-list-entry").first();
  await page.mouse.move(0, 0);
  const base = await tile.boundingBox();
  expect(base?.width).toBeCloseTo(144, 0);
  await tile.hover();
  await page.waitForTimeout(150);
  const zoomed = await tile.boundingBox();
  expect(zoomed!.width / base!.width).toBeCloseTo(1.6, 1);
  await expect(tile.locator(".zone-list-entry__name")).toHaveCSS("opacity", "0");
  const image = tile.locator("img");
  const menu = tile.locator(".card-action-chips");
  const imageBox = await image.boundingBox();
  const menuBox = await menu.boundingBox();
  const seam = menuBox!.y - (imageBox!.y + imageBox!.height);
  expect(seam).toBeGreaterThanOrEqual(-4);
  expect(seam).toBeLessThanOrEqual(0);
  await expect(menu.getByRole("button", { name: "Activate Alpha effect" })).toHaveText("Activate effect");
  await expect(menu.getByRole("button", { name: "Details" })).toBeVisible();
});

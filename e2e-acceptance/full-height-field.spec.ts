import { expect, test } from "@playwright/test";

for (const scenario of ["field-emz", "field-no-emz"] as const) {
  test(`pixel board keeps five-pixel gaps and ratio (${scenario})`, async ({
    page,
  }) => {
    await page.goto(`?scenario=${scenario}`);
    const zones = page.locator('[data-zone-id^="p0:mainMonster:"]');
    const left = await zones.nth(0).boundingBox();
    const right = await zones.nth(1).boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(right!.x - (left!.x + left!.width)).toBeCloseTo(5, 0);
    expect(left!.width).toBeCloseTo(left!.height, 1);

    const slot = await zones.nth(0).locator(".duel-field-zone__slot").boundingBox();
    const cardWidth = left!.width * (72 / 104);
    expect(slot!.width - cardWidth).toBeCloseTo(6, 0);
  });
}

test("Defense and Set rotate inner art without moving outer placement", async ({
  page,
}) => {
  await page.goto("?scenario=field-defense");
  const defense = page.locator('[data-card-id="acceptance-defense"]');
  const set = page.locator('[data-card-id="acceptance-set"]');
  await expect(defense).toHaveClass(/is-defense/);
  await expect(set).toHaveClass(/is-set/);
  await expect(set.locator("img")).toHaveAttribute("alt", "");
  await expect(defense.locator(".duel-field-card__art")).toHaveCSS(
    "transform",
    /matrix/,
  );
});

test("six and twenty card hands keep height with conditional overlay scrollbar", async ({ page }) => {
  await page.goto("?scenario=field-hand-6");
  const sixCard = page.locator('[data-card-zone-id="p0:hand"]').first();
  const sixHeight = await sixCard.evaluate((element) => element.getBoundingClientRect().height);
  await expect(page.locator('[data-cy="field-hand-p0-count"]')).toHaveText("6");
  await expect(page.locator('[data-cy="field-hand-p0-scrollbar"]')).toBeHidden();

  await page.goto("?scenario=field-hand-20");
  const cards = page.locator('[data-card-zone-id="p0:hand"]');
  await expect(cards).toHaveCount(20);
  const twentyHeight = await cards.first().evaluate((element) => element.getBoundingClientRect().height);
  expect(twentyHeight).toBeCloseTo(sixHeight, 1);
  const viewport = page.locator('[data-cy="field-hand-p0-viewport"]');
  expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const scrollbar = page.locator('[data-cy="field-hand-p0-scrollbar"]');
  await expect(scrollbar).toBeVisible();

  const thumb = page.locator('[data-cy="field-hand-p0-scrollbar-thumb"]');
  const box = await thumb.boundingBox();
  expect(box).not.toBeNull();
  await thumb.hover();
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width + 40, box!.y + box!.height / 2);
  await page.mouse.up();
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const countZ = await page.locator('[data-cy="field-hand-p0-count"]').evaluate((element) => Number(getComputedStyle(element).zIndex));
  const cardZ = await cards.first().evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(countZ).toBeGreaterThan(cardZ);
});

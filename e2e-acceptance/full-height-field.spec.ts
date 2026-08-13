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

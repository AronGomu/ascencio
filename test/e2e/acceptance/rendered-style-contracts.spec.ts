import { expect, test } from "@playwright/test";

for (const { scenario, selector } of [
  {
    scenario: "field-defense",
    selector:
      ".duel-field-card.is-identity-known:not(.is-hand-item):not(.is-pinned)[tabindex]",
  },
  {
    scenario: "field-hand-zoom",
    selector:
      ".duel-field-card.is-identity-known.is-hand-item:not(.is-pinned)[tabindex]",
  },
]) {
  test(`reduced motion keeps hovered and focused cards still in ${scenario}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`?scenario=${scenario}`);
    const card = page.locator(selector).first();
    await expect(card).toBeVisible();
    const baseline = await card.boundingBox();
    if (baseline === null) throw new Error("Missing card geometry");
    expect(
      await card.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).transitionDuration),
      ),
    ).toBeLessThanOrEqual(0.00001);
    await card.hover();
    for (const interaction of ["hover", "focus"]) {
      if (interaction === "focus") {
        await page.mouse.move(0, 0);
        await card.focus();
        await expect(card).toBeFocused();
      }
      await expect
        .poll(async () => {
          const current = await card.boundingBox();
          if (current === null) return Infinity;
          return Math.max(
            ...(["x", "y", "width", "height"] as const).map((axis) =>
              Math.abs(current[axis] - baseline[axis]),
            ),
          );
        })
        .toBeLessThanOrEqual(1);
    }
  });
}

test("rendered layout and accessibility contracts hold in the real acceptance scenarios", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 600 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("?scenario=card-list-target-chrome");

  const dialog = page.locator('[data-cy="floating-field-window-zoneList"]');
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(820);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(600);

  const targets = page.locator('[data-cy^="zone-list-entry-target-choice-"]');
  const target = targets.first();
  await expect(target).toBeVisible();
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  expect(targetBox!.width).toBeGreaterThanOrEqual(44);
  expect(targetBox!.height).toBeGreaterThanOrEqual(44);

  await target.focus();
  await expect(target).toBeFocused();
  await expect
    .poll(() =>
      target.evaluate((element) => getComputedStyle(element).outlineWidth),
    )
    .not.toBe("0px");
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[data-cy="zone-list-dialog-selection-count"]'),
  ).toContainText("1 selected");

  const image = page.locator(".zone-list-entry img").first();
  await expect
    .poll(() =>
      image.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).transitionDuration),
      ),
    )
    .toBeLessThanOrEqual(0.00001);
});

import { expect, test } from "@playwright/test";

test("the zoomed hand card overflows the hand band and shows chips above", async ({
  page,
}) => {
  await page.goto("?scenario=field-hand-zoom");
  await expect(
    page.locator('[data-cy="acceptance-scenario"]'),
  ).toBeVisible();

  const handBand = page.locator('[data-cy="field-hand-band-p0"]');
  await expect(handBand).toBeVisible();

  // 3rd card (sequence 2) is the one with choices; hover it
  const cards = handBand.locator(".duel-field-card");
  const thirdCard = cards.nth(2);
  await thirdCard.hover();

  const overlay = page.locator('div.hand-zoom-overlay');
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();

  const bandBox = await handBand.boundingBox();
  expect(bandBox).not.toBeNull();

  // Overlay must extend above the hand band top
  expect(overlayBox!.y).toBeLessThan(bandBox!.y);

  // Overlay height must be approximately card height × 1.6 (±10%)
  const cardBox = await thirdCard.boundingBox();
  expect(cardBox).not.toBeNull();
  const expectedHeight = cardBox!.height * 1.6;
  expect(overlayBox!.height).toBeGreaterThan(expectedHeight * 0.9);
  expect(overlayBox!.height).toBeLessThan(expectedHeight * 1.1);

  // Chips row must appear above the overlay top
  const chips = overlay.locator('[data-cy^="card-action-chips-"]');
  await expect(chips).toBeVisible();
  const chipsBox = await chips.boundingBox();
  expect(chipsBox).not.toBeNull();
  expect(chipsBox!.y + chipsBox!.height).toBeLessThanOrEqual(
    overlayBox!.y + 2, // 2px tolerance for rounding
  );
});

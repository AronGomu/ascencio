import { expect, test, type Page } from "@playwright/test";

const BEATS_BEFORE_CHOICE = 13;
const BEATS_AFTER_CHOICE = 17;

const STORY_REGION = '[data-cy="shell-region-story"]';

async function openStory(page: Page): Promise<void> {
  await page.goto("./#/story");
  await expect(page.locator(STORY_REGION)).toBeVisible();
}

async function startNarrative(page: Page): Promise<void> {
  await openStory(page);
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(page.getByText(/Rain turned/)).toBeVisible();
}

async function reachMap(page: Page): Promise<void> {
  await startNarrative(page);
  for (let index = 0; index < BEATS_BEFORE_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Choose your response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /I trust you/ }).click();
  await expect(page.getByText(/earn that trust/)).toBeVisible();
  for (let index = 0; index < BEATS_AFTER_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
}

async function advanceThroughGreeting(page: Page): Promise<void> {
  await page.locator('[data-cy="story-shop-greeting-cue"]').click();
  await page.locator('[data-cy="story-shop-greeting-cue"]').click();
  await expect(
    page.locator('[data-cy="story-shop-greeting-menu"]'),
  ).toBeVisible();
}

test("shop loop: buy packs, open all, sell cards, singles sanity", async ({
  page,
}) => {
  // Step 1: reach the map via the full prologue
  await reachMap(page);

  // Step 2: enter the shop, advance through greeting beats
  await page.locator('[data-cy="story-map-hotspot-card-shop"]').click();
  await expect(page.locator('[data-cy="story-shop-greeting"]')).toBeVisible();
  await advanceThroughGreeting(page);

  // Step 3: buy 10 Metal Raiders packs, spending all 1000 DP
  await page.locator('[data-cy="story-shop-greeting-buy"]').click();
  await expect(
    page.locator('[data-cy="story-shop-browse-loading"]'),
  ).not.toBeVisible();
  await page.locator('[data-cy="story-shop-set-metal-raiders"]').click();
  await page.locator('[data-cy="story-shop-buy-ten"]').click();
  await expect(page.locator('[data-cy="story-top-bar-dp"]')).toHaveText("0 DP");

  // Close the set dialog before accessing the top-bar boosters pill
  await page.keyboard.press("Escape");

  // Step 4: open all 10 packs at once, verify 90 result tiles, continue
  await expect(page.locator('[data-cy="story-top-bar-boosters"]')).toHaveText(
    "10 packs",
  );
  await page.locator('[data-cy="story-top-bar-boosters"]').click();
  await page.locator('[data-cy="story-shop-open-all"]').click();
  await expect(
    page.locator('[data-cy="story-shop-results-grid"] > div'),
  ).toHaveCount(90);
  await page.locator('[data-cy="story-shop-results-continue"]').click();

  // Step 5: sell — navigate back through greeting to the sell screen
  await page.locator('[data-cy="story-shop-browse-back"]').click();
  await expect(page.locator('[data-cy="story-shop-greeting"]')).toBeVisible();
  await advanceThroughGreeting(page);
  await page.locator('[data-cy="story-shop-greeting-sell"]').click();
  await expect(page.locator('[data-cy="story-shop-sell"]')).toBeVisible();
  await page.locator('[data-cy^="story-shop-sell-plus-"]').first().click();
  await page.locator('[data-cy="story-shop-sell-confirm"]').click();
  const dpText = await page
    .locator('[data-cy="story-top-bar-dp"]')
    .textContent();
  const dp = Number.parseInt(dpText ?? "0", 10);
  expect(dp).toBeGreaterThan(0);

  // Step 6: singles sanity — buy button disabled/enabled consistent with DP
  await page.locator('[data-cy="story-shop-sell-back"]').click();
  await expect(page.locator('[data-cy="story-shop-greeting"]')).toBeVisible();
  await advanceThroughGreeting(page);
  await page.locator('[data-cy="story-shop-greeting-buy"]').click();
  await expect(
    page.locator('[data-cy="story-shop-browse-loading"]'),
  ).not.toBeVisible();
  await page.locator('[data-cy="story-shop-set-metal-raiders"]').click();
  await page.locator('[data-cy="story-shop-view-cards"]').click();

  const firstBuyButton = page
    .locator('[data-cy^="story-shop-card-buy-"]')
    .first();
  const priceText = await firstBuyButton.textContent();
  const price = Number.parseInt(priceText ?? "0", 10);
  const isDisabled = await firstBuyButton.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  expect(isDisabled).toBe(dp < price);
});

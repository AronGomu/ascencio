import { expect, test, type Page } from "@playwright/test";

const adminUrl = "./#/admin";

async function deleteDeckDatabase(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(
        "ygo-story-duel-deck-builder-prototype",
      );
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
}

test("the admin console ships in the production bundle", async ({ page }) => {
  await page.goto(adminUrl);
  await expect(page.locator('[data-cy="admin-title"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-routes"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-jumps"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-resets"]')).toBeVisible();
});

test("the console is not linked from the player-facing home hub", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator('[data-cy="home-title"]')).toBeVisible();
  await expect(page.locator('[data-cy^="admin-"]')).toHaveCount(0);
});

test("the route index navigates to any indexed route", async ({ page }) => {
  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-route-decks"]').click();
  await expect(
    page.getByRole("heading", { name: "Deck Library" }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/decks");

  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-route-home"]').click();
  await expect(page.locator('[data-cy="home-title"]')).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/");
});

test("seeding fills the deck library and a confirmed reset empties it", async ({
  page,
}) => {
  await page.goto(adminUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  /* The seed jump deep-links at the deck it just wrote, so success is the
     editor open on that deck rather than the library listing it. */
  await page.locator('[data-cy="admin-jump-seed-deck"]').click();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Admin test deck",
  );
  expect(new URL(page.url()).hash).toBe("#/decks/admin-test-deck");

  await page.goto(adminUrl);
  /* The first click only arms the delete: nothing is removed until the
     separate confirm button that it reveals is clicked. */
  await page.locator('[data-cy="admin-reset-decks"]').click();
  await expect(
    page.locator('[data-cy="admin-reset-decks-confirm"]'),
  ).toBeVisible();
  await page.locator('[data-cy="admin-route-decks"]').click();
  await expect(page.getByText("Admin test deck")).toBeVisible();

  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-reset-decks"]').click();
  await page.locator('[data-cy="admin-reset-decks-confirm"]').click();
  await expect(page.locator('[data-cy="admin-status"]')).toHaveText(
    "Cleared Deck library.",
  );

  await page.locator('[data-cy="admin-route-decks"]').click();
  await expect(
    page.getByRole("heading", { name: "No local decks" }),
  ).toBeVisible();
  await expect(page.getByText("Admin test deck")).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";
test.beforeEach(async ({ page }) => {
  await installNativeContentBridge(page);
});

const adminUrl = "./#/admin";

test("the native admin console exposes routes and maintenance controls", async ({
  page,
}) => {
  await page.goto(adminUrl);
  await expect(page.locator('[data-cy="admin-title"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-routes"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-jumps"]')).toBeVisible();
  await expect(page.locator('[data-cy="admin-resets"]')).toBeVisible();
});

test("the console is not linked from the player-facing main menu", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator('[data-cy="main-menu-title"]')).toBeVisible();
  await expect(page.locator('[data-cy^="admin-"]')).toHaveCount(0);
});

test("the route index navigates to any indexed route", async ({ page }) => {
  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-route-free-play-decks"]').click();
  await expect(
    page.getByRole("heading", { name: "Deck Library" }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/free-play/decks");

  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-route-home"]').click();
  await expect(page.locator('[data-cy="main-menu-title"]')).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/");
});

test("seeding fills the deck library and a confirmed reset restores its default deck", async ({
  page,
}) => {
  await page.goto(adminUrl);

  await page.reload();

  /* The seed jump deep-links at the deck it just wrote, so success is the
     editor open on that deck rather than the library listing it. */
  await page.locator('[data-cy="admin-jump-seed-deck"]').click();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Admin test deck",
  );
  expect(new URL(page.url()).hash).toBe("#/free-play/decks/admin-test-deck");

  await page.goto(adminUrl);
  /* The first click only arms the delete: nothing is removed until the
     separate confirm button that it reveals is clicked. */
  await page.locator('[data-cy="admin-reset-decks"]').click();
  await expect(
    page.locator('[data-cy="admin-reset-decks-confirm"]'),
  ).toBeVisible();
  await page.locator('[data-cy="admin-route-free-play-decks"]').click();
  await expect(page.getByText("Admin test deck")).toBeVisible();

  await page.goto(adminUrl);
  await page.locator('[data-cy="admin-reset-decks"]').click();
  await page.locator('[data-cy="admin-reset-decks-confirm"]').click();
  await expect(page.locator('[data-cy="admin-status"]')).toHaveText(
    "Cleared Free-play deck library.",
  );

  await page.locator('[data-cy="admin-route-free-play-decks"]').click();

  await expect(page.getByText("Admin test deck")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rename Free Play Player", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-cy="deck-select-grid"] > [data-cy^="deck-tile-"]'),
  ).toHaveCount(1);
});

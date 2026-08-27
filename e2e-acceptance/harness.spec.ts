import { expect, test } from "@playwright/test";

for (const [scenario, extraMonsterZones, zoneCount] of [
  ["field-emz", "true", 34],
  ["field-no-emz", "false", 32],
  ["field-defense", "true", 34],
] as const) {
  test(`${scenario} renders real deterministic field`, async ({ page }) => {
    await page.goto(`?scenario=${scenario}`);
    const harness = page.locator(`[data-acceptance-scenario="${scenario}"]`);
    await expect(harness).toHaveAttribute(
      "data-extra-monster-zones",
      extraMonsterZones,
    );
    await expect(harness).toHaveAttribute("data-zone-count", String(zoneCount));
    await expect(harness.locator('[data-cy="duel-field"]')).toBeVisible();
    await expect(harness.locator('[data-cy="duel-field-board"]')).toBeVisible();
  });
}

test("unknown scenario fails visibly without fallback board", async ({
  page,
}) => {
  await page.goto("?scenario=nope");
  await expect(
    page.locator('[data-cy="acceptance-scenario-error"]'),
  ).toBeVisible();
  await expect(page.locator('[data-cy="duel-field-board"]')).toHaveCount(0);
});

test("missing scenario fails visibly without fallback board", async ({
  page,
}) => {
  await page.goto("");
  await expect(
    page.locator('[data-cy="acceptance-scenario-error"]'),
  ).toBeVisible();
  await expect(page.locator('[data-cy="duel-field-board"]')).toHaveCount(0);
});

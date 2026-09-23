import { expect, test } from "@playwright/test";

const appUrl = process.env.PWA_RETRY_TEST_URL ?? "http://127.0.0.1:4400/";

test("failed first precache can retry without CORE update approval", async ({
  page,
}) => {
  const broken = await page.request.post(
    `${appUrl}__test/shell-version/broken`,
  );
  expect(broken.ok()).toBe(true);
  await page.goto(appUrl);
  await page.locator('[data-cy="main-menu-settings"]').click();
  await expect(
    page.locator('[data-cy="shell-settings-offline-status"]'),
  ).toContainText("Offline setup failed");

  const repaired = await page.request.post(`${appUrl}__test/shell-version/a`);
  expect(repaired.ok()).toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state ?? null;
      }),
    )
    .toBe("activated");

  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
  await page.locator('[data-cy="main-menu-settings"]').click();
  await expect(
    page.locator('[data-cy="shell-settings-offline-status"]'),
  ).toContainText("Offline reopening is ready");
});

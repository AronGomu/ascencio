import { expect, test } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";

test("collection renders optional native card artwork from URL-free catalog definitions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installNativeContentBridge(page);
  await page.goto("/#/free-play/collection");
  await expect(page.locator('[data-cy="collection-screen"]')).toBeVisible();
  const art = page.locator('img[data-cy^="collection-art-"]').first();
  await expect(art).toBeVisible();
  await expect(art).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() =>
      art.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.locator('[data-cy="collection-back"]').click();
  await expect(page.locator('[data-cy="collection-screen"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

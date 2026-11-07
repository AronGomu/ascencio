import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";

async function addOverflowFixture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scroller = document.createElement("div");
    scroller.dataset.cy = "native-scrollbar-fixture";
    Object.assign(scroller.style, {
      position: "fixed",
      top: "1rem",
      left: "1rem",
      width: "160px",
      height: "80px",
      overflow: "scroll",
    });
    const content = document.createElement("div");
    Object.assign(content.style, { width: "480px", height: "320px" });
    scroller.append(content);
    document.body.append(scroller);
  });
}

async function addZoneFixture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const zone = document.createElement("div");
    zone.dataset.cy = "native-zone-scrollbar-fixture";
    zone.className = "zone-list-dialog__entries";
    Object.assign(zone.style, {
      position: "fixed",
      top: "6rem",
      left: "1rem",
      width: "160px",
      height: "80px",
      overflow: "auto",
    });
    const content = document.createElement("div");
    Object.assign(content.style, {
      width: "480px",
      height: "200px",
      flex: "none",
    });
    zone.append(content);
    document.body.append(zone);
  });
}

test("native scrollbar styling renders and remains visible in forced colors", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await page.goto("/");
  await expect(page.locator('[data-cy="main-menu-new-game"]')).toBeVisible({
    timeout: 120_000,
  });
  await addOverflowFixture(page);

  const scrollbar = page.locator('[data-cy="native-scrollbar-fixture"]');
  await expect(scrollbar).toBeVisible();
  await expect
    .poll(() =>
      scrollbar.evaluate((element) => ({
        scrollable:
          element.scrollWidth > element.clientWidth &&
          element.scrollHeight > element.clientHeight,
        client: [element.clientWidth, element.clientHeight],
        scroll: [element.scrollWidth, element.scrollHeight],
        overflow: getComputedStyle(element).overflow,
        width: getComputedStyle(element, "::-webkit-scrollbar").width,
        standardScrollbarColor: CSS.supports("scrollbar-color: red blue"),
        thumbColor: getComputedStyle(element, "::-webkit-scrollbar-thumb")
          .backgroundColor,
        color: getComputedStyle(element).scrollbarColor,
      })),
    )
    .toMatchObject({
      scrollable: true,
      width: "12px",
      thumbColor: "rgb(115, 130, 157)",
    });
  const normalColor = await scrollbar.evaluate((element) => ({
    color: getComputedStyle(element).scrollbarColor,
  }));
  const normalColorSupported =
    typeof normalColor.color === "string" && normalColor.color !== "";
  expect(normalColor.color).toBe(
    normalColorSupported ? "rgb(115, 130, 157) rgb(11, 20, 36)" : undefined,
  );
  await scrollbar.evaluate((element) => {
    element.scrollTop = 40;
  });
  expect(await scrollbar.evaluate((element) => element.scrollTop)).toBe(40);

  await page.emulateMedia({ forcedColors: "active" });
  const forcedColor = await scrollbar.evaluate((element) => ({
    scrollable:
      element.scrollWidth > element.clientWidth &&
      element.scrollHeight > element.clientHeight,
    width: getComputedStyle(element, "::-webkit-scrollbar").width,
    thumbColor: getComputedStyle(element, "::-webkit-scrollbar-thumb")
      .backgroundColor,
    color: getComputedStyle(element).scrollbarColor,
  }));
  expect(forcedColor).toMatchObject({ scrollable: true, width: "12px" });
  const forcedColorSupported =
    typeof forcedColor.color === "string" && forcedColor.color !== "";
  expect(forcedColor.color).toBe(forcedColorSupported ? "auto" : undefined);
  expect(forcedColor.thumbColor).not.toBe("rgba(0, 0, 0, 0)");

  await addZoneFixture(page);
  const zone = page.locator('[data-cy="native-zone-scrollbar-fixture"]');
  await expect(zone).toBeVisible();
  const zoneStyle = await zone.evaluate((element) => ({
    scrollable:
      element.scrollWidth > element.clientWidth &&
      element.scrollHeight > element.clientHeight,
    width: getComputedStyle(element).scrollbarWidth,
    widthSupported:
      typeof getComputedStyle(element).scrollbarWidth === "string" &&
      getComputedStyle(element).scrollbarWidth !== "",
    colorSupported:
      typeof getComputedStyle(element).scrollbarColor === "string" &&
      getComputedStyle(element).scrollbarColor !== "",
    color: getComputedStyle(element).scrollbarColor,
  }));
  expect(zoneStyle.scrollable).toBe(true);
  expect(zoneStyle.width).toBe(zoneStyle.widthSupported ? "auto" : undefined);
  expect(zoneStyle.color).toBe(zoneStyle.colorSupported ? "auto" : undefined);

  await page.goto("/#/decks");
  await page.locator('[data-cy="deck-select-create"]').click();
  await page.getByLabel("Deck name").fill("Forced color scrollbar");
  await page.locator('[data-cy="deck-library-create-submit"]').click();
  await page.getByRole("searchbox", { name: "Name" }).fill("Dragon");
  const catalogResults = page.locator('[data-cy="deck-catalog-results"]');
  const overlayThumb = page.locator(
    '[data-cy="deck-catalog-results-scrollbar-thumb"]',
  );

  const deckTab = page.getByRole("tab", { name: "Deck" });
  if ((await deckTab.count()) > 0) {
    const scrollOwner = page.locator('[data-cy="shell-region-decks"]');
    await expect
      .poll(() =>
        scrollOwner.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
    await scrollOwner.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await expect(overlayThumb).toBeHidden();
    return;
  }

  await expect
    .poll(() =>
      catalogResults.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  await expect(overlayThumb).toBeVisible();
  await expect
    .poll(() =>
      overlayThumb.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe("rgb(0, 0, 0)");
  const overlayBounds = await overlayThumb.boundingBox();
  expect(overlayBounds).not.toBeNull();
  expect(overlayBounds!.width).toBeGreaterThan(0);
  expect(overlayBounds!.height).toBeGreaterThan(0);
});

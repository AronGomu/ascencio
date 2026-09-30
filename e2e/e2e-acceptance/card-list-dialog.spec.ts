import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

const dialogSelector = '[data-cy="floating-field-window-zoneList"]';
const tileSelector = ".zone-list-entry";

async function open(page: Page, id: string): Promise<Locator> {
  await page.goto(`?scenario=${id}`);
  const dialog = page.locator(dialogSelector);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function rect(locator: Locator): Promise<Rect> {
  return locator.evaluate((element) => {
    const value = element.getBoundingClientRect();
    return {
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
      right: value.right,
      bottom: value.bottom,
    };
  });
}

async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

function expectPx(actual: number, expected: number, tolerance = 0.5): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function expectInsideViewport(
  locator: Locator,
  width: number,
  height: number,
): Promise<void> {
  const box = await rect(locator);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(width);
  expect(box.bottom).toBeLessThanOrEqual(height);
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function selectedIds(page: Page): Promise<string[]> {
  const raw =
    (await page
      .locator('[data-cy="acceptance-card-list-scenario"]')
      .getAttribute("data-selected-choice-ids")) ?? "";
  return raw === "" ? [] : raw.split(",");
}

async function targetButtons(page: Page): Promise<Locator> {
  return page.locator('[data-cy^="zone-list-entry-target-choice-"]');
}

async function clickTarget(page: Page, button: Locator): Promise<void> {
  await page.mouse.move(1, 1);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
}

async function expectDocumentFits(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function tabRoute(page: Page, length: number): Promise<string[]> {
  const route: string[] = [];
  for (let index = 0; index < length; index += 1) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        dataCy: element?.getAttribute("data-cy") ?? null,
        outlineWidth:
          element instanceof Element
            ? getComputedStyle(element).outlineWidth
            : "0px",
      };
    });
    expect(active.dataCy).not.toBeNull();
    expect(
      active.outlineWidth,
      `${active.dataCy} must show keyboard focus`,
    ).not.toBe("0px");
    route.push(active.dataCy!);
  }
  return route;
}

test("approved browse metrics cover checks 1-16", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
  });

  const dialog = await open(page, "card-list-browse-six");
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  const dialogBox = await rect(dialog);
  expectPx(dialogBox.width, 1320);
  expectPx(dialogBox.height, 600);
  await expect(page.locator('[data-cy="zone-list-dialog-title"]')).toHaveText(
    "Graveyard",
  );
  await expect(page.locator('[data-cy="zone-list-dialog-count"]')).toHaveText(
    "6",
  );
  const tiles = page.locator(tileSelector);
  await expect(tiles).toHaveCount(6);
  await expect(page.getByText(/quantity/i)).toHaveCount(0);

  const scroller = page.locator('[data-cy="zone-list-dialog-entries"]');
  expect(
    await scroller.evaluate(
      (element) => element.scrollWidth === element.clientWidth,
    ),
  ).toBe(true);
  const scrollerBox = await rect(scroller);
  const firstBase = await rect(tiles.first());
  const lastBase = await rect(tiles.last());
  const rowCenter = (firstBase.x + lastBase.right) / 2;
  const scrollerCenter = (scrollerBox.x + scrollerBox.right) / 2;
  expect(Math.abs(rowCenter - scrollerCenter)).toBeLessThanOrEqual(1);
  expectPx(firstBase.width, 144);
  expectPx((await rect(tiles.nth(1))).x - firstBase.right, 8);

  await attachScreenshot(page, testInfo, "wide-browse");

  await tiles.first().hover();
  await page.waitForTimeout(150);
  const zoomed = await rect(tiles.first());
  expect(zoomed.width / firstBase.width).toBeGreaterThanOrEqual(1.58);
  expect(zoomed.width / firstBase.width).toBeLessThanOrEqual(1.62);
  expect(
    Number.parseFloat(
      await computed(
        tiles.first().locator(".zone-list-entry__name"),
        "opacity",
      ),
    ),
  ).toBe(0);

  const imageBox = await rect(tiles.first().locator("img"));
  const menu = tiles.first().locator(".card-action-chips");
  const sort = page.locator(
    '[data-cy="zone-list-dialog-alphabetical-checkbox"]',
  );
  await expect(menu).toBeVisible();
  const menuBox = await rect(menu);
  const seam = menuBox.y - imageBox.bottom;
  expect(seam).toBeGreaterThanOrEqual(-4);
  expect(seam).toBeLessThanOrEqual(0);
  await menu.getByRole("button", { name: "Activate Alpha effect" }).click();
  await expect(
    page.locator('[data-cy="acceptance-card-list-scenario"]'),
  ).toHaveAttribute("data-last-action", "acceptance-activate-first");
  expect(await selectedIds(page)).toEqual([]);
  await tiles
    .first()
    .locator("img")
    .click({ position: { x: 70, y: 100 } });
  expect(await selectedIds(page)).toEqual([]);

  await page.mouse.move(0, 0);
  expect(
    await tiles
      .first()
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  expect(
    (await rect(tiles.first())).width / firstBase.width,
  ).toBeGreaterThanOrEqual(1.58);
  expect(
    Number.parseFloat(
      await computed(
        tiles.first().locator(".zone-list-entry__name"),
        "opacity",
      ),
    ),
  ).toBe(0);

  await sort.focus();
  await expect(sort).toBeFocused();
  await page.waitForTimeout(150);
  expect(await computed(tiles.first(), "transform")).toBe("none");
  expect(
    Number.parseFloat(
      await computed(
        tiles.first().locator(".zone-list-entry__name"),
        "opacity",
      ),
    ),
  ).toBe(1);

  await expect(tiles.first()).not.toHaveClass(/is-selected/);

  const sourceOrder = await tiles.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-cy")),
  );
  await sort.check();
  await expect(tiles.first().locator(".zone-list-entry__name")).toHaveText(
    "Alpha",
  );
  await sort.uncheck();
  expect(
    await tiles.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-cy")),
    ),
  ).toEqual(sourceOrder);

  await expect(
    page.locator('[data-cy="zone-list-dialog-close-button"]'),
  ).toHaveText("×");
  await expect(
    page.locator('[data-cy="zone-list-dialog-collapse-button"]'),
  ).toHaveCount(0);
  const footer = page.locator('[data-cy="zone-list-dialog-footer"]');
  await expect(footer).toContainText("Alphabetical");
  await expect(
    page.locator('[data-cy="zone-list-dialog-cancel-button"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-cy="zone-list-dialog-confirm-button"]'),
  ).toHaveCount(0);
  await expect(footer).not.toContainText(/top|bottom|order/i);
  await expect(
    page.locator(
      '[data-cy*="evaluator"], [data-cy*="debug"], textarea, [data-cy*="reopen"]',
    ),
  ).toHaveCount(0);

  const beforeDrag = await rect(dialog);
  const header = page.locator('[data-cy="zone-list-dialog-header"]');
  const headerBox = await rect(header);
  await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(
    headerBox.x + headerBox.width / 2 - 40,
    headerBox.y + 45,
  );
  await page.mouse.up();
  const afterDrag = await rect(dialog);
  expect(afterDrag.x).not.toBe(beforeDrag.x);
  expect(afterDrag.y).not.toBe(beforeDrag.y);
  await expect(
    page.locator('[data-cy="acceptance-card-list-scenario"]'),
  ).toHaveAttribute("data-position-change-count", "1");
});

test("exact target modes cover checks 17-21 and 29-32", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-single");
  const count = page.locator('[data-cy="zone-list-dialog-selection-count"]');
  const confirm = page.locator('[data-cy="zone-list-dialog-confirm-button"]');
  await expect(count).toHaveText("0 / 1 selected");
  await expect(confirm).toBeDisabled();
  await clickTarget(page, (await targetButtons(page)).first());
  await expect(count).toHaveText("1 / 1 selected");
  await expect(confirm).toBeEnabled();
  await expect(
    page.locator('[data-cy="zone-list-dialog-close-button"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-cy="zone-list-dialog-target-cancel-button"]'),
  ).toHaveCount(0);

  await open(page, "card-list-multiple");
  await expect(count).toHaveText("0 / 3 selected");
  for (let index = 0; index < 3; index += 1) {
    const multipleButtons = await targetButtons(page);
    await clickTarget(page, multipleButtons.nth(index));
    await expect(count).toHaveText(`${index + 1} / 3 selected`);
  }
  await expect(count).toHaveText("3 / 3 selected");
  await expect(confirm).toBeEnabled();

  const dialog = await open(page, "card-list-mixed");
  await expect(count).toHaveText("0 / 2 selected");
  await expect(
    page.locator('[data-cy="zone-list-dialog-filter-notice"]'),
  ).toHaveText(
    "Filtered: legal targets from Extra Deck, Graveyard, Banished, and Deck",
  );
  const badges = page.locator(".zone-list-entry__zone");
  await expect(badges).toHaveText([
    "EXTRA DECK",
    "GRAVEYARD",
    "BANISHED",
    "DECK",
  ]);
  for (let index = 0; index < 4; index += 1) {
    // Contract gap is badge→art. Measure badge bottom against the art box top
    // after layout settles; allow 5±1.5 for subpixel + border paint variance.
    await expect
      .poll(async () => {
        const badge = await rect(badges.nth(index));
        const art = await rect(
          page.locator(tileSelector).nth(index).locator("img"),
        );
        return Math.abs(art.y - badge.bottom - 5);
      })
      .toBeLessThanOrEqual(1.5);
  }
  const mixedButtons = await targetButtons(page);
  await clickTarget(page, mixedButtons.nth(0));
  await clickTarget(page, mixedButtons.nth(1));
  await expect(count).toHaveText("2 / 2 selected");
  await attachScreenshot(page, testInfo, "mixed-target");
  const cancel = page.locator(
    '[data-cy="zone-list-dialog-target-cancel-button"]',
  );
  await expect(cancel).toBeVisible();
  expect(await computed(cancel, "background-color")).toBe("rgb(255, 140, 155)");
  await expect(
    page.locator('[data-cy="zone-list-dialog-close-button"]'),
  ).toHaveCount(0);

  const collapse = page.locator('[data-cy="zone-list-dialog-collapse-button"]');
  const minusBox = await rect(collapse);
  await collapse.click();
  await expect(dialog).toHaveAttribute("data-collapsed", "true");
  const collapsedBox = await rect(dialog);
  expectPx(collapsedBox.width, 58);
  expectPx(collapsedBox.height, 58);
  const expand = page.locator('[data-cy="zone-list-dialog-expand-button"]');
  const plusBox = await rect(expand);
  expectPx(plusBox.x, minusBox.x);
  expectPx(plusBox.y, minusBox.y);
  expect(
    await page
      .locator('[data-cy="zone-list-dialog-header"]')
      .evaluate(
        (element) =>
          [...element.children].filter(
            (child) => getComputedStyle(child).visibility !== "hidden",
          ).length,
      ),
  ).toBe(1);
  await expand.click();
  await expect(count).toHaveText("2 / 2 selected");
});

test("maximum lock and stale draft cover checks 22-28", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-multiple");
  const buttons = await targetButtons(page);
  for (let index = 0; index < 3; index += 1)
    await clickTarget(page, buttons.nth(index));
  const unavailableButton = buttons.nth(3);
  const unavailableTile = page.locator(tileSelector).nth(3);
  await expect(unavailableButton).toBeDisabled();
  await expect(unavailableButton).toHaveAttribute("aria-disabled", "true");
  await expect(unavailableButton).toHaveAttribute("aria-pressed", "false");
  await expect(unavailableTile.locator(".zone-list-entry__check")).toHaveCount(
    0,
  );
  expect(await computed(unavailableTile.locator("img"), "border-color")).toBe(
    "rgb(255, 140, 155)",
  );
  await unavailableTile.hover({ position: { x: 130, y: 100 } });
  expect(await computed(unavailableTile.locator("img"), "border-color")).toBe(
    "rgb(255, 140, 155)",
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
  expect(await computed(unavailableTile, "transform")).toBe("none");
  await attachScreenshot(page, testInfo, "max-locked-target");

  const beforeOutside = await selectedIds(page);
  await page.mouse.click(0, 0);
  await page.keyboard.press("Escape");
  expect(await selectedIds(page)).toEqual(beforeOutside);

  const selectedTile = page.locator(tileSelector).first();
  const selectedButtonBox = await rect(buttons.first());
  await page.mouse.move(
    selectedButtonBox.x + 10,
    selectedButtonBox.y + selectedButtonBox.height / 2,
  );
  await page.mouse.click(
    selectedButtonBox.x + 10,
    selectedButtonBox.y + selectedButtonBox.height / 2,
  );
  expect(await selectedIds(page)).toEqual(beforeOutside.slice(1));
  expect(await computed(selectedTile, "transform")).toBe("none");
  await expect(unavailableButton).toBeEnabled();
  expect(await computed(unavailableTile.locator("img"), "border-color")).toBe(
    "rgb(126, 226, 168)",
  );

  await open(page, "card-list-stale");
  const staleRoot = page.locator('[data-cy="acceptance-card-list-scenario"]');
  await expect(staleRoot).toHaveAttribute(
    "data-selected-choice-ids",
    "acceptance-stale-rendered,acceptance-stale-missing",
  );
  await expect(
    page.locator('[data-cy="zone-list-dialog-selection-count"]'),
  ).toHaveText("2 / 1 selected");
  await expect(
    page.locator('[data-cy="zone-list-dialog-confirm-button"]'),
  ).toBeDisabled();
  await page.mouse.click(0, 0);
  await page.keyboard.press("Escape");
  await expect(staleRoot).toHaveAttribute(
    "data-selected-choice-ids",
    "acceptance-stale-rendered,acceptance-stale-missing",
  );
});

test("responsive overflow and keyboard cover checks 33-36", async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 780, height: 900 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const dialog = await open(page, "card-list-browse-overflow");
    await expectInsideViewport(dialog, viewport.width, viewport.height);
    await expectDocumentFits(page);
    const scroller = page.locator('[data-cy="zone-list-dialog-entries"]');
    expect(
      await scroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    expect(await computed(scroller, "flex-wrap")).toBe("nowrap");
    const first = page.locator(tileSelector).first();
    await first.hover();
    await page.waitForTimeout(150);
    const firstBox = await rect(first);
    const scrollerBox = await rect(scroller);
    expect(firstBox.x).toBeGreaterThanOrEqual(scrollerBox.x);
    await first
      .locator(".card-action-chips")
      .getByRole("button", { name: "Activate first card" })
      .click();

    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const last = page.locator(tileSelector).last();
    await last.hover();
    await page.waitForTimeout(150);
    const lastBox = await rect(last);
    expect(lastBox.right).toBeLessThanOrEqual(scrollerBox.right);
    await last
      .locator(".card-action-chips")
      .getByRole("button", { name: "Activate last card" })
      .click();

    if (viewport.width === 320)
      await attachScreenshot(page, testInfo, "responsive-320");
  }

  await page.setViewportSize({ width: 780, height: 900 });
  await open(page, "card-list-browse-six");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  expect(await tabRoute(page, 13)).toEqual([
    "zone-list-dialog-close-button",
    "zone-list-entry-acceptance:graveyard:0",
    "card-action-chip-acceptance-activate-first",
    "card-action-details-acceptance:graveyard:0",
    "zone-list-entry-acceptance:graveyard:1",
    "zone-list-entry-acceptance:graveyard:2",
    "zone-list-entry-acceptance:graveyard:3",
    "zone-list-entry-acceptance:graveyard:4",
    "zone-list-entry-acceptance:graveyard:5",
    "card-action-chip-acceptance-activate-last",
    "card-action-details-acceptance:graveyard:5",
    "zone-list-dialog-alphabetical-checkbox",
    "zone-list-dialog-cancel-button",
  ]);

  await open(page, "card-list-mixed");
  const targets = await targetButtons(page);
  await clickTarget(page, targets.nth(0));
  await clickTarget(page, targets.nth(1));
  await expect(
    page.locator('[data-cy="zone-list-dialog-confirm-button"]'),
  ).toBeEnabled();
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  expect(await tabRoute(page, 10)).toEqual([
    "zone-list-dialog-collapse-button",
    "zone-list-entry-acceptance:mixed:0",
    "zone-list-entry-target-choice-acceptance:mixed:0-acceptance-mixed-0",
    "zone-list-entry-acceptance:mixed:1",
    "zone-list-entry-target-choice-acceptance:mixed:1-acceptance-mixed-1",
    "zone-list-entry-acceptance:mixed:2",
    "zone-list-entry-acceptance:mixed:3",
    "zone-list-dialog-alphabetical-checkbox",
    "zone-list-dialog-confirm-button",
    "zone-list-dialog-target-cancel-button",
  ]);
});

test("range compatibility enables inclusive Validate and locks at three", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-range");
  const count = page.locator('[data-cy="zone-list-dialog-selection-count"]');
  const confirm = page.locator('[data-cy="zone-list-dialog-confirm-button"]');
  const buttons = await targetButtons(page);
  await expect(count).toHaveText("0 selected · choose 1–3");
  await expect(confirm).toBeDisabled();
  for (let selected = 1; selected <= 3; selected += 1) {
    await clickTarget(page, buttons.nth(selected - 1));
    await expect(count).toHaveText(`${selected} selected · choose 1–3`);
    await expect(confirm).toBeEnabled();
  }
  await expect(buttons.nth(3)).toBeDisabled();
});

test("Hand source compatibility keeps full fixed source order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-hand-mixed");
  await expect(page.locator(".zone-list-entry__zone")).toHaveText([
    "HAND",
    "GRAVEYARD",
    "DECK",
  ]);
  await expect(
    page.locator('[data-cy="zone-list-dialog-filter-notice"]'),
  ).toHaveText("Filtered: legal targets from Hand, Graveyard, and Deck");
});

test("duplicate choice compatibility keeps two opaque IDs keyboard and max safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-duplicate");
  await expect(page.locator(tileSelector)).toHaveCount(1);
  const trigger = page.locator(
    '[data-cy^="zone-list-entry-choice-menu-trigger-"]',
  );
  await trigger.click();
  const first = page.locator(
    '[data-cy="projected-choice-acceptance:duplicate:0-acceptance-duplicate-first"]',
  );
  const second = page.locator(
    '[data-cy="projected-choice-acceptance:duplicate:0-acceptance-duplicate-second"]',
  );
  await expect(first).toHaveText("Banish");
  await expect(second).toHaveText("Shuffle back");
  await first.focus();
  await page.keyboard.press("End");
  await expect(second).toBeFocused();
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(second).toBeFocused();
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  expect(await selectedIds(page)).toEqual([
    "acceptance-duplicate-second",
    "acceptance-duplicate-first",
  ]);
  await expect(
    page.locator('[data-cy="zone-list-dialog-confirm-button"]'),
  ).toBeEnabled();
  await first.click();
  expect(await selectedIds(page)).toEqual(["acceptance-duplicate-second"]);
});

test("an opponent card renders upright in the list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-browse-opponent");
  const entryImg = page.locator(`${tileSelector}.is-opponent img`).first();
  await expect(entryImg).toBeVisible();
  await expect(entryImg).toHaveCSS("transform", "none");
});

test("a neutral browse entry shows no halo on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-browse-six");
  // Entry 1 has no choices — neutral (entries 0 and 5 are actionable).
  const neutralTile = page.locator(tileSelector).nth(1);
  await neutralTile.hover({ position: { x: 72, y: 50 } });
  const borderColor = await computed(
    neutralTile.locator("img"),
    "border-color",
  );
  expect(borderColor).not.toBe("rgb(126, 226, 168)"); // not green
  expect(borderColor).not.toBe("rgb(255, 213, 128)"); // not orange
  expect(borderColor).not.toBe("rgb(255, 140, 155)"); // not red
});

test("an actionable entry halos green on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-browse-six");
  // Entry 0 has choices — actionable.
  const actionableTile = page.locator(tileSelector).nth(0);
  await actionableTile.hover({ position: { x: 72, y: 50 } });
  expect(await computed(actionableTile.locator("img"), "border-color")).toBe(
    "rgb(126, 226, 168)",
  );
});

test("an over-maximum entry halos red", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-range");
  const buttons = await targetButtons(page);
  // Select 3 entries to reach the maximum.
  for (let i = 0; i < 3; i += 1) await clickTarget(page, buttons.nth(i));
  // 4th entry is now unavailable.
  const unavailableTile = page.locator(tileSelector).nth(3);
  await unavailableTile.hover({ position: { x: 72, y: 50 } });
  expect(await computed(unavailableTile.locator("img"), "border-color")).toBe(
    "rgb(255, 140, 155)",
  );
});

test("a selected entry stays orange even while hovered", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "card-list-range");
  const buttons = await targetButtons(page);
  await clickTarget(page, buttons.first());
  const selectedTile = page.locator(tileSelector).first();
  await selectedTile.hover({ position: { x: 72, y: 50 } });
  expect(await computed(selectedTile.locator("img"), "border-color")).toBe(
    "rgb(255, 213, 128)",
  );
});

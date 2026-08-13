import { expect, test, type Locator, type Page } from "@playwright/test";

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const tolerance = 1;
  return (
    a.x < b.x + b.width - tolerance &&
    a.x + a.width > b.x + tolerance &&
    a.y < b.y + b.height - tolerance &&
    a.y + a.height > b.y + tolerance
  );
}

async function openField(page: Page, scenario: "field-emz" | "field-no-emz") {
  await page.goto(`?scenario=${scenario}`);
  await expect(page.locator('[data-cy="field-phase-strip"]')).toHaveCount(1);
}

for (const scenario of ["field-emz", "field-no-emz"] as const) {
  test(`pixel board keeps five-pixel gaps and ratio (${scenario})`, async ({
    page,
  }) => {
    await page.goto(`?scenario=${scenario}`);
    const zones = page.locator('[data-zone-id^="p0:mainMonster:"]');
    const left = await zones.nth(0).boundingBox();
    const right = await zones.nth(1).boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(right!.x - (left!.x + left!.width)).toBeCloseTo(5, 0);
    expect(left!.width).toBeCloseTo(left!.height, 1);

    const slot = await zones
      .nth(0)
      .locator(".duel-field-zone__slot")
      .boundingBox();
    const cardWidth = left!.width * (72 / 104);
    expect(slot!.width - cardWidth).toBeCloseTo(6, 0);
  });
}

test("phase anchors split groups around EMZ placements", async ({ page }) => {
  await openField(page, "field-emz");
  const left = await rect(page.locator('[data-cy="field-phase-strip-left"]'));
  const right = await rect(page.locator('[data-cy="field-phase-strip-right"]'));
  const emzLeft = await rect(
    page.locator('[data-zone-id="shared:extraMonster:left"]'),
  );
  const emzRight = await rect(
    page.locator('[data-zone-id="shared:extraMonster:right"]'),
  );
  expect(left.x + left.width).toBeLessThanOrEqual(emzLeft.x + 1);
  expect(right.x).toBeGreaterThanOrEqual(emzRight.x + emzRight.width - 1);
});

test("phase centers continuous no-EMZ run", async ({ page }) => {
  await openField(page, "field-no-emz");
  const left = await rect(page.locator('[data-cy="field-phase-strip-left"]'));
  const right = await rect(page.locator('[data-cy="field-phase-strip-right"]'));
  const board = await rect(page.locator('[data-cy="duel-field-board"]'));
  const runCenter = (left.x + right.x + right.width) / 2;
  expect(runCenter).toBeCloseTo(board.x + board.width / 2, 0);
});

test("phase anchors End turn independently", async ({ page }) => {
  for (const scenario of ["field-emz", "field-no-emz"] as const) {
    await openField(page, scenario);
    const end = await rect(page.locator('[data-cy="field-end-turn-button"]'));
    const board = await rect(page.locator('[data-cy="duel-field-board"]'));
    const margin = await page
      .locator('[data-cy="field-phase-strip"]')
      .evaluate((element) => {
        const rightEdge = Number.parseFloat(
          getComputedStyle(element).getPropertyValue("--phase-right-edge"),
        );
        return element.getBoundingClientRect().width - rightEdge;
      });
    expect(end.x + end.width).toBeCloseTo(board.x + board.width - margin, 0);
  }
});

test("phase keeps controls clear of zones/stacks", async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    for (const scenario of ["field-emz", "field-no-emz"] as const) {
      await openField(page, scenario);
      const controls = page.locator(
        '[data-cy^="field-phase-chip-"], [data-cy="field-end-turn-button"]',
      );
      const zones = page.locator("[data-zone-id]");
      for (
        let controlIndex = 0;
        controlIndex < (await controls.count());
        controlIndex += 1
      ) {
        const control = await rect(controls.nth(controlIndex));
        for (
          let zoneIndex = 0;
          zoneIndex < (await zones.count());
          zoneIndex += 1
        )
          expect(intersects(control, await rect(zones.nth(zoneIndex)))).toBe(
            false,
          );
      }
    }
  }
});

test("phase keeps actionable controls at least forty-four pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openField(page, "field-emz");
  const controls = page.locator(
    'button[data-cy^="field-phase-chip-"], [data-cy="field-end-turn-button"]',
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = await rect(controls.nth(index));
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
});

test("phase reduced motion changes no semantics", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openField(page, "field-no-emz");
  await expect(page.locator('[data-cy^="field-phase-chip-"]')).toHaveCount(5);
  await expect(page.locator('[data-cy="field-end-turn-button"]')).toHaveCount(
    1,
  );
});

test("Defense and Set rotate inner art without moving outer placement", async ({
  page,
}) => {
  await page.goto("?scenario=field-defense");
  const defense = page.locator('[data-card-id="acceptance-defense"]');
  const set = page.locator('[data-card-id="acceptance-set"]');
  await expect(defense).toHaveClass(/is-defense/);
  await expect(set).toHaveClass(/is-set/);
  await expect(set.locator("img")).toHaveAttribute("alt", "");
  await expect(defense.locator(".duel-field-card__art")).toHaveCSS(
    "transform",
    /matrix/,
  );
});

test("six and twenty card hands keep height with conditional overlay scrollbar", async ({
  page,
}) => {
  await page.goto("?scenario=field-hand-6");
  const sixCard = page.locator('[data-card-zone-id="p0:hand"]').first();
  const sixHeight = await sixCard.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await expect(page.locator('[data-cy="field-hand-p0-count"]')).toHaveText("6");
  await expect(
    page.locator('[data-cy="field-hand-p0-scrollbar"]'),
  ).toBeHidden();

  await page.goto("?scenario=field-hand-20");
  const cards = page.locator('[data-card-zone-id="p0:hand"]');
  await expect(cards).toHaveCount(20);
  const twentyHeight = await cards
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(twentyHeight).toBeCloseTo(sixHeight, 1);
  const viewport = page.locator('[data-cy="field-hand-p0-viewport"]');
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  const scrollbar = page.locator('[data-cy="field-hand-p0-scrollbar"]');
  await expect(scrollbar).toBeVisible();

  const thumb = page.locator('[data-cy="field-hand-p0-scrollbar-thumb"]');
  const box = await thumb.boundingBox();
  expect(box).not.toBeNull();
  await thumb.hover();
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width + 40, box!.y + box!.height / 2);
  await page.mouse.up();
  expect(
    await viewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);

  const countZ = await page
    .locator('[data-cy="field-hand-p0-count"]')
    .evaluate((element) => Number(getComputedStyle(element).zIndex));
  const cardZ = await cards
    .first()
    .evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(countZ).toBeGreaterThan(cardZ);
});

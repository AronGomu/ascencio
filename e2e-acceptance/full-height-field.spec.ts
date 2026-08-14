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

test("seeded v2 zone settings hydrate visual state and missing state uses defaults", async ({
  page,
}) => {
  await page.goto("?scenario=field-emz");
  await page.evaluate(() =>
    localStorage.setItem(
      "ygo.ui.v2",
      JSON.stringify({
        version: 2,
        windows: { zoneList: null, confirm: null },
        decks: { player: "mvp-player", opponent: "mvp-opponent" },
        settings: { showZoneOutlines: false, showZoneCounts: false },
      }),
    ),
  );
  await page.reload();
  const board = page.locator('[data-cy="duel-field-board"]');
  const zone = board.locator(".duel-field-zone").first();
  const count = board.locator(".duel-field-stack__count").first();
  await expect(board).toHaveAttribute("data-zone-outlines", "false");
  await expect(board).toHaveAttribute("data-zone-counts", "false");
  await expect(zone).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(count).toBeHidden();
  await page.evaluate(() => {
    localStorage.removeItem("ygo.ui.v1");
    localStorage.removeItem("ygo.ui.v2");
  });
  await page.reload();
  await expect(board).toHaveAttribute("data-zone-outlines", "true");
  await expect(board).toHaveAttribute("data-zone-counts", "true");
  await expect(zone).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(count).toBeVisible();
});

async function openField(page: Page, scenario: "field-emz" | "field-no-emz") {
  await page.goto(`?scenario=${scenario}`);
  await expect(page.locator('[data-cy="field-phase-strip"]')).toHaveCount(1);
}

const BOARD_MATRIX = [
  {
    viewport: { width: 1920, height: 1080 },
    scenario: "field-emz",
    board: { width: 1229, height: 1080 },
  },
  {
    viewport: { width: 1920, height: 1080 },
    scenario: "field-no-emz",
    board: { width: 1304, height: 1080 },
  },
  {
    viewport: { width: 2560, height: 1440 },
    scenario: "field-emz",
    board: { width: 1638, height: 1440 },
  },
  {
    viewport: { width: 2560, height: 1440 },
    scenario: "field-no-emz",
    board: { width: 1740, height: 1440 },
  },
  {
    viewport: { width: 1366, height: 768 },
    scenario: "field-emz",
    board: { width: 874, height: 768 },
  },
  {
    viewport: { width: 1366, height: 768 },
    scenario: "field-no-emz",
    board: { width: 886, height: 735 },
  },
] as const;

for (const entry of BOARD_MATRIX) {
  test(`full-height shell matches ${entry.viewport.width}x${entry.viewport.height} ${entry.scenario}`, async ({
    page,
  }) => {
    await page.setViewportSize(entry.viewport);
    await openField(page, entry.scenario);
    const board = await rect(page.locator('[data-cy="duel-field"]'));
    expect(board.width).toBeCloseTo(entry.board.width, 0);
    expect(board.height).toBeCloseTo(entry.board.height, 0);
    const metrics = await page.evaluate(() => ({
      rootWidth: document.documentElement.scrollWidth,
      rootHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(metrics.rootWidth).toBe(metrics.clientWidth);
    expect(metrics.rootHeight).toBe(metrics.clientHeight);
    const slot = await rect(page.locator('[data-cy="acceptance-field-slot"]'));
    expect(board.x).toBeCloseTo(slot.x + (slot.width - board.width) / 2, 0);
    expect(board.y).toBeCloseTo(slot.y + (slot.height - board.height) / 2, 0);
  });
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
      const placements = page.locator(
        '[data-zone-id], [data-cy^="field-stack-"]',
      );
      for (
        let controlIndex = 0;
        controlIndex < (await controls.count());
        controlIndex += 1
      ) {
        const control = await rect(controls.nth(controlIndex));
        for (
          let placementIndex = 0;
          placementIndex < (await placements.count());
          placementIndex += 1
        )
          expect(
            intersects(control, await rect(placements.nth(placementIndex))),
          ).toBe(false);
      }
    }
  }
});

test("phase keeps actionable controls at least forty-four pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openField(page, "field-emz");
  const phaseButtons = page.locator('button[data-cy^="field-phase-chip-"]');
  expect(await phaseButtons.count()).toBeGreaterThan(0);
  const controls = page.locator(
    'button[data-cy^="field-phase-chip-"], [data-cy="field-end-turn-button"]',
  );
  expect(await controls.count()).toBe((await phaseButtons.count()) + 1);
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
  const cards = [
    {
      card: page.locator('[data-card-id="acceptance-defense"]'),
      zone: page.locator('[data-zone-id="p0:mainMonster:2"]'),
    },
    {
      card: page.locator('[data-card-id="acceptance-set"]'),
      zone: page.locator('[data-zone-id="p0:mainMonster:3"]'),
    },
  ];
  await expect(cards[0]!.card).toHaveClass(/is-defense/);
  await expect(cards[1]!.card).toHaveClass(/is-set/);
  await expect(cards[1]!.card.locator("img")).toHaveAttribute("alt", "");

  for (const { card, zone } of cards) {
    const matrix = await card
      .locator(".duel-field-card__art")
      .evaluate((element) => {
        const transform = new DOMMatrix(getComputedStyle(element).transform);
        return [transform.a, transform.b, transform.c, transform.d];
      });
    expect(Math.abs(matrix[0]!)).toBeLessThan(0.001);
    expect(Math.abs(matrix[1]!)).toBeCloseTo(1, 3);
    expect(Math.abs(matrix[2]!)).toBeCloseTo(1, 3);
    expect(Math.abs(matrix[3]!)).toBeLessThan(0.001);
    expect(matrix[1]! * matrix[2]!).toBeCloseTo(-1, 3);

    const zoneBox = await rect(zone);
    const rest = await rect(card);
    expect(rest.x + rest.width / 2).toBeCloseTo(
      zoneBox.x + zoneBox.width / 2,
      1,
    );
    expect(rest.y + rest.height / 2).toBeCloseTo(
      zoneBox.y + zoneBox.height / 2,
      1,
    );
    await card.hover();
    const hovered = await rect(card);
    expect(hovered.x + hovered.width / 2).toBeCloseTo(
      rest.x + rest.width / 2,
      1,
    );
    expect(hovered.y + hovered.height / 2).toBeCloseTo(
      rest.y + rest.height / 2,
      1,
    );
  }
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

test("preview bounds text with stable width and vertical overlay", async ({
  page,
}) => {
  await page.goto("?scenario=preview-short");
  const shortText = page.locator('[data-cy="card-preview-text"]');
  const shortWidth = await shortText.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await expect(
    page.locator('[data-cy="card-preview-text-scrollbar"]'),
  ).toBeHidden();

  await page.goto("?scenario=preview-long");
  const panel = page.locator('[data-cy="card-preview-panel"]');
  const text = page.locator('[data-cy="card-preview-text"]');
  const region = page.locator('[data-cy="card-preview-text-region"]');
  const scrollbar = page.locator('[data-cy="card-preview-text-scrollbar"]');
  const thumb = page.locator('[data-cy="card-preview-text-scrollbar-thumb"]');
  await expect(scrollbar).toBeVisible();
  const metrics = await text.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    width: element.getBoundingClientRect().width,
    paddingRight: Number.parseFloat(getComputedStyle(element).paddingRight),
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.width).toBeCloseTo(shortWidth, 1);
  expect(metrics.paddingRight).toBe(10);
  const panelBox = await rect(panel);
  const textBox = await rect(text);
  expect(textBox.y + textBox.height).toBeLessThanOrEqual(
    panelBox.y + panelBox.height + 0.5,
  );
  await text.focus();
  await expect(text).toBeFocused();
  await page.keyboard.press("End");
  await expect
    .poll(async () => text.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const firstThumbBox = await rect(thumb);
  await page.keyboard.press("Home");
  await expect
    .poll(async () => text.evaluate((element) => element.scrollTop))
    .toBe(0);
  // Thumb tracks scrollTop; once Home lands at 0, the painted thumb must not
  // remain at the End position.
  await expect
    .poll(async () => (await rect(thumb)).y)
    .toBeLessThan(firstThumbBox.y + 0.5);
  await page.keyboard.press("PageDown");
  await expect
    .poll(async () => text.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await region.locator("[tabindex]").count()).toBe(1);
  await page.keyboard.press("Home");
  await expect
    .poll(async () => text.evaluate((element) => element.scrollTop))
    .toBe(0);
  // Drive scroll through the overlay thumb using locator drag — avoids NaN
  // mouse coords when track geometry is momentarily unmeasured.
  const thumbBox = await rect(thumb);
  expect(Number.isFinite(thumbBox.x + thumbBox.y + thumbBox.height)).toBe(true);
  await thumb.hover();
  await page.mouse.down();
  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + thumbBox.height / 2 + 48,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => text.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});

test("opponent twenty-card overlay uses negative row-reverse scrolling", async ({
  page,
}) => {
  await page.goto("?scenario=field-hand-20");
  const cards = page.locator('[data-card-zone-id="p1:hand"]');
  await expect(cards).toHaveCount(20);
  const viewport = page.locator('[data-cy="field-hand-p1-viewport"]');
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  const track = page.locator('[data-cy="field-hand-p1-scrollbar"]');
  const thumb = page.locator('[data-cy="field-hand-p1-scrollbar-thumb"]');
  await expect(track).toBeVisible();
  const thumbBox = await rect(thumb);
  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + thumbBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2 + 40,
    thumbBox.y + thumbBox.height / 2,
  );
  await page.mouse.up();
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeLessThan(
    0,
  );

  const trackBox = await rect(track);
  const movedThumbBox = await rect(thumb);
  expect(movedThumbBox.x).toBeGreaterThanOrEqual(trackBox.x - 1);
  expect(movedThumbBox.x + movedThumbBox.width).toBeLessThanOrEqual(
    trackBox.x + trackBox.width + 1,
  );
});

/* T3: the token layer is a pure indirection over the duel palette, so these
   are the pre-extraction literals, not new design decisions. If one of them
   moves, a token was re-pointed and the duel look changed. */
test("duel colors resolve from tokens", async ({ page }) => {
  await openField(page, "field-emz");

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name: string) => root.getPropertyValue(name).trim();
    return {
      legal: read("--legal"),
      selected: read("--selected"),
      focusRing: read("--focus-ring"),
      accent: read("--accent"),
      dangerStrong: read("--danger-strong"),
    };
  });
  expect(tokens).toEqual({
    legal: "#7ee2a8",
    selected: "#ffd580",
    focusRing: "#f6c177",
    accent: "#73daca",
    dangerStrong: "#ff455d",
  });

  const halos = await page.evaluate(() => {
    const zones = document.querySelectorAll(".duel-field-zone");
    const legalZone = zones[0];
    const selectedZone = zones[1];
    if (!legalZone || !selectedZone) throw new Error("no zones on the field");
    legalZone.classList.add("is-actionable");
    selectedZone.classList.add("is-selected");
    const legalStyle = getComputedStyle(legalZone);
    const selectedStyle = getComputedStyle(selectedZone);
    const result = {
      legalBorder: legalStyle.borderTopColor,
      legalShadow: legalStyle.boxShadow,
      selectedBorder: selectedStyle.borderTopColor,
      selectedShadow: selectedStyle.boxShadow,
    };
    legalZone.classList.remove("is-actionable");
    selectedZone.classList.remove("is-selected");
    return result;
  });
  expect(halos.legalBorder).toBe("rgb(126, 226, 168)");
  expect(halos.selectedBorder).toBe("rgb(255, 213, 128)");
  /* Chromium serializes `color-mix()` as `color(srgb r g b / a)` with 0-1
     channels, so compare sRGB channels rather than the literal string the
     pre-token `rgb(126 226 168 / 0.55)` used to print. */
  expect(sRgbChannels(halos.legalShadow)).toEqual([126, 226, 168, 0.55]);
  expect(sRgbChannels(halos.selectedShadow)).toEqual([255, 213, 128, 0.78]);
});

function sRgbChannels(value: string): [number, number, number, number] {
  const match = value.match(
    /color\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+) \/ ([0-9.]+)\)/,
  );
  expect(match, `no color(srgb ...) in ${value}`).not.toBeNull();
  const [red, green, blue] = match!
    .slice(1, 4)
    .map((channel) => Math.round(Number(channel) * 255));
  return [red, green, blue, Number(match![4])];
}

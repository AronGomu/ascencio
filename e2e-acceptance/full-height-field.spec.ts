import { expect, test, type Locator, type Page } from "@playwright/test";

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function handEndpointMetrics(card: Locator) {
  return card.evaluate((element: HTMLElement) => {
    const viewport = element.closest<HTMLElement>(
      ".duel-field-hand-band__viewport",
    );
    if (viewport === null) throw new Error("Hand card has no viewport");
    const cardRect = element.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const fanDegrees = Math.abs(
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue("--card-fan"),
      ),
    );
    const fanRadians = (fanDegrees * Math.PI) / 180;
    const rotatedWidth =
      element.offsetWidth * Math.cos(fanRadians) +
      element.offsetHeight * Math.sin(fanRadians);
    const projectionScale = cardRect.width / rotatedWidth;
    /* Cards fan around their bottom centre. This is the maximum outward x
       reach of that rotation, projected through the live hand scale. Positive
       droop shifts each endpoint inward, so omitting it stays conservative. */
    const projectedFanOverhang =
      (element.offsetWidth * (1 - Math.cos(fanRadians)) * 0.5 +
        element.offsetHeight * Math.sin(fanRadians)) *
      projectionScale;
    return {
      layoutCardStart: element.offsetLeft,
      layoutCardEnd: element.offsetLeft + element.offsetWidth,
      layoutViewportStart: viewport.scrollLeft,
      layoutViewportEnd: viewport.scrollLeft + viewport.clientWidth,
      projectedCardStart: cardRect.left,
      projectedCardEnd: cardRect.right,
      projectedViewportStart: viewportRect.left,
      projectedViewportEnd: viewportRect.right,
      projectedFanOverhang,
    };
  });
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
  await expect(page.locator('[data-cy="duel-field-board-plane"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-cy="phase-bar"]')).toHaveCount(1);
}

const VIEWPORT_MATRIX = [
  { viewport: { width: 1920, height: 1080 }, scenario: "field-emz" },
  { viewport: { width: 1920, height: 1080 }, scenario: "field-no-emz" },
  { viewport: { width: 2560, height: 1440 }, scenario: "field-emz" },
  { viewport: { width: 2560, height: 1440 }, scenario: "field-no-emz" },
  { viewport: { width: 1366, height: 768 }, scenario: "field-emz" },
  { viewport: { width: 1366, height: 768 }, scenario: "field-no-emz" },
] as const;

for (const entry of VIEWPORT_MATRIX) {
  test(`board fills its slot and anchors projected content at ${entry.viewport.width}x${entry.viewport.height} ${entry.scenario}`, async ({
    page,
  }) => {
    await page.setViewportSize(entry.viewport);
    await openField(page, entry.scenario);
    const slot = await rect(page.locator('[data-cy="acceptance-field-slot"]'));
    const board = await rect(page.locator('[data-cy="duel-field"]'));
    const plane = await rect(
      page.locator('[data-cy="duel-field-board-plane"]'),
    );
    const content = await rect(
      page.locator('[data-cy="duel-field-board-content"]'),
    );
    const planeStyleHeight = await page
      .locator('[data-cy="duel-field-board-plane"]')
      .evaluate((element) => Number.parseFloat(element.style.height));

    expect(board.x).toBeCloseTo(slot.x, 0);
    expect(board.y).toBeCloseTo(slot.y, 0);
    expect(board.width).toBeCloseTo(slot.width, 0);
    expect(board.height).toBeCloseTo(slot.height, 0);
    expect(planeStyleHeight).toBeGreaterThan(board.height);
    expect(Math.abs(board.y - plane.y)).toBeLessThanOrEqual(8);
    expect(content.x + content.width / 2).toBeCloseTo(
      plane.x + plane.width / 2,
      0,
    );
    expect(content.y + content.height).toBeCloseTo(plane.y + plane.height, 0);

    const metrics = await page.evaluate(() => ({
      rootWidth: document.documentElement.scrollWidth,
      rootHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(metrics.rootWidth).toBe(metrics.clientWidth);
    expect(metrics.rootHeight).toBe(metrics.clientHeight);
  });
}

for (const scenario of ["field-emz", "field-no-emz"] as const) {
  test(`pixel board keeps five-pixel gaps and ratio (${scenario})`, async ({
    page,
  }) => {
    await page.goto(`?scenario=${scenario}`);
    const zones = page.locator('[data-zone-id^="p0:mainMonster:"]');
    const [left, right] = await Promise.all(
      [0, 1].map((index) =>
        zones.nth(index).evaluate((element: HTMLElement) => ({
          x: Number.parseFloat(element.style.getPropertyValue("--field-x")),
          width: Number.parseFloat(
            element.style.getPropertyValue("--field-width"),
          ),
          height: Number.parseFloat(
            element.style.getPropertyValue("--field-height"),
          ),
        })),
      ),
    );
    expect(right!.x - left!.x - left!.width).toBeCloseTo(5, 5);
    expect(left!.width).toBeCloseTo(left!.height, 5);

    const slotWidth = await zones
      .nth(0)
      .locator(".duel-field-zone__slot")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).width),
      );
    const cardWidth = left!.width * (72 / 104);
    expect(Math.abs(slotWidth - cardWidth - 6)).toBeLessThanOrEqual(0.02);
  });
}

test("phase bar fills its track and splits at the exact midpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openField(page, "field-emz");
  const slot = await rect(page.locator('[data-cy="acceptance-field-slot"]'));
  const board = await rect(page.locator('[data-cy="duel-field"]'));
  const bar = await rect(page.locator('[data-cy="phase-bar"]'));
  const opponent = await rect(page.locator('[data-cy="phase-bar-opponent"]'));
  const player = await rect(page.locator('[data-cy="phase-bar-player"]'));

  expect(bar.x).toBeCloseTo(slot.x, 0);
  expect(bar.width).toBeCloseTo(slot.width, 0);
  expect(bar.height).toBeCloseTo(48, 0);
  expect(bar.y + bar.height).toBeCloseTo(slot.y, 0);
  expect(board.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  expect(player.x).toBeCloseTo(bar.x + 1, 0);
  expect(player.width).toBeCloseTo(opponent.width, 0);
  expect(player.x + player.width).toBeCloseTo(opponent.x, 0);
  expect(opponent.x + opponent.width).toBeCloseTo(bar.x + bar.width - 1, 0);

  const gradients = await page.evaluate(() => ({
    opponent: getComputedStyle(
      document.querySelector('[data-cy="phase-bar-opponent"]')!,
    ).backgroundImage,
    player: getComputedStyle(
      document.querySelector('[data-cy="phase-bar-player"]')!,
    ).backgroundImage,
  }));
  expect(gradients.opponent).toMatch(/^linear-gradient\(90deg,/);
  expect(gradients.player).toMatch(/^linear-gradient\(270deg,/);
});

test("phase keeps actionable controls at least forty-four pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openField(page, "field-emz");
  const controls = page.locator(
    '[data-cy="phase-bar"] button.phase-chip:not(:disabled)',
  );
  expect(await controls.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = await rect(controls.nth(index));
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
});

test("phase reduced motion changes no semantics", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openField(page, "field-no-emz");
  await expect(page.locator('[data-cy^="phase-bar-you-"]')).toHaveCount(5);
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

    const [cardPlacement, zonePlacement] = await Promise.all(
      [card, zone].map((locator) =>
        locator.evaluate((element: HTMLElement) => ({
          x: element.style.getPropertyValue("--field-x"),
          y: element.style.getPropertyValue("--field-y"),
        })),
      ),
    );
    expect(cardPlacement).toEqual(zonePlacement);
    const rest = await rect(card);
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
  await expect(page.locator('[data-card-zone-id="p0:hand"]')).toHaveCount(6);
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

test("hand cards are centered when the hand fits", async ({ page }) => {
  for (const player of ["p0", "p1"] as const) {
    await page.goto("?scenario=field-hand-6");
    const viewport = page.locator(`[data-cy="field-hand-${player}-viewport"]`);
    const cards = viewport.locator(".duel-field-card");
    expect(await cards.count()).toBeGreaterThan(0);
    const viewportBox = await rect(viewport);
    const firstBox = await rect(cards.first());
    const lastBox = await rect(cards.last());
    const clusterCenter = (firstBox.x + lastBox.x + lastBox.width) / 2;
    const viewportCenter = viewportBox.x + viewportBox.width / 2;
    expect(Math.abs(clusterCenter - viewportCenter)).toBeLessThanOrEqual(8);
  }
});

test("an overflowing hand still scrolls to both ends", async ({ page }) => {
  await page.goto("?scenario=field-hand-20");
  const viewport = page.locator('[data-cy="field-hand-p0-viewport"]');
  const cards = viewport.locator(".duel-field-card");
  const first = await handEndpointMetrics(cards.first());
  expect(first.layoutCardStart).toBeGreaterThanOrEqual(
    first.layoutViewportStart,
  );
  expect(first.projectedCardStart).toBeGreaterThanOrEqual(
    first.projectedViewportStart - first.projectedFanOverhang,
  );

  await viewport.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  const last = await handEndpointMetrics(cards.last());
  expect(last.layoutCardEnd).toBeLessThanOrEqual(last.layoutViewportEnd);
  expect(last.projectedCardEnd).toBeLessThanOrEqual(
    last.projectedViewportEnd + last.projectedFanOverhang,
  );
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
  const thumbCentre = {
    x: thumbBox.x + thumbBox.width / 2,
    y: thumbBox.y + thumbBox.height / 2,
  };
  const pointerHit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-cy]")
        ?.getAttribute("data-cy") ?? null,
    thumbCentre,
  );
  expect(pointerHit).toBe("field-hand-p1-scrollbar-thumb");
  await thumb.evaluate((element) => {
    element.addEventListener(
      "gotpointercapture",
      () => {
        element.setAttribute("data-pointer-capture-observed", "true");
      },
      { once: true },
    );
  });
  await page.mouse.move(thumbCentre.x, thumbCentre.y);
  await page.mouse.down();
  /* Chromium applies pending capture before the next pointer event, not during
     pointerdown itself. One pixel forces that event without changing intent. */
  await page.mouse.move(thumbCentre.x + 1, thumbCentre.y);
  await expect(thumb).toHaveAttribute("data-pointer-capture-observed", "true");
  await page.mouse.move(thumbCentre.x + 40, thumbCentre.y);
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

/* The token layer is a pure indirection over the approved duel and Basilica
   Slate palettes. A changed literal means a token was re-pointed. */
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
    accent: "#d3b268",
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
  /* T16: derive the expected rgb from the already-read token value so a
     token change causes exactly one assertion to fail (the toEqual above),
     not a second redundant one here. */
  expect(halos.legalBorder).toBe(hexToRgb(tokens.legal));
  expect(halos.selectedBorder).toBe(hexToRgb(tokens.selected));
  /* Chromium serializes `color-mix()` as `color(srgb r g b / a)` with 0-1
     channels, so compare sRGB channels rather than the literal string the
     pre-token `rgb(126 226 168 / 0.55)` used to print. The legal halo is two
     layers — `sRgbChannels` reads the first, which is the solid ring; the
     glow behind it is asserted by the spread assertion below. */
  expect(sRgbChannels(halos.legalShadow)).toEqual([
    ...hexToChannels(tokens.legal),
    0.9,
  ]);
  expect(halos.legalShadow, "legal halo keeps its outer glow layer").toMatch(
    /0px 0px 10px 0px/,
  );
  expect(sRgbChannels(halos.selectedShadow)).toEqual([
    ...hexToChannels(tokens.selected),
    0.78,
  ]);
});

function hexToRgb(hex: string): string {
  const [r, g, b] = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToChannels(hex: string): [number, number, number] {
  return hex
    .slice(1)
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16)) as [number, number, number];
}

function sRgbChannels(value: string): [number, number, number, number] {
  const match = value.match(
    /color\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+) \/ ([0-9.]+)\)/,
  );
  expect(match, `no color(srgb ...) in ${value}`).not.toBeNull();
  const [red, green, blue] = match!
    .slice(1, 4)
    .map((channel) => Math.round(Number(channel) * 255)) as [
    number,
    number,
    number,
  ];
  return [red, green, blue, Number(match![4])];
}

/* T14 halo v2: the field's `data-targeting` attribute exists to produce the
   invalid-target ring on a non-candidate card. Component tests assert the
   attribute; only a real browser can assert the rule it gates. */
test("a non-candidate field card halos red only while targeting", async ({
  page,
}) => {
  await page.goto("?scenario=field-invalid-target");
  const field = page.locator('[data-cy="duel-field"]');
  await expect(field).toHaveAttribute("data-targeting", "true");

  const danger = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--danger")
      .trim(),
  );
  expect(danger).toBe("#ff8c9b");
  const invalidRing = hexToRgb(danger);

  const board = page.locator('[data-cy="duel-field-board"]');
  const candidate = board.locator(".duel-field-card.is-actionable");
  const nonCandidate = board.locator(".duel-field-card:not(.is-actionable)");
  await expect(candidate).toHaveCount(1);
  await expect(nonCandidate).toHaveCount(1);

  await nonCandidate.hover();
  await expect(nonCandidate.locator(".duel-field-card__art")).toHaveCSS(
    "border-color",
    invalidRing,
  );

  await candidate.hover();
  await expect(candidate.locator(".duel-field-card__art")).not.toHaveCSS(
    "border-color",
    invalidRing,
  );

  /* The same two cards with no targeting prompt: hover paints nothing red. */
  await page.goto("?scenario=field-defense");
  await expect(field).not.toHaveAttribute("data-targeting", "true");
  const idleCard = board
    .locator(".duel-field-card:not(.is-actionable)")
    .first();
  await idleCard.hover();
  await expect(idleCard.locator(".duel-field-card__art")).not.toHaveCSS(
    "border-color",
    invalidRing,
  );
});

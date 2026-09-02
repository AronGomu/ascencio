import { expect, test, type Page } from "@playwright/test";

const WIDE_VIEWPORT = { width: 1600, height: 900 } as const;
/* Measured against the shipped production build after pane-only Start was
   removed from the footer probe: 789px is full, 788px compacts. */
const MEASURED_COMPACT_WIDTH = 788;

async function openFreePlayDeckSelect(page: Page): Promise<void> {
  await page.goto("./#/free-play");
  await expect(page.locator('[data-cy="deck-select-screen"]')).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('[data-cy="deck-select-start"]')).toBeEnabled({
    timeout: 120_000,
  });
}

test("twin pane geometry", async ({ page }) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await openFreePlayDeckSelect(page);

  const pane = page.locator('[data-cy="duel-start-seat-panel"]');
  const player = page.locator('[data-cy="seat-section-player"]');
  const opponent = page.locator('[data-cy="seat-section-opponent"]');
  const filter = page.locator('[data-cy="deck-select-filter"]');
  const titlebar = page.locator('[data-cy="deck-select-titlebar"]');

  const [paneBox, playerBox, opponentBox, filterBox, titlebarBox, rootFont] =
    await Promise.all([
      pane.boundingBox(),
      player.boundingBox(),
      opponent.boundingBox(),
      filter.boundingBox(),
      titlebar.boundingBox(),
      page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      ),
    ]);
  expect(paneBox).not.toBeNull();
  expect(playerBox).not.toBeNull();
  expect(opponentBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(titlebarBox).not.toBeNull();

  expect(Math.abs(paneBox!.width - 38 * rootFont)).toBeLessThanOrEqual(2);
  expect(playerBox!.x).toBeLessThan(opponentBox!.x);
  await expect(page.locator('[data-cy="deck-select-start"]')).toBeVisible();
  expect(filterBox!.x + filterBox!.width).toBeCloseTo(
    titlebarBox!.x + titlebarBox!.width,
    0,
  );
  expect(paneBox!.x - (filterBox!.x + filterBox!.width)).toBeCloseTo(12, 0);

  await page.locator('[data-cy="deck-select-start"]').click();
  await expect(page.locator('[data-cy="duel-field"]')).toBeVisible({
    timeout: 120_000,
  });
});

test("hover docks preview", async ({ page }) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await openFreePlayDeckSelect(page);

  const wrapper = page.locator(
    '[data-cy="deck-select-seat-list-player-wrapper"]',
  );
  const rows = wrapper.locator("li.row");
  await expect(rows.first()).toBeVisible({ timeout: 120_000 });
  const restingRowCount = await rows.count();

  await page.locator('[data-cy="deck-tile-preset:burning-abyss"]').hover();
  await expect(wrapper).toHaveClass(/previewing/);
  await expect.poll(() => rows.count()).not.toBe(restingRowCount);
  await expect(page.locator('[data-cy="deck-select-hover-float"]')).toHaveCount(
    0,
  );

  await page.locator('[data-cy="deck-select-titlebar"]').hover();
  await expect(wrapper).not.toHaveClass(/previewing/);
  await expect.poll(() => rows.count()).toBe(restingRowCount);
});

test("footer actions", async ({ page }) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await openFreePlayDeckSelect(page);

  const footer = page.locator('[data-cy="deck-select-footer"]');
  const actions = footer.locator("button:visible");
  await expect(actions.first()).toHaveAttribute("data-cy", "deck-select-back");
  await expect(actions.last()).toHaveAttribute("data-cy", "deck-select-create");
  await expect(page.locator('[data-cy="deck-select-back"]')).toHaveText(
    "← Return to Menu",
  );

  const colors = await page.evaluate(() => {
    function resolvedColor(value: string): string {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }
    const back = document.querySelector('[data-cy="deck-select-back"]');
    const create = document.querySelector('[data-cy="deck-select-create"]');
    if (!(back instanceof HTMLElement) || !(create instanceof HTMLElement))
      throw new Error("Deck-select footer actions are missing");
    return {
      back: getComputedStyle(back).color,
      danger: resolvedColor("var(--danger)"),
      create: getComputedStyle(create).backgroundColor,
      legal: resolvedColor("var(--legal)"),
    };
  });
  expect(colors.back).toBe(colors.danger);
  expect(colors.create).toBe(colors.legal);
});

test("compaction", async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 900 });
  await openFreePlayDeckSelect(page);

  await expect(page.locator('[data-cy="deck-select-title"]')).toHaveText(
    "Choose your deck",
  );
  await expect(page.locator('[data-cy="deck-select-eyebrow"]')).toBeVisible();
  await expect(page.locator('[data-cy="deck-select-kebab"]')).toHaveCount(0);

  await page.setViewportSize({ width: MEASURED_COMPACT_WIDTH, height: 900 });
  await expect(page.locator('[data-cy="deck-select-title"]')).toHaveText(
    "Select Deck",
  );
  await expect(page.locator('[data-cy="deck-select-eyebrow"]')).toHaveCount(0);
  await page.locator('[data-cy="deck-select-kebab"]').click();
  const menu = page.locator('[data-cy="deck-select-kebab-menu"]');
  await expect(menu).toBeVisible();
  const menuItems = menu.locator('[role="menuitem"]');
  await expect(menuItems).toHaveCount(5);
  expect(
    await menuItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-cy")),
    ),
  ).toEqual([
    "deck-select-delete",
    "deck-select-rename",
    "deck-select-duplicate",
    "deck-select-open",
    "deck-select-create",
  ]);

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator('[data-cy="deck-select-kebab"]')).toBeFocused();
});

test("copies chip", async ({ page }) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await openFreePlayDeckSelect(page);

  const singles = page
    .locator('[data-cy^="deck-select-seat-list-player-row-copies-"]')
    .filter({ hasText: /^1$/ });
  await expect(singles.first()).toHaveText("1", { timeout: 120_000 });
});

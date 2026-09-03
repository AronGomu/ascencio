import { expect, test, type Page } from "@playwright/test";
import {
  createInitialStoryState,
  type StoryState,
} from "../src/story/model/story-state.ts";
import {
  STORY_SAVES_DATABASE_NAME,
  STORY_SAVES_STORE_NAME,
} from "../src/shell/screens/story-save-presence.ts";
import type { StorySaveEnvelope } from "../src/story/saves/story-save-contracts.ts";
import { storyStarterSave } from "./story-starter-save.ts";

const SET_ID = "legend-of-blue-eyes-white-dragon";
const IMPACT_CARD_CODE = 89631139;
const STARTER = storyStarterSave();
const OPENED_CARD = { code: IMPACT_CARD_CODE, rarity: "common" } as const;

const VIEWPORTS = [
  { id: "desktop", width: 1280, height: 720 },
  { id: "short", width: 1280, height: 560 },
  { id: "tablet-portrait", width: 768, height: 1024 },
  { id: "mobile-portrait", width: 375, height: 667 },
  { id: "mobile-landscape", width: 667, height: 375 },
] as const;

function stateAt(
  screen: StoryState["screen"],
  overrides: Partial<StoryState> = {},
): StoryState {
  return {
    ...createInitialStoryState(),
    screen,
    savedScreen: screen,
    progressExists: true,
    decks: [STARTER.deck],
    defaultDeckId: STARTER.deck.id,
    collection: STARTER.collection,
    ...overrides,
  };
}

async function putRecord(
  page: Page,
  record: unknown,
  key: string,
): Promise<void> {
  await page.evaluate(
    async ([databaseName, storeName, value, recordKey]) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName as string, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore(storeName as string);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(
        storeName as string,
        "readwrite",
      );
      transaction.objectStore(storeName as string).put(value, recordKey);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    [STORY_SAVES_DATABASE_NAME, STORY_SAVES_STORE_NAME, record, key] as const,
  );
}

async function openSavedScreen(
  page: Page,
  state: StoryState,
  selector: string,
): Promise<void> {
  await page.goto("./#/");
  const envelope: StorySaveEnvelope = {
    schemaVersion: 4,
    slot: "autosave",
    revision: 1,
    savedAt: Date.now(),
    state,
  };
  await putRecord(page, envelope, envelope.slot);
  await page.reload();
  const resume = page.locator('[data-cy="main-menu-continue"]');
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.locator(selector)).toBeVisible({ timeout: 120_000 });
}

async function openNewGame(page: Page): Promise<void> {
  await page.goto("./#/");
  await page.locator('[data-cy="main-menu-new-game"]').click();
  await expect(page.locator('[data-cy="story-narrative-stage"]')).toBeVisible();
}

async function expectInsideStage(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const geometry = await page.locator(selector).evaluate((target) => {
    const stage = document.querySelector<HTMLElement>('[data-cy="app-stage"]');
    if (stage === null) throw new Error("App stage is missing");
    const stageRect = stage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      stage: {
        top: stageRect.top,
        right: stageRect.right,
        bottom: stageRect.bottom,
        left: stageRect.left,
      },
      target: {
        top: targetRect.top,
        right: targetRect.right,
        bottom: targetRect.bottom,
        left: targetRect.left,
      },
      clientWidth: target.clientWidth,
      scrollWidth: target.scrollWidth,
    };
  });
  expect(geometry.target.left, `${label} left`).toBeGreaterThanOrEqual(
    geometry.stage.left - 1,
  );
  expect(geometry.target.top, `${label} top`).toBeGreaterThanOrEqual(
    geometry.stage.top - 1,
  );
  expect(geometry.target.right, `${label} right`).toBeLessThanOrEqual(
    geometry.stage.right + 1,
  );
  expect(geometry.target.bottom, `${label} bottom`).toBeLessThanOrEqual(
    geometry.stage.bottom + 1,
  );
  expect(
    geometry.scrollWidth,
    `${label} horizontal overflow`,
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectVerticalScrollOwner(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const overflow = await page.locator(selector).evaluate((element) => ({
    x: getComputedStyle(element).overflowX,
    y: getComputedStyle(element).overflowY,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(["auto", "scroll"]).toContain(overflow.y);
  expect(
    overflow.scrollWidth,
    `${label} horizontal overflow`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectOverlay(
  page: Page,
  labelId: string,
  label: string,
): Promise<void> {
  await expectInsideStage(
    page,
    `[data-cy="story-overlay-backdrop-${labelId}"]`,
    `${label} backdrop`,
  );
  await expectInsideStage(page, `[data-cy="story-overlay-${labelId}"]`, label);
}

for (const viewport of VIEWPORTS) {
  test(`T13 all story surfaces fit ${viewport.id} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    await page.goto("./#/");
    await page.locator('[data-cy="main-menu-load"]').click();
    await expect(page.locator('[data-cy="story-load-screen"]')).toBeVisible();
    await expectInsideStage(
      page,
      '[data-cy="story-load-screen"]',
      "load screen",
    );
    await expectVerticalScrollOwner(
      page,
      '[data-cy="story-load-screen"]',
      "load screen",
    );

    await openSavedScreen(
      page,
      stateAt("battle-mock", { encounterId: "old-arena" }),
      '[data-cy="story-handoff-screen"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-handoff-screen"]',
      "battle handoff",
    );

    await openSavedScreen(
      page,
      stateAt("outcome", { encounterId: "old-arena", outcome: "win" }),
      '[data-cy="story-outcome-screen"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-outcome-screen"]',
      "outcome",
    );

    await openSavedScreen(
      page,
      stateAt("reward", {
        encounterId: "old-arena",
        outcome: "win",
        rewardGranted: true,
      }),
      '[data-cy="story-reward-screen"]',
    );
    await expectInsideStage(page, '[data-cy="story-reward-screen"]', "reward");

    await openSavedScreen(page, stateAt("end"), '[data-cy="story-end-screen"]');
    await expectInsideStage(page, '[data-cy="story-end-screen"]', "end screen");

    await openSavedScreen(
      page,
      stateAt("shop-cards", {
        shopReturnScreen: "map",
        shopSetId: SET_ID,
      }),
      '[data-cy="story-shop-cards"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-shop-cards"]',
      "shop card list",
    );
    await expectVerticalScrollOwner(
      page,
      viewport.width <= 768
        ? '[data-cy="story-shop-cards-layout"]'
        : '[data-cy="story-shop-cards-grid"]',
      "shop card list",
    );

    await openSavedScreen(
      page,
      stateAt("shop-sell", { shopReturnScreen: "map" }),
      '[data-cy="story-shop-sell"]',
    );
    await expectInsideStage(page, '[data-cy="story-shop-sell"]', "shop sell");
    await expectVerticalScrollOwner(
      page,
      '[data-cy="story-shop-sell-grid"]',
      "shop sell grid",
    );

    const openedCards = Array.from({ length: 9 }, () => OPENED_CARD);
    await openSavedScreen(
      page,
      stateAt("shop-opening", {
        shopReturnScreen: "map",
        shopSetId: SET_ID,
        openedCards,
        openingMode: "sequential",
      }),
      '[data-cy="story-shop-opening"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-shop-opening"]',
      "booster opening",
    );
    await expectVerticalScrollOwner(
      page,
      '[data-cy="story-shop-opening-grid"]',
      "booster opening grid",
    );

    await openSavedScreen(
      page,
      stateAt("shop-results", {
        shopReturnScreen: "map",
        shopSetId: SET_ID,
        openedCards,
        openingMode: "all",
      }),
      '[data-cy="story-shop-results"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-shop-results"]',
      "booster results",
    );
    await expectVerticalScrollOwner(
      page,
      '[data-cy="story-shop-results-grid"]',
      "booster results grid",
    );

    await openSavedScreen(
      page,
      stateAt("shop-browse", {
        shopReturnScreen: "map",
        boosters: { [SET_ID]: 2 },
      }),
      '[data-cy="story-shop-browse"]',
    );
    await page.locator(`[data-cy="story-shop-set-${SET_ID}"]`).click();
    await expectOverlay(page, "shop-set-title", "shop set dialog");
    await page.keyboard.press("Escape");
    await page.locator('[data-cy="story-top-bar-boosters"]').click();
    await expectOverlay(page, "booster-dialog-title", "booster inventory");

    await openSavedScreen(
      page,
      stateAt("shop-sell", { shopReturnScreen: "map" }),
      '[data-cy="story-shop-sell"]',
    );
    await page
      .locator(`[data-cy="story-shop-sell-plus-${IMPACT_CARD_CODE}"]`)
      .click();
    await page.locator('[data-cy="story-shop-sell-confirm"]').click();
    await expectInsideStage(
      page,
      '[data-cy="story-sell-impact-backdrop"]',
      "sell impact backdrop",
    );
    await expectInsideStage(
      page,
      '[data-cy="story-sell-impact-dialog"]',
      "sell impact dialog",
    );

    await openSavedScreen(
      page,
      stateAt("map", {
        rewardAcknowledged: true,
        locations: [
          { id: "old-arena", access: "available", completed: true },
          { id: "archive", access: "available", completed: false },
          { id: "hidden-gate", access: "hidden", completed: false },
          { id: "card-shop", access: "available", completed: false },
        ],
      }),
      '[data-cy="story-completion-panel"]',
    );
    await expectInsideStage(
      page,
      '[data-cy="story-completion-panel"]',
      "completion panel",
    );

    await page.goto("./#/");
    await putRecord(page, "not a save", "manual:1");
    await page.locator('[data-cy="main-menu-load"]').click();
    await expect(page.locator('[data-cy="story-storage-error"]')).toBeVisible();
    await expectInsideStage(
      page,
      '[data-cy="story-storage-error"]',
      "storage banner",
    );
    await page.locator('[data-cy="story-storage-error-reset"]').click();
    await expect(page.locator('[data-cy="story-storage-error"]')).toHaveCount(
      0,
    );

    await openNewGame(page);
    await page.locator('[data-cy="story-narrative-history"]').focus();
    await page.keyboard.press("Enter");
    await expectOverlay(page, "history-title", "history overlay");

    await openSavedScreen(page, stateAt("map"), '[data-cy="story-map-screen"]');
    await page.locator('[data-cy="story-top-bar-settings"]').click();
    await expectOverlay(page, "settings-title", "settings overlay");
    await page.keyboard.press("Escape");

    await openNewGame(page);
    await page.locator('[data-cy="story-narrative-menu"]').click();
    await page.locator('[data-cy="story-pause-save"]').click();
    await expectOverlay(page, "save-load-title", "save overlay");
    await page.keyboard.press("Escape");
    await page.locator('[data-cy="story-narrative-menu"]').click();
    await page.locator('[data-cy="story-pause-load"]').click();
    await expectOverlay(page, "load-overlay-title", "load overlay");

    await page.goto("./#/free-play/collection");
    await expect(page.locator('[data-cy="collection-screen"]')).toBeVisible({
      timeout: 120_000,
    });
    await expectInsideStage(
      page,
      '[data-cy="collection-screen"]',
      "collection",
    );
    await expectVerticalScrollOwner(
      page,
      viewport.width <= 768
        ? '[data-cy="collection-layout"]'
        : '[data-cy="collection-grid"]',
      "collection",
    );
  });
}

test("T13 card zoom stays stage-local in a letterboxed Chromium stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  const openedCards = Array.from({ length: 9 }, () => OPENED_CARD);
  await openSavedScreen(
    page,
    stateAt("shop-opening", {
      shopReturnScreen: "map",
      shopSetId: SET_ID,
      openedCards,
      openingMode: "sequential",
    }),
    '[data-cy="story-shop-opening"]',
  );

  const tile = page.locator('[data-cy="story-shop-opening-card-8"]');
  await tile.click();
  await tile.hover();
  await expect(page.locator('[data-cy="card-zoom-inspector"]')).toBeVisible();
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element === null) throw new Error(`${selector} is missing`);
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
      };
    };
    return {
      stage: rect('[data-cy="app-stage"]'),
      zoom: rect('[data-cy="card-zoom-inspector-card"]'),
      window: rect('[data-cy="card-zoom-inspector-window"]'),
    };
  });
  expect(geometry.stage.left).toBeGreaterThan(100);
  for (const [label, box] of [
    ["zoom card", geometry.zoom],
    ["zoom window", geometry.window],
  ] as const) {
    expect(box.left, `${label} left`).toBeGreaterThanOrEqual(
      geometry.stage.left + 7,
    );
    expect(box.top, `${label} top`).toBeGreaterThanOrEqual(
      geometry.stage.top + 7,
    );
    expect(box.right, `${label} right`).toBeLessThanOrEqual(
      geometry.stage.right - 7,
    );
    expect(box.bottom, `${label} bottom`).toBeLessThanOrEqual(
      geometry.stage.bottom - 7,
    );
  }
});

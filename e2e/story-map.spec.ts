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

const VIEWPORTS = [
  { id: "desktop", width: 1280, height: 720, foreground: "cover" },
  {
    id: "mobile-portrait",
    width: 375,
    height: 667,
    foreground: "contain",
  },
  {
    id: "mobile-landscape",
    width: 667,
    height: 375,
    foreground: "cover",
  },
] as const;

const MAP_SOURCE = {
  width: 1200,
  height: 700,
  hotspots: {
    "old-arena": { x: 340, y: 370 },
    archive: { x: 875, y: 255 },
    "card-shop": { x: 744, y: 504 },
  },
} as const;

type BrowserRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function intersects(first: BrowserRect, second: BrowserRect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function mapState(): StoryState {
  const initial = createInitialStoryState();
  return {
    ...initial,
    screen: "map",
    savedScreen: "map",
    previousScreen: "narrative",
    progressExists: true,
    locations: initial.locations.map((location) =>
      location.id === "archive" ? { ...location, completed: true } : location,
    ),
  };
}

async function putAutosave(page: Page, state: StoryState): Promise<void> {
  const envelope: StorySaveEnvelope = {
    schemaVersion: 4,
    slot: "autosave",
    revision: 1,
    savedAt: Date.now(),
    state,
  };
  await page.evaluate(
    async ([databaseName, storeName, record]) => {
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
      transaction.objectStore(storeName as string).put(record, "autosave");
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    [STORY_SAVES_DATABASE_NAME, STORY_SAVES_STORE_NAME, envelope] as const,
  );
}

async function openMap(page: Page): Promise<void> {
  await page.goto("./#/");
  await putAutosave(page, mapState());
  await page.reload();
  await page.locator('[data-cy="main-menu-continue"]').click();
  await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();
}

function hotspot(page: Page, id: string) {
  return page.locator(`[data-cy="story-map-hotspot-${id}"]`);
}

function popover(page: Page, id: string) {
  return page.locator(`[data-cy="story-map-popover-${id}"]`);
}

async function tapCenter(page: Page, target: ReturnType<typeof hotspot>) {
  const box = await target.boundingBox();
  if (box === null) throw new Error("Touch target has no bounds");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

for (const viewport of VIEWPORTS) {
  test(`map art, hotspots, popovers, and Return fit ${viewport.id} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openMap(page);

    for (const removed of [
      "story-map-sidebar",
      "story-map-location-list",
      "story-map-eyebrow",
      "story-map-choice-acknowledgment",
    ])
      await expect(page.locator(`[data-cy="${removed}"]`)).toHaveCount(0);
    await expect(hotspot(page, "hidden-gate")).toHaveCount(0);
    await expect(popover(page, "hidden-gate")).toHaveCount(0);

    const layout = await page
      .locator('[data-cy="story-map-screen"]')
      .evaluate((screen) => {
        const art = screen.querySelector<HTMLElement>(
          '[data-cy="story-map-art"]',
        );
        const canvas = screen.querySelector<HTMLElement>(
          '[data-cy="story-map-canvas"]',
        );
        const image = screen.querySelector<HTMLElement>(
          '[data-cy="story-map-image"]',
        );
        const backdrop = screen.querySelector<HTMLElement>(
          '[data-cy="story-map-backdrop"]',
        );
        const back = screen.querySelector<HTMLElement>(
          '[data-cy="story-map-return"]',
        );
        if (
          art === null ||
          canvas === null ||
          image === null ||
          backdrop === null ||
          back === null
        )
          throw new Error("Map layout nodes are missing");
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const screenBox = rect(screen);
        const screenStyle = getComputedStyle(screen);
        return {
          screen: screenBox,
          art: rect(art),
          canvas: rect(canvas),
          image: rect(image),
          backdrop: rect(backdrop),
          back: rect(back),
          padding: {
            left: Number.parseFloat(screenStyle.paddingLeft),
            right: Number.parseFloat(screenStyle.paddingRight),
            top: Number.parseFloat(screenStyle.paddingTop),
            bottom: Number.parseFloat(screenStyle.paddingBottom),
          },
          imageObjectFit: getComputedStyle(image).objectFit,
          backdropObjectFit: getComputedStyle(backdrop).objectFit,
        };
      });

    expect(layout.art.left).toBeCloseTo(
      layout.screen.left + layout.padding.left,
      0,
    );
    expect(layout.art.right).toBeCloseTo(
      layout.screen.right - layout.padding.right,
      0,
    );
    expect(layout.art.top).toBeCloseTo(
      layout.screen.top + layout.padding.top,
      0,
    );
    expect(layout.canvas.width / layout.canvas.height).toBeCloseTo(
      MAP_SOURCE.width / MAP_SOURCE.height,
      2,
    );
    expect(layout.canvas.left + layout.canvas.width / 2).toBeCloseTo(
      layout.art.left + layout.art.width / 2,
      1,
    );
    expect(layout.canvas.top + layout.canvas.height / 2).toBeCloseTo(
      layout.art.top + layout.art.height / 2,
      1,
    );
    expect(layout.image).toEqual(layout.canvas);
    expect(layout.imageObjectFit).toBe("cover");
    expect(layout.backdrop.left).toBeCloseTo(layout.art.left + 1, 0);
    expect(layout.backdrop.right).toBeCloseTo(layout.art.right - 1, 0);
    expect(layout.backdrop.top).toBeCloseTo(layout.art.top + 1, 0);
    expect(layout.backdrop.bottom).toBeCloseTo(layout.art.bottom - 1, 0);
    expect(layout.backdropObjectFit).toBe("cover");
    if (viewport.foreground === "contain") {
      expect(layout.canvas.left).toBeGreaterThanOrEqual(layout.art.left);
      expect(layout.canvas.right).toBeLessThanOrEqual(layout.art.right);
      expect(layout.canvas.top).toBeGreaterThanOrEqual(layout.art.top);
      expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.art.bottom);
    } else {
      expect(layout.canvas.width).toBeGreaterThanOrEqual(layout.art.width - 2);
      expect(layout.canvas.height).toBeGreaterThanOrEqual(
        layout.art.height - 2,
      );
    }
    expect(layout.art.bottom).toBeLessThanOrEqual(layout.back.top);
    expect(layout.back.left).toBeCloseTo(
      layout.screen.left + layout.padding.left,
      0,
    );
    expect(layout.back.bottom).toBeCloseTo(
      layout.screen.bottom - layout.padding.bottom,
      0,
    );

    const returnBox = await page
      .locator('[data-cy="story-map-return"]')
      .boundingBox();
    expect(returnBox).not.toBeNull();
    for (const [id, sourcePoint] of Object.entries(MAP_SOURCE.hotspots)) {
      const target = hotspot(page, id);
      const targetBox = await target.boundingBox();
      expect(targetBox, `${id} hotspot`).not.toBeNull();
      const expectedCenter = {
        x:
          layout.canvas.left +
          (sourcePoint.x / MAP_SOURCE.width) * layout.canvas.width,
        y:
          layout.canvas.top +
          (sourcePoint.y / MAP_SOURCE.height) * layout.canvas.height,
      };
      expect(targetBox!.x + targetBox!.width / 2).toBeCloseTo(
        expectedCenter.x,
        1,
      );
      expect(targetBox!.y + targetBox!.height / 2).toBeCloseTo(
        expectedCenter.y,
        1,
      );
      expect(targetBox!.x).toBeGreaterThanOrEqual(layout.art.left);
      expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(
        layout.art.right,
      );
      expect(targetBox!.y).toBeGreaterThanOrEqual(layout.art.top);
      expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(
        layout.art.bottom,
      );
      expect(intersects(targetBox!, returnBox!)).toBe(false);

      await target.focus();
      const info = popover(page, id);
      await expect(info).toBeVisible();
      const infoBox = await info.boundingBox();
      expect(infoBox, `${id} popover`).not.toBeNull();
      expect(infoBox!.x).toBeGreaterThanOrEqual(layout.art.left - 1);
      expect(infoBox!.x + infoBox!.width).toBeLessThanOrEqual(
        layout.art.right + 1,
      );
      expect(infoBox!.y).toBeGreaterThanOrEqual(layout.art.top - 1);
      expect(infoBox!.y + infoBox!.height).toBeLessThanOrEqual(
        layout.art.bottom + 1,
      );
      expect(intersects(infoBox!, returnBox!)).toBe(false);
      for (const obstacleId of Object.keys(MAP_SOURCE.hotspots)) {
        const obstacleBox = await hotspot(page, obstacleId).boundingBox();
        expect(obstacleBox, `${obstacleId} overlap obstacle`).not.toBeNull();
        expect(
          intersects(infoBox!, obstacleBox!),
          `${id} popover covers ${obstacleId}`,
        ).toBe(false);
      }
      await page.keyboard.press("Escape");
    }
  });
}

test("Chromium mouse and keyboard preserve input ownership and activation", async ({
  page,
}) => {
  await openMap(page);
  const arena = hotspot(page, "old-arena");
  const archive = hotspot(page, "archive");

  await arena.hover();
  await expect(popover(page, "old-arena")).toContainText("Old Arena");
  await expect(popover(page, "old-arena")).toContainText("battle · available");
  await expect(popover(page, "old-arena")).toContainText(
    "A dormant transmitter is staging an unanswered duel.",
  );
  await page.mouse.move(0, 0);
  await expect(popover(page, "old-arena")).toHaveCount(0);

  await archive.focus();
  await expect(popover(page, "archive")).toContainText(
    "story · locked · completed",
  );
  await expect(popover(page, "archive")).toContainText(
    "Locked: Requires decoded arena signal.",
  );
  await page.mouse.move(0, 0);
  await expect(popover(page, "archive")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();
  await expect(popover(page, "archive")).toBeVisible();
  await page.locator('[data-cy="story-map-return"]').focus();
  await expect(popover(page, "archive")).toHaveCount(0);

  await arena.focus();
  await expect(popover(page, "old-arena")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-cy="story-briefing-screen"]')).toBeVisible();
});

test.describe("touch map hotspots", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("first tap inspects, another switches, outside/Escape close, second same tap activates", async ({
    page,
  }) => {
    await openMap(page);
    const arena = hotspot(page, "old-arena");
    const archive = hotspot(page, "archive");
    const shop = hotspot(page, "card-shop");

    await arena.tap();
    await expect(popover(page, "old-arena")).toBeVisible();
    await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();

    await tapCenter(page, archive);
    await expect(popover(page, "old-arena")).toHaveCount(0);
    await expect(popover(page, "archive")).toContainText(
      "Locked: Requires decoded arena signal.",
    );
    await tapCenter(page, archive);
    await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();

    await shop.tap();
    await expect(popover(page, "card-shop")).toBeVisible();
    await page.locator('[data-cy="story-map-art"]').tap({
      position: { x: 8, y: 8 },
    });
    await expect(popover(page, "card-shop")).toHaveCount(0);

    await arena.tap();
    await page.keyboard.press("Escape");
    await expect(popover(page, "old-arena")).toHaveCount(0);

    await arena.tap();
    await expect(popover(page, "old-arena")).toBeVisible();
    await arena.tap();
    await expect(
      page.locator('[data-cy="story-briefing-screen"]'),
    ).toBeVisible();
  });
});

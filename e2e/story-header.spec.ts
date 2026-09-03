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
  { id: "desktop", width: 1280, height: 720 },
  { id: "mobile-portrait", width: 375, height: 667 },
  { id: "mobile-landscape", width: 667, height: 375 },
] as const;

const NON_SHOP_SIBLINGS = [
  "pre-battle",
  "battle-mock",
  "outcome",
  "reward",
  "end",
] as const satisfies readonly StoryState["screen"][];

function stateAt(screen: StoryState["screen"]): StoryState {
  return {
    ...createInitialStoryState(),
    screen,
    savedScreen: screen,
    progressExists: true,
    shopReturnScreen: screen.startsWith("shop-") ? "map" : null,
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

async function openSavedScreen(page: Page, state: StoryState): Promise<void> {
  await page.goto("./#/");
  await putAutosave(page, state);
  await page.reload();
  await page.locator('[data-cy="main-menu-continue"]').click();
  await expect(page.locator('[data-cy="story-top-bar"]')).toBeVisible();
}

async function expectHeaderGeometry(page: Page): Promise<void> {
  const geometry = await page
    .locator('[data-cy="story-top-bar"]')
    .evaluate((header) => {
      const story = header.closest<HTMLElement>('[data-cy="story-app"]');
      if (story === null) throw new Error("Story root is missing");
      const rect = (element: Element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      };
      const storyStyle = getComputedStyle(story);
      return {
        header: rect(header),
        story: rect(story),
        storyPadding: {
          left: Number.parseFloat(storyStyle.paddingLeft),
          right: Number.parseFloat(storyStyle.paddingRight),
          top: Number.parseFloat(storyStyle.paddingTop),
        },
        clientWidth: header.clientWidth,
        scrollWidth: header.scrollWidth,
        children: Array.from(header.children).map((element) => ({
          cy: element.getAttribute("data-cy"),
          ...rect(element),
        })),
      };
    });

  expect(geometry.header.left).toBeCloseTo(
    geometry.story.left + geometry.storyPadding.left,
    0,
  );
  expect(geometry.header.right).toBeCloseTo(
    geometry.story.right - geometry.storyPadding.right,
    0,
  );
  expect(geometry.header.top).toBeCloseTo(
    geometry.story.top + geometry.storyPadding.top,
    0,
  );
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  for (const [index, child] of geometry.children.entries()) {
    expect(child.left, `${child.cy} left`).toBeGreaterThanOrEqual(
      geometry.header.left - 1,
    );
    expect(child.right, `${child.cy} right`).toBeLessThanOrEqual(
      geometry.header.right + 1,
    );
    expect(child.top, `${child.cy} top`).toBeGreaterThanOrEqual(
      geometry.header.top - 1,
    );
    expect(child.bottom, `${child.cy} bottom`).toBeLessThanOrEqual(
      geometry.header.bottom + 1,
    );
    if (
      child.cy === "story-top-bar-title" ||
      child.cy === "story-top-bar-objective"
    )
      expect(child.width, `${child.cy} readable width`).toBeGreaterThan(0);
    const next = geometry.children[index + 1];
    if (next !== undefined)
      expect(child.right, `${child.cy} overlap`).toBeLessThanOrEqual(
        next.left + 1,
      );
  }

  const controls = page.locator('[data-cy="story-top-bar"] button');
  for (let index = 0; index < (await controls.count()); index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box, `header control ${index}`).not.toBeNull();
    expect(
      box!.height,
      `header control ${index} height`,
    ).toBeGreaterThanOrEqual(44);
  }
}

for (const viewport of VIEWPORTS) {
  test(`T14 header matrix fits ${viewport.id} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    await openSavedScreen(page, stateAt("narrative"));
    await expect(page.locator('[data-cy="story-top-bar"]')).toHaveCount(1);
    await expect(page.locator('[data-cy="story-top-bar-title"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-cy="story-top-bar-objective"]'),
    ).toHaveCount(0);
    await expectHeaderGeometry(page);

    for (const storyScreen of NON_SHOP_SIBLINGS) {
      await openSavedScreen(page, stateAt(storyScreen));
      await expect(
        page.locator('[data-cy="story-top-bar-shop"]'),
        `${storyScreen} shop action`,
      ).toHaveCount(0);
      await expect(page.locator('[data-cy="story-top-bar"]')).toHaveCount(1);
      await expectHeaderGeometry(page);
    }

    await openSavedScreen(page, stateAt("map"));
    await expect(page.locator('[data-cy="story-top-bar-title"]')).toHaveText(
      "City signal map",
    );
    await expect(
      page.locator('[data-cy="story-top-bar-objective-value"]'),
    ).toHaveText("Meet Rin at the Old Arena");
    await expect(page.locator('[data-cy="story-map-heading"]')).toHaveCount(0);
    await expect(page.locator('[data-cy="story-map-objective"]')).toHaveCount(
      0,
    );
    await expectHeaderGeometry(page);

    const titlePolicy = await page
      .locator('[data-cy="story-top-bar-title"]')
      .evaluate((element) => ({
        overflow: getComputedStyle(element).overflow,
        textOverflow: getComputedStyle(element).textOverflow,
        whiteSpace: getComputedStyle(element).whiteSpace,
      }));
    expect(titlePolicy).toEqual({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });

    const settings = page.getByRole("button", { name: "Open settings" });
    await page.locator('[data-cy="story-top-bar-title"]').focus();
    await page.keyboard.press("Tab");
    await expect(settings).toBeFocused();
    const focusStyle = await settings.evaluate((element) => ({
      outlineStyle: getComputedStyle(element).outlineStyle,
      outlineWidth: getComputedStyle(element).outlineWidth,
    }));
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(
      3,
    );
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");

    await openSavedScreen(page, stateAt("shop-sell"));
    await expect(page.locator('[data-cy="story-top-bar-title"]')).toHaveText(
      "Sell Cards",
    );
    await expect(page.locator('[data-cy="story-top-bar-shop"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open deck builder" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open settings" }),
    ).toBeVisible();
    await expectHeaderGeometry(page);
  });
}

test("map return follows persisted origin by pointer and keyboard", async ({
  page,
}) => {
  const map = {
    ...stateAt("map"),
    previousScreen: "narrative" as const,
  };
  const returnButton = () =>
    page.getByRole("button", { name: "Return to Dialog" });

  await openSavedScreen(page, map);
  await expect(returnButton()).toHaveAttribute("data-cy", "story-map-return");
  await returnButton().click();
  await expect(page.locator('[data-cy="story-narrative-stage"]')).toBeVisible();

  await openSavedScreen(page, map);
  await returnButton().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-cy="story-narrative-stage"]')).toBeVisible();
});

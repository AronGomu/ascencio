import { expect, test, type Locator, type Page } from "@playwright/test";
import { createInitialStoryState } from "../src/story/model/story-state.ts";
import type { BattleResult } from "../src/story/model/story-state.ts";
import { storyStarterSave } from "./story-starter-save.ts";

/* The prologue advances one beat per confirm. These two counts are the beats
   before the choice and the beats after it, taken from the flow the deleted
   `prototype-flow` spec proved against the same content. */
const BEATS_BEFORE_CHOICE = 13;
const BEATS_AFTER_CHOICE = 17;

/* The app labels elements with `data-cy`, not Playwright's default
   `data-testid`, so the region is addressed by attribute. */
const STORY_REGION = '[data-cy="shell-region-story"]';
const STARTER = storyStarterSave();

async function openStory(page: Page): Promise<void> {
  await page.goto("./#/story");
  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(page.getByText(/Rain turned/)).toBeVisible();
}

async function reloadMainMenu(page: Page): Promise<void> {
  await page.goto("./#/");
  await page.reload();
  await expect(page.getByRole("heading", { name: "ASCENCIO" })).toBeVisible();
}

async function dismissToast(page: Page, message: string): Promise<void> {
  const toast = page
    .locator('[data-cy^="shell-toast-toast-"]')
    .filter({ hasText: message });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toHaveCount(0);
}

async function startNarrative(page: Page): Promise<void> {
  await openStory(page);
}

/** Resumes the story on the outcome screen for `outcome`.

    The duel that produces an outcome is a real duel now: `e2e/story-duel.spec`
    plays one, and these tests are about the authored scenes that come after
    one, so they start from a save rather than from an engine.

    The save carries the granted deck and the cards behind it, because Retry on
    these scenes starts a real encounter and an encounter is fought with this
    save's own deck. A save holding none cannot start one at all. The record is
    written at schema 1 on purpose — the migration keeps fields a v1 record
    already carries — so the read path stays under test with it. */
async function resumeAtOutcome(
  page: Page,
  outcome: BattleResult,
): Promise<void> {
  await openStory(page);
  await page.evaluate(
    async (record) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("ygo-story-saves", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("saves");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("saves", "readwrite");
      transaction.objectStore("saves").put(record, "autosave");
      await new Promise((resolve) => {
        transaction.oncomplete = resolve;
      });
      database.close();
    },
    {
      schemaVersion: 1,
      slot: "autosave",
      revision: 1,
      savedAt: Date.now(),
      state: {
        ...createInitialStoryState(),
        screen: "outcome",
        savedScreen: "outcome",
        progressExists: true,
        encounterId: "old-arena",
        outcome,
        decks: [STARTER.deck],
        defaultDeckId: STARTER.deck.id,
        collection: STARTER.collection,
      },
    },
  );
  await reloadMainMenu(page);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function reachMap(page: Page, narrativeStarted = false): Promise<void> {
  if (!narrativeStarted) await startNarrative(page);
  for (let index = 0; index < BEATS_BEFORE_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Choose your response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /I trust you/ }).click();
  await expect(page.getByText(/earn that trust/)).toBeVisible();
  for (let index = 0; index < BEATS_AFTER_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
}

test("story plays the prologue through to the duel handoff", async ({
  page,
}) => {
  await reachMap(page);
  await expect(
    page.locator('[data-cy="story-map-choice-acknowledgment"]'),
  ).toHaveCount(0);
  await page.locator('[data-cy="story-map-hotspot-old-arena"]').click();
  await expect(page.locator('[data-cy="deck-select-title"]')).toHaveText(
    "Select Deck",
  );
  await expect(page.locator('[data-cy="duel-start-opponent-name"]')).toHaveText(
    "Rin's Echo",
  );
  await page.getByRole("button", { name: "Start Duel" }).click();
  /* The shell owns the duel, so the story's last act is to hand over: the
     duel region replaces it on a session route of its own. */
  await expect(page).toHaveURL(/#\/duel\/session\/[\w-]+$/);
  await expect(page.locator('[data-cy="shell-region-duel"]')).toBeVisible();
  await expect(page.locator(STORY_REGION)).toHaveCount(0);
});

/* A reader tapping through a scene clicks the line itself, fast, in one spot:
   the browser raises `detail` on every click after the first and would select
   the text under the pointer. Both used to swallow the click. */
test("a fast burst of clicks on the dialogue text advances once per click", async ({
  page,
}) => {
  await startNarrative(page);
  const line = page.locator('[data-cy="story-narrative-text"]');
  await line.click({ clickCount: 5, delay: 10 });
  await expect(page.locator('[data-cy="story-narrative-cursor"]')).toHaveText(
    "Beat 6",
  );
  expect(await page.evaluate(() => globalThis.getSelection()?.toString())).toBe(
    "",
  );

  /* Two more bursts with no pause between them: nothing resets the click
     counter, so this is the case that used to lose everything after the
     first click of each burst. */
  await line.click({ clickCount: 4, delay: 5 });
  await line.click({ clickCount: 4, delay: 5 });
  await expect(page.locator('[data-cy="story-narrative-cursor"]')).toHaveText(
    "Beat 14",
  );
  await expect(
    page.getByRole("heading", { name: "Choose your response" }),
  ).toBeVisible();
});

test("auto advances the scene, and skip stops at unread text until the reader allows it", async ({
  page,
}) => {
  /* Seeded rather than dragged on the slider: the setting is proven by the
     overlay tests, and one second per beat keeps this run honest and short. */
  await page.addInitScript(() =>
    localStorage.setItem(
      "ygo.story.playback.v1",
      JSON.stringify({ autoSpeedSeconds: 1, skipUnread: false }),
    ),
  );
  await startNarrative(page);

  const auto = page.getByRole("button", { name: "Auto", exact: true });
  await auto.click();
  await expect(auto).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Rin said midnight/)).toBeVisible();
  await page.locator('[data-cy="story-narrative-stage"]').click();
  await expect(auto).toHaveAttribute("aria-pressed", "false");

  /* Beat 3 has never been read, so skip hands the scene straight back — and
     says so, rather than looking like a dead button. */
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.click();
  await dismissToast(page, "not read yet");
  await expect(skip).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Skip unread text").check();
  await page.keyboard.press("Escape");

  await skip.click();
  await expect(
    page.getByRole("heading", { name: "Choose your response" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("choose a response");
});

test("a win reaches its own outcome and the updated map", async ({ page }) => {
  await resumeAtOutcome(page, "win");
  await expect(
    page.getByRole("heading", { name: "Signal broken" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue story" }).click();
  await expect(
    page.getByRole("heading", { name: "Signal Cipher" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to updated map" }).click();
  await expect(page.getByText(/Archive available/)).toBeVisible();
});

test("a loss reaches its own outcome and still continues", async ({ page }) => {
  await resumeAtOutcome(page, "loss");
  await expect(
    page.getByRole("heading", { name: "Signal endures" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue story" }).click();
  await expect(
    page.getByRole("heading", { name: "Signal Cipher" }),
  ).toBeVisible();
});

test("an aborted duel recovers without granting a reward", async ({ page }) => {
  await resumeAtOutcome(page, "abort");
  await expect(
    page.getByRole("heading", { name: "Duel paused" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to map" }).click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
  await expect(page.getByText("Signal Cipher")).toHaveCount(0);
});

/* A technical failure is not a defeat, so its scene must not offer progress
   either — and retrying it has to run a real duel, not replay an outcome. */
test("a technical failure offers a retry that starts a new duel", async ({
  page,
}) => {
  await resumeAtOutcome(page, "failure");
  await expect(
    page.getByRole("heading", { name: "Connection interrupted" }),
  ).toBeVisible();
  await expect(page.getByText("Signal Cipher")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry duel" }).click();
  await expect(page).toHaveURL(/#\/duel\/session\/[\w-]+$/);
  await expect(page.locator('[data-cy="shell-region-duel"]')).toBeVisible();
});

test("saved progress survives a reload and reaches the end of the prologue", async ({
  page,
}) => {
  await resumeAtOutcome(page, "win");
  await page.getByRole("button", { name: "Continue story" }).click();
  await expect(page.getByText(/Autosave complete/)).toBeVisible();
  await page.getByRole("button", { name: "Continue to updated map" }).click();
  await page.getByRole("button", { name: "Save progress" }).click();
  await page.getByRole("button", { name: "Confirm overwrite" }).click();
  await dismissToast(page, "Game saved.");

  await reloadMainMenu(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Archive available/)).toBeVisible();
  await page.getByRole("button", { name: "End prototype" }).click();
  await expect(
    page.getByRole("heading", { name: "Prototype complete" }),
  ).toBeVisible();
});

test("manual save and delete only touch the manual slot", async ({ page }) => {
  await startNarrative(page);
  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  /* Story entry already marks progress as existing, so the save overlay opens
     on the overwrite confirmation rather than the empty-slot action. */
  await page.getByRole("button", { name: "Confirm overwrite" }).click();
  await dismissToast(page, "Game saved.");
  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Load game" })).toBeVisible();
  await page.getByRole("button", { name: "Delete manual slot 1" }).click();
  const deletion = page.getByRole("alertdialog", { name: "Delete save?" });
  await expect(deletion).toBeVisible();
  /* Two stacked surfaces must never both be modal, or a screen reader can
     reach the dialog behind the confirmation. */
  await expect(page.locator("[aria-modal='true']")).toHaveCount(1);
  const cancel = page.getByRole("button", { name: "Cancel delete" });
  const confirm = page.getByRole("button", { name: "Delete save" });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await confirm.click();
  await expect(
    page.getByRole("heading", { name: "Manual slot 1 · Empty" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Load game" }).click();

  await reloadMainMenu(page);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
});

/** The slot keys the story database actually holds, read from outside the app
    so a passing save cannot be one the component only remembers. */
async function storySaveSlots(page: Page): Promise<readonly string[]> {
  return await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ygo-story-saves", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("saves", "readonly");
    const keys = transaction.objectStore("saves").getAllKeys();
    await new Promise((resolve) => {
      transaction.oncomplete = resolve;
    });
    database.close();
    return keys.result.map(String);
  });
}

/* The reload is the whole point: the manual slot has to come back out of
   IndexedDB through the Load screen, not out of the component's memory. */
test("a manual save is reloadable from the Load screen after a reload", async ({
  page,
}) => {
  await resumeAtOutcome(page, "win");
  await page.getByRole("button", { name: "Continue story" }).click();
  await page.getByRole("button", { name: "Continue to updated map" }).click();
  await page.getByRole("button", { name: "Save progress" }).click();
  await page.getByRole("button", { name: "Confirm overwrite" }).click();
  await dismissToast(page, "Game saved.");

  expect(await storySaveSlots(page)).toContain("manual:1");

  await reloadMainMenu(page);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("button", { name: "Load manual slot 1" }).click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
  await expect(page.getByText(/Archive available/)).toBeVisible();
});

/* A record this build cannot read costs the player that slot and nothing
   else. The failure this guards against is a blank screen on mount. */
test("a corrupt slot degrades to no save and the story still plays", async ({
  page,
}) => {
  await openStory(page);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ygo-story-saves", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("saves", "readwrite");
    transaction.objectStore("saves").put("not a save", "manual:1");
    await new Promise((resolve) => {
      transaction.oncomplete = resolve;
    });
    database.close();
  });

  await page.reload();
  await expect(page.getByRole("alert")).toContainText("manual:1");
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(page.getByText(/Rain turned/)).toBeVisible();

  /* The banner's reset clears every slot, so the next save writes cleanly on
     top of the record that could not be read. */
  await page.getByRole("button", { name: "Reset prototype storage" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await storySaveSlots(page)).toEqual([]);
});

test("every story overlay opens, traps focus, and restores it on close", async ({
  page,
}) => {
  await startNarrative(page);
  const history = page.getByRole("button", { name: "History", exact: true });
  await history.click();
  await expect(
    page.getByRole("dialog", { name: "Dialogue history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close Dialogue history" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Dialogue history" }),
  ).toHaveCount(0);
  await expect(history).toBeFocused();

  /* Settings, Save and Load sit behind the gear menu; when one of them closes,
     focus restores to the gear that opened the menu, because the menu item it
     was chosen from no longer exists. */
  const gear = page.getByRole("button", { name: "Open menu" }).first();
  for (const [trigger, dialog] of [
    ["Settings", "Settings"],
    ["Save", "Save and load"],
    ["Load", "Load game"],
  ] as const) {
    await gear.click();
    await page.getByRole("button", { name: trigger, exact: true }).click();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Close ${dialog}` }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: dialog })).toHaveCount(0);
    await expect(gear).toBeFocused();
  }

  const pause = page.getByRole("button", { name: "Open menu" }).first();
  await pause.click();
  const paused = page.getByRole("dialog", { name: "Menu" });
  await expect(paused).toBeVisible();
  const close = page.getByRole("button", { name: "Close Menu" });
  const last = page.getByRole("button", { name: "Return to Main Menu" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pause).toBeFocused();
});

async function readOverflow(page: Page) {
  return await page.evaluate((selector) => {
    const region = document.querySelector<HTMLElement>(selector);
    if (region === null) throw new Error("Story region is missing");
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      regionScrollWidth: region.scrollWidth,
      regionClientWidth: region.clientWidth,
    };
  }, STORY_REGION);
}

async function expectInsideStage(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const geometry = await page.evaluate((targetSelector) => {
    const stage = document.querySelector<HTMLElement>('[data-cy="app-stage"]');
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (stage === null || target === null)
      throw new Error(`${targetSelector} or app stage is missing`);
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
    };
  }, selector);
  expect(geometry.target.left, `${label} left edge`).toBeGreaterThanOrEqual(
    geometry.stage.left - 1,
  );
  expect(geometry.target.top, `${label} top edge`).toBeGreaterThanOrEqual(
    geometry.stage.top - 1,
  );
  expect(geometry.target.right, `${label} right edge`).toBeLessThanOrEqual(
    geometry.stage.right + 1,
  );
  expect(geometry.target.bottom, `${label} bottom edge`).toBeLessThanOrEqual(
    geometry.stage.bottom + 1,
  );
}

async function expectInternalScroll(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const scroll = await page.locator(selector).evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(scroll.overflowY, `${label} owns vertical overflow`).toBe("auto");
  expect(
    scroll.scrollHeight,
    `${label} has scrollable content`,
  ).toBeGreaterThan(scroll.clientHeight);
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1280, height: 560 },
  { width: 768, height: 1024 },
  { width: 375, height: 667 },
  { width: 667, height: 375 },
]) {
  test(`story screens fit the ${viewport.width}x${viewport.height} shell stage`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("./#/story");
    await expect(page.locator(STORY_REGION)).toBeVisible();
    await expect(page.getByText(/Rain turned/)).toBeVisible();
    await expectInsideStage(page, '[data-cy="story-app"]', "story root");
    await expectInsideStage(
      page,
      '[data-cy="story-narrative-stage"]',
      "narrative",
    );
    await expectInsideStage(
      page,
      '[data-cy="story-narrative-background"]',
      "narrative background",
    );
    await expectInsideStage(
      page,
      '[data-cy="story-narrative-dialogue"]',
      "narrative dialogue",
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expectInsideStage(
      page,
      '[data-cy^="story-narrative-character-"]',
      "narrative character",
    );

    await page.getByRole("button", { name: "Open menu" }).first().click();
    await expectInsideStage(
      page,
      '[data-cy="story-overlay-backdrop-pause-title"]',
      "pause overlay",
    );
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByText(/Rain turned/)).toBeVisible();

    await reachMap(page, true);
    await expectInsideStage(page, '[data-cy="story-map-screen"]', "map");
    const overflow = await readOverflow(page);
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
    expect(overflow.regionScrollWidth).toBeLessThanOrEqual(
      overflow.regionClientWidth,
    );

    if (viewport.width <= 667) {
      const targets = page.getByLabel("Map hotspots").getByRole("button");
      for (let index = 0; index < (await targets.count()); index += 1) {
        const box = await targets.nth(index).boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    }

    await page.locator('[data-cy="story-map-hotspot-old-arena"]').click();
    await expectInsideStage(
      page,
      '[data-cy="story-briefing-screen"]',
      "pre-battle briefing",
    );
    await page
      .locator(
        '[data-cy="deck-select-back"]:visible, [data-cy="deck-select-back-icon"]:visible',
      )
      .click();
    await expect(page.locator('[data-cy="story-map-screen"]')).toBeVisible();
    await page.locator('[data-cy="story-map-hotspot-card-shop"]').click();
    await expect(page.locator('[data-cy="story-shop-greeting"]')).toBeVisible();
    await expectInsideStage(
      page,
      '[data-cy="story-shop-greeting"]',
      "shop greeting",
    );
    await page.locator('[data-cy="story-shop-greeting-cue"]').click();
    await page.locator('[data-cy="story-shop-greeting-cue"]').click();
    await page.locator('[data-cy="story-shop-greeting-buy"]').click();
    await expect(page.locator('[data-cy="story-shop-set-grid"]')).toBeVisible();
    await expectInsideStage(
      page,
      '[data-cy="story-shop-browse"]',
      "shop browser",
    );
    await expectInternalScroll(
      page,
      '[data-cy="story-shop-browse"]',
      "shop browser",
    );

    await page.goto("./#/free-play/collection");
    await expect(page.locator('[data-cy="collection-screen"]')).toBeVisible();
    await expectInsideStage(
      page,
      '[data-cy="collection-screen"]',
      "collection",
    );
    await expectInternalScroll(
      page,
      viewport.width <= 768
        ? '[data-cy="collection-layout"]'
        : '[data-cy="collection-grid"]',
      "collection",
    );
  });
}

/* The story's reduced-motion rules moved from a document-wide `@media` block
   into one scoped to `.story-app`, so the emulated preference has to be shown
   still reaching the scene. */
test("story survives 200% text zoom with reduced motion honoured", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startNarrative(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.getByText(/Rain turned/)).toBeVisible();
  await expect(page.locator('[data-cy="story-narrative-menu"]')).toBeVisible();
  const transition = await page
    .locator("[data-testid=narrative-background]")
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  const durationMs = transition.endsWith("ms")
    ? Number.parseFloat(transition)
    : Number.parseFloat(transition) * 1_000;
  expect(durationMs).toBeLessThanOrEqual(0.01);
  const overflow = await readOverflow(page);
  expect(overflow.regionScrollWidth).toBeLessThanOrEqual(
    overflow.regionClientWidth,
  );
});

async function keyboardActivate(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 60; index += 1) {
    if (
      await target.evaluate((element) => document.activeElement === element)
    ) {
      await page.keyboard.press("Enter");
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(
    `Could not reach keyboard target: ${await target.textContent()}`,
  );
}

/* Each screen change moves focus to that screen's heading. The lookup is
   scoped to the story's own root now that the shell mounts other domains in
   the same document, so the whole traversal is asserted through focus. */
test("the story flow is reachable by keyboard alone", async ({ page }) => {
  await openStory(page);
  for (let index = 0; index < BEATS_BEFORE_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  const choice = page.getByRole("button", { name: /I trust you/ });
  await expect(choice).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/earn that trust/)).toBeVisible();
  for (let index = 0; index < BEATS_AFTER_CHOICE; index += 1)
    await page.keyboard.press("Enter");
  const mapHeading = page.getByRole("heading", { name: "City signal map" });
  await expect(mapHeading).toBeFocused();
  await keyboardActivate(
    page,
    page.getByLabel("Map hotspots").getByRole("button", { name: /Old Arena/ }),
  );
  await expect(page.locator('[data-cy="deck-select-title"]')).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Start Duel" }),
  );
  /* The story hands the duel to the shell here, so the traversal continues
     on the scenes that come back from one. */
  await expect(page).toHaveURL(/#\/duel\/session\/[\w-]+$/);
});

test("the authored outcome scenes are reachable by keyboard alone", async ({
  page,
}) => {
  await resumeAtOutcome(page, "win");
  const winHeading = page.getByRole("heading", { name: "Signal broken" });
  await expect(winHeading).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Continue story" }),
  );
  await expect(
    page.getByRole("heading", { name: "Signal Cipher" }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Continue to updated map" }),
  );
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeFocused();
});

/* The prototype shipped as a second HTML document precisely so it could not
   drag the duel runtime in. It now shares `index.html`, so the isolation that
   `verifyPrototypeIsolation` used to prove at build time has to be proven
   here at runtime instead. */
test("the story route ships from index.html without booting the duel runtime", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let count = 0;
    class CountingWorker extends NativeWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        count += 1;
      }
    }
    Object.defineProperty(window, "Worker", { value: CountingWorker });
    Object.defineProperty(window, "__storyWorkerCount", { get: () => count });
  });
  await startNarrative(page);
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { readonly __storyWorkerCount: number })
          .__storyWorkerCount,
    ),
  ).toBe(0);
  expect(requests.some((url) => /\/runtime\/|\.wasm(?:$|\?)/.test(url))).toBe(
    false,
  );
  expect(requests.some((url) => /prototype\.html(?:$|[?#])/.test(url))).toBe(
    false,
  );
});

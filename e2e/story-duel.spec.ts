import { expect, test, type Page } from "@playwright/test";
import { createInitialStoryState } from "../src/story/model/story-state.ts";
import {
  STORY_SAVES_DATABASE_NAME,
  STORY_SAVES_STORE_NAME,
  type StorySaveEnvelope,
} from "../src/story/saves/story-save-contracts.ts";

const STORY_REGION = '[data-cy="shell-region-story"]';
const DUEL_REGION = '[data-cy="shell-region-duel"]';
const SESSION_ROUTE = /#\/duel\/session\/[\w-]+$/;

/** Writes one story record straight into the database the story reads on
    mount. Playing 30 narrative beats per test would prove the prologue, which
    `e2e/story.spec.ts` already does; what these tests need is a player who is
    standing on the city map. */
async function putStorySave(
  page: Page,
  envelope: StorySaveEnvelope,
): Promise<void> {
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
      const envelope = record as { readonly slot: string };
      transaction.objectStore(storeName as string).put(record, envelope.slot);
      await new Promise((resolve) => {
        transaction.oncomplete = resolve;
      });
      database.close();
    },
    [STORY_SAVES_DATABASE_NAME, STORY_SAVES_STORE_NAME, envelope] as const,
  );
}

async function seedMapProgress(page: Page): Promise<void> {
  await page.goto("./#/story");
  await expect(page.locator(STORY_REGION)).toBeVisible();
  await putStorySave(page, {
    schemaVersion: 1,
    slot: "autosave",
    revision: 1,
    savedAt: Date.now(),
    state: {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      progressExists: true,
    },
  });
  await page.reload();
}

async function reachEncounter(page: Page): Promise<void> {
  await seedMapProgress(page);
  await page.locator('[data-cy="story-title-continue"]').click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
  await page.locator('[data-cy="story-map-location-old-arena"]').click();
  await expect(page.getByRole("heading", { name: "Rin's Echo" })).toBeVisible();
  await page.locator('[data-cy="story-briefing-start"]').click();
}

async function startPickedDuel(page: Page): Promise<void> {
  const start = page.locator('[data-cy="deck-picker-start-button"]');
  await expect(start).toBeEnabled({ timeout: 120_000 });
  await start.click();
  await expect(page.locator('[data-cy="duel-shell"]')).toBeVisible({
    timeout: 120_000,
  });
}

async function surrenderThroughMenu(page: Page): Promise<void> {
  await page.locator('[data-cy="duel-right-rail-options"]').click();
  await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
  await page
    .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
    .click();
}

test("a story encounter reaches the duel through the picker with a deck already chosen", async ({
  page,
}) => {
  await reachEncounter(page);

  await expect(page.locator(DUEL_REGION)).toBeVisible();
  await expect(page).toHaveURL(SESSION_ROUTE);
  await expect(page.locator('[data-cy="deck-picker"]')).toBeVisible({
    timeout: 120_000,
  });
  /* The seat is never left empty: the stored default deck on a fresh profile,
     the player's own key afterwards. Which one it is depends on whether the
     starter deck seeded, so what is asserted is that a deck is selected. */
  await expect(
    page.locator('[data-cy="deck-picker-player-select"]'),
  ).not.toHaveValue("", { timeout: 120_000 });
  await expect(
    page.locator('[data-cy="deck-picker-opponent-fixed"]'),
  ).toContainText("Shaddoll");
  await expect(page.locator(STORY_REGION)).toHaveCount(0);
});

test("surrendering a story duel returns to the abort branch without a reward", async ({
  page,
}) => {
  await reachEncounter(page);
  await startPickedDuel(page);
  const entriesAtSession = await page.evaluate(() => history.length);

  await surrenderThroughMenu(page);

  await expect(
    page.getByRole("heading", { name: "Duel paused" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  /* The spent session route is replaced rather than stacked on. A third entry
     is what traps Back: it lands on a session nothing can resume, which sends
     the player forward to the story again, for as long as they keep pressing. */
  expect(await page.evaluate(() => history.length)).toBe(entriesAtSession);
  await expect(page.getByText("Signal Cipher")).toHaveCount(0);
  await page.locator('[data-cy="story-outcome-abort-return"]').click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
});

/* Back is the other way out of a duel, and the one that changes the route
   before the duel region is torn down: the story is still owed its result. */
test("browser back out of a story duel reaches the abort branch", async ({
  page,
}) => {
  await reachEncounter(page);
  await startPickedDuel(page);

  await page.goBack();

  await expect(
    page.getByRole("heading", { name: "Duel paused" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  await expect(page.locator(DUEL_REGION)).toHaveCount(0);

  /* Forward leads back to a session whose duel has already been settled, so it
     has to correct itself to the story rather than strand the player there. */
  await page.goForward();

  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  await expect(page.locator(DUEL_REGION)).toHaveCount(0);
});

/* The crash-safety property: the tab can die at any point of a duel, and what
   comes back has to be the same encounter rather than a blank screen. */
test("a reload mid-duel restarts the same encounter from the checkpoint", async ({
  page,
}) => {
  await reachEncounter(page);
  await startPickedDuel(page);
  const sessionUrl = page.url();

  await page.reload();

  await expect(page).toHaveURL(sessionUrl);
  await expect(page.locator(DUEL_REGION)).toBeVisible();
  await expect(page.locator('[data-cy="deck-picker"]')).toBeVisible({
    timeout: 120_000,
  });
  await startPickedDuel(page);
  await surrenderThroughMenu(page);
  await expect(
    page.getByRole("heading", { name: "Duel paused" }),
  ).toBeVisible();
  await page.locator('[data-cy="story-outcome-abort-return"]').click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
  await expect(page.getByText(/Investigate|Meet Rin/)).toBeVisible();
});

test("a session route with no checkpoint lands on the story, not a blank screen", async ({
  page,
}) => {
  await seedMapProgress(page);

  await page.goto("./#/duel/session/44444444-2222-4333-8444-555555555555");

  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  await expect(page.locator(DUEL_REGION)).toHaveCount(0);
  await expect(page.locator('[data-cy="story-title-continue"]')).toBeVisible();
});

/* A checkpoint written by another handoff must not be adopted by this one. */
test("a session route whose checkpoint names another handoff lands on the story", async ({
  page,
}) => {
  await seedMapProgress(page);
  await putStorySave(page, {
    schemaVersion: 1,
    slot: "checkpoint:pre-duel",
    revision: 1,
    savedAt: Date.now(),
    state: {
      ...createInitialStoryState(),
      screen: "battle-mock",
      savedScreen: "map",
      progressExists: true,
      encounterId: "old-arena",
      pendingHandoffId: "11111111-2222-4333-8444-555555555555",
    },
  });

  await page.goto("./#/duel/session/99999999-2222-4333-8444-555555555555");

  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  await expect(page.locator(DUEL_REGION)).toHaveCount(0);
});

/* A record the build cannot parse is the same as no checkpoint: the player
   goes back to the story rather than into a half-restored duel. */
test("a corrupt checkpoint lands on the story with progress intact", async ({
  page,
}) => {
  await seedMapProgress(page);
  await page.evaluate(
    async ([databaseName, storeName]) => {
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
      transaction
        .objectStore(storeName as string)
        .put("not a checkpoint", "checkpoint:pre-duel");
      await new Promise((resolve) => {
        transaction.oncomplete = resolve;
      });
      database.close();
    },
    [STORY_SAVES_DATABASE_NAME, STORY_SAVES_STORE_NAME] as const,
  );

  await page.goto("./#/duel/session/55555555-2222-4333-8444-555555555555");

  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(page).toHaveURL(/#\/story$/);
  await page.locator('[data-cy="story-title-continue"]').click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
});

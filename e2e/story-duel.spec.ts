import { expect, test, type Page } from "@playwright/test";
import { createInitialStoryState } from "../src/story/model/story-state.ts";
/* The two names come from the shell's own copy of them rather than from
   `src/story/saves/story-save-contracts.ts`: that module now reaches the
   starter grant, which reads the bundled deck list through a Vite `?raw`
   import, and Playwright loads these files without Vite — the same reason
   `story-starter-save.ts` reads that list with `readFileSync`.
   `tests/unit/story-save-presence.test.ts` is what keeps the shell's two
   strings and the story's one fact. The envelope type is erased at load, so
   it still comes from the contract it describes. */
import {
  STORY_SAVES_DATABASE_NAME,
  STORY_SAVES_STORE_NAME,
} from "../src/shell/screens/story-save-presence.ts";
import type { StorySaveEnvelope } from "../src/story/saves/story-save-contracts.ts";
import { storyStarterSave } from "./story-starter-save.ts";

const STORY_REGION = '[data-cy="shell-region-story"]';
const DUEL_REGION = '[data-cy="shell-region-duel"]';
const SESSION_ROUTE = /#\/duel\/session\/[\w-]+$/;
/* The deck and cards a new game is granted. A save standing on the map always
   has both, and the briefing refuses to start an encounter for a save holding
   no deck it can field. */
const STARTER = storyStarterSave();

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
    schemaVersion: 3,
    slot: "autosave",
    revision: 1,
    savedAt: Date.now(),
    state: {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      progressExists: true,
      decks: [STARTER.deck],
      defaultDeckId: STARTER.deck.id,
      collection: STARTER.collection,
    },
  });
  await page.reload();
}

/* A save whose default deck the collection no longer covers. Nobody edited it;
   the cards behind it were sold, which is the state T25 badges in the library
   and T26 warns about before the sale commits. */
async function seedBrokenDefault(page: Page): Promise<void> {
  await page.goto("./#/story");
  await expect(page.locator(STORY_REGION)).toBeVisible();
  const [sold] = STARTER.deck.main;
  await putStorySave(page, {
    schemaVersion: 3,
    slot: "autosave",
    revision: 1,
    savedAt: Date.now(),
    state: {
      ...createInitialStoryState(),
      screen: "map",
      savedScreen: "map",
      progressExists: true,
      decks: [STARTER.deck],
      defaultDeckId: STARTER.deck.id,
      collection: { ...STARTER.collection, [sold!]: 0 },
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
  /* Asked for by its own name rather than by role: the briefing titles itself
     after the opponent and seats that same opponent beside the decks, so two
     headings carry the encounter. */
  await expect(page.locator('[data-cy="deck-select-title"]')).toHaveText(
    "Rin's Echo",
  );
  /* Disabled until the card database has answered for the save's decks, which
     is the whole read the duel is about to make anyway. */
  const start = page.locator('[data-cy="deck-select-start"]');
  await expect(start).toBeEnabled({ timeout: 120_000 });
  /* The save's one deck, picked: the tick is what says the encounter starts on
     it rather than on nothing. */
  await expect(
    page.locator(`[data-cy="deck-tile-name-${STARTER.deck.id}"]`),
  ).toHaveText(STARTER.deck.name);
  await expect(
    page.locator(`[data-cy="deck-tile-check-${STARTER.deck.id}"]`),
  ).toBeVisible();
  await start.click();
}

/* No picker step: the briefing already chose the deck and the shell hands the
   duel a built request, so the field is what comes up. */
async function awaitDuelField(page: Page): Promise<void> {
  await expect(page.locator('[data-cy="duel-shell"]')).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('[data-cy="deck-picker"]')).toHaveCount(0);
}

async function surrenderThroughMenu(page: Page): Promise<void> {
  await page.locator('[data-cy="duel-right-rail-options"]').click();
  await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
  await page
    .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
    .click();
}

/* The deck chosen at the briefing is the deck fought with. What crosses to the
   Worker — the save's own forty card codes, seat by seat — is asserted exactly
   in `tests/component/StoryDuelHandoff.test.ts`, which drives the same shell,
   coordinator and story against a hand-driven worker client. What only a real
   browser can show is that the field comes up on its own: the encounter never
   stops at the duel's own picker, which lists free play's decks rather than
   this save's and would fix the opponent itself. */
test("a story encounter opens the duel on the chosen deck, with no second picker", async ({
  page,
}) => {
  await reachEncounter(page);

  await expect(page.locator(DUEL_REGION)).toBeVisible();
  await expect(page).toHaveURL(SESSION_ROUTE);
  await awaitDuelField(page);
  await expect(page.locator(STORY_REGION)).toHaveCount(0);
  /* The player's own hand is dealt from that deck, so a duel that reached the
     field at all has already been handed one. */
  await expect(page.locator('[data-cy="field-hand-band-p0"]')).toBeVisible({
    timeout: 120_000,
  });
});

test("surrendering a story duel returns to the abort branch without a reward", async ({
  page,
}) => {
  await reachEncounter(page);
  await awaitDuelField(page);
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
  await awaitDuelField(page);

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
  await awaitDuelField(page);
  const sessionUrl = page.url();

  await page.reload();

  await expect(page).toHaveURL(sessionUrl);
  await expect(page.locator(DUEL_REGION)).toBeVisible();
  /* The checkpoint carries the whole save, so the restarted encounter resolves
     the same deck rather than dropping the player back into a picker. */
  await awaitDuelField(page);
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
    schemaVersion: 3,
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

/* The refusal, end to end against the shipped card database: a deck the save
   cannot field stops the duel, says which card is missing, and the way out it
   offers actually opens the editor rather than dropping the run. */
test("an encounter refuses a deck the save no longer owns and links to the editor", async ({
  page,
}) => {
  await seedBrokenDefault(page);
  await page.locator('[data-cy="story-title-continue"]').click();
  await page.locator('[data-cy="story-map-location-old-arena"]').click();
  await expect(page.locator('[data-cy="deck-select-title"]')).toHaveText(
    "Rin's Echo",
  );

  const reason = page.locator('[data-cy="deck-select-block-notice"]');
  await expect(reason).toBeVisible({ timeout: 120_000 });
  await expect(reason).toContainText("you own 0");
  await expect(page.locator('[data-cy="deck-select-start"]')).toBeDisabled();
  /* Listed rather than hidden, because a story's decks live in the save: the
     player has to see the deck they are being sent to repair. */
  await expect(
    page.locator(`[data-cy="deck-tile-press-${STARTER.deck.id}"]`),
  ).toBeDisabled();

  await page.locator('[data-cy="story-briefing-block-action"]').click();

  await expect(page.locator('[data-cy="shell-region-decks"]')).toBeVisible({
    timeout: 120_000,
  });
  await expect(page).toHaveURL(/#\/story\/decks$/);
  await expect(
    page.locator(`[data-cy="deck-tile-badge-illegal-${STARTER.deck.id}"]`),
  ).toBeVisible({ timeout: 120_000 });
});

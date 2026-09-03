import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_NAME,
} from "../src/decks/deck-database.ts";
import { RESULT_WINDOW_CEILING } from "../src/deck-editor/layout/result-window.ts";

const libraryUrl = "./#/decks";
const BLUE_EYES = 89631139;
/* The catalog is the whole card database, where a name is not unique: six
   printings answer to "Summoned Skull" and three to "Celtic Guardian". Pick the
   card by code, the way the rest of this file already does. */
const SUMMONED_SKULL = 70781052;
const CELTIC_GUARDIAN = 91152256;

/* Both names, so a scenario that seeds the prototype database cannot leave one
   behind for the next scenario to migrate. */
async function deleteDeckDatabase(page: Page) {
  await page.evaluate(
    async (names: readonly string[]) => {
      for (const name of names)
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        });
    },
    [DECK_DATABASE_NAME, LEGACY_DECK_DATABASE_NAME],
  );
}

/* The counts moved into each zone's collapse bar, so "Main 1" is now the main
   zone's own `1/40`. `40-60` only appears once the deck is past forty cards. */
function zoneCount(page: Page, zone: "main" | "extra" | "side"): Locator {
  return page.locator(`[data-cy="deck-zone-count-${zone}"]`);
}

function zoneTile(page: Page, zone: "main" | "extra" | "side", code: number) {
  return page.locator(
    `[data-cy="deck-zone-drop-area-${zone}"] [data-card-code="${code}"]`,
  );
}

/* The catalog and the deck render the same card as the same tile, so every
   tile locator says which of the two it means. */
function catalogTile(page: Page, code: number): Locator {
  return page.locator(
    `[data-cy="deck-catalog-results"] [data-cy="catalog-tile-${code}"]`,
  );
}

interface DeckCounts {
  readonly main: number;
  readonly extra: number;
  readonly side: number;
}

/* Reads the deck row the editor writes, not the one it is holding. */
async function persistedDeckCounts(
  page: Page,
  deckId: string,
): Promise<DeckCounts | null> {
  return page.evaluate(
    async ([name, id]) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        if (!database.objectStoreNames.contains("decks")) return null;
        const record = await new Promise<{
          main: readonly number[];
          extra: readonly number[];
          side: readonly number[];
        } | null>((resolve, reject) => {
          const request = database
            .transaction("decks", "readonly")
            .objectStore("decks")
            .get(id);
          request.onsuccess = () =>
            resolve(
              (request.result as {
                main: readonly number[];
                extra: readonly number[];
                side: readonly number[];
              } | null) ?? null,
            );
          request.onerror = () => reject(request.error);
        });
        return record === null
          ? null
          : {
              main: record.main.length,
              extra: record.extra.length,
              side: record.side.length,
            };
      } finally {
        database.close();
      }
    },
    [DECK_DATABASE_NAME, deckId] as const,
  );
}

/* `aria-busy` on the editor layout is `saveState === "saving"` and nothing
   else, so its absence is equally true of `saved`, `failed`, `conflict` and of
   `idle` before the queued save has begun — four of the five states, two of
   them failures. It is also unordered: a mutation chains onto a promise queue,
   so the click resolves at least a microtask before `saveState` leaves the
   value it already had, and the first poll lands inside that window. Neither
   the scenarios that follow a save nor the second browser context that has to
   lose a revision race can stand on that.

   What only a committed save produces is the deck row itself. The expected
   card counts are passed in rather than read back off the page, because the
   page is the thing under test: comparing the database to the DOM passes
   whenever both are still one step behind. */
async function expectSaveSettled(page: Page, expected: DeckCounts) {
  const deckId = new URL(page.url()).hash.replace(
    /^#\/(?:free-play|story)\/decks\//,
    "",
  );
  expect(deckId, "expectSaveSettled must be called on a deck route").not.toBe(
    "",
  );
  await expect
    .poll(() => persistedDeckCounts(page, deckId), {
      message: `the saved deck row should hold ${expected.main}/${expected.extra}/${expected.side}`,
    })
    .toEqual(expected);
}

/* The main menu offers no deck entry of its own — the free-play submenu owns
   that door — so the fact under test is that the editor is not what `#/`
   mounts. */
test("default route shows the main menu, not the deck editor", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect(page.locator('[data-cy="shell-region-decks"]')).toHaveCount(0);
});

test("open deck returns through the button below its preview", async ({
  page,
}) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Return Control");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const preview = page.locator('[data-cy="card-preview-panel"]');
  const back = page.locator('[data-cy="deck-editor-return"]');
  await expect(back).toHaveText("Return to Deck Selection");
  await expect(
    page.locator('[data-cy="deck-editor-library-link"]'),
  ).toHaveCount(0);
  const [previewBox, backBox] = await Promise.all([
    preview.boundingBox(),
    back.boundingBox(),
  ]);
  expect(previewBox).not.toBeNull();
  expect(backBox).not.toBeNull();
  expect(backBox!.x).toBeCloseTo(previewBox!.x, 0);
  expect(backBox!.width).toBeCloseTo(previewBox!.width, 0);
  expect(backBox!.y).toBeGreaterThanOrEqual(previewBox!.y + previewBox!.height);

  await back.click();
  await expect(page.locator('[data-cy="deck-library"]')).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/free-play/decks");
});

test("deck editor persists edits across reloads", async ({ page }) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Deck Library" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("E2E Control");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Control");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  const blueEyes = catalogTile(page, BLUE_EYES);
  await expect(blueEyes).toBeVisible();
  /* A catalog click both selects the card and adds it to its canonical zone. */
  await blueEyes.click();
  await expect(
    page.getByText(
      "This legendary dragon is a powerful engine of destruction.",
    ),
  ).toBeVisible();
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await expectSaveSettled(page, { main: 1, extra: 0, side: 0 });

  /* Dragging is still its own path into the deck, so a second copy arrives
     that way and undo/redo has to see both adds. */
  await blueEyes.dragTo(page.locator('[data-cy="deck-zone-drop-area-main"]'));
  await expect(zoneCount(page, "main")).toHaveText("2/40");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(zoneCount(page, "main")).toHaveText("2/40");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(zoneCount(page, "main")).toHaveText("1/40");

  /* Above the breakpoint a left click on a deck card is the move itself: out
     of the Main Deck goes to the Side Deck, and back again from there. */
  await zoneTile(page, "main", BLUE_EYES).click();
  await expect(zoneCount(page, "side")).toHaveText("1/15");
  await expect(zoneCount(page, "main")).toHaveText("0/40");
  await zoneTile(page, "side", BLUE_EYES).click();
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await expect(zoneCount(page, "side")).toHaveText("0/15");
  /* Right click opens the card actions without losing the exact copy. */
  await zoneTile(page, "main", BLUE_EYES).click({ button: "right" });
  await page.locator('[data-cy="deck-card-context-remove"]').click();
  await expect(zoneCount(page, "main")).toHaveText("0/40");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await expectSaveSettled(page, { main: 1, extra: 0, side: 0 });

  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Control");
  await expect(zoneCount(page, "main")).toHaveText("1/40");

  /* A one-card deck is invalid, and exporting one says so rather than
     refusing. */
  await page.locator('[data-cy="deck-editor-export"]').click();
  await expect(
    page.locator('[data-cy="deck-ydk-export-warning"]'),
  ).toContainText("invalid");
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(zoneCount(page, "main")).toHaveText("1/40");

  // Rename via deck-name-input (A7: commit on blur, no dialog)
  const nameInput = page.locator('[data-cy="deck-name-input"]');
  await nameInput.fill("E2E Renamed");
  await nameInput.blur();
  await expect(nameInput).toHaveValue("E2E Renamed");

  // Duplicate via deck page
  await page.locator('[data-cy="deck-editor-duplicate"]').click();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "E2E Renamed Copy",
  );
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await expect(zoneTile(page, "main", BLUE_EYES)).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "E2E Renamed Copy",
  );
  await expect(zoneCount(page, "main")).toHaveText("1/40");

  // Delete via deck page — confirm dialog, then land on library
  await page.locator('[data-cy="deck-editor-delete"]').click();
  await expect(
    page.locator('[data-cy="deck-editor-delete-dialog"]'),
  ).toBeVisible();
  await page.locator('[data-cy="deck-editor-delete-confirm"]').click();
  const grid = page.locator('[data-cy="deck-select-grid"]');
  await expect(page.locator('[data-cy="deck-library"]')).toBeVisible();
  await expect(grid).not.toContainText("E2E Renamed Copy");
  await expect(page.getByText("E2E Renamed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(grid).not.toContainText("E2E Renamed Copy");
});

test("the deck route deep-links, survives a reload and answers Back", async ({
  page,
}) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Deep Link");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Deep Link",
  );

  /* Opening a deck has to be a real navigation, not internal state: the hash
     names the deck and a reload of that hash reopens the same deck. */
  const deckHash = new URL(page.url()).hash;
  expect(deckHash).toMatch(/^#\/free-play\/decks\/.+/);
  await page.reload();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Deep Link",
  );

  await page.goBack();
  await expect(page.locator('[data-cy="deck-library"]')).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#/decks");

  await page.goto("./#/decks/no-such-deck");
  await expect(page.locator('[data-cy="deck-not-found"]')).toBeVisible();
  await page.locator('[data-cy="deck-not-found-back"]').click();
  await expect(page.locator('[data-cy="deck-library"]')).toBeVisible();
  /* Anchored because tile press names deck plus its counts and metadata. */
  await expect(page.getByRole("button", { name: /^Deep Link/ })).toBeVisible();
});

test("Deck Library imports one persisted undoable update", async ({ page }) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.locator('[data-cy="deck-library-import"]').click();
  await page.getByLabel("Deck name").fill("Library Import E2E");
  await page
    .getByLabel("Or paste YDK text")
    .fill("#main\n99999999\n#extra\n!side\n");
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Replace deck cards" }).click();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Library Import E2E",
  );
  /* A code the pinned catalog does not know stays in the deck as a tile that
     says so; nothing is repaired silently. */
  await expect(zoneTile(page, "main", 99999999)).toHaveAttribute(
    "aria-label",
    /Missing card 99999999/,
  );
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.reload();
  await expect(page.locator('[data-cy="deck-name-input"]')).toHaveValue(
    "Library Import E2E",
  );
  await expect(zoneTile(page, "main", 99999999)).toHaveAttribute(
    "aria-label",
    /Missing card 99999999/,
  );
});

test("the deck editor recovers real save failures and revision conflicts", async ({
  page,
  context,
}) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Recovery E2E");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(IDBDatabase.prototype, "transaction", {
      configurable: true,
      value: function (this: IDBDatabase, ...args: unknown[]) {
        const stores = Array.isArray(args[0]) ? args[0] : [args[0]];
        if (args[1] === "readwrite" && stores.includes("decks")) {
          Object.defineProperty(IDBDatabase.prototype, "transaction", {
            configurable: true,
            value: original,
          });
          throw new Error("simulated transaction failure");
        }
        return Reflect.apply(original, this, args);
      },
    });
  });
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await catalogTile(page, BLUE_EYES).click();
  await expect(page.getByRole("alert")).toContainText(
    "simulated transaction failure",
  );
  await page.getByRole("button", { name: "Retry autosave" }).click();
  /* The banner is the failure; its absence is the recovery. */
  await expect(page.locator('[data-cy="deck-editor-save-failed"]')).toHaveCount(
    0,
  );
  await expectSaveSettled(page, { main: 1, extra: 0, side: 0 });

  /* `#/decks` is the library now, so the second context has to deep-link at
     the deck under test rather than rely on a last-opened pointer. */
  const second = await context.newPage();
  await second.goto(`./${new URL(page.url()).hash}`);
  await expect(zoneCount(second, "main")).toHaveText("1/40");

  await page.getByRole("searchbox", { name: "Name" }).fill("Summoned Skull");
  await catalogTile(page, SUMMONED_SKULL).click();
  await expect(zoneCount(page, "main")).toHaveText("2/40");
  /* The second context loses the revision race only if this save has actually
     landed before it tries its own; that is exactly what the old barrier could
     not promise. */
  await expectSaveSettled(page, { main: 2, extra: 0, side: 0 });

  await second.getByRole("searchbox", { name: "Name" }).fill("Celtic Guardian");
  await catalogTile(second, CELTIC_GUARDIAN).click();
  await expect(second.getByRole("alert")).toContainText(
    "changed by another browser context",
  );
  await second
    .getByRole("button", { name: "Preserve local edits as copy" })
    .click();
  await expect(second.getByLabel("Deck name")).toHaveValue(
    "Recovery E2E Recovered Copy",
  );
  await expect(zoneCount(second, "main")).toHaveText("2/40");
  await second.reload();
  await expect(second.getByLabel("Deck name")).toHaveValue(
    "Recovery E2E Recovered Copy",
  );
});

test("a prototype deck database is migrated on first load", async ({
  page,
}) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);

  /* The schema is spelled out rather than imported because this fixture has to
     be what the *previous* build wrote: a page cannot import project modules,
     and pinning the old shape here is the point of the scenario. */
  await page.evaluate(async (name: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        const decks = request.result.createObjectStore("decks", {
          keyPath: "id",
        });
        decks.createIndex("updatedAt", "updatedAt");
        decks.createIndex("name", "name");
        request.result.createObjectStore("histories", { keyPath: "deckId" });
        request.result.createObjectStore("preferences", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ["decks", "histories", "preferences"],
      "readwrite",
    );
    transaction.objectStore("decks").put({
      schemaVersion: 1,
      id: "prototype-deck",
      revision: 1,
      name: "Prototype Survivor",
      main: [89631139],
      extra: [],
      side: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      validation: {
        status: "errors",
        issues: [],
        rulesetRevision: "prototype-2026-01",
      },
      importedNeedsReview: false,
    });
    transaction.objectStore("histories").put({
      deckId: "prototype-deck",
      history: { undo: [], redo: [], nextSequence: 1 },
    });
    transaction
      .objectStore("preferences")
      .put({ key: "last-opened-deck", value: "prototype-deck" });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, LEGACY_DECK_DATABASE_NAME);

  await page.reload();
  /* Anchored because tile press names deck plus its counts and metadata. */
  const migrated = page.getByRole("button", { name: /^Prototype Survivor/ });
  await expect(migrated).toBeVisible();

  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map(({ name }) => name ?? ""),
  );
  expect(names).toContain(DECK_DATABASE_NAME);
  expect(names).not.toContain(LEGACY_DECK_DATABASE_NAME);

  /* Opening the deck reads its history record too, so this also proves the
     migration copied more than the deck row. One card is not a legal deck, so
     its tile cannot be picked and the kebab is the way in — which is the point:
     a deck is opened to be repaired. */
  await page.locator('[data-cy="deck-tile-menu-prototype-deck"]').click();
  await page.locator('[data-cy="deck-tile-menu-open-prototype-deck"]').click();
  await expect(page.getByLabel("Deck name")).toHaveValue("Prototype Survivor");
  await expect(zoneCount(page, "main")).toHaveText("1/40");
});

test("the deck editor builds a deck by tap on a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Portrait Build");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  /* One pane at a time, and the deck pane carries the counts. */
  const main = zoneCount(page, "main");
  const side = zoneCount(page, "side");
  await expect(main).toBeVisible();
  await expect(page.locator('[data-cy="deck-pane-deck"]')).toBeVisible();
  await expect(page.locator('[data-cy="deck-pane-catalog"]')).toHaveCount(0);

  await page.locator('[data-cy="deck-tab-catalog"]').click();
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await catalogTile(page, BLUE_EYES).click();
  /* Adding leaves the catalog open, so the next card is one tap away. */
  await expect(page.locator('[data-cy="deck-pane-catalog"]')).toBeVisible();
  await expectSaveSettled(page, { main: 1, extra: 0, side: 0 });

  await page.locator('[data-cy="deck-tab-deck"]').click();
  await expect(main).toHaveText("1/40");
  /* The tile itself, not the validation issue that also names the card. */
  const deckTile = page.locator(
    '[data-cy="deck-pane-deck"] [data-card-code="89631139"]',
  );
  await deckTile.click();
  await expect(page.locator('[data-cy="deck-tap-menu"]')).toBeVisible();
  await expect(page.locator('[data-cy="deck-tap-target-main"]')).toHaveCount(0);
  await expect(
    page.locator('[data-cy="deck-tap-target-extra"]'),
  ).toBeDisabled();
  await page.locator('[data-cy="deck-tap-target-side"]').click();
  await expect(side).toHaveText("1/15");
  await expect(main).toHaveText("0/40");

  await deckTile.click();
  await page.locator('[data-cy="deck-tap-target-remove"]').click();
  await expect(side).toHaveText("0/15");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(side).toHaveText("1/15");
  await expectSaveSettled(page, { main: 0, extra: 0, side: 1 });
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("Portrait Build");
  await expect(side).toHaveText("1/15");

  /* No sideways scroll at any of the sizes the editor now has to serve. */
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator('[data-cy="deck-editor-layout"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `page overflows at ${size.width}x${size.height}`,
    ).toBe(true);
    expect(
      await page.evaluate(() => {
        const layout = document.querySelector('[data-cy="deck-editor-layout"]');
        return layout === null || layout.scrollWidth <= layout.clientWidth;
      }),
      `editor layout overflows at ${size.width}x${size.height}`,
    ).toBe(true);
  }
});

test("the deck editor keeps its three panels above the breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Desktop Panels");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  for (const pane of ["catalog", "deck", "details"])
    await expect(page.locator(`[data-cy="deck-pane-${pane}"]`)).toHaveCount(1);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  /* The tap menu stays a touch affordance: above the breakpoint a catalog
     click is the add itself, with no menu in between. */
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await catalogTile(page, BLUE_EYES).click();
  await expect(page.locator('[data-cy="deck-tap-menu"]')).toHaveCount(0);
  await expect(zoneCount(page, "main")).toHaveText("1/40");
});

test("the deck editor fits the stage without a region scrollbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Viewport Fit");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator('[data-cy="deck-editor-layout"]')).toBeVisible();

  const region = page.locator('[data-cy="shell-region-decks"]');
  const measure = () =>
    region.evaluate((el) => ({
      fitsVertically: el.scrollHeight <= el.clientHeight + 1,
      fitsHorizontally: el.scrollWidth <= el.clientWidth + 1,
    }));
  const scrolls = await measure();
  expect(scrolls.fitsVertically, "region must not scroll vertically").toBe(
    true,
  );
  expect(scrolls.fitsHorizontally, "region must not scroll horizontally").toBe(
    true,
  );

  /* Duplicate reports through the shell toast without changing region height. */
  await page.locator('[data-cy="deck-editor-duplicate"]').click();
  await expect(page.locator('[data-cy^="shell-toast-message-"]')).toHaveText(
    "Deck duplicated.",
  );
  const withMessage = await measure();
  expect(
    withMessage.fitsVertically,
    "region must not scroll vertically while a message shows",
  ).toBe(true);
  expect(
    withMessage.fitsHorizontally,
    "region must not scroll horizontally while a message shows",
  ).toBe(true);
});

test("the card viewer is card width", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Card Width");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator('[data-cy="deck-editor-layout"]')).toBeVisible();

  const preview = page.locator('[data-cy="card-preview-panel"]');
  const box = await preview.boundingBox();
  expect(box, "card-preview-panel must be visible").not.toBeNull();
  const expectedPx = 15.5 * 16;
  expect(
    Math.abs(box!.width - expectedPx),
    `card-preview-panel width ${box!.width}px should be within 10px of ${expectedPx}px`,
  ).toBeLessThanOrEqual(10);
});

/* jsdom holds no component CSS — `vite-plugin-svelte` keeps it out of the
   document, so `getComputedStyle` answers `none` for every grid property —
   which leaves the unit test in `card-tile-art.test.ts` reading rules out of
   the source. Whether those rules add up to art that fills the tile is a
   question only a real box tree answers, so it is asked here: without
   `grid-template-areas: "card"` and `.card-tile > * { grid-area: card }` the
   badge, the art and the name take a row each and the art collapses to a strip
   across the top of the tile. */
test("the tile art fills the tile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Art Fit");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");

  const tile = catalogTile(page, BLUE_EYES);
  await expect(tile).toBeVisible();
  /* Whichever of the two this build has for the card: the image when it
     packages art, the placeholder glyph when it does not. Both sit in the same
     grid area and both have to fill it. */
  const art = tile.locator(
    `[data-cy="catalog-tile-image-${BLUE_EYES}"], [data-cy="catalog-tile-art-${BLUE_EYES}"]`,
  );
  await expect(art).toHaveCount(1);

  /* The tile's content box rather than its border box: the 1px border is not
     something the art is supposed to cover. */
  const inner = await tile.evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  const tileBox = (await tile.boundingBox())!;
  const artBox = (await art.boundingBox())!;
  const nameBox = (await tile
    .locator(`[data-cy="catalog-tile-name-${BLUE_EYES}"]`)
    .boundingBox())!;
  expect(tileBox, "the catalog tile must be laid out").not.toBeNull();
  expect(artBox, "the tile art must be laid out").not.toBeNull();
  expect(nameBox, "the tile name must be laid out").not.toBeNull();
  expect(inner.height, "a card tile is taller than it is wide").toBeGreaterThan(
    inner.width,
  );

  expect(
    artBox.height,
    `art ${artBox.height}px should cover the ${inner.height}px tile interior`,
  ).toBeGreaterThanOrEqual(inner.height - 1);
  expect(
    artBox.width,
    `art ${artBox.width}px should cover the ${inner.width}px tile interior`,
  ).toBeGreaterThanOrEqual(inner.width - 1);
  /* Covering it from the top-left corner, not overflowing past it. */
  expect(Math.abs(artBox.y - tileBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(artBox.x - tileBox.x)).toBeLessThanOrEqual(2);

  /* The art filling the tile is not by itself the thing the grid area buys.
     A card image already has the tile's own 59:86 proportions, so an image
     that loaded is about tile-sized whether or not it shares an area with the
     name; what it does not do is leave room for the name underneath. Take the
     rows away and the two stack to 209px inside a 176px tile, `overflow:
     hidden` eats the name, and the tile the player reads has no title on it.
     So: the name sits over the art, and nothing spills out of the tile. */
  expect(
    nameBox.y,
    `the name at ${nameBox.y} should sit over art starting at ${artBox.y}`,
  ).toBeGreaterThanOrEqual(artBox.y - 1);
  expect(
    nameBox.y + nameBox.height,
    "the name should end inside the tile rather than under its clipped edge",
  ).toBeLessThanOrEqual(tileBox.y + tileBox.height + 1);
  expect(
    inner.scrollHeight,
    `tile content ${inner.scrollHeight}px overflows its ${inner.height}px box`,
  ).toBeLessThanOrEqual(inner.height + 1);
});

/* The tabbed layout hands `CardCatalog` `filled`, which stops `.results` being
   a scroll container. The observer is viewport-rooted in that layout. The
   result window grows with scroll but is capped at `RESULT_WINDOW_CEILING` to
   bound the DOM. When the ceiling is reached, a truncation notice appears and
   the sentinel is removed. */
test("the catalog tile count stays under the ceiling on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Scroll Build");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.locator('[data-cy="deck-tab-catalog"]').click();

  /* The selector must match only the tile buttons themselves, not their child
     elements (limit badge, image, name), which also have data-cy attributes
     prefixed with "catalog-tile-". The button is the only direct child. */
  const tiles = page.locator(
    '[data-cy="deck-catalog-results"] > [data-cy^="catalog-tile-"]',
  );
  await expect(tiles.first()).toBeVisible();
  await expect(
    page.locator('[data-cy="deck-catalog-result-count"]'),
  ).toHaveText(/\d{4,} results/);

  /* The window grows with scroll but stops at the ceiling. */
  const scrollToBottom = () =>
    page.evaluate(() => {
      const region = document.querySelector(
        '[data-cy="shell-region-decks"]',
      ) as HTMLElement | null;
      region?.scrollTo({ top: region.scrollHeight });
    });

  /* Scroll once — window should grow past initial 60. */
  await scrollToBottom();
  await page.waitForTimeout(500);
  const afterOneScroll = await tiles.count();
  expect(afterOneScroll, "first scroll should append tiles").toBeGreaterThan(
    60,
  );

  /* Scroll many times — window should hit ceiling and stop. */
  for (let i = 0; i < 20; i++) {
    await scrollToBottom();
    await page.waitForTimeout(100);
  }
  const afterManyScrolls = await tiles.count();
  expect(
    afterManyScrolls,
    `tile count ${afterManyScrolls} exceeds ceiling ${RESULT_WINDOW_CEILING}`,
  ).toBeLessThanOrEqual(RESULT_WINDOW_CEILING);

  /* Ceiling notice must be visible. */
  await expect(
    page.locator('[data-cy="deck-catalog-ceiling-notice"]'),
    "ceiling truncation notice should appear",
  ).toBeVisible();

  /* Sentinel must be removed from DOM. */
  await expect(
    page.locator('[data-cy="deck-catalog-results-sentinel"]'),
  ).toHaveCount(0);
});

/* Edit cost must not scale with mounted tile count. A MutationObserver counts
   DOM mutations during an add-card action; the count should be bounded by a
   small constant independent of scroll depth. This is deterministic: it
   measures mutation count, not wall-clock time. */
test("edit mutation count is independent of scroll depth", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Mutation Test");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.locator('[data-cy="deck-tab-catalog"]').click();

  /* Direct child selector: only count tile buttons, not their children. */
  const tiles = page.locator(
    '[data-cy="deck-catalog-results"] > [data-cy^="catalog-tile-"]',
  );
  await expect(tiles.first()).toBeVisible();

  /* Measure mutation count during add with few tiles (initial window). */
  const mutationsAtShallow = await page.evaluate(async () => {
    const results = document.querySelector('[data-cy="deck-catalog-results"]');
    if (!results) return -1;
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    observer.observe(results, { childList: true, subtree: true });
    /* Direct child: don't match child elements of the tile. */
    const tile = results.querySelector(
      ':scope > [data-cy^="catalog-tile-"]',
    ) as HTMLElement | null;
    tile?.click();
    await new Promise((r) => setTimeout(r, 100));
    observer.disconnect();
    return count;
  });

  /* Scroll to ceiling. */
  const scrollToBottom = () =>
    page.evaluate(() => {
      const region = document.querySelector(
        '[data-cy="shell-region-decks"]',
      ) as HTMLElement | null;
      region?.scrollTo({ top: region.scrollHeight });
    });
  for (let i = 0; i < 20; i++) {
    await scrollToBottom();
    await page.waitForTimeout(100);
  }

  /* Confirm ceiling reached. */
  const tileCount = await tiles.count();
  expect(tileCount).toBeGreaterThanOrEqual(RESULT_WINDOW_CEILING - 10);

  /* Measure mutation count during add at ceiling. */
  const mutationsAtCeiling = await page.evaluate(async () => {
    const results = document.querySelector('[data-cy="deck-catalog-results"]');
    if (!results) return -1;
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    observer.observe(results, { childList: true, subtree: true });
    const tile = results.querySelectorAll(
      ':scope > [data-cy^="catalog-tile-"]',
    )[10] as HTMLElement | null;
    tile?.click();
    await new Promise((r) => setTimeout(r, 100));
    observer.disconnect();
    return count;
  });

  /* Both counts should be small constants, independent of tile count. The
     tile tap fires selection + hover updates + Svelte reactive batches; bound
     is generous to cover those but stable across scroll depth. */
  const MUTATION_BOUND = 100;
  expect(
    mutationsAtShallow,
    `shallow mutations ${mutationsAtShallow} exceeds bound ${MUTATION_BOUND}`,
  ).toBeLessThanOrEqual(MUTATION_BOUND);
  expect(
    mutationsAtCeiling,
    `ceiling mutations ${mutationsAtCeiling} exceeds bound ${MUTATION_BOUND}`,
  ).toBeLessThanOrEqual(MUTATION_BOUND);

  /* The two counts should be comparable — edit cost independent of depth. */
  const delta = Math.abs(mutationsAtCeiling - mutationsAtShallow);
  expect(
    delta,
    `mutation delta ${delta} (shallow=${mutationsAtShallow}, ceiling=${mutationsAtCeiling}) suggests cost scales with depth`,
  ).toBeLessThanOrEqual(MUTATION_BOUND);
});

test("deck library shows art rows with frame and copy count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Create deck" }).click();
  await page.getByLabel("Deck name").fill("Decklist Rows");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await catalogTile(page, BLUE_EYES).click();
  await page.getByRole("searchbox", { name: "Name" }).fill("");
  const catalogTiles = page.locator(
    '[data-cy="deck-catalog-results"] > [data-cy^="catalog-tile-"]',
  );
  const catalogCodes = await catalogTiles.evaluateAll((tiles) =>
    tiles.map((tile) => tile.getAttribute("data-card-code")),
  );
  const additionalCodes = catalogCodes
    .filter(
      (code): code is string => code !== null && code !== String(BLUE_EYES),
    )
    .slice(0, 59);
  expect(additionalCodes.length).toBeGreaterThanOrEqual(39);
  for (const code of additionalCodes) {
    await catalogTile(page, Number(code)).click();
    if ((await zoneCount(page, "main").textContent())?.startsWith("40/")) break;
  }
  await expect(zoneCount(page, "main")).toHaveText("40/40");
  await expectSaveSettled(page, { main: 40, extra: 7, side: 0 });

  await page.goto(libraryUrl);
  await page.getByRole("button", { name: /^Decklist Rows/ }).click();

  const row = page.locator('[data-cy^="deck-select-docked-list-row-"]').first();
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS("border-left-width", "5px");
  await expect(row.locator('[data-cy*="-row-copies-"]')).toHaveCount(1);
  await expect(row.locator('[data-cy*="-row-art-"]')).toHaveCount(1);
});

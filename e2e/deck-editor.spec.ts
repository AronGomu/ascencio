import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_NAME,
} from "../src/decks/deck-database.ts";

const libraryUrl = "./#/decks";
const BLUE_EYES = 89631139;

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
    `[data-cy="deck-zone-drop-area-${zone}"] [data-cy="deck-tile-${code}"]`,
  );
}

/* The catalog and the deck render the same card as the same tile, so every
   tile locator says which of the two it means. */
function catalogTile(page: Page, code: number): Locator {
  return page.locator(
    `[data-cy="deck-catalog-results"] [data-cy="deck-tile-${code}"]`,
  );
}

/* The autosave chip went with the rest of the header chrome; `aria-busy` on
   the editor layout is the only thing the editor still says about a save in
   flight, so waiting for it to drop is what "saved" looks like now. */
async function expectSaveSettled(page: Page) {
  await expect(
    page.locator('[data-cy="deck-editor-layout"]'),
  ).not.toHaveAttribute("aria-busy", "true");
}

test("default route shows the home hub", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator('[data-cy="home-entry-decks"]')).toBeVisible();
  await expect(page.locator('[data-cy="shell-region-decks"]')).toHaveCount(0);
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
  await expectSaveSettled(page);

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
  /* Right click is the remove that the picked-card toolbar used to spell. */
  await zoneTile(page, "main", BLUE_EYES).click({ button: "right" });
  await expect(zoneCount(page, "main")).toHaveText("0/40");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(zoneCount(page, "main")).toHaveText("1/40");
  await expectSaveSettled(page);

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
  const list = page.locator('[data-cy="deck-library-list"]');
  await expect(page.locator('[data-cy="deck-library"]')).toBeVisible();
  await expect(list).not.toContainText("E2E Renamed Copy");
  await expect(page.getByText("E2E Renamed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(list).not.toContainText("E2E Renamed Copy");
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
  expect(deckHash).toMatch(/^#\/decks\/.+/);
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
  /* Anchored, because the row's favourite toggle is named after the deck too. */
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
  await expectSaveSettled(page);

  /* `#/decks` is the library now, so the second context has to deep-link at
     the deck under test rather than rely on a last-opened pointer. */
  const second = await context.newPage();
  await second.goto(`./${new URL(page.url()).hash}`);
  await expect(zoneCount(second, "main")).toHaveText("1/40");

  await page.getByRole("searchbox", { name: "Name" }).fill("Summoned Skull");
  await page
    .locator('[data-cy="deck-catalog-results"]')
    .getByRole("button", { name: /Summoned Skull/ })
    .click();
  await expect(zoneCount(page, "main")).toHaveText("2/40");
  await expectSaveSettled(page);

  await second.getByRole("searchbox", { name: "Name" }).fill("Celtic Guardian");
  await second
    .locator('[data-cy="deck-catalog-results"]')
    .getByRole("button", { name: /Celtic Guardian/ })
    .click();
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
  /* Anchored, because the row's favourite toggle is named after the deck too. */
  const migrated = page.getByRole("button", { name: /^Prototype Survivor/ });
  await expect(migrated).toBeVisible();

  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map(({ name }) => name ?? ""),
  );
  expect(names).toContain(DECK_DATABASE_NAME);
  expect(names).not.toContain(LEGACY_DECK_DATABASE_NAME);

  /* Opening the deck reads its history record too, so this also proves the
     migration copied more than the deck row. */
  await migrated.click();
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
  await expectSaveSettled(page);

  await page.locator('[data-cy="deck-tab-deck"]').click();
  await expect(main).toHaveText("1/40");
  /* The tile itself, not the validation issue that also names the card. */
  const deckTile = page.locator(
    '[data-cy="deck-pane-deck"] [data-cy="deck-tile-89631139"]',
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
  await expectSaveSettled(page);
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

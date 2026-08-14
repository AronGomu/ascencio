import { expect, test, type Page } from "@playwright/test";
import {
  DECK_DATABASE_NAME,
  LEGACY_DECK_DATABASE_NAME,
} from "../src/decks/deck-database.ts";

const libraryUrl = "./#/decks";

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
  const blueEyes = page.getByRole("button", {
    name: /Blue-Eyes White Dragon.*Unlimited/,
  });
  await expect(blueEyes).toBeVisible();
  await blueEyes.click();
  await expect(
    page.getByText(
      "This legendary dragon is a powerful engine of destruction.",
    ),
  ).toBeVisible();
  const mainDropArea = page.getByRole("group", {
    name: "Main Deck drop area",
  });
  await blueEyes.dragTo(mainDropArea);
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");
  await expect(page.getByText("Saved locally")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Deck counts")).toContainText("Main 0");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");

  const mainCard = mainDropArea.getByRole("button", {
    name: /Blue-Eyes White Dragon/,
  });
  await mainCard.focus();
  await mainCard.press("Space");
  await page
    .getByRole("button", { name: "Drop picked card in Side Deck" })
    .click();
  await expect(page.getByLabel("Deck counts")).toContainText("Side 1");
  const sideCard = page
    .getByRole("group", { name: "Side Deck drop area" })
    .getByRole("button", { name: /Blue-Eyes White Dragon/ });
  await sideCard.focus();
  await sideCard.press("Space");
  await page
    .getByRole("button", { name: "Drop picked card in Main Deck" })
    .click();
  await mainCard.focus();
  await mainCard.press("Space");
  await page.getByRole("button", { name: "Remove picked card" }).click();
  await expect(page.getByLabel("Deck counts")).toContainText("Main 0");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");
  await expect(page.getByText("Saved locally")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Control");
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");

  await page.getByRole("button", { name: "Import" }).click();
  await page
    .getByLabel("Or paste YDK text")
    .fill("#main\n99999999\n#extra\n!side\n");
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Replace deck cards" }).click();
  await expect(
    page.getByRole("button", { name: /Missing card 99999999/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid");
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Missing card 99999999/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Deck Library" }).click();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Deck name").fill("E2E Renamed");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Rename", exact: true })
    .click();
  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Renamed");
  await page.getByRole("button", { name: "Deck Library" }).click();
  await page.getByRole("button", { name: "Duplicate" }).first().click();
  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Renamed Copy");
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");
  await expect(
    page.getByRole("button", { name: /Missing card 99999999/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("E2E Renamed Copy");
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");
  await page.getByRole("button", { name: "Deck Library" }).click();
  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Local deck and retained history",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Delete / })
    .click();
  await expect(
    page.getByRole("button", { name: /E2E Renamed Copy/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /E2E Renamed/ })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /E2E Renamed Copy/ }),
  ).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: /Deep Link/ })).toBeVisible();
});

test("Deck Library imports one persisted undoable update", async ({ page }) => {
  await page.goto(libraryUrl);
  await deleteDeckDatabase(page);
  await page.reload();
  await page.getByRole("button", { name: "Import YDK" }).click();
  await page.getByLabel("Deck name").fill("Library Import E2E");
  await page
    .getByLabel("Or paste YDK text")
    .fill("#main\n99999999\n#extra\n!side\n");
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Replace deck cards" }).click();
  await expect(page.getByLabel("Deck name")).toHaveValue("Library Import E2E");
  await expect(
    page.getByRole("button", { name: /Missing card 99999999/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("Library Import E2E");
  await expect(
    page.getByRole("button", { name: /Missing card 99999999/ }),
  ).toBeVisible();
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
  const blueEyes = page.getByRole("button", { name: /Blue-Eyes White Dragon/ });
  await blueEyes.focus();
  await blueEyes.press("Space");
  await page
    .getByRole("button", { name: "Drop picked card in Main Deck" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "simulated transaction failure",
  );
  await page.getByRole("button", { name: "Retry autosave" }).click();
  await expect(page.getByText("Saved locally")).toBeVisible();

  /* `#/decks` is the library now, so the second context has to deep-link at
     the deck under test rather than rely on a last-opened pointer. */
  const second = await context.newPage();
  await second.goto(`./${new URL(page.url()).hash}`);
  await expect(second.getByLabel("Deck counts")).toContainText("Main 1");

  await page.getByRole("searchbox", { name: "Name" }).fill("Dark Magician");
  const darkMagician = page.getByRole("button", { name: /Dark Magician/ });
  await darkMagician.focus();
  await darkMagician.press("Space");
  await page
    .getByRole("button", { name: "Drop picked card in Main Deck" })
    .click();
  await expect(page.getByText("Saved locally")).toBeVisible();

  await second.getByRole("searchbox", { name: "Name" }).fill("Red-Eyes");
  const redEyes = second.getByRole("button", { name: /Red-Eyes Black Dragon/ });
  await redEyes.focus();
  await redEyes.press("Space");
  await second
    .getByRole("button", { name: "Drop picked card in Main Deck" })
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
  await expect(second.getByLabel("Deck counts")).toContainText("Main 2");
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
  const migrated = page.getByRole("button", { name: /Prototype Survivor/ });
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
  await expect(page.getByLabel("Deck counts")).toContainText("Main 1");
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

  /* One pane at a time, and the counts stay on screen in every one of them. */
  const counts = page.getByLabel("Deck counts");
  await expect(counts).toBeVisible();
  await expect(page.locator('[data-cy="deck-pane-deck"]')).toBeVisible();
  await expect(page.locator('[data-cy="deck-pane-catalog"]')).toHaveCount(0);

  await page.locator('[data-cy="deck-tab-catalog"]').click();
  await expect(counts).toBeVisible();
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await page
    .getByRole("button", { name: /Blue-Eyes White Dragon/ })
    .first()
    .click();
  await expect(counts).toContainText("Main 1");
  /* Adding leaves the catalog open, so the next card is one tap away. */
  await expect(page.locator('[data-cy="deck-pane-catalog"]')).toBeVisible();
  await expect(page.getByText("Saved locally")).toBeVisible();

  await page.locator('[data-cy="deck-tab-deck"]').click();
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
  await expect(counts).toContainText("Side 1");
  await expect(counts).toContainText("Main 0");

  await deckTile.click();
  await page.locator('[data-cy="deck-tap-target-remove"]').click();
  await expect(counts).toContainText("Side 0");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(counts).toContainText("Side 1");
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("Portrait Build");
  await expect(counts).toContainText("Side 1");

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
  /* A click above the breakpoint still only selects: no tap menu, no add. */
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  await page.getByRole("button", { name: /Blue-Eyes White Dragon/ }).click();
  await expect(page.locator('[data-cy="deck-tap-menu"]')).toHaveCount(0);
  await expect(page.getByLabel("Deck counts")).toContainText("Main 0");
});

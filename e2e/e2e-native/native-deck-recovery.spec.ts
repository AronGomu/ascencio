import { expect, test } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";

test("a rejected native commit preserves deck edits in a saved copy", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await page.goto("/#/decks");
  await page.locator('[data-cy="deck-select-create"]').click();
  await page.getByLabel("Deck name").fill("Native commit recovery");
  await page.locator('[data-cy="deck-library-create-submit"]').click();
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  const card = page.locator(
    '[data-cy="deck-catalog-results"] [data-cy="catalog-tile-89631139"]',
  );
  await expect(card).toBeVisible();
  const deckId = new URL(page.url()).hash.split("/").at(-1);
  if (!deckId) throw new Error("The editor did not navigate to its saved deck");
  // Autosave history commits precede the deck write; reject the edited deck record.
  const editedRecord = JSON.stringify({
    namespace: "decks",
    key: deckId,
    revision: 2,
  }).slice(0, -1);
  await page.evaluate(
    (fragment) =>
      window.nativeTestControl.failNextUserCommitContaining(fragment),
    editedRecord,
  );
  const deckTab = page.getByRole("tab", { name: "Deck" });
  if ((await deckTab.count()) > 0) await card.click();
  else await card.dblclick();
  await expect(page.locator('[data-cy="deck-editor-conflict"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Preserve local edits as copy" })
    .click();
  const name = page.getByLabel("Deck name");
  await expect(name).toHaveValue("Native commit recovery Recovered Copy");
  if ((await deckTab.count()) > 0) await deckTab.click();
  await expect(page.locator('[data-cy="deck-zone-count-main"]')).toHaveText(
    "1/40",
  );
  await expect(page.locator('[data-cy="deck-editor-conflict"]')).toHaveCount(0);
  await page.reload();
  await expect(name).toHaveValue("Native commit recovery Recovered Copy");
  if ((await deckTab.count()) > 0) await deckTab.click();
  await expect(page.locator('[data-cy="deck-zone-count-main"]')).toHaveText(
    "1/40",
  );
});

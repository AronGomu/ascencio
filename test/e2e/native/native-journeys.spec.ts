import { expect, test } from "@playwright/test";
import { installNativeContentBridge } from "./native-content-bridge.ts";
import { installNativeWorkerCapture } from "./native-worker-capture.ts";

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

function opponentHands(events: readonly unknown[]) {
  return events.flatMap((event) => {
    const message = record(event);
    const state = record(message?.state);
    const players = state?.players;
    if (message?.type !== "state" || !Array.isArray(players)) return [];
    const opponent = record(players[1]);
    if (
      !Array.isArray(opponent?.hand) ||
      typeof opponent.handCount !== "number"
    )
      return [];
    return [{ hand: opponent.hand, handCount: opponent.handCount }];
  });
}

function promptIds(events: readonly unknown[]): string[] {
  return events.flatMap((event) => {
    const message = record(event);
    const prompt = record(message?.prompt);
    return message?.type === "prompt" && typeof prompt?.id === "string"
      ? [prompt.id]
      : [];
  });
}

function responseCount(commands: readonly unknown[], promptId: string): number {
  return commands.filter((command) => {
    const message = record(command);
    return message?.type === "respond" && message.promptId === promptId;
  }).length;
}

test("story progress survives restart and stays usable from the keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installNativeContentBridge(page);
  await page.goto("/");

  const newGame = page.locator('[data-cy="main-menu-new-game"]');
  await expect(newGame).toBeVisible({ timeout: 120_000 });
  await newGame.focus();
  await page.keyboard.press("Enter");

  const dialogue = page.locator('[data-cy="story-narrative-dialogue"]');
  await expect(dialogue).toBeVisible();
  const text = page.locator('[data-cy="story-narrative-text"]');
  const cursor = page.locator('[data-cy="story-narrative-cursor"]');
  await expect(text).toHaveText(
    "Rain turned the last train into a ribbon of silver.",
  );
  await expect(cursor).toHaveText("Beat 1");
  const bounds = await dialogue.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);

  await page.keyboard.press("Enter");
  await expect(text).toHaveText("Rin said midnight. She did not say why.");
  await expect(cursor).toHaveText("Beat 2");

  await page.locator('[data-cy="story-narrative-menu"]').click();
  await page.locator('[data-cy="story-pause-save"]').click();
  await page.locator('[data-cy="story-save-load-save"]').click();
  await expect(page.locator('[data-cy^="shell-toast-toast-"]')).toContainText(
    "Game saved.",
  );

  await page.goto("/");
  await page.reload();
  const loadGame = page.locator('[data-cy="main-menu-load"]');
  await expect(loadGame).toBeVisible({ timeout: 120_000 });
  await loadGame.click();
  await page.getByRole("button", { name: "Load manual slot 1" }).click();
  await expect(dialogue).toBeVisible();
  await expect(text).toHaveText("Rin said midnight. She did not say why.");
  await expect(cursor).toHaveText("Beat 2");
});

test("deck name edits persist through the native user-data bridge", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await page.goto("/#/decks");
  await expect(
    page.getByRole("heading", { name: "Deck Library" }),
  ).toBeVisible();
  await page.locator('[data-cy="deck-select-create"]').click();
  await page.getByLabel("Deck name").fill("Native persistence check");
  await page.locator('[data-cy="deck-library-create-submit"]').click();
  await expect(page.getByLabel("Deck name")).toHaveValue(
    "Native persistence check",
  );
  await page.getByRole("searchbox", { name: "Name" }).fill("Blue-Eyes");
  const blueEyes = page.locator(
    '[data-cy="deck-catalog-results"] [data-cy="catalog-tile-89631139"]',
  );
  await expect(blueEyes).toBeVisible();
  const deckTab = page.getByRole("tab", { name: "Deck" });
  const hasDeckTab = (await deckTab.count()) > 0;
  if (hasDeckTab) {
    await blueEyes.click();
    await deckTab.click();
  } else {
    await blueEyes.dblclick();
  }
  const mainCount = page.locator('[data-cy="deck-zone-count-main"]');
  await expect(mainCount).toHaveText("1/40");

  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue(
    "Native persistence check",
  );
  if (hasDeckTab) await deckTab.click();
  await expect(page.locator('[data-cy="deck-zone-count-main"]')).toHaveText(
    "1/40",
  );
});

test("native Worker events keep hidden hands private and accept one prompt response", async ({
  page,
}) => {
  await installNativeContentBridge(page);
  await installNativeWorkerCapture(page);
  await page.goto("/#/free-play");
  await page.locator('[data-cy="deck-select-start"]').click();

  const field = page.locator('[data-cy="duel-field"][data-prompt-kind]');
  await expect(field).toBeVisible({ timeout: 120_000 });
  await expect(
    page.locator('[data-cy="duel-right-rail-status-title"]', {
      hasText: "Choose a Main Phase action",
    }),
  ).toBeVisible({ timeout: 120_000 });

  const capture = await page.evaluate(() => ({
    workers: window.__nativeWorkerCapture.workers,
    terminations: window.__nativeWorkerCapture.terminations,
    events: window.__nativeWorkerCapture.events,
    commands: window.__nativeWorkerCapture.commands,
    created: window.__nativeWorkerCapture.created,
  }));
  expect(capture.workers - capture.terminations, JSON.stringify(capture)).toBe(
    1,
  );
  const hands = opponentHands(capture.events);
  expect(hands.length).toBeGreaterThan(0);
  for (const opponent of hands) {
    expect(opponent.hand).toEqual([]);
    expect(opponent.handCount).toBeGreaterThan(0);
  }

  const rotationDismiss = page.locator('[data-cy="duel-rotation-dismiss"]');
  if ((await rotationDismiss.count()) > 0) await rotationDismiss.click();

  const promptId = promptIds(capture.events).at(-1);
  if (promptId === undefined) throw new Error("The Worker emitted no prompt");
  const endTurn = page.locator('[data-cy="field-end-turn-button"]');
  await endTurn.click();
  await expect
    .poll(async () => {
      const latest = await page.evaluate(() => ({
        events: window.__nativeWorkerCapture.events,
        commands: window.__nativeWorkerCapture.commands,
      }));
      return responseCount(latest.commands, promptId);
    })
    .toBe(1);
  await expect
    .poll(async () => {
      const events = await page.evaluate(
        () => window.__nativeWorkerCapture.events,
      );
      return promptIds(events).at(-1);
    })
    .not.toBe(promptId);
});

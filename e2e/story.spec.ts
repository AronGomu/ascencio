import { expect, test, type Locator, type Page } from "@playwright/test";

/* The prologue advances one beat per confirm. These two counts are the beats
   before the choice and the beats after it, taken from the flow the deleted
   `prototype-flow` spec proved against the same content. */
const BEATS_BEFORE_CHOICE = 13;
const BEATS_AFTER_CHOICE = 17;

/* The app labels elements with `data-cy`, not Playwright's default
   `data-testid`, so the region is addressed by attribute. */
const STORY_REGION = '[data-cy="shell-region-story"]';

async function openStory(page: Page): Promise<void> {
  await page.goto("./#/story");
  await expect(page.locator(STORY_REGION)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Echoes of the Draw" }),
  ).toBeVisible();
}

async function startNarrative(page: Page): Promise<void> {
  await openStory(page);
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(page.getByText(/Rain turned/)).toBeVisible();
}

async function reachMap(page: Page): Promise<void> {
  await startNarrative(page);
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

test("story plays the prologue through to the updated map", async ({
  page,
}) => {
  await reachMap(page);
  await expect(
    page.getByText(/Earlier choice:.*remembers your trust/),
  ).toBeVisible();
  await page
    .getByLabel("Location list")
    .getByRole("button", { name: /Old Arena/ })
    .click();
  await expect(page.getByRole("heading", { name: "Rin's Echo" })).toBeVisible();
  await page.getByRole("button", { name: "Start Duel" }).click();
  await expect(
    page.getByRole("heading", { name: "Existing duel experience placeholder" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate Player Win" }).click();
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
  await reachMap(page);
  await page
    .getByLabel("Map hotspots")
    .getByRole("button", { name: /Old Arena/ })
    .click();
  await page.getByRole("button", { name: "Start Duel" }).click();
  await page.getByRole("button", { name: "Simulate Player Loss" }).click();
  await expect(
    page.getByRole("heading", { name: "Signal endures" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue story" }).click();
  await expect(
    page.getByRole("heading", { name: "Signal Cipher" }),
  ).toBeVisible();
});

test("an aborted duel recovers without granting a reward", async ({ page }) => {
  await reachMap(page);
  await page
    .getByLabel("Location list")
    .getByRole("button", { name: /Old Arena/ })
    .click();
  await page.getByRole("button", { name: "Start Duel" }).click();
  await page.getByRole("button", { name: "Simulate Abort" }).click();
  await expect(
    page.getByRole("heading", { name: "Duel paused" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry duel" }).click();
  await expect(
    page.getByRole("heading", { name: "Existing duel experience placeholder" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Simulate Abort" }).click();
  await page.getByRole("button", { name: "Return to map" }).click();
  await expect(
    page.getByRole("heading", { name: "City signal map" }),
  ).toBeVisible();
  await expect(page.getByText("Signal Cipher")).toHaveCount(0);
});

test("saved progress survives a reload and reaches the end of the prologue", async ({
  page,
}) => {
  await reachMap(page);
  await page
    .getByLabel("Location list")
    .getByRole("button", { name: /Old Arena/ })
    .click();
  await page.getByRole("button", { name: "Start Duel" }).click();
  await page.getByRole("button", { name: "Simulate Player Win" }).click();
  await page.getByRole("button", { name: "Continue story" }).click();
  await expect(page.getByText(/Autosave complete/)).toBeVisible();
  await page.getByRole("button", { name: "Continue to updated map" }).click();
  await page.getByRole("button", { name: "Save progress" }).click();
  await page.getByRole("button", { name: "Confirm overwrite" }).click();
  await expect(page.getByText(/Save complete/)).toBeVisible();
  await page.getByRole("button", { name: "Close Save and load" }).click();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Echoes of the Draw" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Archive available/)).toBeVisible();
  await page.getByRole("button", { name: "End prototype" }).click();
  await expect(
    page.getByRole("heading", { name: "Prototype complete" }),
  ).toBeVisible();
});

test("manual save and delete only touch the manual slot", async ({ page }) => {
  await startNarrative(page);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  /* New Game already marks progress as existing, so the save overlay opens on
     the overwrite confirmation rather than the empty-slot action. */
  await page.getByRole("button", { name: "Confirm overwrite" }).click();
  await expect(page.getByText(/Save complete/)).toBeVisible();
  await page.getByRole("button", { name: "Close Save and load" }).click();
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

  await page.reload();
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
});

test("every story overlay opens, traps focus, and restores it on close", async ({
  page,
}) => {
  await startNarrative(page);
  for (const [trigger, dialog] of [
    ["History", "Dialogue history"],
    ["Settings", "Settings"],
    ["Save", "Save and load"],
    ["Load", "Load game"],
  ] as const) {
    const control = page.getByRole("button", { name: trigger, exact: true });
    await control.click();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Close ${dialog}` }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: dialog })).toHaveCount(0);
    await expect(control).toBeFocused();
  }

  const pause = page.getByRole("button", { name: "Open pause menu" });
  await pause.click();
  const paused = page.getByRole("dialog", { name: "Paused" });
  await expect(paused).toBeVisible();
  const close = page.getByRole("button", { name: "Close Paused" });
  const last = page.getByRole("button", { name: "Return to Title" });
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

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 375, height: 667 },
  { width: 667, height: 375 },
]) {
  test(`story fits ${viewport.width}x${viewport.height} without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await reachMap(page);
    const overflow = await readOverflow(page);
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
    expect(overflow.regionScrollWidth).toBeLessThanOrEqual(
      overflow.regionClientWidth,
    );
    if (viewport.width > 667) return;
    const targets = page.getByLabel("Location list").getByRole("button");
    for (let index = 0; index < (await targets.count()); index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
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
  await expect(
    page.getByRole("button", { name: "Open pause menu" }),
  ).toBeVisible();
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
  await expect(page.getByRole("button", { name: "New Game" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Rain turned/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Rin's Echo" })).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Start Duel" }),
  );
  await expect(
    page.getByRole("heading", { name: "Existing duel experience placeholder" }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Simulate Player Win" }),
  );
  await expect(
    page.getByRole("heading", { name: "Signal broken" }),
  ).toBeFocused();
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
  await expect(mapHeading).toBeFocused();
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
